'use strict';
const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');
const router = express.Router();
router.use(requireAuth);

const BUYER_TYPES = ['hospital', 'colleague', 'doctor', 'patient'];
const PAY_TYPES   = ['d30', 'd60', 'cash'];

function tierOf(qty) {
  return qty <= 20 ? 0 : qty <= 50 ? 1 : qty <= 100 ? 2 : 3;
}

// ── GET /api/pricing/products ────────────────────────────────────────────────
router.get('/products', async (req, res) => {
  try {
    const r = await query('SELECT * FROM products WHERE active=true ORDER BY sort_order,id');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/pricing/products (manager) ─────────────────────────────────────
router.post('/products', requireManager, async (req, res) => {
  const { name, code, unit, sort_order } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const r = await query(
      `INSERT INTO products (name, code, unit, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, code || '', unit || 'عدد', sort_order || 0]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/pricing/products/:id (manager) ───────────────────────────────────
router.put('/products/:id', requireManager, async (req, res) => {
  const { name, code, unit, sort_order, active } = req.body || {};
  try {
    const r = await query(
      `UPDATE products SET name=COALESCE($1,name), code=COALESCE($2,code),
       unit=COALESCE($3,unit), sort_order=COALESCE($4,sort_order),
       active=COALESCE($5,active) WHERE id=$6 RETURNING *`,
      [name, code, unit, sort_order, active, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/pricing/prices ───────────────────────────────────────────────────
// Returns latest active price list per buyer_type with all items
// ?buyer_type=colleague  — filter by single buyer type
// ?list_id=5             — get specific version
router.get('/prices', async (req, res) => {
  try {
    const { buyer_type, list_id } = req.query;
    let lists;
    if (list_id) {
      lists = await query('SELECT * FROM price_lists WHERE id=$1', [list_id]);
    } else if (buyer_type) {
      lists = await query(
        `SELECT DISTINCT ON (buyer_type) * FROM price_lists
         WHERE buyer_type=$1 AND active=true ORDER BY buyer_type, version DESC`,
        [buyer_type]
      );
    } else {
      // one per buyer_type
      lists = await query(
        `SELECT DISTINCT ON (buyer_type) * FROM price_lists
         WHERE active=true ORDER BY buyer_type, version DESC`
      );
    }

    const result = [];
    for (const pl of lists.rows) {
      const items = await query(
        `SELECT pli.*, p.name as product_name, p.unit, p.sort_order
         FROM price_list_items pli
         JOIN products p ON p.id = pli.product_id
         WHERE pli.price_list_id = $1
         ORDER BY p.sort_order, p.id, pli.qty_tier, pli.pay_type`,
        [pl.id]
      );
      result.push({ ...pl, items: items.rows });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/pricing/prices/history ──────────────────────────────────────────
router.get('/prices/history', async (req, res) => {
  try {
    const r = await query(
      `SELECT pl.*, COUNT(pli.id) as item_count
       FROM price_lists pl LEFT JOIN price_list_items pli ON pli.price_list_id=pl.id
       GROUP BY pl.id ORDER BY pl.created_at DESC`
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/pricing/prices/import (manager) ─────────────────────────────────
// body: { buyer_type, name, notes, items: [{product_id, prices: [[d30,d60,cash]×4tiers]}] }
router.post('/prices/import', requireManager, async (req, res) => {
  const { buyer_type, name, notes, items, commissions } = req.body || {};
  if (!buyer_type || !BUYER_TYPES.includes(buyer_type))
    return res.status(400).json({ error: 'buyer_type invalid' });
  if (!items || !items.length)
    return res.status(400).json({ error: 'items required' });
  try {
    // bump version
    const vr = await query(
      `SELECT COALESCE(MAX(version),0)+1 as v FROM price_lists WHERE buyer_type=$1`,
      [buyer_type]
    );
    const version = vr.rows[0].v;
    // deactivate old
    await query(`UPDATE price_lists SET active=false WHERE buyer_type=$1`, [buyer_type]);
    // create new list
    const pl = await query(
      `INSERT INTO price_lists (version, name, buyer_type, notes, created_by, effective_from)
       VALUES ($1,$2,$3,$4,$5,NOW()::DATE) RETURNING id`,
      [version, name || `لیست ${buyer_type} v${version}`, buyer_type, notes || '', req.user.username]
    );
    const listId = pl.rows[0].id;
    // insert items
    for (const it of items) {
      const tiers = it.prices || it.p || [];
      for (let tier = 0; tier < 4; tier++) {
        const row = tiers[tier] || [];
        for (let pi = 0; pi < 3; pi++) {
          const pt = PAY_TYPES[pi];
          const price = parseInt(row[pi]) || 0;
          if (price > 0) {
            await query(
              `INSERT INTO price_list_items (price_list_id, product_id, qty_tier, pay_type, price, base_price)
               VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
              [listId, it.product_id, tier, pt, price, it.base_price || price]
            );
          }
        }
      }
    }
    // insert commission rules if provided
    if (commissions && commissions.length) {
      for (const c of commissions) {
        for (let lvl = 1; lvl <= 3; lvl++) {
          if (c[`level${lvl}`]) {
            await query(
              `INSERT INTO commission_rules (product_id, price_list_id, level, amount, label)
               VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
              [c.product_id, listId, lvl, c[`level${lvl}`], c[`label${lvl}`] || `سطح ${lvl}`]
            );
          }
        }
      }
    }
    res.json({ ok: true, list_id: listId, version });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/pricing/calc ─────────────────────────────────────────────────────
// ?product_id=1&qty=25&center_key=center_123&pay_type=d30
// Derives buyer_type from center config; falls back to 'hospital'
router.get('/calc', async (req, res) => {
  const { product_id, qty: qtyStr, center_key, pay_type = 'd30', buyer_type: bt_override } = req.query;
  if (!product_id) return res.status(400).json({ error: 'product_id required' });
  const qty  = parseInt(qtyStr) || 1;
  const tier = tierOf(qty);
  try {
    // 1. Get center config (buyer_type, commission_level, discount)
    let buyer_type = bt_override || 'hospital';
    let commission_level = null;
    let discount_pct = 0;
    let discount_ceiling_pct = 5;

    if (center_key) {
      const cc = await query(
        'SELECT * FROM center_pricing_config WHERE center_key=$1', [center_key]
      );
      if (cc.rows.length) {
        buyer_type = bt_override || cc.rows[0].buyer_type || 'hospital';
        commission_level = cc.rows[0].commission_level;
        discount_pct = parseFloat(cc.rows[0].discount_pct) || 0;
        discount_ceiling_pct = parseFloat(cc.rows[0].discount_ceiling_pct) || 5;
      }
    }

    // 2. Get price from latest active list for buyer_type
    const pr = await query(
      `SELECT pli.price, pli.base_price, pli.price_list_id
       FROM price_list_items pli
       JOIN price_lists pl ON pl.id = pli.price_list_id
       WHERE pl.buyer_type=$1 AND pl.active=true
         AND pli.product_id=$2 AND pli.qty_tier=$3 AND pli.pay_type=$4
       ORDER BY pl.version DESC LIMIT 1`,
      [buyer_type, product_id, tier, pay_type]
    );
    if (!pr.rows.length) return res.json({ error: 'no_price', buyer_type, tier });

    const base_price = parseInt(pr.rows[0].price);
    const list_id    = pr.rows[0].price_list_id;

    // 3. Get commission if applicable
    let commission = 0;
    if (commission_level) {
      const cr = await query(
        `SELECT amount FROM commission_rules WHERE product_id=$1 AND price_list_id=$2 AND level=$3`,
        [product_id, list_id, commission_level]
      );
      if (cr.rows.length) commission = parseInt(cr.rows[0].amount) || 0;
    }

    // 4. Calculate prices
    // inflated = base + commission (the center pays this higher price; we pay the commission separately)
    const inflated = base_price + commission;
    // discount applied on inflated price
    const discount_amount = Math.round(inflated * discount_pct / 100);
    const suggested_price = inflated - discount_amount;
    // needs approval if total discount% > ceiling
    const total_disc_pct = ((base_price - suggested_price) / base_price) * 100;
    const needs_approval = total_disc_pct > discount_ceiling_pct;

    res.json({
      product_id: parseInt(product_id),
      qty, tier, buyer_type, pay_type,
      base_price,
      commission,
      commission_level,
      discount_pct,
      discount_amount,
      inflated_price: inflated,
      suggested_price,
      unit_total: suggested_price * qty,
      needs_approval,
      discount_ceiling_pct
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/pricing/center/:key ──────────────────────────────────────────────
router.get('/center/:key', async (req, res) => {
  try {
    const r = await query(
      'SELECT * FROM center_pricing_config WHERE center_key=$1',
      [decodeURIComponent(req.params.key)]
    );
    res.json(r.rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/pricing/center/:key (manager) ────────────────────────────────────
router.put('/center/:key', requireManager, async (req, res) => {
  const center_key = decodeURIComponent(req.params.key);
  const { center_name, buyer_type, commission_level, discount_pct, discount_ceiling_pct, notes } = req.body || {};
  if (buyer_type && !BUYER_TYPES.includes(buyer_type))
    return res.status(400).json({ error: 'buyer_type invalid' });
  try {
    await query(
      `INSERT INTO center_pricing_config
         (center_key, center_name, buyer_type, commission_level, discount_pct, discount_ceiling_pct, notes, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (center_key) DO UPDATE SET
         center_name=EXCLUDED.center_name,
         buyer_type=EXCLUDED.buyer_type,
         commission_level=EXCLUDED.commission_level,
         discount_pct=EXCLUDED.discount_pct,
         discount_ceiling_pct=EXCLUDED.discount_ceiling_pct,
         notes=EXCLUDED.notes,
         updated_by=EXCLUDED.updated_by,
         updated_at=NOW()`,
      [center_key, center_name||'', buyer_type||'hospital',
       commission_level||null, discount_pct||0, discount_ceiling_pct||5,
       notes||'', req.user.username]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/pricing/quotes ──────────────────────────────────────────────────
router.post('/quotes', async (req, res) => {
  const { center_key, center_name, buyer_type, pay_type, jalali_date, items } = req.body || {};
  if (!items || !items.length) return res.status(400).json({ error: 'items required' });
  try {
    // generate quote number QT-YYYYMM-seq
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
    const seqR = await query(
      `SELECT COUNT(*)+1 as seq FROM price_quotes WHERE quote_number LIKE $1`,
      [`QT-${ym}-%`]
    );
    const quote_number = `QT-${ym}-${String(seqR.rows[0].seq).padStart(3,'0')}`;

    let total_base=0, total_final=0, total_commission=0, total_discount=0;
    items.forEach(it => {
      total_base       += (it.unit_base_price||0) * (it.qty||1);
      total_final      += (it.unit_final_price||it.unit_suggested_price||0) * (it.qty||1);
      total_commission += (it.unit_commission||0) * (it.qty||1);
      total_discount   += (it.unit_discount||0) * (it.qty||1);
    });

    const needs_approval = items.some(it => it.needs_approval);

    const q = await query(
      `INSERT INTO price_quotes
         (quote_number, center_key, center_name, buyer_type, pay_type, created_by,
          status, total_base, total_final, total_commission, total_discount, jalali_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [quote_number, center_key||'', center_name||'', buyer_type||'hospital',
       pay_type||'d30', req.user.username,
       needs_approval ? 'pending' : 'draft',
       total_base, total_final, total_commission, total_discount, jalali_date||'']
    );
    const qid = q.rows[0].id;

    for (const it of items) {
      const line_total = (it.unit_final_price||it.unit_suggested_price||0) * (it.qty||1);
      await query(
        `INSERT INTO price_quote_items
           (quote_id, product_id, product_name, qty, qty_tier, unit_base_price,
            unit_suggested_price, unit_final_price, unit_commission, unit_discount, line_total, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [qid, it.product_id||null, it.product_name||'', it.qty||1,
         it.qty_tier||0, it.unit_base_price||0, it.unit_suggested_price||0,
         it.unit_final_price||it.unit_suggested_price||0,
         it.unit_commission||0, it.unit_discount||0, line_total, it.notes||'']
      );
    }
    res.json({ ok: true, id: qid, quote_number, status: needs_approval ? 'pending' : 'draft' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/pricing/quotes ───────────────────────────────────────────────────
router.get('/quotes', async (req, res) => {
  const { status, center_key, limit = 50 } = req.query;
  try {
    let sql = 'SELECT * FROM price_quotes WHERE 1=1';
    const params = [];
    if (!req.user.role || (req.user.role !== 'مدیر' && req.user.role !== 'سوپر ادمین')) {
      sql += ` AND created_by=$${params.length+1}`; params.push(req.user.username);
    }
    if (status) { sql += ` AND status=$${params.length+1}`; params.push(status); }
    if (center_key) { sql += ` AND center_key=$${params.length+1}`; params.push(center_key); }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length+1}`; params.push(parseInt(limit));
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/pricing/quotes/:id ───────────────────────────────────────────────
router.get('/quotes/:id', async (req, res) => {
  try {
    const q  = await query('SELECT * FROM price_quotes WHERE id=$1', [req.params.id]);
    if (!q.rows.length) return res.status(404).json({ error: 'not found' });
    const qi = await query('SELECT * FROM price_quote_items WHERE quote_id=$1 ORDER BY id', [req.params.id]);
    res.json({ ...q.rows[0], items: qi.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/pricing/quotes/:id/submit ────────────────────────────────────────
router.put('/quotes/:id/submit', async (req, res) => {
  try {
    await query(
      `UPDATE price_quotes SET status='pending', updated_at=NOW() WHERE id=$1 AND created_by=$2`,
      [req.params.id, req.user.username]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/pricing/quotes/:id/approve (manager) ─────────────────────────────
// body: { manager_notes, items: [{id, unit_final_price}] }  — items optional override
router.put('/quotes/:id/approve', requireManager, async (req, res) => {
  const { manager_notes, items } = req.body || {};
  try {
    if (items && items.length) {
      for (const it of items) {
        const lt_r = await query('SELECT qty FROM price_quote_items WHERE id=$1', [it.id]);
        if (!lt_r.rows.length) continue;
        const qty = lt_r.rows[0].qty;
        await query(
          `UPDATE price_quote_items SET unit_final_price=$1, line_total=$2 WHERE id=$3`,
          [it.unit_final_price, it.unit_final_price * qty, it.id]
        );
      }
      // recalc total
      const totR = await query(
        'SELECT SUM(line_total) as t FROM price_quote_items WHERE quote_id=$1', [req.params.id]
      );
      await query(
        `UPDATE price_quotes SET total_final=$1, status='approved',
         manager_notes=$2, approved_by=$3, approved_at=NOW(), updated_at=NOW() WHERE id=$4`,
        [totR.rows[0].t || 0, manager_notes||'', req.user.username, req.params.id]
      );
    } else {
      await query(
        `UPDATE price_quotes SET status='approved', manager_notes=$1,
         approved_by=$2, approved_at=NOW(), updated_at=NOW() WHERE id=$3`,
        [manager_notes||'', req.user.username, req.params.id]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/pricing/quotes/:id/reject (manager) ──────────────────────────────
router.put('/quotes/:id/reject', requireManager, async (req, res) => {
  const { manager_notes } = req.body || {};
  try {
    await query(
      `UPDATE price_quotes SET status='rejected', manager_notes=$1,
       approved_by=$2, approved_at=NOW(), updated_at=NOW() WHERE id=$3`,
      [manager_notes||'', req.user.username, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/pricing/quotes/:id/print ─────────────────────────────────────────
router.get('/quotes/:id/print', async (req, res) => {
  try {
    const q  = await query('SELECT * FROM price_quotes WHERE id=$1', [req.params.id]);
    if (!q.rows.length) return res.status(404).send('not found');
    const qi = await query('SELECT * FROM price_quote_items WHERE quote_id=$1 ORDER BY id', [req.params.id]);
    const quote = q.rows[0]; const items = qi.rows;
    const BUYER_FA = { hospital:'مرکز درمانی', colleague:'همکار', doctor:'پزشک', patient:'بیمار' };
    const PAY_FA   = { d30:'تسویه ۳۰ روزه', d60:'تسویه ۶۰ روزه', cash:'نقدی' };
    const fmt = n => n ? Number(n).toLocaleString() : '—';

    const rows = items.map((it,i) => `
      <tr>
        <td style="text-align:center">${i+1}</td>
        <td>${it.product_name||''}</td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:left;direction:ltr">${fmt(it.unit_final_price)}</td>
        <td style="text-align:left;direction:ltr;font-weight:800">${fmt(it.line_total)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8">
<title>پیشنهاد قیمت ${quote.quote_number}</title>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;800&display=swap" rel="stylesheet">
<style>
body{font-family:'Vazirmatn',Tahoma,sans-serif;padding:24px;direction:rtl;color:#1a2e48;background:#fff}
.hdr{background:linear-gradient(135deg,#003875,#0060B8);color:#fff;padding:20px 28px;border-radius:10px;margin-bottom:20px}
.hdr h1{font-size:22px;font-weight:800}.hdr p{font-size:12px;opacity:.8;margin-top:4px}
.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px}
.meta-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px}
.meta-label{font-size:10px;color:#64748b;margin-bottom:3px}
.meta-val{font-size:14px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#003875;color:#fff;padding:10px 12px;text-align:right;font-size:12px}
td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}
tr:hover td{background:#f8fafc}
.total{background:#003875;color:#fff;border-radius:8px;padding:14px 20px;text-align:center}
.total .lbl{font-size:12px;opacity:.7}
.total .val{font-size:28px;font-weight:900;margin-top:4px}
.status-${quote.status}{display:inline-block;padding:4px 14px;border-radius:10px;font-size:12px;font-weight:700;
  ${quote.status==='approved'?'background:#dcfce7;color:#166534':
    quote.status==='pending'?'background:#fef3c7;color:#92400e':
    'background:#f1f5f9;color:#475569'}}
@media print{body{padding:8px}}
</style></head><body>
<div class="hdr">
  <h1>🏷 پیشنهاد قیمت — آتنا زیست درمان</h1>
  <p>شماره: ${quote.quote_number} &nbsp;|&nbsp; تاریخ: ${quote.jalali_date||new Date().toLocaleDateString('fa-IR')}</p>
</div>
<div class="meta">
  <div class="meta-item"><div class="meta-label">مرکز / خریدار</div><div class="meta-val">${quote.center_name||'—'}</div></div>
  <div class="meta-item"><div class="meta-label">نوع خریدار</div><div class="meta-val">${BUYER_FA[quote.buyer_type]||quote.buyer_type}</div></div>
  <div class="meta-item"><div class="meta-label">نوع تسویه</div><div class="meta-val">${PAY_FA[quote.pay_type]||quote.pay_type}</div></div>
  <div class="meta-item"><div class="meta-label">وضعیت</div><div class="meta-val"><span class="status-${quote.status}">${
    quote.status==='approved'?'✅ تأیید شده':quote.status==='pending'?'⏳ در انتظار تأیید':
    quote.status==='rejected'?'❌ رد شده':'پیش‌نویس'}</span></div></div>
  <div class="meta-item"><div class="meta-label">تهیه‌کننده</div><div class="meta-val">${quote.created_by||'—'}</div></div>
  ${quote.approved_by?`<div class="meta-item"><div class="meta-label">تأیید‌کننده</div><div class="meta-val">${quote.approved_by}</div></div>`:''}
</div>
<table><thead><tr><th>#</th><th>محصول</th><th style="text-align:center">تعداد</th><th>قیمت واحد (ریال)</th><th>جمع (ریال)</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="total"><div class="lbl">جمع کل سفارش</div><div class="val">${fmt(quote.total_final)} ریال</div></div>
${quote.manager_notes?`<p style="margin-top:16px;font-size:12px;color:#64748b">📝 یادداشت مدیر: ${quote.manager_notes}</p>`:''}
</body></html>`;
    res.send(html);
  } catch (e) { res.status(500).send(e.message); }
});

module.exports = router;
