'use strict';

const express = require('express');
const multer  = require('multer');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // سقف ۱۵ مگابایت برای ضمایم
});

// تبدیل تاریخ میلادی به سال شمسی
function toJalaliYear() {
  const now = new Date();
  const gy = now.getFullYear();
  const gm = now.getMonth() + 1;
  const gd = now.getDate();

  let jy = gy - 1600;
  let gd2 = gd;
  let gm2 = gm;
  let gy2 = gy - 1600;

  const gMonthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let g_day_no = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gMonthDays[gm2 - 1] + gd2 - 1;
  if (gm2 > 2) {
    if ((gy % 4 == 0 && gy % 100 != 0) || gy % 400 == 0) g_day_no++;
  }

  let j_day_no = g_day_no - 79;
  let j_np = Math.floor(j_day_no / 12053);
  j_day_no %= 12053;

  let jY = 979 + 33 * j_np + 4 * Math.floor(j_day_no / 1461);
  j_day_no %= 1461;

  if (j_day_no >= 366) {
    jY += Math.floor((j_day_no - 1) / 365);
    j_day_no = (j_day_no - 1) % 365;
  }

  return jY;
}

// تولید خودکار شماره اندیکاتور بر اساس سال مالی، پیشوند دپارتمان و نوع نامه
async function generateIndicatorNumber(type, departmentPrefix) {
  const basePrefix = departmentPrefix || 'الف';
  const typeLetter = type === 'outgoing' ? 'ص' : (type === 'internal' ? 'د' : 'و');
  const fullPrefix = `${basePrefix}/${typeLetter}`;

  const now = new Date();
  const jalaliYear = toJalaliYear();
  
  // دریافت شماره ماه شمسی
  let jm = '01';
  try {
    const faDateParts = now.toLocaleDateString('fa-IR-u-nu-latn').split('/');
    if (faDateParts.length >= 2) {
      jm = faDateParts[1].padStart(2, '0');
    }
  } catch (err) {
    jm = String(now.getMonth() + 1).padStart(2, '0');
  }

  const datePart = String(jalaliYear).substring(1, 4) + jm; // e.g. 40503 for 1405/03

  const indRes = await query(
    `SELECT id, last_sequence FROM letter_indicators WHERE department_prefix = $1 AND letter_type = $2 LIMIT 1`,
    [basePrefix, type]
  );

  let nextSeq = 1;
  if (indRes.rows.length > 0) {
    nextSeq = parseInt(indRes.rows[0].last_sequence) + 1;
    await query(
      `UPDATE letter_indicators SET last_sequence = $1 WHERE id = $2`,
      [nextSeq, indRes.rows[0].id]
    );
  } else {
    const maxRes = await query(
      `SELECT indicator_number FROM letters WHERE type = $1 AND department_prefix = $2 AND indicator_number IS NOT NULL`,
      [type, basePrefix]
    );
    let maxSeq = 0;
    for (const row of maxRes.rows) {
      if (row.indicator_number) {
        const parts = row.indicator_number.split('-');
        if (parts.length >= 2) {
          const seq = parseInt(parts[1]);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }
    nextSeq = maxSeq + 1;
    await query(
      `INSERT INTO letter_indicators (fiscal_year_id, department_prefix, letter_type, last_sequence) VALUES (1, $1, $2, $3)`,
      [basePrefix, type, nextSeq]
    );
  }

  const seqPart = String(nextSeq).padStart(3, '0');
  return `${fullPrefix}-${seqPart}-${datePart}`;
}

// ─────────────────────────────────────────────
// GET / — دریافت لیست نامه‌ها بر اساس تب و فیلترها
// ─────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const username = req.user.username;
  const role = req.user.role;
  const isAdmin = (role === 'مدیر' || role === 'سوپر ادمین');
  const { tab, search, subject, indicatorNumber, senderExternalName, dateFrom, dateTo } = req.query;

  try {
    let whereClause = '';
    let queryParams = [];

    // فیلتر پایه‌ای بر اساس حذف یا بایگانی
    if (tab === 'trash') {
      whereClause = 'l.is_deleted = TRUE';
    } else if (tab === 'archived') {
      whereClause = 'l.is_archived = TRUE AND l.is_deleted = FALSE';
    } else {
      whereClause = 'l.is_deleted = FALSE AND l.is_archived = FALSE';
    }

    // فیلتر تب‌ها
    if (tab === 'pending') {
      whereClause += ` AND (
        (l.type IN ('internal', 'incoming') AND l.status IN ('pending_action', 'registered', 'in_referral'))
        OR
        (l.type = 'outgoing' AND l.status IN ('pending_action', 'in_referral', 'approved_for_sign'))
      )`;
      if (!isAdmin) {
        queryParams.push(username);
        whereClause += ` AND (l.created_by = $${queryParams.length} OR EXISTS(
          SELECT 1 FROM letter_referrals r2 
          WHERE r2.letter_id = l.id AND r2.receiver_id = $${queryParams.length} AND r2.is_completed = FALSE
        ))`;
      }
    } else if (tab === 'sign_desk') {
      whereClause += ` AND l.status NOT IN ('draft', 'terminated') AND EXISTS(
        SELECT 1 FROM letter_signers ls 
        WHERE ls.letter_id = l.id AND ls.user_id = $${queryParams.length + 1} AND ls.status IN ('accepted', 'signed')
      )`;
      queryParams.push(username);
    } else if (tab === 'incoming') {
      whereClause += ` AND l.type = 'incoming' AND l.status = 'registered'`;
      if (!isAdmin) {
        queryParams.push(username);
        whereClause += ` AND (l.created_by = $${queryParams.length} OR EXISTS(
          SELECT 1 FROM letter_receivers lr WHERE lr.letter_id = l.id AND lr.receiver_type = 'user' AND lr.receiver_id = $${queryParams.length}
        ) OR EXISTS(
          SELECT 1 FROM letter_referrals r2 WHERE r2.letter_id = l.id AND (r2.receiver_id = $${queryParams.length} OR r2.sender_id = $${queryParams.length})
        ))`;
      }
    } else if (tab === 'outgoing') {
      whereClause += ` AND l.type = 'outgoing' AND l.status = 'registered'`;
      if (!isAdmin) {
        queryParams.push(username);
        whereClause += ` AND (l.created_by = $${queryParams.length} OR EXISTS(
          SELECT 1 FROM letter_signers ls WHERE ls.letter_id = l.id AND ls.user_id = $${queryParams.length}
        ))`;
      }
    } else if (tab === 'internal') {
      whereClause += ` AND l.type = 'internal' AND l.status = 'registered'`;
      if (!isAdmin) {
        queryParams.push(username);
        whereClause += ` AND (l.created_by = $${queryParams.length} OR EXISTS(
          SELECT 1 FROM letter_receivers lr WHERE lr.letter_id = l.id AND lr.receiver_type = 'user' AND lr.receiver_id = $${queryParams.length}
        ) OR EXISTS(
          SELECT 1 FROM letter_referrals r2 WHERE r2.letter_id = l.id AND (r2.receiver_id = $${queryParams.length} OR r2.sender_id = $${queryParams.length})
        ))`;
      }
    } else if (tab === 'drafts') {
      whereClause += ` AND l.status = 'draft'`;
      if (!isAdmin) {
        queryParams.push(username);
        whereClause += ` AND l.created_by = $${queryParams.length}`;
      }
    }

    // فیلترهای فیلدها
    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND (l.subject ILIKE $${queryParams.length} OR l.body ILIKE $${queryParams.length} OR l.indicator_number ILIKE $${queryParams.length})`;
    }
    if (subject) {
      queryParams.push(`%${subject}%`);
      whereClause += ` AND l.subject ILIKE $${queryParams.length}`;
    }
    if (indicatorNumber) {
      queryParams.push(`%${indicatorNumber}%`);
      whereClause += ` AND l.indicator_number ILIKE $${queryParams.length}`;
    }
    if (senderExternalName) {
      queryParams.push(`%${senderExternalName}%`);
      whereClause += ` AND l.sender_external ILIKE $${queryParams.length}`;
    }
    if (dateFrom) {
      queryParams.push(dateFrom);
      whereClause += ` AND l.created_at >= $${queryParams.length}`;
    }
    if (dateTo) {
      queryParams.push(dateTo);
      whereClause += ` AND l.created_at <= $${queryParams.length}`;
    }

    queryParams.push(username);
    const myUserParamIndex = queryParams.length;

    const queryStr = `
      SELECT l.*, 
             u.display_name as creator_name,
             (SELECT COUNT(*) FROM letter_signers WHERE letter_id = l.id) as total_signers,
             (SELECT COUNT(*) FROM letter_signers WHERE letter_id = l.id AND status = 'signed') as completed_signers,
             (SELECT status FROM letter_signers WHERE letter_id = l.id AND user_id = $${myUserParamIndex}) as my_signer_status,
             (SELECT sign_type FROM letter_signers WHERE letter_id = l.id AND user_id = $${myUserParamIndex}) as my_signer_type,
             (SELECT COUNT(id) FROM letter_referrals r WHERE r.letter_id = l.id AND (r.receiver_id = $${myUserParamIndex} OR r.sender_id = $${myUserParamIndex})) as involved_ref_count,
             (SELECT json_agg(json_build_object('username', us.username, 'display_name', us.display_name, 'status', ls.status)) FROM letter_signers ls JOIN app_users us ON ls.user_id = us.username WHERE ls.letter_id = l.id) as signers,
             (SELECT json_agg(json_build_object('receiver_id', lr.receiver_id, 'receiver_type', lr.receiver_type, 'name', COALESCE(usr.display_name, cust.company_name))) FROM letter_receivers lr LEFT JOIN app_users usr ON lr.receiver_type = 'user' AND lr.receiver_id = usr.username LEFT JOIN sync_customers cust ON lr.receiver_type = 'external' AND lr.receiver_id = cust.company_num::text WHERE lr.letter_id = l.id) as receivers
      FROM letters l
      LEFT JOIN app_users u ON l.created_by = u.username
      WHERE ${whereClause}
      ORDER BY l.created_at DESC
    `;

    const lettersResult = await query(queryStr, queryParams);

    // واکشی تمام ارجاعات مرتبط با کاربر
    const referralsResult = await query(`
      SELECT r.*,
             su.display_name as sender_name, rv.display_name as receiver_name
      FROM letter_referrals r
      LEFT JOIN app_users su ON r.sender_id = su.username
      LEFT JOIN app_users rv ON r.receiver_id = rv.username
      WHERE r.sender_id = $1 OR r.receiver_id = $1
      ORDER BY r.referred_at ASC
    `, [username]);

    res.json({
      letters: lettersResult.rows,
      referrals: referralsResult.rows,
    });
  } catch (e) {
    console.error('[letters GET /]', e);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// GET /users — دریافت لیست کاربران جهت گیرنده/امضا کننده
// ─────────────────────────────────────────────
router.get('/users', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT username, display_name, role FROM app_users WHERE active = true ORDER BY display_name ASC');
    res.json({ users: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// GET /customers — دریافت لیست مشتریان
// ─────────────────────────────────────────────
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT company_num::text AS id, company_name, company_code FROM sync_customers ORDER BY company_name ASC');
    res.json({ customers: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// GET /templates — قالب‌های متنی
// ─────────────────────────────────────────────
router.get('/templates', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT id, title, content FROM letter_templates WHERE created_by = $1 ORDER BY title ASC', [req.user.username]);
    res.json({ templates: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /templates — ثبت قالب جدید
// ─────────────────────────────────────────────
router.post('/templates', requireAuth, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'عنوان و محتوا الزامی است' });
  try {
    const r = await query('INSERT INTO letter_templates (title, content, created_by) VALUES ($1, $2, $3) RETURNING *', [title, content, req.user.username]);
    res.json({ ok: true, template: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// DELETE /templates/:id — حذف قالب
// ─────────────────────────────────────────────
router.delete('/templates/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await query('DELETE FROM letter_templates WHERE id = $1 AND created_by = $2', [id, req.user.username]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST / — ثبت نامه جدید
// ─────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { type, subject, body, priority, classification, department_prefix, sender_external, receiver_external, receivers, signers, status } = req.body;

  if (!type || !subject) {
    return res.status(400).json({ error: 'نوع نامه و موضوع الزامی است' });
  }

  try {
    await query('BEGIN');

    let finalStatus = status || 'draft';
    let indicator = null;
    let registeredAt = null;

    if (finalStatus === 'pending') {
      if (type === 'incoming' || type === 'internal') {
        finalStatus = 'registered';
        indicator = await generateIndicatorNumber(type, department_prefix);
        registeredAt = new Date();
      } else {
        finalStatus = 'pending_action';
      }
    }

    const lRes = await query(`
      INSERT INTO letters (type, subject, body, priority, classification, department_prefix, status, indicator_number, registered_at, sender_external, receiver_external, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      type, subject, body || '', priority || 'normal', classification || 'normal', department_prefix || 'الف',
      finalStatus, indicator, registeredAt, sender_external || '', receiver_external || '', req.user.username
    ]);

    const letterId = lRes.rows[0].id;

    // ثبت گیرندگان
    if (receivers && receivers.length > 0) {
      for (const rec of receivers) {
        const recType = (type === 'outgoing') ? 'external' : 'user';
        await query('INSERT INTO letter_receivers (letter_id, receiver_type, receiver_id) VALUES ($1, $2, $3)', [letterId, recType, String(rec)]);
      }
    }

    // ثبت امضاکنندگان (فقط برای نامه‌های صادره)
    if (type === 'outgoing' && signers && signers.length > 0) {
      for (const sig of signers) {
        await query('INSERT INTO letter_signers (letter_id, user_id, status) VALUES ($1, $2, \'pending\')', [letterId, String(sig)]);
      }
    }

    // ارجاع خودکار برای نامه‌های وارده و داخلی پس از ثبت نهایی
    if (finalStatus === 'registered' && (type === 'incoming' || type === 'internal') && receivers && receivers.length > 0) {
      for (const rec of receivers) {
        await query(`
          INSERT INTO letter_referrals (letter_id, sender_id, receiver_id, action_type, note, is_completed)
          VALUES ($1, $2, $3, 'for_action', 'ارجاع خودکار سیستمی پس از صدور شماره', FALSE)
        `, [letterId, req.user.username, String(rec)]);

        // ایجاد نوتیفیکیشن
        const notifId = `referral_${Date.now()}_${letterId}_${rec}`;
        const senderName = req.user.display_name || req.user.username;
        await query(`
          INSERT INTO notifications (id, to_user, msg, at, read)
          VALUES ($1, $2, $3, NOW(), FALSE)
        `, [notifId, String(rec), `📨 نامه‌ای با موضوع «${subject}» و شماره اندیکاتور ${indicator} از طرف ${senderName} به کارتابل شما ارجاع شد.`]).catch(()=>{});
      }
    }

    // لاگ سیستم
    await query(`
      INSERT INTO change_log (at, by, rkey, field, val)
      VALUES (NOW(), $1, $2, 'letters', $3)
    `, [req.user.username, `letter_${letterId}`, JSON.stringify({ action: 'create', type, subject, indicator })]).catch(() => {});

    await query('COMMIT');
    res.status(201).json({ ok: true, letter: lRes.rows[0] });
  } catch (e) {
    await query('ROLLBACK');
    console.error('[letters POST /]', e.message);
    res.status(500).json({ error: e.message || 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// PUT /:id — ویرایش نامه
// ─────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  const { type, subject, body, priority, classification, department_prefix, sender_external, receiver_external, receivers, signers, status } = req.body;

  try {
    const check = await query('SELECT * FROM letters WHERE id = $1', [letterId]);
    if (!check.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });
    const letter = check.rows[0];

    if (letter.created_by !== req.user.username && req.user.role !== 'مدیر' && req.user.role !== 'سوپر ادمین') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    await query('BEGIN');

    let finalStatus = status || letter.status;
    let indicator = letter.indicator_number;
    let registeredAt = letter.registered_at;

    if (letter.status === 'draft' && finalStatus === 'pending') {
      if (letter.type === 'incoming' || letter.type === 'internal') {
        finalStatus = 'registered';
        indicator = await generateIndicatorNumber(letter.type, department_prefix || letter.department_prefix);
        registeredAt = new Date();
      } else {
        finalStatus = 'pending_action';
      }
    }

    const updRes = await query(`
      UPDATE letters
      SET type = $1, subject = $2, body = $3, priority = $4, classification = $5,
          department_prefix = $6, status = $7, indicator_number = $8, registered_at = $9,
          sender_external = $10, receiver_external = $11, updated_at = NOW()
      WHERE id = $12
      RETURNING *
    `, [
      type || letter.type,
      subject || letter.subject,
      body || letter.body,
      priority || letter.priority,
      classification || letter.classification,
      department_prefix || letter.department_prefix,
      finalStatus,
      indicator,
      registeredAt,
      sender_external !== undefined ? sender_external : letter.sender_external,
      receiver_external !== undefined ? receiver_external : letter.receiver_external,
      letterId
    ]);

    // بروزرسانی گیرندگان
    if (receivers) {
      await query('DELETE FROM letter_receivers WHERE letter_id = $1', [letterId]);
      for (const rec of receivers) {
        const recType = ((type || letter.type) === 'outgoing') ? 'external' : 'user';
        await query('INSERT INTO letter_receivers (letter_id, receiver_type, receiver_id) VALUES ($1, $2, $3)', [letterId, recType, String(rec)]);
      }
    }

    // بروزرسانی امضاکنندگان
    if (signers && (type || letter.type) === 'outgoing') {
      await query('DELETE FROM letter_signers WHERE letter_id = $1', [letterId]);
      for (const sig of signers) {
        await query('INSERT INTO letter_signers (letter_id, user_id, status) VALUES ($1, $2, \'pending\')', [letterId, String(sig)]);
      }
    }

    // ارجاع خودکار برای نامه‌های وارده و داخلی در صورتی که الان ثبت نهایی شوند
    if (letter.status === 'draft' && finalStatus === 'registered' && (letter.type === 'incoming' || letter.type === 'internal')) {
      const activeReceivers = receivers || [];
      for (const rec of activeReceivers) {
        await query(`
          INSERT INTO letter_referrals (letter_id, sender_id, receiver_id, action_type, note, is_completed)
          VALUES ($1, $2, $3, 'for_action', 'ارجاع خودکار سیستمی پس از صدور شماره', FALSE)
        `, [letterId, req.user.username, String(rec)]);

        // ایجاد نوتیفیکیشن
        const notifId = `referral_${Date.now()}_${letterId}_${rec}`;
        const senderName = req.user.display_name || req.user.username;
        await query(`
          INSERT INTO notifications (id, to_user, msg, at, read)
          VALUES ($1, $2, $3, NOW(), FALSE)
        `, [notifId, String(rec), `📨 نامه‌ای با موضوع «${subject || letter.subject}» و شماره اندیکاتور ${indicator} از طرف ${senderName} به کارتابل شما ارجاع شد.`]).catch(()=>{});
      }
    }

    await query('COMMIT');
    res.json({ ok: true, letter: updRes.rows[0] });
  } catch (e) {
    await query('ROLLBACK');
    console.error('[letters PUT /:id]', e);
    res.status(500).json({ error: e.message || 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /:id/approve-internal — صدور شماره اندیکاتور (وارده/داخلی)
// ─────────────────────────────────────────────
router.post('/:id/approve-internal', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  try {
    await query('BEGIN');
    const check = await query('SELECT * FROM letters WHERE id = $1', [letterId]);
    if (!check.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });
    const letter = check.rows[0];

    if (letter.indicator_number) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'نامه قبلاً شماره‌گذاری شده است' });
    }

    const indicator = await generateIndicatorNumber(letter.type, letter.department_prefix);
    await query(`
      UPDATE letters
      SET status = 'registered', indicator_number = $1, registered_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [indicator, letterId]);

    // ایجاد ارجاع برای گیرندگان
    const recsRes = await query('SELECT receiver_id FROM letter_receivers WHERE letter_id = $1 AND receiver_type = \'user\'', [letterId]);
    for (const r of recsRes.rows) {
      const dup = await query('SELECT 1 FROM letter_referrals WHERE letter_id = $1 AND receiver_id = $2 AND is_completed = FALSE', [letterId, r.receiver_id]);
      if (dup.rows.length === 0) {
        await query(`
          INSERT INTO letter_referrals (letter_id, sender_id, receiver_id, action_type, note, is_completed)
          VALUES ($1, $2, $3, 'for_action', 'ارجاع خودکار سیستمی پس از صدور شماره', FALSE)
        `, [letterId, req.user.username, r.receiver_id]);

        // ایجاد نوتیفیکیشن
        const notifId = `referral_${Date.now()}_${letterId}_${r.receiver_id}`;
        const senderName = req.user.display_name || req.user.username;
        await query(`
          INSERT INTO notifications (id, to_user, msg, at, read)
          VALUES ($1, $2, $3, NOW(), FALSE)
        `, [notifId, r.receiver_id, `📥 نامه‌ای با موضوع «${letter.subject}» و شماره اندیکاتور ${indicator} به کارتابل شما ارجاع شد.`]).catch(()=>{});
      }
    }

    await query('COMMIT');
    res.json({ ok: true, indicator_number: indicator });
  } catch (e) {
    await query('ROLLBACK');
    res.status(500).json({ error: e.message || 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /:id/approve-outgoing — ارسال به کارتابل امضا (صادره)
// ─────────────────────────────────────────────
router.post('/:id/approve-outgoing', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  try {
    await query('BEGIN');
    const check = await query('SELECT * FROM letters WHERE id = $1', [letterId]);
    if (!check.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });
    const letter = check.rows[0];

    await query('UPDATE letters SET status = \'approved_for_sign\', updated_at = NOW() WHERE id = $1', [letterId]);

    // ایجاد ارجاع برای امضا کنندگان
    const signersRes = await query('SELECT user_id FROM letter_signers WHERE letter_id = $1', [letterId]);
    for (const s of signersRes.rows) {
      const dup = await query('SELECT 1 FROM letter_referrals WHERE letter_id = $1 AND receiver_id = $2 AND action_type = \'for_signature\' AND is_completed = FALSE', [letterId, s.user_id]);
      if (dup.rows.length === 0) {
        await query(`
          INSERT INTO letter_referrals (letter_id, sender_id, receiver_id, action_type, note, is_completed)
          VALUES ($1, $2, $3, 'for_signature', 'ارجاع سیستمی جهت بررسی و تایید امضا', FALSE)
        `, [letterId, req.user.username, s.user_id]);

        // ایجاد نوتیفیکیشن
        const notifId = `sig_req_${Date.now()}_${letterId}_${s.user_id}`;
        const senderName = req.user.display_name || req.user.username;
        await query(`
          INSERT INTO notifications (id, to_user, msg, at, read)
          VALUES ($1, $2, $3, NOW(), FALSE)
        `, [notifId, s.user_id, `✍️ درخواست امضای نامه «${letter.subject}» از طرف ${senderName} ارجاع شد.`]).catch(()=>{});
      }
    }

    await query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await query('ROLLBACK');
    res.status(500).json({ error: e.message || 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /:id/sign — ثبت امضای دیجیتال
// ─────────────────────────────────────────────
router.post('/:id/sign', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  const { sign_type, use_letterhead, pin_code } = req.body;
  const username = req.user.username;

  try {
    await query('BEGIN');

    // بررسی پین‌کد امضا
    const userRes = await query('SELECT signature_pin FROM app_users WHERE username = $1', [username]);
    const pinInDb = userRes.rows[0]?.signature_pin;
    const activePin = pinInDb || '1234';

    if (String(pin_code) !== String(activePin)) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'پین‌کد وارد شده اشتباه است' });
    }

    const letterRes = await query('SELECT * FROM letters WHERE id = $1', [letterId]);
    if (!letterRes.rows.length) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'نامه یافت نشد' });
    }
    const letter = letterRes.rows[0];

    // ثبت وضعیت امضا برای این کاربر
    await query(`
      UPDATE letter_signers
      SET status = 'signed', signed_at = NOW(), sign_type = $1
      WHERE letter_id = $2 AND user_id = $3
    `, [sign_type || 'simple', letterId, username]);

    // اتمام ارجاع مربوط به امضا
    await query(`
      UPDATE letter_referrals
      SET is_completed = TRUE, completed_at = NOW(), completion_note = $1
      WHERE letter_id = $2 AND receiver_id = $3 AND action_type = 'for_signature' AND is_completed = FALSE
    `, [`ثبت امضا: ${sign_type || 'simple'}`, letterId, username]);

    // ثبت لاگ امضا
    await query(`
      INSERT INTO letter_referrals (letter_id, sender_id, receiver_id, action_type, note, is_completed, completed_at, completion_note)
      VALUES ($1, $2, $2, 'for_signature', 'ثبت امضای دیجیتال', TRUE, NOW(), $3)
    `, [letterId, username, `امضای دیجیتال کاربر ${req.user.display_name || username} با موفقیت ثبت شد.`]);

    // بررسی تعداد امضاهای باقی‌مانده
    const pendingRes = await query('SELECT COUNT(*) FROM letter_signers WHERE letter_id = $1 AND status != \'signed\'', [letterId]);
    const pendingCount = parseInt(pendingRes.rows[0].count);

    if (pendingCount === 0) {
      // همه امضا کرده‌اند -> صدور نهایی شماره اندیکاتور
      let indicator = letter.indicator_number;
      if (!indicator) {
        indicator = await generateIndicatorNumber(letter.type, letter.department_prefix);
      }

      await query(`
        UPDATE letters
        SET signature_status = $1, use_letterhead = $2, indicator_number = $3, status = 'registered', registered_at = COALESCE(registered_at, NOW()), updated_at = NOW()
        WHERE id = $4
      `, [sign_type || 'simple', !!use_letterhead, indicator, letterId]);

      // ارجاع خودکار برای گیرندگان داخلی پس از تکمیل امضای نامه صادره
      const recsRes = await query('SELECT receiver_id FROM letter_receivers WHERE letter_id = $1 AND receiver_type = \'user\'', [letterId]);
      for (const r of recsRes.rows) {
        const dup = await query('SELECT 1 FROM letter_referrals WHERE letter_id = $1 AND receiver_id = $2 AND is_completed = FALSE', [letterId, r.receiver_id]);
        if (dup.rows.length === 0) {
          await query(`
            INSERT INTO letter_referrals (letter_id, sender_id, receiver_id, action_type, note, is_completed)
            VALUES ($1, $2, $3, 'for_action', 'ارجاع خودکار سیستمی پس از امضای نهایی و صدور شماره', FALSE)
          `, [letterId, username, r.receiver_id]);

          // ایجاد نوتیفیکیشن
          const notifId = `referral_${Date.now()}_${letterId}_${r.receiver_id}`;
          const senderName = req.user.display_name || username;
          await query(`
            INSERT INTO notifications (id, to_user, msg, at, read)
            VALUES ($1, $2, $3, NOW(), FALSE)
          `, [notifId, r.receiver_id, `📥 نامه‌ای با موضوع «${letter.subject}» و شماره اندیکاتور ${indicator} به کارتابل شما ارجاع شد.`]).catch(()=>{});
        }
      }

      await query('COMMIT');
      return res.json({ ok: true, status: 'signed_complete', indicator_number: indicator });
    } else {
      // امضای ناقص (بقیه امضاکننده‌ها مانده‌اند)
      await query(`
        UPDATE letters
        SET signature_status = 'partial', use_letterhead = $1, updated_at = NOW()
        WHERE id = $2
      `, [!!use_letterhead, letterId]);

      await query('COMMIT');
      return res.json({ ok: true, status: 'signed_partial' });
    }
  } catch (e) {
    await query('ROLLBACK');
    console.error('[letters sign error]', e);
    res.status(500).json({ error: e.message || 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /:id/unsign — لغو امضا
// ─────────────────────────────────────────────
router.post('/:id/unsign', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  const { pin_code } = req.body;
  const username = req.user.username;

  try {
    await query('BEGIN');

    // بررسی پین‌کد
    const userRes = await query('SELECT signature_pin FROM app_users WHERE username = $1', [username]);
    const pinInDb = userRes.rows[0]?.signature_pin;
    const activePin = pinInDb || '1234';

    if (String(pin_code) !== String(activePin)) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'پین‌کد وارد شده اشتباه است' });
    }

    // بازگردانی وضعیت امضا
    await query(`
      UPDATE letter_signers
      SET status = 'accepted', signed_at = NULL
      WHERE letter_id = $1 AND user_id = $2
    `, [letterId, username]);

    await query(`
      UPDATE letters
      SET status = 'approved_for_sign', indicator_number = NULL, signature_status = 'partial', updated_at = NOW()
      WHERE id = $1
    `, [letterId]);

    // ثبت در لاگ ارجاع
    await query(`
      INSERT INTO letter_referrals (letter_id, sender_id, receiver_id, action_type, note, is_completed, completed_at, completion_note)
      VALUES ($1, $2, $2, 'for_signature', 'لغو امضای دیجیتال', TRUE, NOW(), 'کاربر امضای خود را پس گرفت.')
    `, [letterId, username]);

    await query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await query('ROLLBACK');
    console.error('[letters unsign error]', e);
    res.status(500).json({ error: e.message || 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /update-pin — تغییر پین‌کد امضا
// ─────────────────────────────────────────────
router.post('/update-pin', requireAuth, async (req, res) => {
  const { current_pin, new_pin } = req.body;
  const username = req.user.username;

  if (!new_pin) return res.status(400).json({ error: 'پین‌کد جدید الزامی است' });

  try {
    const userRes = await query('SELECT signature_pin FROM app_users WHERE username = $1', [username]);
    const pinInDb = userRes.rows[0]?.signature_pin;
    const activePin = pinInDb || '1234';

    if (String(current_pin) !== String(activePin)) {
      return res.status(400).json({ error: 'پین‌کد فعلی اشتباه است' });
    }

    await query('UPDATE app_users SET signature_pin = $1 WHERE username = $2', [new_pin, username]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /:id/refer — ارجاع نامه
// ─────────────────────────────────────────────
router.post('/:id/refer', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  const { receiverId, note, action_type, private_note } = req.body;

  if (!receiverId) {
    return res.status(400).json({ error: 'گیرنده ارجاع الزامی است' });
  }

  try {
    const check = await query('SELECT id, subject FROM letters WHERE id = $1', [letterId]);
    if (!check.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });

    const referralResult = await query(`
      INSERT INTO letter_referrals (letter_id, sender_id, receiver_id, action_type, note, private_note, is_completed)
      VALUES ($1, $2, $3, $4, $5, $6, FALSE)
      RETURNING *
    `, [letterId, req.user.username, receiverId, action_type || 'for_action', note || '', private_note || '']);

    // ایجاد نوتیفیکیشن سیستمی برای گیرنده
    const notifId = `referral_${Date.now()}_${letterId}_${receiverId}`;
    const senderName = req.user.display_name || req.user.username;
    const subject = check.rows[0].subject;
    await query(`
      INSERT INTO notifications (id, to_user, msg, at, read)
      VALUES ($1, $2, $3, NOW(), FALSE)
    `, [notifId, receiverId, `📨 نامه‌ای با موضوع «${subject}» از طرف ${senderName} به کارتابل شما ارجاع شد.`]).catch(e => {
      console.warn('[letters referral notif]', e.message);
    });

    res.json({ ok: true, referral: referralResult.rows[0] });
  } catch (e) {
    console.error('[letters POST /:id/refer]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// GET /:id/referrals — تاریخچه ارجاعات یک نامه
// ─────────────────────────────────────────────
router.get('/:id/referrals', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  const username = req.user.username;
  try {
    // خوانده شدن ارجاعات مربوط به کاربر جاری
    await query(`
      UPDATE letter_referrals
      SET is_read = TRUE
      WHERE letter_id = $1 AND receiver_id = $2 AND is_read = FALSE
    `, [letterId, username]);

    const r = await query(`
      SELECT ref.*,
             su.display_name as sender_name, rv.display_name as receiver_name
      FROM letter_referrals ref
      LEFT JOIN app_users su ON ref.sender_id = su.username
      LEFT JOIN app_users rv ON ref.receiver_id = rv.username
      WHERE ref.letter_id = $1
      ORDER BY ref.referred_at ASC
    `, [letterId]);

    res.json({ referrals: r.rows });
  } catch (e) {
    console.error('[letters referrals GET]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /referrals/:refId/complete — تکمیل/مختومه کردن ارجاع
// ─────────────────────────────────────────────
router.post('/referrals/:refId/complete', requireAuth, async (req, res) => {
  const refId = parseInt(req.params.refId);
  const { completion_note } = req.body;
  try {
    const check = await query('SELECT * FROM letter_referrals WHERE id = $1', [refId]);
    if (!check.rows.length) return res.status(404).json({ error: 'ارجاع یافت نشد' });

    if (check.rows[0].receiver_id !== req.user.username) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    await query(`
      UPDATE letter_referrals
      SET is_completed = TRUE, completed_at = NOW(), completion_note = $1
      WHERE id = $2
    `, [completion_note || '', refId]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /:id/archive — بایگانی نامه
// ─────────────────────────────────────────────
router.post('/:id/archive', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  try {
    // بررسی عدم وجود ارجاع باز
    const refCheck = await query('SELECT COUNT(*) FROM letter_referrals WHERE letter_id = $1 AND is_completed = FALSE', [letterId]);
    if (parseInt(refCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'این نامه دارای ارجاع اقدام نشده (باز) است. ابتدا باید ارجاعات آن مختومه شود.' });
    }

    await query('UPDATE letters SET is_archived = TRUE, status = \'registered\', updated_at = NOW() WHERE id = $1', [letterId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[letters archive POST]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /:id/delete — انتقال به زباله‌دان
// ─────────────────────────────────────────────
router.post('/:id/delete', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  try {
    const check = await query('SELECT * FROM letters WHERE id = $1', [letterId]);
    if (!check.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });
    const letter = check.rows[0];

    if (letter.created_by !== req.user.username && req.user.role !== 'مدیر' && req.user.role !== 'سوپر ادمین') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    await query('UPDATE letters SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1', [letterId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /:id/restore — بازگردانی از زباله‌دان
// ─────────────────────────────────────────────
router.post('/:id/restore', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  try {
    const check = await query('SELECT * FROM letters WHERE id = $1', [letterId]);
    if (!check.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });
    const letter = check.rows[0];

    if (letter.created_by !== req.user.username && req.user.role !== 'مدیر' && req.user.role !== 'سوپر ادمین') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    await query('UPDATE letters SET is_deleted = FALSE, updated_at = NOW() WHERE id = $1', [letterId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /:id/files — آپلود فایل ضمیمه
// ─────────────────────────────────────────────
router.post('/:id/files', requireAuth, upload.single('file'), async (req, res) => {
  const letterId = parseInt(req.params.id);
  if (!req.file) return res.status(400).json({ error: 'فایلی ارسال نشده' });

  try {
    const f = req.file;
    const r = await query(`
      INSERT INTO letter_files (letter_id, filename, mime_type, file_size, data, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, filename, mime_type, file_size, uploaded_by, created_at
    `, [letterId, f.originalname, f.mimetype, f.size, f.buffer, req.user.username]);

    res.json({ ok: true, file: r.rows[0] });
  } catch (e) {
    console.error('[letters upload file]', e.message);
    res.status(500).json({ error: 'خطای بارگذاری فایل' });
  }
});

// ─────────────────────────────────────────────
// GET /:id/files — دریافت لیست فایل‌های ضمیمه
// ─────────────────────────────────────────────
router.get('/:id/files', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id);
  try {
    const r = await query(`
      SELECT id, filename, mime_type, file_size, uploaded_by, created_at
      FROM letter_files WHERE letter_id = $1 ORDER BY created_at ASC
    `, [letterId]);
    res.json({ files: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// GET /files/:fileId — دانلود / نمایش فایل ضمیمه
// ─────────────────────────────────────────────
router.get('/files/:fileId', requireAuth, async (req, res) => {
  const fileId = parseInt(req.params.fileId);
  try {
    const r = await query('SELECT * FROM letter_files WHERE id=$1', [fileId]);
    if (!r.rows.length) return res.status(404).json({ error: 'فایل یافت نشد' });
    const f = r.rows[0];
    res.setHeader('Content-Type', f.mime_type);
    res.setHeader('Content-Disposition',
      req.query.dl === '1'
        ? `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`
        : `inline; filename*=UTF-8''${encodeURIComponent(f.filename)}`
    );
    res.send(f.data);
  } catch (e) {
    console.error('[letters file download]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;
