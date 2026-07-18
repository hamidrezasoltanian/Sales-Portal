'use strict';

const express = require('express');
const multer  = require('multer');
const { query } = require('../db');
const { requirePermission } = require('../permissions');
const { requireAuth } = require('../auth');
const { searchLetterCenters, resolveCenterName } = require('../lib/letterCenters');
const {
  DEFAULT_PRINT_TEMPLATE,
  buildPrintHtml,
} = require('../lib/letter-print');
const hub = require('../lib/notification-hub');

async function sendLetterNotif(toUser, fromUser, msg, notifId, meta) {
  await hub.notifySimple({
    id: notifId,
    to: String(toUser),
    from: fromUser,
    msg,
    type: 'letters',
    meta: Object.assign({ module: 'letters' }, meta || {}),
  }).catch(function () {});
}

const router = express.Router();
let _broadcast = null;
try { _broadcast = require('./events').broadcast; } catch (_) {}

function emitLetterChanged(letterId, by, extra) {
  try {
    if (_broadcast) {
      _broadcast('letter-changed', Object.assign({ letter_id: letterId, at: Date.now(), by }, extra || {}));
    }
  } catch (_) {}
}
const DEFAULT_LETTERS_PIN = process.env.LETTERS_DEFAULT_PIN || '1234';
router.use(requireAuth);
router.use((req, res, next) => {
  const level = req.method === 'GET' ? 'view' : 'edit';
  requirePermission('letters', level)(req, res, next);
});
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

async function logLetterChange(letterId, username, field, oldVal, newVal, extra) {
  const oldStr = oldVal == null ? '' : String(oldVal);
  const newStr = newVal == null ? '' : String(newVal);
  if (oldStr === newStr) return;
  await query(
    `INSERT INTO change_log (at, "by", rkey, field, val) VALUES (NOW(), $1, $2, $3, $4::jsonb)`,
    [username, `letter_${letterId}`, field, JSON.stringify({ action: 'update', old: oldVal, new: newVal, ...(extra || {}) })]
  );
}

function isManagerUser(user) {
  return user.role === 'مدیر' || user.role === 'سوپر ادمین';
}

/** ارسال نامه صادره به میز کار امضا — ارجاع + نوتیفیکیشن */
async function sendLetterToSignDesk(letterId, senderUser, subject) {
  await query('UPDATE letters SET status = \'approved_for_sign\', updated_at = NOW() WHERE id = $1', [letterId]);
  const signersRes = await query('SELECT user_id FROM letter_signers WHERE letter_id = $1', [letterId]);
  const senderName = senderUser.display_name || senderUser.username;
  for (const s of signersRes.rows) {
    const dup = await query(
      'SELECT 1 FROM letter_referrals WHERE letter_id = $1 AND receiver_id = $2 AND action_type = \'for_signature\' AND is_completed = FALSE',
      [letterId, s.user_id]
    );
    if (dup.rows.length) continue;
    await query(`
      INSERT INTO letter_referrals (letter_id, sender_id, receiver_id, action_type, note, is_completed)
      VALUES ($1, $2, $3, 'for_signature', 'ارجاع سیستمی جهت بررسی و تایید امضا', FALSE)
    `, [letterId, senderUser.username, s.user_id]);
    const notifId = `sig_req_${Date.now()}_${letterId}_${s.user_id}`;
    await query(`
      INSERT INTO notifications (id, to_user, msg, at, read)
      VALUES ($1, $2, $3, NOW(), FALSE)
    `, [notifId, s.user_id, `✍️ درخواست امضای نامه «${subject}» از طرف ${senderName} ارجاع شد.`]).catch(() => {});
  }
}

function he(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function getPrintTemplateHtml() {
  try {
    const r = await query(`SELECT value FROM letter_settings WHERE key = 'print_template'`);
    if (r.rows.length && r.rows[0].value && String(r.rows[0].value).trim()) {
      return r.rows[0].value;
    }
  } catch (_) { /* table may not exist yet on first boot */ }
  return DEFAULT_PRINT_TEMPLATE;
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
      whereClause += ` AND l.status = 'approved_for_sign' AND EXISTS(
        SELECT 1 FROM letter_signers ls
        WHERE ls.letter_id = l.id AND ls.user_id = $${queryParams.length + 1} AND ls.status = 'pending'
      )`;
      queryParams.push(username);
    } else if (tab === 'followup') {
      whereClause += ` AND l.status IN ('registered', 'in_referral') AND EXISTS(
        SELECT 1 FROM letter_referrals r2
        WHERE r2.letter_id = l.id AND r2.is_completed = FALSE AND r2.action_type = 'for_action'`;
      if (!isAdmin) {
        queryParams.push(username);
        whereClause += ` AND r2.receiver_id = $${queryParams.length}`;
      }
      whereClause += ')';
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

    const letters = lettersResult.rows.map((row) => {
      const hasDocx = !!(row.body_docx && row.body_docx.length);
      const { body_docx, ...rest } = row;
      return { ...rest, has_docx: hasDocx };
    });

    // تعمیر خودکار نامه‌های صادره گیرکرده در pending_action
    for (const letter of letters) {
      if (letter.type === 'outgoing' && letter.status === 'pending_action') {
        try {
          const sigRes = await query('SELECT COUNT(*) FROM letter_signers WHERE letter_id = $1', [letter.id]);
          if (parseInt(sigRes.rows[0].count, 10) > 0) {
            await sendLetterToSignDesk(letter.id, { username: letter.created_by, display_name: letter.creator_name }, letter.subject);
            letter.status = 'approved_for_sign';
          }
        } catch (_) { /* ignore repair errors */ }
      }
    }

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
      letters,
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
    if (e.message && e.message.includes('does not exist')) {
      return res.json({ customers: [] });
    }
    console.error('[letters GET /customers]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// GET /centers — جستجو در مراکز CRM
// ─────────────────────────────────────────────
router.get('/centers', requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = parseInt(req.query.limit, 10) || 30;
    const centers = await searchLetterCenters(q, limit);
    res.json({ centers });
  } catch (e) {
    console.error('[letters GET /centers]', e.message);
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
// GET /print-template — قالب HTML چاپ نامه
// PUT /print-template — ذخیره قالب (مدیر)
// ─────────────────────────────────────────────
router.get('/print-template', requireAuth, async (req, res) => {
  try {
    const template = await getPrintTemplateHtml();
    res.json({
      template,
      default_template: DEFAULT_PRINT_TEMPLATE,
      placeholders: [
        'letterhead', 'indicator_number', 'type', 'date', 'creator',
        'sender_block', 'receiver_block', 'subject', 'body', 'signers_block',
      ],
    });
  } catch (e) {
    console.error('[letters GET /print-template]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/print-template', requireAuth, async (req, res) => {
  if (!isManagerUser(req.user)) {
    return res.status(403).json({ error: 'فقط مدیر می‌تواند قالب چاپ را ویرایش کند' });
  }
  const { template } = req.body;
  if (!template || !String(template).trim()) {
    return res.status(400).json({ error: 'قالب HTML الزامی است' });
  }
  try {
    await query(`
      INSERT INTO letter_settings (key, value, updated_at, updated_by)
      VALUES ('print_template', $1, NOW(), $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
    `, [String(template), req.user.username]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[letters PUT /print-template]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// POST /signature-image — آپلود تصویر امضا (کاربر جاری)
// GET  /signature-image/:username — دریافت تصویر امضا
// ─────────────────────────────────────────────
const SIG_UPLOAD = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('فقط تصویر PNG/JPEG/WebP مجاز است'));
  },
});

router.post('/signature-image', SIG_UPLOAD.single('image'), async (req, res) => {
  if (!req.file || !req.file.buffer || !req.file.buffer.length) {
    return res.status(400).json({ error: 'فایل تصویر امضا الزامی است' });
  }
  try {
    await query(
      `UPDATE app_users SET signature_image = $1, signature_image_mime = $2 WHERE username = $3`,
      [req.file.buffer, req.file.mimetype || 'image/png', req.user.username]
    );
    res.json({ ok: true, has_image: true });
  } catch (e) {
    console.error('[letters POST /signature-image]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/signature-image/status', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT (signature_image IS NOT NULL AND octet_length(signature_image) > 0) AS has_image
       FROM app_users WHERE username = $1`,
      [req.user.username]
    );
    res.json({ has_image: !!(r.rows[0] && r.rows[0].has_image) });
  } catch (e) {
    console.error('[letters GET /signature-image/status]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/signature-image/:username', requireAuth, async (req, res) => {
  const uname = String(req.params.username || '').trim();
  if (!uname) return res.status(400).json({ error: 'نام کاربری نامعتبر' });
  try {
    const r = await query(
      'SELECT signature_image, signature_image_mime FROM app_users WHERE username = $1',
      [uname]
    );
    if (!r.rows.length || !r.rows[0].signature_image) {
      return res.status(404).send('تصویر امضا یافت نشد');
    }
    res.setHeader('Content-Type', r.rows[0].signature_image_mime || 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(r.rows[0].signature_image);
  } catch (e) {
    console.error('[letters GET /signature-image]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// GET /by-center/:centerKey — نامه‌های مرتبط با یک مرکز
// ─────────────────────────────────────────────
router.get('/by-center/:centerKey', requireAuth, async (req, res) => {
  const centerKey = decodeURIComponent(req.params.centerKey || '').trim();
  if (!centerKey) return res.status(400).json({ error: 'کلید مرکز الزامی است' });
  try {
    const r = await query(`
      SELECT l.id, l.indicator_number, l.subject, l.type, l.status, l.priority,
             l.created_at, l.sender_external, l.receiver_external, l.body,
             (l.body_docx IS NOT NULL AND length(l.body_docx) > 0) AS has_docx,
             u.display_name AS creator_name
      FROM letters l
      LEFT JOIN app_users u ON l.created_by = u.username
      WHERE l.is_deleted = FALSE
        AND (
          l.sender_center_key = $1 OR l.receiver_center_key = $1
          OR EXISTS (
            SELECT 1 FROM letter_receivers lr
            WHERE lr.letter_id = l.id AND lr.receiver_type = 'center' AND lr.receiver_id = $1
          )
        )
      ORDER BY l.created_at DESC
      LIMIT 50
    `, [centerKey]);
    res.json({ letters: r.rows });
  } catch (e) {
    console.error('[letters GET /by-center]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
router.get('/:id/history', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id, 10);
  if (isNaN(letterId)) return res.status(400).json({ error: 'شناسه نامعتبر' });
  try {
    const check = await query('SELECT id, created_by FROM letters WHERE id = $1 AND is_deleted = FALSE', [letterId]);
    if (!check.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });
    const letter = check.rows[0];
    const isOwner = letter.created_by === req.user.username;
    const isMgr = isManagerUser(req.user);
    if (!isOwner && !isMgr) {
      const ref = await query(
        'SELECT 1 FROM letter_referrals WHERE letter_id = $1 AND (sender_id = $2 OR receiver_id = $2) LIMIT 1',
        [letterId, req.user.username]
      );
      const sig = await query(
        'SELECT 1 FROM letter_signers WHERE letter_id = $1 AND user_id = $2 LIMIT 1',
        [letterId, req.user.username]
      );
      if (!ref.rows.length && !sig.rows.length) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
    }
    const r = await query(
      `SELECT id, at, "by", field, val FROM change_log WHERE rkey = $1 ORDER BY at ASC`,
      [`letter_${letterId}`]
    );
    res.json({ history: r.rows });
  } catch (e) {
    console.error('[letters GET /:id/history]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// GET /:id/docx — دریافت فایل DOCX نامه
// ─────────────────────────────────────────────
router.get('/:id/docx', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id, 10);
  if (isNaN(letterId)) return res.status(400).json({ error: 'شناسه نامعتبر' });
  try {
    const r = await query(
      'SELECT body_docx FROM letters WHERE id = $1 AND is_deleted = FALSE',
      [letterId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });
    const buf = r.rows[0].body_docx;
    if (!buf || !buf.length) return res.status(404).json({ error: 'سند Word موجود نیست' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `inline; filename="letter-${letterId}.docx"`);
    res.send(buf);
  } catch (e) {
    console.error('[letters GET /:id/docx]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ─────────────────────────────────────────────
// GET /:id/print — قالب چاپ نامه
// ─────────────────────────────────────────────
router.get('/:id/print', requireAuth, async (req, res) => {
  const letterId = parseInt(req.params.id, 10);
  if (isNaN(letterId)) return res.status(400).json({ error: 'شناسه نامعتبر' });
  try {
    const r = await query(`
      SELECT l.*, u.display_name AS creator_name,
        (SELECT json_agg(json_build_object(
          'username', us.username,
          'display_name', us.display_name,
          'status', ls.status,
          'sign_type', ls.sign_type,
          'signed_at', ls.signed_at,
          'signature_mime', us.signature_image_mime
        ) ORDER BY ls.id)
         FROM letter_signers ls JOIN app_users us ON ls.user_id = us.username WHERE ls.letter_id = l.id) AS signers
      FROM letters l
      LEFT JOIN app_users u ON l.created_by = u.username
      WHERE l.id = $1 AND l.is_deleted = FALSE
    `, [letterId]);
    if (!r.rows.length) return res.status(404).send('نامه یافت نشد');
    const L = r.rows[0];
    const signers = L.signers || [];
    const signedUsernames = signers.filter((s) => s.status === 'signed').map((s) => s.username);
    const signatureMap = {};
    if (signedUsernames.length) {
      const sigRes = await query(
        'SELECT username, signature_image FROM app_users WHERE username = ANY($1) AND signature_image IS NOT NULL',
        [signedUsernames]
      );
      sigRes.rows.forEach((row) => {
        signatureMap[row.username] = row.signature_image;
      });
    }
    const template = await getPrintTemplateHtml();
    const html = await buildPrintHtml(L, signers, signatureMap, template);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('[letters GET /:id/print]', e.message);
    res.status(500).send('خطای سرور');
  }
});

// ─────────────────────────────────────────────
// POST / — ثبت نامه جدید
// ─────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const {
    type, subject, body, body_docx, priority, classification, department_prefix,
    sender_external, receiver_external, sender_center_key, receiver_center_key,
    receivers, signers, status,
  } = req.body;

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
        finalStatus = 'approved_for_sign';
      }
    }

    let bodyDocxBuf = null;
    if (body_docx && typeof body_docx === 'string') {
      try {
        bodyDocxBuf = Buffer.from(body_docx, 'base64');
      } catch (_) {
        return res.status(400).json({ error: 'فرمت body_docx نامعتبر است' });
      }
    }

    let senderExt = sender_external || '';
    let receiverExt = receiver_external || '';
    const senderKey = String(sender_center_key || '').trim();
    const receiverKey = String(receiver_center_key || '').trim();
    if (senderKey) {
      senderExt = (await resolveCenterName(senderKey)) || senderExt;
    }
    if (receiverKey) {
      receiverExt = (await resolveCenterName(receiverKey)) || receiverExt;
    }

    const lRes = await query(`
      INSERT INTO letters (type, subject, body, body_docx, priority, classification, department_prefix, status, indicator_number, registered_at, sender_external, receiver_external, sender_center_key, receiver_center_key, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      type, subject, body || '', bodyDocxBuf, priority || 'normal', classification || 'normal', department_prefix || 'الف',
      finalStatus, indicator, registeredAt, senderExt, receiverExt, senderKey, receiverKey, req.user.username
    ]);

    const letterRow = lRes.rows[0];
    if (letterRow && letterRow.body_docx) delete letterRow.body_docx;
    if (letterRow) letterRow.has_docx = !!bodyDocxBuf;

    const letterId = lRes.rows[0].id;

    // ثبت گیرندگان
    if (receivers && receivers.length > 0) {
      for (const rec of receivers) {
        const recType = (type === 'outgoing') ? 'external' : 'user';
        await query('INSERT INTO letter_receivers (letter_id, receiver_type, receiver_id) VALUES ($1, $2, $3)', [letterId, recType, String(rec)]);
      }
    } else if (type === 'outgoing' && receiverKey) {
      await query('INSERT INTO letter_receivers (letter_id, receiver_type, receiver_id) VALUES ($1, $2, $3)', [letterId, 'center', receiverKey]);
    }

    // ثبت امضاکنندگان (فقط برای نامه‌های صادره)
    if (type === 'outgoing' && signers && signers.length > 0) {
      for (const sig of signers) {
        await query('INSERT INTO letter_signers (letter_id, user_id, status) VALUES ($1, $2, \'pending\')', [letterId, String(sig)]);
      }
    }

    // ارسال خودکار به میز کار امضا (نامه صادره)
    if (type === 'outgoing' && finalStatus === 'approved_for_sign') {
      await sendLetterToSignDesk(letterId, req.user, subject);
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
        await sendLetterNotif(String(rec), req.user.username,
          `📨 نامه‌ای با موضوع «${subject}» و شماره اندیکاتور ${indicator} از طرف ${senderName} به کارتابل شما ارجاع شد.`,
          notifId, { letterId, action: 'referral' });
      }
    }

    // لاگ سیستم
    await query(`
      INSERT INTO change_log (at, "by", rkey, field, val)
      VALUES (NOW(), $1, $2, 'letters', $3::jsonb)
    `, [req.user.username, `letter_${letterId}`, JSON.stringify({ action: 'create', type, subject, indicator })]);

    await query('COMMIT');
    emitLetterChanged(letterId, req.user.username, { action: 'create' });
    res.status(201).json({ ok: true, letter: letterRow });
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
  const {
    type, subject, body, body_docx, priority, classification, department_prefix,
    sender_external, receiver_external, sender_center_key, receiver_center_key,
    receivers, signers, status,
  } = req.body;

  try {
    const check = await query('SELECT * FROM letters WHERE id = $1', [letterId]);
    if (!check.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });
    const letter = check.rows[0];

    if (letter.created_by !== req.user.username && !isManagerUser(req.user)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    if (letter.status !== 'draft') {
      const contentChanged = subject !== undefined || body !== undefined || body_docx !== undefined;
      if (contentChanged) {
        return res.status(400).json({ error: 'فقط پیش‌نویس‌ها قابل ویرایش متن هستند' });
      }
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
        finalStatus = 'approved_for_sign';
      }
    }

    let bodyDocxBuf = undefined;
    if (body_docx !== undefined) {
      if (body_docx && typeof body_docx === 'string') {
        try {
          bodyDocxBuf = Buffer.from(body_docx, 'base64');
        } catch (_) {
          return res.status(400).json({ error: 'فرمت body_docx نامعتبر است' });
        }
      } else {
        bodyDocxBuf = null;
      }
    }

    const bodyDocxParam = bodyDocxBuf !== undefined ? bodyDocxBuf : letter.body_docx;

    const nextType = type || letter.type;
    const nextSubject = subject !== undefined ? subject : letter.subject;
    const nextBody = body !== undefined ? body : letter.body;
    const nextPriority = priority || letter.priority;
    const nextClassification = classification || letter.classification;
    const nextDept = department_prefix || letter.department_prefix;

    let nextSenderExt = sender_external !== undefined ? sender_external : letter.sender_external;
    let nextReceiverExt = receiver_external !== undefined ? receiver_external : letter.receiver_external;
    const nextSenderKey = sender_center_key !== undefined ? String(sender_center_key || '').trim() : (letter.sender_center_key || '');
    const nextReceiverKey = receiver_center_key !== undefined ? String(receiver_center_key || '').trim() : (letter.receiver_center_key || '');
    if (sender_center_key !== undefined && nextSenderKey) {
      nextSenderExt = (await resolveCenterName(nextSenderKey)) || nextSenderExt;
    }
    if (receiver_center_key !== undefined && nextReceiverKey) {
      nextReceiverExt = (await resolveCenterName(nextReceiverKey)) || nextReceiverExt;
    }

    const updRes = await query(`
      UPDATE letters
      SET type = $1, subject = $2, body = $3,
          body_docx = $4,
          priority = $5, classification = $6,
          department_prefix = $7, status = $8, indicator_number = $9, registered_at = $10,
          sender_external = $11, receiver_external = $12,
          sender_center_key = $13, receiver_center_key = $14,
          updated_at = NOW()
      WHERE id = $15
      RETURNING *
    `, [
      nextType,
      nextSubject,
      nextBody,
      bodyDocxParam,
      nextPriority,
      nextClassification,
      nextDept,
      finalStatus,
      indicator,
      registeredAt,
      nextSenderExt,
      nextReceiverExt,
      nextSenderKey,
      nextReceiverKey,
      letterId
    ]);

    const username = req.user.username;
    await logLetterChange(letterId, username, 'subject', letter.subject, nextSubject);
    await logLetterChange(letterId, username, 'body', letter.body, nextBody);
    await logLetterChange(letterId, username, 'type', letter.type, nextType);
    await logLetterChange(letterId, username, 'priority', letter.priority, nextPriority);
    await logLetterChange(letterId, username, 'classification', letter.classification, nextClassification);
    await logLetterChange(letterId, username, 'sender_external', letter.sender_external, nextSenderExt);
    await logLetterChange(letterId, username, 'receiver_external', letter.receiver_external, nextReceiverExt);
    await logLetterChange(letterId, username, 'sender_center_key', letter.sender_center_key, nextSenderKey);
    await logLetterChange(letterId, username, 'receiver_center_key', letter.receiver_center_key, nextReceiverKey);
    if (body_docx !== undefined) {
      await logLetterChange(letterId, username, 'body_docx', !!(letter.body_docx && letter.body_docx.length), !!(bodyDocxParam && bodyDocxParam.length), { note: 'DOCX updated' });
    }
    if (letter.status !== finalStatus) {
      await logLetterChange(letterId, username, 'status', letter.status, finalStatus);
    }

    const updatedRow = updRes.rows[0];
    if (updatedRow) {
      const hasDocx = !!(updatedRow.body_docx && updatedRow.body_docx.length);
      delete updatedRow.body_docx;
      updatedRow.has_docx = hasDocx;
    }

    // بروزرسانی گیرندگان
    if (receivers) {
      await query('DELETE FROM letter_receivers WHERE letter_id = $1', [letterId]);
      for (const rec of receivers) {
        const recType = (nextType === 'outgoing') ? 'external' : 'user';
        await query('INSERT INTO letter_receivers (letter_id, receiver_type, receiver_id) VALUES ($1, $2, $3)', [letterId, recType, String(rec)]);
      }
    } else if (nextType === 'outgoing' && receiver_center_key !== undefined) {
      await query('DELETE FROM letter_receivers WHERE letter_id = $1', [letterId]);
      if (nextReceiverKey) {
        await query('INSERT INTO letter_receivers (letter_id, receiver_type, receiver_id) VALUES ($1, $2, $3)', [letterId, 'center', nextReceiverKey]);
      }
    }

    // بروزرسانی امضاکنندگان
    if (signers && (type || letter.type) === 'outgoing') {
      await query('DELETE FROM letter_signers WHERE letter_id = $1', [letterId]);
      for (const sig of signers) {
        await query('INSERT INTO letter_signers (letter_id, user_id, status) VALUES ($1, $2, \'pending\')', [letterId, String(sig)]);
      }
    }

    // ارسال خودکار به میز کار امضا (نامه صادره از پیش‌نویس)
    if (letter.status === 'draft' && finalStatus === 'approved_for_sign' && nextType === 'outgoing') {
      await sendLetterToSignDesk(letterId, req.user, nextSubject);
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
        await sendLetterNotif(String(rec), req.user.username,
          `📨 نامه‌ای با موضوع «${subject || letter.subject}» و شماره اندیکاتور ${indicator} از طرف ${senderName} به کارتابل شما ارجاع شد.`,
          notifId, { letterId, action: 'referral' });
      }
    }

    await query('COMMIT');
    emitLetterChanged(letterId, req.user.username, { action: 'update' });
    res.json({ ok: true, letter: updatedRow });
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
        await sendLetterNotif(r.receiver_id, req.user.username,
          `📥 نامه‌ای با موضوع «${letter.subject}» و شماره اندیکاتور ${indicator} به کارتابل شما ارجاع شد.`,
          notifId, { letterId, action: 'referral' });
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
    const check = await query('SELECT * FROM letters WHERE id = $1 AND is_deleted = FALSE', [letterId]);
    if (!check.rows.length) return res.status(404).json({ error: 'نامه یافت نشد' });
    const letter = check.rows[0];

    if (letter.type !== 'outgoing') {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'فقط نامه‌های صادره قابل ارسال به میز امضا هستند' });
    }
    const allowed = ['draft', 'pending_action', 'approved_for_sign'];
    if (!allowed.includes(letter.status)) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'نامه در وضعیت فعلی قابل ارسال به میز امضا نیست' });
    }
    const sigCount = await query('SELECT COUNT(*) FROM letter_signers WHERE letter_id = $1', [letterId]);
    if (parseInt(sigCount.rows[0].count, 10) === 0) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'حداقل یک امضاکننده باید انتخاب شده باشد' });
    }
    const signedCount = await query('SELECT COUNT(*) FROM letter_signers WHERE letter_id = $1 AND status = \'signed\'', [letterId]);
    if (parseInt(signedCount.rows[0].count, 10) > 0) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'پس از شروع امضا، ارسال مجدد به میز امضا امکان‌پذیر نیست' });
    }

    await sendLetterToSignDesk(letterId, req.user, letter.subject);
    await logLetterChange(letterId, req.user.username, 'status', letter.status, 'approved_for_sign', { action: 'send_to_sign_desk' });

    await query('COMMIT');
    const updated = await query(`
      SELECT l.*, u.display_name as creator_name,
        (SELECT json_agg(json_build_object('username', us.username, 'display_name', us.display_name, 'status', ls.status))
         FROM letter_signers ls JOIN app_users us ON ls.user_id = us.username WHERE ls.letter_id = l.id) as signers
      FROM letters l LEFT JOIN app_users u ON l.created_by = u.username WHERE l.id = $1
    `, [letterId]);
    const row = updated.rows[0];
    if (row) {
      row.has_docx = !!(row.body_docx && row.body_docx.length);
      delete row.body_docx;
    }
    emitLetterChanged(letterId, req.user.username, { action: 'approve-outgoing' });
    res.json({ ok: true, letter: row });
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
    const activePin = pinInDb || DEFAULT_LETTERS_PIN;

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

    if (letter.status !== 'approved_for_sign') {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'این نامه در مرحله امضا نیست' });
    }

    const signerCheck = await query(
      'SELECT status FROM letter_signers WHERE letter_id = $1 AND user_id = $2',
      [letterId, username]
    );
    if (!signerCheck.rows.length) {
      await query('ROLLBACK');
      return res.status(403).json({ error: 'شما امضاکننده این نامه نیستید' });
    }
    if (signerCheck.rows[0].status === 'signed') {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'شما قبلاً این نامه را امضا کرده‌اید' });
    }

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
          await sendLetterNotif(r.receiver_id, username,
            `📥 نامه‌ای با موضوع «${letter.subject}» و شماره اندیکاتور ${indicator} به کارتابل شما ارجاع شد.`,
            notifId, { letterId, action: 'referral' });
        }
      }

      if (recsRes.rows.length > 0) {
        await query(`UPDATE letters SET status = 'in_referral', updated_at = NOW() WHERE id = $1`, [letterId]);
      }

      await query('COMMIT');
      emitLetterChanged(letterId, username, { action: 'signed_complete' });
      return res.json({ ok: true, status: 'signed_complete', indicator_number: indicator });
    } else {
      // امضای ناقص (بقیه امضاکننده‌ها مانده‌اند)
      await query(`
        UPDATE letters
        SET signature_status = 'partial', use_letterhead = $1, updated_at = NOW()
        WHERE id = $2
      `, [!!use_letterhead, letterId]);

      await query('COMMIT');
      emitLetterChanged(letterId, username, { action: 'signed_partial' });
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
    const activePin = pinInDb || DEFAULT_LETTERS_PIN;

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
    emitLetterChanged(letterId, username, { action: 'unsign' });
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
    const activePin = pinInDb || DEFAULT_LETTERS_PIN;

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
    await sendLetterNotif(receiverId, req.user.username,
      `📨 نامه‌ای با موضوع «${subject}» از طرف ${senderName} به کارتابل شما ارجاع شد.`,
      notifId, { letterId, action: 'referral' });

    await query(`UPDATE letters SET status = 'in_referral', updated_at = NOW() WHERE id = $1 AND status = 'registered'`, [letterId]).catch(() => {});

    emitLetterChanged(letterId, req.user.username, { action: 'refer' });
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

    const ref = check.rows[0];
    const openCheck = await query(
      'SELECT COUNT(*) FROM letter_referrals WHERE letter_id = $1 AND is_completed = FALSE',
      [ref.letter_id]
    );
    if (parseInt(openCheck.rows[0].count, 10) === 0) {
      await query(
        `UPDATE letters SET status = 'registered', updated_at = NOW() WHERE id = $1 AND status = 'in_referral'`,
        [ref.letter_id]
      );
    }

    const letterRow = await query('SELECT subject FROM letters WHERE id = $1', [ref.letter_id]);
    const subject = letterRow.rows[0]?.subject || '';
    const receiverName = req.user.display_name || req.user.username;
    const notifId = `ref_done_${Date.now()}_${refId}`;
    await query(`
      INSERT INTO notifications (id, to_user, msg, at, read)
      VALUES ($1, $2, $3, NOW(), FALSE)
    `, [notifId, ref.sender_id, `✅ ارجاع نامه «${subject}» توسط ${receiverName} تکمیل شد.`]).catch(() => {});

    emitLetterChanged(ref.letter_id, req.user.username, { action: 'referral_complete' });
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
    emitLetterChanged(letterId, req.user.username, { action: 'archive' });
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
