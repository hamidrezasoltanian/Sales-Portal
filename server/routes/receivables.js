'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { requirePermission } = require('../permissions');

const router = express.Router();
router.use(requireAuth);

function isManager(role) { return ['مدیر', 'سوپر ادمین'].includes(role); }

// Receivables are part of the established مطالبات (mtr) permission module.
router.get('/', requirePermission('mtr', 'view'), async function (req, res) {
  try {
    const conds = [], params = [];
    if (req.query.status) { params.push(req.query.status); conds.push(`r.status=$${params.length}`); }
    if (!isManager(req.user.role)) { params.push(req.user.username); conds.push(`(r.owner=$${params.length} OR i.created_by=$${params.length})`); }
    const r = await query(`SELECT r.*,i.invoice_no,i.center_name,i.jalali_date,i.status AS invoice_status
      FROM receivables r JOIN invoices i ON i.id=r.invoice_id
      ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
      ORDER BY CASE WHEN r.status='overdue' THEN 0 ELSE 1 END,r.due_date NULLS LAST,r.created_at DESC LIMIT 300`, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/assign', requirePermission('mtr', 'edit'), async function (req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر می‌تواند مسئول وصول را تعیین کند' });
    const owner = String(req.body && req.body.owner || '').trim();
    if (!owner) return res.status(400).json({ error: 'مسئول وصول الزامی است' });
    const r = await query(`UPDATE receivables SET owner=$2,updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id, owner]);
    if (!r.rows.length) return res.status(404).json({ error: 'مطالبه یافت نشد' });
    await query(`UPDATE sales_work_items SET owner=$1,updated_at=NOW() WHERE source_type='receivable' AND source_id=$2 AND status IN ('open','claimed')`, [owner, r.rows[0].invoice_id]).catch(function () {});
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/refresh-overdue', requirePermission('mtr', 'edit'), async function (req, res) {
  try {
    if (!isManager(req.user.role)) return res.status(403).json({ error: 'فقط مدیر' });
    const today = String(req.body && req.body.today || '');
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(today)) return res.status(400).json({ error: 'تاریخ جلالی معتبر الزامی است' });
    const r = await query(`UPDATE receivables SET status='overdue',updated_at=NOW()
      WHERE status IN ('open','partial') AND due_date <> '' AND due_date < $1 RETURNING id`, [today]);
    res.json({ ok: true, overdue: r.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
