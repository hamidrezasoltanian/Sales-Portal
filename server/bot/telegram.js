'use strict';

// ════════════════════════════════════════════════════════════════
// TELEGRAM BOT — Click CRM
// Features:
//   • proforma approve/reject
//   • inventory check + QR scan
//   • today's schedule (SQL week_entries)
//   • mark entry done + call note
//   • tasks list
//   • 🌅 daily morning report at 08:00 to managers
//   • 📊 weekly digest every Monday 08:00 (overdue aging + KPI summary)
//   • 🔔 push CRM notifications to Telegram
// ════════════════════════════════════════════════════════════════

const https  = require('https');
const Jimp   = require('jimp');
const jsQR   = require('jsqr');
const bcrypt = require('bcryptjs');
const { query } = require('../db');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// ── States ────────────────────────────────────────────────────────────────
const ST = {
  IDLE:             'idle',
  AWAIT_USERNAME:   'await_username',
  AWAIT_PASSWORD:   'await_password',
  AWAIT_REJECT:     'await_reject',
  AWAIT_CALL_NOTE:  'await_call_note',
  AWAIT_MSG_TEXT:   'await_msg_text',    // manager: typing message to expert
  AWAIT_PLAN_SEARCH:'await_plan_search', // typing center name to add to plan
  AWAIT_SEARCH_Q:   'await_search_q',    // typing center name for info lookup
};

const sessions = {};

// ── Telegram API helpers ──────────────────────────────────────────────────
function tgCall(method, body) {
  return new Promise(function(resolve, reject) {
    const data = JSON.stringify(body || {});
    const opts = {
      hostname: 'api.telegram.org',
      path:     '/bot' + TOKEN + '/' + method,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(opts, function(res) {
      let buf = '';
      res.on('data', function(c){ buf += c; });
      res.on('end', function(){ try { resolve(JSON.parse(buf)); } catch(e){ resolve({}); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendMsg(chatId, text, opts) {
  return tgCall('sendMessage', Object.assign({ chat_id: chatId, text: text, parse_mode: 'HTML' }, opts || {}));
}

function editMsg(chatId, msgId, text, opts) {
  return tgCall('editMessageText', Object.assign({ chat_id: chatId, message_id: msgId, text: text, parse_mode: 'HTML' }, opts || {}));
}

function answerCallback(cbId, text) {
  return tgCall('answerCallbackQuery', { callback_query_id: cbId, text: text || '' });
}

function downloadFile(fileId) {
  return tgCall('getFile', { file_id: fileId }).then(function(r) {
    if (!r.ok) throw new Error('getFile failed');
    const filePath = r.result.file_path;
    return new Promise(function(resolve, reject) {
      https.get('https://api.telegram.org/file/bot' + TOKEN + '/' + filePath, function(res) {
        const chunks = [];
        res.on('data', function(c){ chunks.push(c); });
        res.on('end', function(){ resolve(Buffer.concat(chunks)); });
      }).on('error', reject);
    });
  });
}

// ── Session persistence ───────────────────────────────────────────────────
async function loadBotSessions() {
  const r = await query(`SELECT value FROM app_data WHERE key = 'bot_sessions'`);
  return r.rows.length ? r.rows[0].value : {};
}

async function saveBotSessions(map) {
  await query(
    `INSERT INTO app_data (key, value, updated_at, updated_by)
     VALUES ('bot_sessions', $1, NOW(), 'bot')
     ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW(), updated_by='bot'`,
    [JSON.stringify(map)]
  );
}

async function persistSession(chatId, remove) {
  try {
    const stored = await loadBotSessions();
    if (remove) delete stored[chatId];
    else stored[chatId] = sessions[chatId];
    await saveBotSessions(stored);
  } catch(e) {}
}

// ── Auth helper ───────────────────────────────────────────────────────────
async function verifyCRM(username, password) {
  try {
    const r = await query(
      'SELECT username, display_name, role, password_hash FROM app_users WHERE username = $1 AND active = true',
      [username]
    );
    if (!r.rows.length) return null;
    const u = r.rows[0];
    return (await bcrypt.compare(password, u.password_hash)) ? u : null;
  } catch(e) { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtN(n) { return Number(n || 0).toLocaleString('fa-IR'); }
function isManagerRole(role) { return ['مدیر', 'سوپر ادمین'].includes(role); }

const PF_LABELS = { draft:'پیش‌نویس', sent:'ارسال شده', approved:'✅ تأیید', rejected:'❌ رد', cancelled:'لغو' };

// Minimal Gregorian → Jalali
function toJalali(date) {
  const gy = date.getFullYear(), gm = date.getMonth() + 1, gd = date.getDate();
  const g_d_no = 365*gy + Math.floor((gy+3)/4) - Math.floor((gy+99)/100) + Math.floor((gy+399)/400);
  const j_d_no = g_d_no - 79;
  const j_np   = Math.floor(j_d_no / 12053);
  let jy = 979 + 33*j_np, jd = j_d_no % 12053;
  jy += 4 * Math.floor(jd / 1461);
  jd %= 1461;
  if (jd >= 366) { jy += Math.floor((jd-1)/365); jd = (jd-1)%365; }
  const jm_days = [31,31,31,31,31,31,30,30,30,30,30,29];
  let jm = 0;
  for (let i = 0; i < 12; i++) {
    if (jd < jm_days[i]) { jm = i+1; jd++; break; }
    jd -= jm_days[i];
  }
  return jy + '/' + String(jm).padStart(2,'0') + '/' + String(jd).padStart(2,'0');
}

// ── Keyboards ─────────────────────────────────────────────────────────────
const MENU_KB = {
  keyboard: [
    [{ text: '☀️ برنامه امروز' },    { text: '📅 برنامه هفته' }],
    [{ text: '📋 وظایف من' },         { text: '🔔 اعلان‌ها' }],
    [{ text: '➕ افزودن به برنامه' }, { text: '🔍 جستجوی مرکز' }],
    [{ text: '📄 پیشفاکتورها' },      { text: '🔍 اسکن QR' }],
    [{ text: '❓ راهنما' }],
  ],
  resize_keyboard: true,
};

const MENU_KB_MANAGER = {
  keyboard: [
    [{ text: '☀️ برنامه امروز' },    { text: '📅 برنامه هفته' }],
    [{ text: '📋 وظایف من' },         { text: '🔔 اعلان‌ها' }],
    [{ text: '📊 گزارش معوق' },       { text: '📈 KPI هفتگی' }],
    [{ text: '📨 ارسال پیام' },       { text: '➕ افزودن به برنامه' }],
    [{ text: '🔍 جستجوی مرکز' },     { text: '📄 پیشفاکتورها' }],
    [{ text: '📦 موجودی انبار' },     { text: '🔍 اسکن QR' }],
    [{ text: '❓ راهنما' }],
  ],
  resize_keyboard: true,
};

function menuFor(sess) { return isManagerRole(sess.role) ? MENU_KB_MANAGER : MENU_KB; }

// ── Update handler ────────────────────────────────────────────────────────
async function handleUpdate(upd) {
  try {
    if (upd.callback_query) { await handleCallback(upd.callback_query); return; }
    const msg = upd.message;
    if (!msg) return;
    const chatId = msg.chat.id;
    const text   = (msg.text || '').trim();

    // Restore session
    if (!sessions[chatId]) {
      const stored = await loadBotSessions();
      sessions[chatId] = stored[chatId] || { state: ST.AWAIT_USERNAME };
      const s = sessions[chatId];
      if (s.state !== ST.IDLE) { s.state = ST.AWAIT_USERNAME; delete s.pendingUser; }
    }

    const sess = sessions[chatId];

    // QR photo
    if (msg.photo && sess.state === ST.IDLE) { await handlePhoto(chatId, msg); return; }

    // /start / /help / help button
    if (text === '/start' || text === '/help' || text === '❓ راهنما') {
      if (!sess.username) {
        sess.state = ST.AWAIT_USERNAME;
        await sendMsg(chatId, '🔐 <b>ورود به سیستم</b>\n\nنام کاربری CRM خود را وارد کنید:\n<i>مثال: Hamidreza.soltanian</i>');
      } else {
        await sendMsg(chatId,
          '👋 سلام <b>' + sess.name + '</b> | ' + sess.role + (isManagerRole(sess.role) ? ' 👑' : '') + '\n\n' +
          '📋 دستورات:\n' +
          '☀️ برنامه امروز — مراکز امروز\n' +
          '📅 برنامه هفته — نمای ۷ روزه\n' +
          '📋 وظایف من — وظایف باز\n' +
          '🔔 اعلان‌ها — اعلان‌های خوانده‌نشده\n' +
          '➕ افزودن به برنامه — جستجو و ثبت در برنامه\n' +
          '🔍 جستجوی مرکز — وضعیت و یادداشت مرکز\n' +
          '📄 پیشفاکتورها — لیست و تأیید\n' +
          '📦 موجودی انبار — وضعیت کالاها\n' +
          '🔍 اسکن QR — اطلاعات لات/کالا\n' +
          '/logout — خروج',
          { reply_markup: menuFor(sess) }
        );
      }
      return;
    }

    if (text === '/logout') {
      delete sessions[chatId];
      await persistSession(chatId, true);
      await sendMsg(chatId, '👋 از سیستم خارج شدید.', { reply_markup: { remove_keyboard: true } });
      return;
    }

    // State machine
    if (sess.state === ST.AWAIT_USERNAME) {
      if (!text || text.startsWith('/')) {
        await sendMsg(chatId, '🔐 نام کاربری CRM خود را وارد کنید:');
        return;
      }
      sess.pendingUser = text;
      sess.state = ST.AWAIT_PASSWORD;
      await sendMsg(chatId, '🔑 رمز عبور:');
      return;
    }

    if (sess.state === ST.AWAIT_PASSWORD) {
      const user = await verifyCRM(sess.pendingUser, text);
      if (!user) {
        sess.state = ST.AWAIT_USERNAME;
        delete sess.pendingUser;
        await sendMsg(chatId, '❌ نام کاربری یا رمز اشتباه است.\n\nدوباره نام کاربری را وارد کنید:');
        return;
      }
      Object.assign(sess, { username: user.username, name: user.display_name, role: user.role, state: ST.IDLE });
      delete sess.pendingUser;
      await persistSession(chatId);
      await sendMsg(chatId,
        '✅ <b>خوش آمدید، ' + user.display_name + '!</b>\n' +
        'نقش: ' + user.role + (isManagerRole(user.role) ? ' 👑' : ''),
        { reply_markup: menuFor(sess) }
      );
      return;
    }

    if (sess.state === ST.AWAIT_REJECT) {
      const { pfId } = sess;
      delete sess.pfId;
      sess.state = ST.IDLE;
      await doRejectPf(chatId, pfId, text, sess);
      return;
    }

    if (sess.state === ST.AWAIT_CALL_NOTE) {
      const note = (text === '/skip' || text === '-') ? '' : text;
      const key  = sess.pendingWeKey;
      const result = sess.pendingWeResult || '';
      delete sess.pendingWeKey;
      delete sess.pendingWeResult;
      sess.state = ST.IDLE;
      await markEntryDone(chatId, sess, key, result, note);
      return;
    }

    if (sess.state === ST.AWAIT_MSG_TEXT) {
      const recipient = sess.pendingMsgTo;
      delete sess.pendingMsgTo;
      sess.state = ST.IDLE;
      if (text && text !== '/cancel') {
        await doSendMessageToExpert(chatId, sess, recipient, text);
      } else {
        await sendMsg(chatId, '❌ لغو شد.', { reply_markup: menuFor(sess) });
      }
      return;
    }

    if (sess.state === ST.AWAIT_PLAN_SEARCH) {
      if (text === '/cancel') {
        sess.state = ST.IDLE;
        await sendMsg(chatId, '❌ لغو شد.', { reply_markup: menuFor(sess) });
        return;
      }
      sess.state = ST.IDLE;
      await handlePlanSearchResults(chatId, sess, text);
      return;
    }

    if (sess.state === ST.AWAIT_SEARCH_Q) {
      if (text === '/cancel') {
        sess.state = ST.IDLE;
        await sendMsg(chatId, '❌ لغو شد.', { reply_markup: menuFor(sess) });
        return;
      }
      sess.state = ST.IDLE;
      await handleCenterInfo(chatId, sess, text);
      return;
    }

    // Require login for commands below
    if (!sess.username) {
      sess.state = ST.AWAIT_USERNAME;
      await sendMsg(chatId, '🔐 ابتدا وارد شوید. نام کاربری CRM:');
      return;
    }

    if (text === '☀️ برنامه امروز'     || text === '/today')    { await handleTodaySchedule(chatId, sess); return; }
    if (text === '📅 برنامه هفته'      || text === '/week')     { await handleWeekSchedule(chatId, sess); return; }
    if (text === '📋 وظایف من'         || text === '/tasks')    { await handleTasks(chatId, sess); return; }
    if (text === '🔔 اعلان‌ها'          || text === '/notifs')   { await handleNotifications(chatId, sess); return; }
    if (text === '➕ افزودن به برنامه' || text === '/add')      { await handleAddToPlan(chatId, sess); return; }
    if (text === '🔍 جستجوی مرکز'     || text === '/search')   { await handleCenterSearch(chatId, sess); return; }
    if (text === '📊 گزارش معوق'       || text === '/overdue')  { await handleOverdueReport(chatId, sess); return; }
    if (text === '📈 KPI هفتگی'        || text === '/kpi')      { await handleWeeklyKPI(chatId, sess); return; }
    if (text === '📨 ارسال پیام'       || text === '/msg')      { await handleSendMessage(chatId, sess); return; }
    if (text === '📄 پیشفاکتورها'      || text === '/proformas') { await handleProformas(chatId, sess); return; }
    if (text === '📦 موجودی انبار'     || text === '/inventory') { await handleInventory(chatId); return; }
    if (text === '🔍 اسکن QR'          || text === '/scan') {
      await sendMsg(chatId, '📸 عکس QR کد کالا را بفرستید:', { reply_markup: { force_reply: true } });
      return;
    }

    await sendMsg(chatId, 'از منو زیر انتخاب کنید:', { reply_markup: menuFor(sess) });

  } catch(e) {
    console.error('[bot] handleUpdate error:', e.message);
  }
}

// ── ☀️ Today's schedule (reads from week_entries SQL table) ───────────────
async function handleTodaySchedule(chatId, sess) {
  const todayStr = toJalali(new Date());
  const isMgr = isManagerRole(sess.role);

  let rows;
  try {
    if (isMgr) {
      const r = await query(
        `SELECT key, value FROM week_entries WHERE value->>'scheduledDate' = $1 ORDER BY updated_at`,
        [todayStr]
      );
      rows = r.rows;
    } else {
      const r = await query(
        `SELECT key, value FROM week_entries
         WHERE value->>'scheduledDate' = $1 AND value->>'addedBy' = $2
         ORDER BY updated_at`,
        [todayStr, sess.username]
      );
      rows = r.rows;
    }
  } catch(e) {
    await sendMsg(chatId, '❌ خطا در دریافت برنامه:\n' + e.message, { reply_markup: menuFor(sess) });
    return;
  }

  if (!rows.length) {
    await sendMsg(chatId,
      '☀️ <b>برنامه امروز — ' + todayStr + '</b>\n\nهیچ مرکزی برای امروز برنامه‌ریزی نشده.',
      { reply_markup: menuFor(sess) }
    );
    return;
  }

  // Store keys in session for callback reference (avoids 64-byte callback_data limit)
  sess.todayEntries = rows.map(function(r) { return r.key; });

  const doneCount = rows.filter(function(r) { return r.value.done; }).length;
  const actionIcon = { call: '📞', visit: '🚗' };

  let text = '☀️ <b>برنامه امروز — ' + todayStr + '</b>\n';
  text += '✅ ' + doneCount + ' از ' + rows.length + ' انجام شده\n\n';

  const inlineRows = [];
  rows.forEach(function(r, idx) {
    const we   = r.value;
    const act  = actionIcon[we.actionType] || '📋';
    const name = (we.centerName || we.rid || '—').slice(0, 25);
    const ownerTag = isMgr && we.addedBy ? ' <i>(' + we.addedBy + ')</i>' : '';
    text += (idx + 1) + '. ' + (we.done ? '✅' : '⬜') + ' ' + act + ' ' + name + ownerTag + '\n';
    if (!we.done) {
      inlineRows.push([{
        text: '✅ ثبت نتیجه: ' + name.slice(0, 18),
        callback_data: 'we_done:' + idx,
      }]);
    }
  });

  const opts = inlineRows.length
    ? { reply_markup: { inline_keyboard: inlineRows } }
    : { reply_markup: menuFor(sess) };
  await sendMsg(chatId, text, opts);
}

// ── Mark entry done ───────────────────────────────────────────────────────
async function markEntryDone(chatId, sess, key, result, note) {
  try {
    const todayStr = toJalali(new Date());
    const update = { done: true, doneDate: todayStr };
    if (result) update.callResult = result;
    if (note)   update.callNote   = note;

    await query(
      `UPDATE week_entries SET value = value || $2::jsonb, updated_at = NOW(), updated_by = $3 WHERE key = $1`,
      [key, JSON.stringify(update), sess.username]
    );

    const resultLabel = { ok: '✅ موفق', followup: '🔄 پیگیری', fail: '❌ ناموفق' };
    let reply = '✅ <b>ثبت شد!</b>\n';
    if (result) reply += '📊 نتیجه: ' + (resultLabel[result] || result) + '\n';
    if (note)   reply += '📝 یادداشت: ' + note;

    await sendMsg(chatId, reply, { reply_markup: menuFor(sess) });
  } catch(e) {
    await sendMsg(chatId, '❌ خطا در ثبت: ' + e.message, { reply_markup: menuFor(sess) });
  }
}

// ── 📋 Tasks ──────────────────────────────────────────────────────────────
async function handleTasks(chatId, sess) {
  const isMgr = isManagerRole(sess.role);
  const todayStr = toJalali(new Date());

  let rows = [];
  try {
    const r = await query(
      `SELECT id, title, owner, due_date, priority, status, done
       FROM tasks
       WHERE (owner = $1 OR created_by = $1) AND done = false
       ORDER BY
         CASE WHEN due_date IS NOT NULL AND due_date < $2 THEN 0 ELSE 1 END,
         due_date ASC NULLS LAST,
         priority DESC
       LIMIT 20`,
      [sess.username, todayStr]
    );
    rows = r.rows;
  } catch(e) {}

  // Fallback to blob if SQL table has no results
  if (!rows.length) {
    try {
      const blobRes = await query("SELECT value FROM app_data WHERE key = 'main'");
      if (blobRes.rows.length) {
        const blobTasks = (blobRes.rows[0].value || {}).tasks || [];
        rows = blobTasks
          .filter(function(t) {
            return !t.done && (t.owner === sess.username || t.createdBy === sess.username);
          })
          .sort(function(a, b) {
            const aOv = a.dueDate && a.dueDate < todayStr;
            const bOv = b.dueDate && b.dueDate < todayStr;
            if (aOv && !bOv) return -1;
            if (!aOv && bOv) return 1;
            if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return (b.priority || 2) - (a.priority || 2);
          })
          .slice(0, 20)
          .map(function(t) {
            return {
              id: String(t.id),
              title: t.title,
              owner: t.owner,
              due_date: t.dueDate || null,
              priority: t.priority || 2,
              status: t.status || 'todo',
              done: false,
            };
          });
      }
    } catch(e) {}
  }

  if (!rows.length) {
    await sendMsg(chatId, '📋 <b>وظایف من</b>\n\n✅ هیچ وظیفه بازی ندارید!', { reply_markup: menuFor(sess) });
    return;
  }

  const priIcon = { 3: '🔴', 2: '🟡', 1: '🔵' };

  const lines = rows.map(function(t, i) {
    const pri = priIcon[t.priority] || '⚪';
    const ownerTag = (isMgr && t.owner && t.owner !== sess.username) ? ' <i>(' + t.owner + ')</i>' : '';
    let dueTag = '';
    if (t.due_date) {
      dueTag = t.due_date < todayStr ? ' ⚠️<b>معوق</b>' : ' 📅' + t.due_date;
    }
    return (i+1) + '. ' + pri + ' ' + (t.title || '—') + ownerTag + dueTag;
  });

  const overdueCount = rows.filter(function(t){ return t.due_date && t.due_date < todayStr; }).length;
  let header = '📋 <b>وظایف من</b> — ' + rows.length + ' وظیفه باز';
  if (overdueCount > 0) header += ' | ⚠️ ' + overdueCount + ' معوق';

  const inlineRows = rows.slice(0, 5).map(function(t) {
    return [{ text: '✅ انجام: ' + (t.title || '').slice(0, 25), callback_data: 'tk_done:' + t.id }];
  });

  const opts = inlineRows.length
    ? { reply_markup: { inline_keyboard: inlineRows } }
    : { reply_markup: menuFor(sess) };

  await sendMsg(chatId, header + '\n\n' + lines.join('\n'), opts);
}

// ── 📄 Proformas ──────────────────────────────────────────────────────────
async function handleProformas(chatId, sess) {
  const isMgr = isManagerRole(sess.role);

  const r = isMgr
    ? await query(`SELECT * FROM proformas WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 10`)
    : await query(
        `SELECT * FROM proformas WHERE created_by = $1
         AND status IN ('draft','sent','approved','rejected')
         ORDER BY created_at DESC LIMIT 10`,
        [sess.username]
      );

  if (!r.rows.length) {
    await sendMsg(chatId,
      isMgr ? '✅ پیشفاکتور در انتظار تأییدی وجود ندارد.' : '📄 پیشفاکتوری ثبت نشده است.',
      { reply_markup: menuFor(sess) }
    );
    return;
  }

  for (const pf of r.rows) {
    const items    = pf.items || [];
    const itemList = items.slice(0, 3).map(function(i){ return '  • ' + i.name + ' × ' + i.qty; }).join('\n');
    const moreItems = items.length > 3 ? '\n  و ' + (items.length - 3) + ' ردیف دیگر...' : '';

    let text =
      '📄 <b>' + pf.no + '</b>\n' +
      '👤 مشتری: ' + (pf.center_name || '—') + '\n' +
      '📅 تاریخ: ' + (pf.jalali_date || '—') + '\n' +
      '💰 مبلغ: <b>' + fmtN(pf.total) + ' ﷼</b>\n' +
      '🔖 وضعیت: ' + (PF_LABELS[pf.status] || pf.status) + '\n' +
      '📦 کالاها:\n' + itemList + moreItems;

    if (pf.note)         text += '\n📝 ' + pf.note;
    if (pf.manager_note) text += '\n👑 یادداشت مدیر: ' + pf.manager_note;

    let inlineKb;
    if (isMgr && pf.status === 'sent') {
      inlineKb = { inline_keyboard: [[
        { text: '✅ تأیید', callback_data: 'pf_approve:' + pf.id },
        { text: '❌ رد',    callback_data: 'pf_reject:'  + pf.id },
      ]] };
    } else if (!isMgr && pf.status === 'draft' && pf.created_by === sess.username) {
      inlineKb = { inline_keyboard: [[
        { text: '📤 ارسال برای تأیید', callback_data: 'pf_send:' + pf.id },
      ]] };
    }

    await sendMsg(chatId, text, inlineKb ? { reply_markup: inlineKb } : undefined);
  }
}

// ── 📦 Inventory ──────────────────────────────────────────────────────────
async function handleInventory(chatId) {
  const r = await query(`
    SELECT p.id, p.name, p.full_name, p.unit, p.reorder_point,
      COALESCE(SUM(l.qty), 0)::int AS total_qty,
      BOOL_OR(l.expiry < NOW() + INTERVAL '90 days' AND l.expiry IS NOT NULL) AS expiry_soon
    FROM wms_products p
    LEFT JOIN wms_lots l ON l.product_id = p.id AND l.qty > 0
    WHERE p.active = true
    GROUP BY p.id, p.name, p.full_name, p.unit, p.reorder_point
    ORDER BY p.name
  `);

  if (!r.rows.length) {
    await sendMsg(chatId, '⚠️ هیچ کالایی در WMS ثبت نشده است.', { reply_markup: MENU_KB });
    return;
  }

  const lines = r.rows.map(function(p) {
    const qty  = p.total_qty;
    const low  = p.reorder_point || 10;
    const icon = qty === 0 ? '🔴' : qty <= low ? '🟡' : '🟢';
    return icon + ' <b>' + (p.full_name || p.name) + '</b>: ' + fmtN(qty) + ' ' + (p.unit || 'عدد') +
      (p.expiry_soon ? ' ⚠️انقضا' : '');
  });

  await sendMsg(chatId,
    '📦 <b>موجودی انبار</b>\n\n' + lines.join('\n') +
    '\n\n🟢 کافی  🟡 زیر حد سفارش  🔴 اتمام',
    { reply_markup: MENU_KB }
  );
}

// ── Callback handler ──────────────────────────────────────────────────────
async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const msgId  = cb.message.message_id;
  const data   = cb.data || '';
  const sess   = sessions[chatId];

  await answerCallback(cb.id);

  if (!sess || !sess.username) {
    await sendMsg(chatId, '❌ لطفاً ابتدا وارد شوید: /start');
    return;
  }

  const isMgr = isManagerRole(sess.role);

  // ── Proforma callbacks ─────────────────────────────────────────────────
  if (data.startsWith('pf_approve:')) {
    if (!isMgr) { await sendMsg(chatId, '❌ فقط مدیر می‌تواند تأیید کند.'); return; }
    await doApprovePf(chatId, msgId, data.slice(11), sess);
    return;
  }
  if (data.startsWith('pf_reject:')) {
    if (!isMgr) { await sendMsg(chatId, '❌ فقط مدیر می‌تواند رد کند.'); return; }
    sess.state = ST.AWAIT_REJECT;
    sess.pfId  = data.slice(10);
    await sendMsg(chatId, '✏️ دلیل رد را بنویسید (یا <code>-</code> برای بدون دلیل):');
    return;
  }
  if (data.startsWith('pf_send:')) {
    await doSendPf(chatId, msgId, data.slice(8), sess);
    return;
  }

  // ── Manager: send message recipient selected ──────────────────────────
  if (data.startsWith('msg_to:')) {
    if (!isMgr) return;
    const recipient = data.slice(7);
    sess.pendingMsgTo = recipient;
    sess.state = ST.AWAIT_MSG_TEXT;
    await answerCallback(cb.id, recipient);
    await sendMsg(chatId,
      '✏️ پیام خود را برای <b>' + recipient + '</b> بنویسید:\n(<code>/cancel</code> برای لغو)'
    );
    return;
  }

  // ── Manager: approve/reject task ──────────────────────────────────────
  if (data.startsWith('tk_done:')) {
    const taskId = data.slice(8);
    await doMarkTaskDone(chatId, sess, taskId);
    return;
  }

  // ── Add to plan: pick center from search results ───────────────────────
  if (data.startsWith('plan_center:')) {
    const idx = parseInt(data.slice(12));
    const center = (sess.planResults || [])[idx];
    if (!center) { await sendMsg(chatId, '❌ مرکز یافت نشد. دوباره /add را بزنید.'); return; }
    sess.planCenter = center;

    // Build date options (next 6 days)
    const dates = [];
    for (let i = 0; i < 6; i++) dates.push(toJalali(new Date(Date.now() + i * 86400000)));
    sess.planDates = dates;
    const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

    const dateRows = dates.map(function(d, i) {
      const dow = new Date(Date.now() + i * 86400000).getDay();
      const label = i === 0 ? '⭐ امروز — ' + d : i === 1 ? '📅 فردا — ' + d : persianDays[dow] + ' — ' + d;
      return [{ text: label, callback_data: 'plan_date:' + i }];
    });

    await sendMsg(chatId,
      '📅 <b>' + center.name + '</b>\n\nتاریخ را انتخاب کنید:',
      { reply_markup: { inline_keyboard: dateRows } }
    );
    return;
  }

  if (data.startsWith('plan_date:')) {
    const idx = parseInt(data.slice(10));
    const date = (sess.planDates || [])[idx];
    if (!date || !sess.planCenter) { await sendMsg(chatId, '❌ خطا. دوباره /add را بزنید.'); return; }
    sess.planDate = date;

    await sendMsg(chatId,
      '📋 نوع فعالیت را انتخاب کنید:',
      { reply_markup: { inline_keyboard: [[
        { text: '📞 تماس تلفنی', callback_data: 'plan_action:call' },
        { text: '🚗 بازدید حضوری', callback_data: 'plan_action:visit' },
      ]] } }
    );
    return;
  }

  if (data.startsWith('plan_action:')) {
    const actionType = data.slice(12);
    const center = sess.planCenter;
    const date   = sess.planDate;
    delete sess.planCenter; delete sess.planDate; delete sess.planDates; delete sess.planResults;

    if (!center || !date) { await sendMsg(chatId, '❌ خطا. دوباره /add را بزنید.', { reply_markup: menuFor(sess) }); return; }

    const recKey = (center.rtype || 'center') + '_' + (center.rid || center.name.replace(/\s/g,'_'));
    const key    = date + ':::' + recKey;
    const value  = {
      rtype: center.rtype || 'center', rid: center.rid || '',
      centerName: center.name, scheduledDate: date,
      actionType: actionType, done: false,
      addedBy: sess.username, weekTagId: null,
    };

    try {
      await query(
        `INSERT INTO week_entries (key, value, updated_at, updated_by)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
        [key, JSON.stringify(value), sess.username]
      );
      const actLabel = actionType === 'call' ? '📞 تماس تلفنی' : '🚗 بازدید حضوری';
      await sendMsg(chatId,
        '✅ <b>اضافه شد به برنامه!</b>\n\n' +
        '🏥 مرکز: <b>' + center.name + '</b>\n' +
        '📅 تاریخ: ' + date + '\n' +
        '📋 نوع: ' + actLabel,
        { reply_markup: menuFor(sess) }
      );
    } catch(e) {
      await sendMsg(chatId, '❌ خطا در ثبت: ' + e.message, { reply_markup: menuFor(sess) });
    }
    return;
  }

  // ── Notifications: mark all read ──────────────────────────────────────
  if (data === 'notif_readall') {
    try {
      await query(`UPDATE notifications SET read = true WHERE to_user = $1 AND read = false`, [sess.username]);
      await sendMsg(chatId, '✅ همه اعلان‌ها خوانده شد.', { reply_markup: menuFor(sess) });
    } catch(e) {
      await sendMsg(chatId, '❌ خطا: ' + e.message);
    }
    return;
  }

  // ── Center info: pick from multiple results ────────────────────────────
  if (data.startsWith('info_center:')) {
    const idx = parseInt(data.slice(12));
    const center = (sess.searchResults || [])[idx];
    if (!center) { await sendMsg(chatId, '❌ مرکز یافت نشد.'); return; }
    await showCenterInfo(chatId, sess, center);
    return;
  }

  // ── Week entry callbacks ───────────────────────────────────────────────
  if (data.startsWith('we_done:')) {
    const idx = parseInt(data.slice(8));
    const key = (sess.todayEntries || [])[idx];
    if (!key) { await sendMsg(chatId, '❌ برنامه یافت نشد. دوباره ☀️ برنامه امروز را باز کنید.'); return; }
    sess.pendingWeKey = key;
    await sendMsg(chatId, '📊 نتیجه تماس/بازدید را انتخاب کنید:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ موفق',    callback_data: 'we_result:' + idx + ':ok' },
          { text: '🔄 پیگیری', callback_data: 'we_result:' + idx + ':followup' },
          { text: '❌ ناموفق', callback_data: 'we_result:' + idx + ':fail' },
        ]],
      },
    });
    return;
  }

  if (data.startsWith('we_result:')) {
    const parts  = data.split(':');
    const idx    = parseInt(parts[1]);
    const result = parts[2];
    const key    = (sess.todayEntries || [])[idx];
    if (!key) { await sendMsg(chatId, '❌ برنامه یافت نشد.'); return; }
    sess.pendingWeKey    = key;
    sess.pendingWeResult = result;
    sess.state = ST.AWAIT_CALL_NOTE;
    const label = { ok: 'موفق ✅', followup: 'پیگیری 🔄', fail: 'ناموفق ❌' };
    await answerCallback(cb.id, label[result] || '');
    await sendMsg(chatId, '✏️ یادداشت (یا <code>/skip</code> بدون یادداشت):');
    return;
  }
}

// ── Proforma actions ──────────────────────────────────────────────────────
async function doApprovePf(chatId, msgId, pfId, sess) {
  const r = await query(
    `UPDATE proformas SET status='approved', responded_at=NOW(), responded_by=$2, updated_at=NOW()
     WHERE id=$1 AND status='sent' RETURNING *`,
    [pfId, sess.username]
  );
  if (!r.rows.length) { await sendMsg(chatId, '⚠️ این پیشفاکتور قابل تأیید نیست.'); return; }
  const pf = r.rows[0];
  await editMsg(chatId, msgId,
    '✅ <b>پیشفاکتور ' + pf.no + ' تأیید شد.</b>\n' +
    '👤 مشتری: ' + (pf.center_name || '—') + '\n' +
    '💰 مبلغ: ' + fmtN(pf.total) + ' ﷼\n' +
    '👑 تأیید: ' + sess.name
  );
  await notifyUser(pf.created_by, '✅ پیشفاکتور ' + pf.no + ' توسط ' + sess.name + ' تأیید شد.');
}

async function doRejectPf(chatId, pfId, note, sess) {
  const managerNote = (note === '-' ? '' : note);
  const r = await query(
    `UPDATE proformas SET status='rejected', responded_at=NOW(), responded_by=$2, manager_note=$3, updated_at=NOW()
     WHERE id=$1 AND status='sent' RETURNING *`,
    [pfId, sess.username, managerNote]
  );
  if (!r.rows.length) { await sendMsg(chatId, '⚠️ این پیشفاکتور قابل رد نیست.', { reply_markup: menuFor(sess) }); return; }
  const pf = r.rows[0];
  await sendMsg(chatId,
    '❌ <b>پیشفاکتور ' + pf.no + ' رد شد.</b>' + (managerNote ? '\n📝 دلیل: ' + managerNote : ''),
    { reply_markup: menuFor(sess) }
  );
  await notifyUser(pf.created_by,
    '❌ پیشفاکتور ' + pf.no + ' رد شد.' + (managerNote ? '\nدلیل: ' + managerNote : '')
  );
}

async function doSendPf(chatId, msgId, pfId, sess) {
  const r = await query(
    `UPDATE proformas SET status='sent', sent_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND status='draft' AND created_by=$2 RETURNING *`,
    [pfId, sess.username]
  );
  if (!r.rows.length) { await sendMsg(chatId, '⚠️ این پیشفاکتور قبلاً ارسال شده.'); return; }
  const pf = r.rows[0];
  await editMsg(chatId, msgId,
    '📤 <b>پیشفاکتور ' + pf.no + ' برای تأیید ارسال شد.</b>\n' +
    '👤 مشتری: ' + (pf.center_name || '—') + '\n' +
    '💰 مبلغ: ' + fmtN(pf.total) + ' ﷼'
  );
  await notifyManagers(
    '📄 پیشفاکتور ' + pf.no + ' از ' + sess.name + ' در انتظار تأیید\n' +
    '💰 ' + fmtN(pf.total) + ' ﷼ | 👤 ' + (pf.center_name || '—')
  );
}

// ── 🔍 QR Photo handler ───────────────────────────────────────────────────
async function handlePhoto(chatId, msg) {
  await sendMsg(chatId, '🔍 در حال پردازش تصویر...');
  try {
    const best  = msg.photo[msg.photo.length - 1];
    const buf   = await downloadFile(best.file_id);
    const image = await Jimp.read(buf);
    const { data, width, height } = image.bitmap;
    const code  = jsQR(new Uint8ClampedArray(data), width, height);

    if (!code || !code.data) {
      await sendMsg(chatId, '❌ QR کد در تصویر یافت نشد.\nتصویر واضح‌تری بفرستید.', { reply_markup: MENU_KB });
      return;
    }

    const qrData = code.data.trim();
    await sendMsg(chatId, '📦 کد: <code>' + qrData + '</code>\n\nدر حال جستجو...');

    const lotRes = await query(`
      SELECT l.*, p.name AS prod_name, p.full_name AS prod_full_name, p.unit, w.name AS wh_name
      FROM wms_lots l JOIN wms_products p ON p.id = l.product_id
      LEFT JOIN wms_warehouses w ON w.id = l.warehouse_id
      WHERE l.lot_no = $1 OR l.id = $1 LIMIT 1
    `, [qrData]);

    if (lotRes.rows.length) {
      const l = lotRes.rows[0];
      const daysLeft = l.expiry ? Math.ceil((new Date(l.expiry) - new Date()) / 86400000) : null;
      const expLine  = l.expiry
        ? '\n📅 انقضا: ' + l.expiry.toISOString().slice(0, 10) +
          (daysLeft !== null ? ' (' + daysLeft + ' روز)' : '') +
          (daysLeft !== null && daysLeft < 30 ? ' ⚠️' : '')
        : '';
      await sendMsg(chatId,
        '📦 <b>لات</b>: <code>' + l.lot_no + '</code>\n' +
        '💊 کالا: ' + (l.prod_full_name || l.prod_name) + '\n' +
        '🏭 انبار: ' + (l.wh_name || '—') + '\n' +
        '📊 موجودی لات: ' + fmtN(l.qty) + ' ' + l.unit + expLine +
        (l.ttac_no ? '\n📋 TTAC: ' + l.ttac_no : ''),
        { reply_markup: MENU_KB }
      );
      return;
    }

    const prodRes = await query(`
      SELECT p.*, COALESCE(SUM(l.qty), 0)::int AS total_qty
      FROM wms_products p LEFT JOIN wms_lots l ON l.product_id = p.id
      WHERE p.id = $1 OR p.catalog_code = $1 OR p.irc_code = $1
      GROUP BY p.id LIMIT 1
    `, [qrData]);

    if (prodRes.rows.length) {
      const p = prodRes.rows[0];
      await sendMsg(chatId,
        '💊 <b>کالا</b>: ' + (p.full_name || p.name) + '\n' +
        '🔖 کد کاتالوگ: ' + (p.catalog_code || '—') + '\n' +
        '📋 IRC: ' + (p.irc_code || '—') + '\n' +
        '📦 موجودی کل: ' + fmtN(p.total_qty) + ' ' + p.unit,
        { reply_markup: MENU_KB }
      );
      return;
    }

    await sendMsg(chatId, '🔍 کد <code>' + qrData + '</code> در انبار یافت نشد.', { reply_markup: MENU_KB });
  } catch(e) {
    console.error('[bot] QR scan error:', e.message);
    await sendMsg(chatId, '❌ خطا در پردازش تصویر: ' + e.message, { reply_markup: MENU_KB });
  }
}

// ── 📅 Week Schedule ─────────────────────────────────────────────────────
async function handleWeekSchedule(chatId, sess) {
  const isMgr = isManagerRole(sess.role);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(toJalali(new Date(Date.now() + i * 86400000)));

  let rows;
  try {
    const params = isMgr ? [days[0], days[6]] : [days[0], days[6], sess.username];
    const r = await query(
      `SELECT key, value FROM week_entries
       WHERE value->>'scheduledDate' >= $1 AND value->>'scheduledDate' <= $2
       ${!isMgr ? "AND value->>'addedBy' = $3" : ''}
       ORDER BY value->>'scheduledDate', updated_at`,
      params
    );
    rows = r.rows;
  } catch(e) {
    await sendMsg(chatId, '❌ خطا: ' + e.message, { reply_markup: menuFor(sess) });
    return;
  }

  const byDate = {};
  rows.forEach(function(r) {
    const d = r.value.scheduledDate;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r.value);
  });

  const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  let text = '📅 <b>برنامه ۷ روزه</b>\n\n';
  let totalEntries = 0;

  days.forEach(function(dayStr, i) {
    const entries = byDate[dayStr] || [];
    totalEntries += entries.length;
    if (!entries.length && i > 0) return; // فقط روزهایی که برنامه دارند نمایش بده (امروز همیشه نمایش)

    const dow = new Date(Date.now() + i * 86400000).getDay();
    const dayLabel = i === 0 ? '⭐ امروز' : i === 1 ? 'فردا' : persianDays[dow];
    const done = entries.filter(function(e){ return e.done; }).length;

    text += '<b>' + dayLabel + ' — ' + dayStr + '</b>';
    if (entries.length) text += ' (' + entries.length + (done ? ' | ✅' + done : '') + ')';
    text += '\n';

    entries.slice(0, 5).forEach(function(we) {
      const act = we.actionType === 'call' ? '📞' : '🚗';
      const name = (we.centerName || we.rid || '—').slice(0, 20);
      const ownerTag = isMgr && we.addedBy ? ' <i>(' + we.addedBy + ')</i>' : '';
      text += (we.done ? '  ✅' : '  ⬜') + ' ' + act + ' ' + name + ownerTag + '\n';
    });
    if (entries.length > 5) text += '  و ' + (entries.length - 5) + ' مورد دیگر...\n';
    text += '\n';
  });

  if (!totalEntries) text += 'هیچ برنامه‌ای برای ۷ روز آینده تنظیم نشده.\n\nاز ➕ افزودن به برنامه استفاده کنید.';

  await sendMsg(chatId, text, { reply_markup: menuFor(sess) });
}

// ── 🔔 Notifications ──────────────────────────────────────────────────────
async function handleNotifications(chatId, sess) {
  try {
    const r = await query(
      `SELECT id, msg, center_key, at, read FROM notifications
       WHERE to_user = $1 ORDER BY at DESC LIMIT 15`,
      [sess.username]
    );
    const notifs = r.rows;
    const unread = notifs.filter(function(n){ return !n.read; });

    if (!notifs.length) {
      await sendMsg(chatId, '🔔 <b>اعلان‌ها</b>\n\nهیچ اعلانی وجود ندارد.', { reply_markup: menuFor(sess) });
      return;
    }

    let text = '🔔 <b>اعلان‌ها</b> — ' + notifs.length + ' مورد';
    if (unread.length) text += ' | <b>' + unread.length + ' خوانده‌نشده</b>';
    text += '\n\n';

    notifs.slice(0, 10).forEach(function(n) {
      const icon = n.read ? '·' : '🔵';
      const time = n.at ? toJalali(new Date(n.at)) : '';
      text += icon + ' ' + (n.msg || '') + '\n';
      if (time) text += '   <i>' + time + '</i>\n';
    });
    if (notifs.length > 10) text += '\n<i>و ' + (notifs.length - 10) + ' مورد دیگر...</i>';

    const inlineKb = unread.length ? {
      inline_keyboard: [[{ text: '✅ همه خوانده شد', callback_data: 'notif_readall' }]],
    } : null;

    await sendMsg(chatId, text, inlineKb ? { reply_markup: inlineKb } : { reply_markup: menuFor(sess) });
  } catch(e) {
    await sendMsg(chatId, '❌ خطا: ' + e.message, { reply_markup: menuFor(sess) });
  }
}

// ── ➕ Add to plan ────────────────────────────────────────────────────────
async function handleAddToPlan(chatId, sess) {
  sess.state = ST.AWAIT_PLAN_SEARCH;
  await sendMsg(chatId,
    '🔍 <b>افزودن به برنامه هفته</b>\n\nنام مرکز یا بخشی از نام را بنویسید:\n(<code>/cancel</code> برای لغو)',
    { reply_markup: { force_reply: true } }
  );
}

async function searchCentersInDB(searchText, username, isMgr) {
  const results = [];
  const seen = new Set();
  const like = '%' + searchText + '%';

  // Search week_entries for previously scheduled centers
  try {
    const params = isMgr ? [like] : [like, username];
    const cond   = isMgr ? "WHERE value->>'centerName' ILIKE $1" : "WHERE value->>'centerName' ILIKE $1 AND value->>'addedBy' = $2";
    const r = await query(
      `SELECT DISTINCT ON (value->>'centerName')
              value->>'centerName' AS name,
              value->>'rtype' AS rtype,
              value->>'rid'   AS rid
       FROM week_entries ${cond}
       ORDER BY value->>'centerName'
       LIMIT 12`,
      params
    );
    r.rows.forEach(function(row) {
      const key = (row.rtype || '') + '_' + (row.rid || '');
      if (row.name && !seen.has(key)) {
        seen.add(key);
        results.push({ name: row.name, rtype: row.rtype || 'center', rid: row.rid || '' });
      }
    });
  } catch(e) {}

  // Also search blob edits for nameOverride / more coverage
  if (results.length < 5) {
    try {
      const blobRes = await query("SELECT value FROM app_data WHERE key = 'main'");
      const blob = blobRes.rows.length ? blobRes.rows[0].value : {};
      const edits = blob.edits || {};
      Object.entries(edits).forEach(function([key, e]) {
        const name = e.nameOverride || '';
        if (!name || !name.toLowerCase().includes(searchText.toLowerCase())) return;
        if (seen.has(key)) return;
        seen.add(key);
        const parts = key.split('_');
        const rtype = parts[0];
        const rid   = parts.slice(1).join('_');
        if (results.length < 8) results.push({ name, rtype, rid });
      });
    } catch(e) {}
  }

  return results.slice(0, 8);
}

async function handlePlanSearchResults(chatId, sess, searchText) {
  const isMgr = isManagerRole(sess.role);
  const results = await searchCentersInDB(searchText, sess.username, isMgr);

  if (!results.length) {
    await sendMsg(chatId,
      '❌ مرکزی با نام «' + searchText + '» یافت نشد.\n\nدوباره /add را بزنید یا نام دیگری جستجو کنید.',
      { reply_markup: menuFor(sess) }
    );
    return;
  }

  sess.planResults = results;

  const rows = results.map(function(c, i) {
    return [{ text: c.name.slice(0, 40), callback_data: 'plan_center:' + i }];
  });

  await sendMsg(chatId, '🔍 <b>' + results.length + ' نتیجه</b> — کدام مرکز؟', {
    reply_markup: { inline_keyboard: rows },
  });
}

// ── 🔍 Center search / info ───────────────────────────────────────────────
async function handleCenterSearch(chatId, sess) {
  sess.state = ST.AWAIT_SEARCH_Q;
  await sendMsg(chatId,
    '🔍 <b>جستجوی مرکز</b>\n\nنام مرکز را بنویسید:\n(<code>/cancel</code> برای لغو)',
    { reply_markup: { force_reply: true } }
  );
}

async function handleCenterInfo(chatId, sess, searchText) {
  const isMgr = isManagerRole(sess.role);
  const results = await searchCentersInDB(searchText, sess.username, isMgr);

  if (!results.length) {
    await sendMsg(chatId, '❌ مرکزی با نام «' + searchText + '» یافت نشد.', { reply_markup: menuFor(sess) });
    return;
  }

  if (results.length === 1) {
    await showCenterInfo(chatId, sess, results[0]);
    return;
  }

  sess.searchResults = results;
  const rows = results.map(function(c, i) {
    return [{ text: c.name.slice(0, 40), callback_data: 'info_center:' + i }];
  });
  await sendMsg(chatId, '🔍 <b>' + results.length + ' نتیجه</b> — کدام مرکز؟', {
    reply_markup: { inline_keyboard: rows },
  });
}

async function showCenterInfo(chatId, sess, center) {
  try {
    const blobRes = await query("SELECT value FROM app_data WHERE key = 'main'");
    const data = blobRes.rows.length ? blobRes.rows[0].value : {};

    const key  = (center.rtype || 'center') + '_' + (center.rid || '');
    const edit = (data.edits || {})[key] || {};
    const todayStr = toJalali(new Date());

    const statusLabels = {
      'new': 'جدید', 'contacted': 'تماس گرفته شد', 'interested': 'علاقمند',
      'negotiating': 'مذاکره', 'demo': 'دمو', 'proposal': 'پیشنهاد داده شده',
      'contract': '✅ قرارداد', 'lost': '❌ از دست رفته', 'inactive': 'غیرفعال',
    };

    const status   = statusLabels[edit.status] || edit.status || '—';
    const owner    = edit.owner || '—';
    const followup = edit.followupDate || '—';
    const isOverdue = edit.followupDate && edit.followupDate < todayStr;

    let text = '🏥 <b>' + center.name + '</b>\n\n';
    text += '📊 وضعیت: ' + status + '\n';
    text += '👤 مسئول: ' + owner + '\n';
    text += '📅 فالوآپ: ' + followup;
    if (isOverdue) text += ' ⚠️ <b>معوق!</b>';
    text += '\n';
    if (edit.potential) text += '💎 پتانسیل: P' + edit.potential + '\n';
    if (edit.competitor) text += '🏭 رقیب: ' + edit.competitor + '\n';

    // Last note
    const notes = (data.notes || {})[key] || [];
    if (notes.length) {
      const last = notes[notes.length - 1];
      const noteText = (last.text || last.content || '').slice(0, 200);
      if (noteText) {
        text += '\n📝 <b>آخرین یادداشت:</b>\n' + noteText;
        const by = last.by || last.user;
        if (by) text += '\n   — ' + by;
        if (last.at || last.date) text += ' | ' + toJalali(new Date(last.at || last.date));
      }
    }

    // Recent week entries for this center
    try {
      const weRes = await query(
        `SELECT value FROM week_entries
         WHERE value->>'rtype' = $1 AND value->>'rid' = $2
         ORDER BY value->>'scheduledDate' DESC LIMIT 3`,
        [center.rtype || 'center', center.rid || '']
      );
      if (weRes.rows.length) {
        text += '\n\n📅 <b>آخرین بازدیدها:</b>\n';
        weRes.rows.forEach(function(r) {
          const we = r.value;
          const act = we.actionType === 'call' ? '📞' : '🚗';
          const doneIcon = we.done ? '✅' : '⬜';
          text += doneIcon + ' ' + act + ' ' + (we.scheduledDate || '') + '\n';
        });
      }
    } catch(e) {}

    await sendMsg(chatId, text, { reply_markup: menuFor(sess) });
  } catch(e) {
    await sendMsg(chatId, '❌ خطا در دریافت اطلاعات: ' + e.message, { reply_markup: menuFor(sess) });
  }
}

// ── 📊 Overdue report (manager) ───────────────────────────────────────────
async function handleOverdueReport(chatId, sess) {
  if (!isManagerRole(sess.role)) {
    await sendMsg(chatId, '❌ این قابلیت فقط برای مدیران است.', { reply_markup: menuFor(sess) });
    return;
  }
  const todayStr = toJalali(new Date());

  let blob;
  try {
    const r = await query("SELECT value FROM app_data WHERE key = 'main'");
    blob = r.rows.length ? r.rows[0].value : null;
  } catch(e) { blob = null; }

  if (!blob || !blob.edits) {
    await sendMsg(chatId, '⚠️ داده‌ای یافت نشد.', { reply_markup: menuFor(sess) });
    return;
  }

  // Group overdue centers by owner
  const byOwner = {};
  const ACTIVE = ['contacted', 'interested', 'negotiating', 'demo', 'proposal'];
  Object.entries(blob.edits).forEach(function([key, e]) {
    if (!e.followupDate || e.followupDate >= todayStr) return;
    if (e.status === 'lost' || e.status === 'inactive') return;
    const owner = e.owner || 'نامشخص';
    if (!byOwner[owner]) byOwner[owner] = [];
    const daysLate = Math.floor(
      (new Date(todayStr.replace(/\//g,'-')) - new Date(e.followupDate.replace(/\//g,'-'))) / 86400000
    );
    byOwner[owner].push({ daysLate, date: e.followupDate });
  });

  if (!Object.keys(byOwner).length) {
    await sendMsg(chatId, '✅ <b>گزارش معوق</b>\n\nهیچ مرکز معوقی وجود ندارد! 🎉', { reply_markup: menuFor(sess) });
    return;
  }

  const total = Object.values(byOwner).reduce(function(s, arr){ return s + arr.length; }, 0);
  let text = '📊 <b>گزارش معوق — ' + todayStr + '</b>\n';
  text += '⚠️ مجموع: <b>' + total + '</b> مرکز معوق\n\n';

  Object.entries(byOwner)
    .sort(function(a, b){ return b[1].length - a[1].length; })
    .forEach(function([owner, items]) {
      const maxDelay = Math.max.apply(null, items.map(function(i){ return i.daysLate; }));
      const warn = maxDelay > 14 ? ' 🔴' : maxDelay > 7 ? ' 🟡' : ' 🟢';
      text += '👤 <b>' + owner + '</b>: ' + items.length + ' مرکز' + warn + '\n';
      text += '   بیشترین تأخیر: ' + maxDelay + ' روز\n';
    });

  await sendMsg(chatId, text, { reply_markup: menuFor(sess) });
}

// ── 📈 Weekly KPI (manager) ───────────────────────────────────────────────
async function handleWeeklyKPI(chatId, sess) {
  if (!isManagerRole(sess.role)) {
    await sendMsg(chatId, '❌ این قابلیت فقط برای مدیران است.', { reply_markup: menuFor(sess) });
    return;
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayStr = toJalali(new Date());

  let blob;
  try {
    const r = await query("SELECT value FROM app_data WHERE key = 'main'");
    blob = r.rows.length ? r.rows[0].value : null;
  } catch(e) { blob = null; }

  if (!blob) {
    await sendMsg(chatId, '⚠️ داده‌ای یافت نشد.', { reply_markup: menuFor(sess) });
    return;
  }

  // Collect stats per expert
  const stats = {};
  function inc(by, field) {
    if (!by) return;
    if (!stats[by]) stats[by] = { calls: 0, visits: 0, sales: 0 };
    stats[by][field]++;
  }

  (blob.callLog   || []).filter(function(l){ return l.at && l.at >= weekAgo; }).forEach(function(l){ inc(l.by || l.user, 'calls'); });
  (blob.visitLog  || []).filter(function(l){ return l.at && l.at >= weekAgo; }).forEach(function(l){ inc(l.by || l.user, 'visits'); });
  (blob.salesLog  || []).filter(function(l){ return l.at && l.at >= weekAgo; }).forEach(function(l){ inc(l.by || l.user, 'sales'); });

  // Week entries done this week
  let weDone = {};
  try {
    const r = await query(
      `SELECT value->>'addedBy' AS expert, COUNT(*)::int AS cnt
       FROM week_entries
       WHERE (value->>'done')::boolean = true AND updated_at >= NOW() - INTERVAL '7 days'
       GROUP BY value->>'addedBy'`
    );
    r.rows.forEach(function(row){ weDone[row.expert] = row.cnt; });
  } catch(e) {}

  if (!Object.keys(stats).length && !Object.keys(weDone).length) {
    await sendMsg(chatId, '📈 <b>KPI هفتگی</b>\n\nهیچ فعالیتی در ۷ روز گذشته ثبت نشده.', { reply_markup: menuFor(sess) });
    return;
  }

  // Merge all experts
  const allExperts = new Set([...Object.keys(stats), ...Object.keys(weDone)]);
  let text = '📈 <b>KPI هفتگی — ۷ روز گذشته</b>\n\n';

  Array.from(allExperts).sort().forEach(function(expert) {
    const s = stats[expert] || { calls: 0, visits: 0, sales: 0 };
    const done = weDone[expert] || 0;
    text += '👤 <b>' + expert + '</b>\n';
    text += '  📞 تماس: ' + s.calls + ' | 🚗 بازدید: ' + s.visits;
    if (s.sales)  text += ' | 💰 فروش: ' + s.sales;
    if (done)     text += ' | ✅ انجام: ' + done;
    text += '\n';
  });

  await sendMsg(chatId, text, { reply_markup: menuFor(sess) });
}

// ── 📨 Send message to expert (manager) ──────────────────────────────────
async function handleSendMessage(chatId, sess) {
  if (!isManagerRole(sess.role)) {
    await sendMsg(chatId, '❌ این قابلیت فقط برای مدیران است.', { reply_markup: menuFor(sess) });
    return;
  }

  let users;
  try {
    const r = await query(`SELECT username, display_name, role FROM app_users WHERE active = true ORDER BY display_name`);
    users = r.rows.filter(function(u){ return u.username !== sess.username; });
  } catch(e) {
    await sendMsg(chatId, '❌ خطا در دریافت لیست کاربران.', { reply_markup: menuFor(sess) });
    return;
  }

  if (!users.length) {
    await sendMsg(chatId, '⚠️ کاربر دیگری یافت نشد.', { reply_markup: menuFor(sess) });
    return;
  }

  const rows = [];
  for (let i = 0; i < users.length; i += 2) {
    const row = [{ text: users[i].display_name || users[i].username, callback_data: 'msg_to:' + users[i].username }];
    if (users[i+1]) row.push({ text: users[i+1].display_name || users[i+1].username, callback_data: 'msg_to:' + users[i+1].username });
    rows.push(row);
  }

  await sendMsg(chatId, '📨 <b>ارسال پیام</b>\n\nگیرنده را انتخاب کنید:', {
    reply_markup: { inline_keyboard: rows },
  });
}

// ── Send message action ───────────────────────────────────────────────────
async function doSendMessageToExpert(chatId, sess, recipient, text) {
  try {
    // Create CRM notification (will also push to Telegram via notifications.js hook)
    const id = 'bot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    await query(
      `INSERT INTO notifications (id, to_user, msg, center_key, at)
       VALUES ($1, $2, $3, NULL, NOW())`,
      [id, recipient, '📨 پیام از مدیر: ' + text]
    );
    // Also push directly (in case notifications route hook isn't reachable here)
    await notifyUser(recipient, '📨 <b>پیام از مدیر (' + sess.name + '):</b>\n\n' + text);
    await sendMsg(chatId, '✅ پیام به <b>' + recipient + '</b> ارسال شد.', { reply_markup: menuFor(sess) });
  } catch(e) {
    await sendMsg(chatId, '❌ خطا در ارسال پیام: ' + e.message, { reply_markup: menuFor(sess) });
  }
}

// ── Mark task done from bot ───────────────────────────────────────────────
async function doMarkTaskDone(chatId, sess, taskId) {
  try {
    const r = await query(
      `UPDATE tasks SET done = true, done_at = NOW(), status = 'done'
       WHERE id = $1 AND (owner = $2 OR created_by = $2) RETURNING title`,
      [taskId, sess.username]
    );
    if (!r.rows.length) {
      await sendMsg(chatId, '⚠️ وظیفه یافت نشد یا دسترسی ندارید.');
      return;
    }
    await sendMsg(chatId, '✅ وظیفه «' + r.rows[0].title + '» انجام شد.', { reply_markup: menuFor(sess) });
  } catch(e) {
    await sendMsg(chatId, '❌ خطا: ' + e.message);
  }
}

// ── Notify helpers ────────────────────────────────────────────────────────
async function notifyUser(username, text) {
  try {
    const stored = await loadBotSessions();
    for (const [chatId, s] of Object.entries(stored)) {
      if (s.username === username && s.state === ST.IDLE) {
        await sendMsg(parseInt(chatId), text).catch(function(){});
      }
    }
  } catch(e) {}
}

async function notifyManagers(text) {
  try {
    const stored = await loadBotSessions();
    for (const [chatId, s] of Object.entries(stored)) {
      if (isManagerRole(s.role) && s.state === ST.IDLE) {
        await sendMsg(parseInt(chatId), text).catch(function(){});
      }
    }
  } catch(e) {}
}

async function notifyAll(text) {
  try {
    const stored = await loadBotSessions();
    for (const [chatId, s] of Object.entries(stored)) {
      if (s.username && s.state === ST.IDLE) {
        await sendMsg(parseInt(chatId), text).catch(function(){});
      }
    }
  } catch(e) {}
}

// ── 🌅 Daily morning report ───────────────────────────────────────────────
let _lastReportDate = '';

async function sendDailyReport() {
  try {
    const todayStr = toJalali(new Date());

    // Today's schedule stats per expert from SQL
    const weRes = await query(
      `SELECT
         value->>'addedBy' AS expert,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE (value->>'done')::boolean = true)::int AS done_count
       FROM week_entries WHERE value->>'scheduledDate' = $1
       GROUP BY value->>'addedBy' ORDER BY value->>'addedBy'`,
      [todayStr]
    ).catch(function(){ return { rows: [] }; });

    // Overdue + done entries from blob
    let overdueTotal = 0;
    const expertOverdue = {};
    const expertDoneNames = {};
    try {
      const blobRes = await query("SELECT value FROM app_data WHERE key = 'main'");
      if (blobRes.rows.length) {
        const blob = blobRes.rows[0].value || {};
        const edits = blob.edits || {};
        Object.values(edits).forEach(function(e) {
          if (e.followupDate && e.followupDate < todayStr
              && e.status !== 'قرارداد بسته شد' && e.status !== 'غیرفعال' && e.status !== 'lost') {
            overdueTotal++;
            const ow = e.owner || 'نامشخص';
            expertOverdue[ow] = (expertOverdue[ow] || 0) + 1;
          }
        });
        // Today's done week entries: collect center names per expert
        const weAll = blob.weekEntries || {};
        Object.values(weAll).forEach(function(we) {
          if (!we.done || we.scheduledDate !== todayStr) return;
          const owner = we.addedBy || 'نامشخص';
          if (!expertDoneNames[owner]) expertDoneNames[owner] = [];
          const cname = we.centerName || we.rid || '';
          if (cname && expertDoneNames[owner].length < 3) expertDoneNames[owner].push(cname);
        });
      }
    } catch(e) {}

    const totalToday = weRes.rows.reduce(function(s, r){ return s + r.total; }, 0);
    const totalDone  = weRes.rows.reduce(function(s, r){ return s + r.done_count; }, 0);

    // Pending proformas
    let pfCount = 0;
    try {
      const pfRes = await query(`SELECT COUNT(*)::int AS cnt FROM proformas WHERE status = 'sent'`);
      pfCount = pfRes.rows[0].cnt;
    } catch(e) {}

    let text = '🌅 <b>گزارش صبح — ' + todayStr + '</b>\n\n';
    text += '📅 برنامه امروز: <b>' + totalToday + '</b> مرکز';
    if (totalDone > 0) text += ' | ✅ <b>' + totalDone + '</b> انجام‌شده';
    text += '\n';
    if (overdueTotal > 0) text += '⚠️ مراکز معوق: <b>' + overdueTotal + '</b>\n';
    if (pfCount > 0)      text += '📄 پیشفاکتور منتظر تأیید: <b>' + pfCount + '</b>\n';

    if (weRes.rows.length) {
      text += '\n👥 <b>بر اساس کارشناس:</b>\n';
      weRes.rows.forEach(function(r) {
        const expert = r.expert || 'نامشخص';
        const doneTag  = r.done_count > 0 ? ' ✅' + r.done_count : '';
        const ovTag    = expertOverdue[expert] ? ' ⚠️' + expertOverdue[expert] + ' معوق' : '';
        text += '• ' + expert + ': 📋' + r.total + doneTag + ovTag + '\n';
        // Show names of done centers (max 3)
        const dones = expertDoneNames[expert] || [];
        if (dones.length) {
          text += '  ' + dones.map(function(n){ return '✓ ' + n; }).join(' | ') + '\n';
        }
      });
    }

    await notifyManagers(text);
    console.log('[bot] Daily report sent for ' + todayStr);
  } catch(e) {
    console.error('[bot] daily report error:', e.message);
  }
}

async function sendWeeklyDigest() {
  try {
    const todayStr = toJalali(new Date());
    const now = new Date();

    // Overdue aging from blob
    let aging = { w1: 0, w2: 0, old: 0 };
    let perExpert = {};
    try {
      const blobRes = await query("SELECT value FROM app_data WHERE key = 'main'");
      if (blobRes.rows.length) {
        const blob = blobRes.rows[0].value || {};
        const edits = blob.edits || {};
        Object.values(edits).forEach(function(e) {
          if (!e.followupDate || e.followupDate >= todayStr) return;
          if (e.status === 'lost' || e.status === 'غیرفعال' || e.status === 'قرارداد بسته شد') return;
          // compute days overdue (rough: compare strings in Jalali is OK for same-year)
          const fd = e.followupDate;
          const nowParts = todayStr.split('/').map(Number);
          const fdParts = fd.split('/').map(Number);
          const diffDays = (nowParts[0]-fdParts[0])*365 + (nowParts[1]-fdParts[1])*30 + (nowParts[2]-fdParts[2]);
          if (diffDays <= 7) aging.w1++;
          else if (diffDays <= 30) aging.w2++;
          else aging.old++;
          const owner = e.owner || 'نامشخص';
          if (!perExpert[owner]) perExpert[owner] = { overdue: 0, calls: 0, visits: 0 };
          perExpert[owner].overdue++;
        });

        // Last 7 days calls/visits from logs
        const sevenDaysAgo = new Date(now.getTime() - 7*24*60*60*1000);
        const callLog = Array.isArray(blob.callLog) ? blob.callLog : [];
        const visitLog = Array.isArray(blob.visitLog) ? blob.visitLog : [];
        callLog.forEach(function(l) {
          if (new Date(l.at || l.date) >= sevenDaysAgo) {
            const u = l.by || l.user || 'نامشخص';
            if (!perExpert[u]) perExpert[u] = { overdue: 0, calls: 0, visits: 0 };
            perExpert[u].calls++;
          }
        });
        visitLog.forEach(function(l) {
          if (new Date(l.at || l.date) >= sevenDaysAgo) {
            const u = l.by || l.user || 'نامشخص';
            if (!perExpert[u]) perExpert[u] = { overdue: 0, calls: 0, visits: 0 };
            perExpert[u].visits++;
          }
        });
      }
    } catch(e) {}

    // Done entries this week from SQL
    const weekStart = toJalali(new Date(now.getTime() - 6*24*60*60*1000));
    let doneCounts = {};
    try {
      const weRes = await query(
        `SELECT value->>'addedBy' AS expert, COUNT(*)::int AS cnt
         FROM week_entries
         WHERE (value->>'done')::boolean = true AND value->>'doneDate' >= $1
         GROUP BY value->>'addedBy'`,
        [weekStart]
      );
      weRes.rows.forEach(function(r) { doneCounts[r.expert || 'نامشخص'] = r.cnt; });
    } catch(e) {}

    let text = '📊 <b>خلاصه هفتگی — ' + todayStr + '</b>\n\n';

    // Overdue aging
    const totalOverdue = aging.w1 + aging.w2 + aging.old;
    text += '⚠️ <b>وضعیت معوق‌ها:</b>\n';
    if (totalOverdue === 0) {
      text += '✅ هیچ مرکز معوقی وجود ندارد!\n';
    } else {
      if (aging.w1) text += '🟡 ۱-۷ روز: <b>' + aging.w1 + '</b> مرکز\n';
      if (aging.w2) text += '🟠 ۸-۳۰ روز: <b>' + aging.w2 + '</b> مرکز\n';
      if (aging.old) text += '🔴 بیش از ۳۰ روز: <b>' + aging.old + '</b> مرکز\n';
    }

    // Per-expert summary
    const experts = Object.keys(perExpert).sort();
    if (experts.length) {
      text += '\n👥 <b>عملکرد کارشناسان (۷ روز گذشته):</b>\n';
      experts.forEach(function(u) {
        const s = perExpert[u];
        const done = doneCounts[u] || 0;
        text += '• ' + u + ': ';
        const parts = [];
        if (s.calls) parts.push('📞' + s.calls);
        if (s.visits) parts.push('🤝' + s.visits);
        if (done) parts.push('✅' + done);
        if (s.overdue) parts.push('⚠️' + s.overdue + ' معوق');
        text += (parts.length ? parts.join(' | ') : 'فعالیتی ثبت نشده') + '\n';
      });
    }

    await notifyManagers(text);
    console.log('[bot] Weekly digest sent for ' + todayStr);
  } catch(e) {
    console.error('[bot] weekly digest error:', e.message);
  }
}

let _lastWeeklyDate = '';

function startDailyScheduler() {
  setInterval(async function() {
    try {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const dateKey = now.toDateString();
      if (h === 8 && m === 0 && dateKey !== _lastReportDate) {
        _lastReportDate = dateKey;
        await sendDailyReport();
        // Monday = day 1 in JS (0=Sun, 1=Mon)
        if (now.getDay() === 1 && dateKey !== _lastWeeklyDate) {
          _lastWeeklyDate = dateKey;
          await sendWeeklyDigest();
        }
      }
    } catch(e) {}
  }, 60000);
}

// ── Long-polling loop ─────────────────────────────────────────────────────
let _offset  = 0;
let _running = false;

async function poll() {
  if (!TOKEN) { console.log('[bot] TELEGRAM_BOT_TOKEN not set — bot disabled'); return; }
  _running = true;
  console.log('[bot] Telegram bot started (long-polling)');
  startDailyScheduler();

  while (_running) {
    try {
      const r = await tgCall('getUpdates', {
        offset:          _offset,
        timeout:         25,
        allowed_updates: ['message', 'callback_query'],
      });
      if (r.ok && r.result && r.result.length) {
        for (const upd of r.result) {
          _offset = upd.update_id + 1;
          handleUpdate(upd).catch(function(e){ console.error('[bot] update error:', e.message); });
        }
      }
    } catch(e) {
      console.error('[bot] poll error:', e.message);
      await new Promise(function(res){ setTimeout(res, 5000); });
    }
  }
}

function stop() { _running = false; }

module.exports = { poll, stop, notifyManagers, notifyAll, notifyUser };
