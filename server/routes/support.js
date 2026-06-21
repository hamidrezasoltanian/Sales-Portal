'use strict';

const express = require('express');
const router  = express.Router();
const { query } = require('../db');

const { requireAuth } = require('../auth');

function isManagerRole(role) {
  return ['مدیر', 'سوپر ادمین'].includes(role);
}

// ── GET /api/support  — list tickets ────────────────────────────────────────
router.get('/', requireAuth, async function(req, res) {
  try {
    const { status, assigned_to, category, center_key, limit = 50, offset = 0 } = req.query;
    const user = req.user;
    const isMgr = isManagerRole(user.role);

    const conditions = [];
    const params = [];

    if (status)      { params.push(status);      conditions.push('t.status = $' + params.length); }
    if (assigned_to) { params.push(assigned_to); conditions.push('t.assigned_to = $' + params.length); }
    if (category)    { params.push(category);    conditions.push('t.category = $' + params.length); }
    if (center_key)  { params.push(center_key);  conditions.push('t.center_key = $' + params.length); }

    // Non-managers only see tickets they reported or are assigned to
    if (!isMgr) {
      params.push(user.username);
      conditions.push('(t.reporter = $' + params.length + ' OR t.assigned_to = $' + params.length + ')');
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    params.push(parseInt(limit) || 50);
    params.push(parseInt(offset) || 0);

    const r = await query(
      `SELECT t.*,
              (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id)::int AS comment_count
       FROM support_tickets t
       ${where}
       ORDER BY
         CASE t.priority WHEN 4 THEN 0 WHEN 3 THEN 1 WHEN 2 THEN 2 ELSE 3 END,
         t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const stats = await query(
      `SELECT status, COUNT(*)::int AS cnt FROM support_tickets
       ${!isMgr ? 'WHERE reporter = $1 OR assigned_to = $1' : ''}
       GROUP BY status`,
      isMgr ? [] : [user.username]
    );

    const statusCounts = {};
    stats.rows.forEach(function(row) { statusCounts[row.status] = row.cnt; });

    res.json({ tickets: r.rows, statusCounts });
  } catch(e) {
    console.error('[support GET /]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/support/stats ───────────────────────────────────────────────────
router.get('/stats', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const isMgr = isManagerRole(user.role);
    const todayStr = new Date().toISOString().slice(0, 10);

    const r = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status IN ('open','in_progress'))::int AS open_count,
         COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_count,
         COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed') AND sla_deadline IS NOT NULL AND sla_deadline < $1)::int AS sla_breached,
         COUNT(*) FILTER (WHERE priority >= 3)::int AS high_priority
       FROM support_tickets
       ${!isMgr ? 'WHERE reporter = $2 OR assigned_to = $2' : ''}`,
      isMgr ? [todayStr] : [todayStr, user.username]
    );

    res.json(r.rows[0] || {});
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/support  — create ticket ──────────────────────────────────────
router.post('/', requireAuth, async function(req, res) {
  try {
    const { title, center_key, center_name, category, priority, description, assigned_to, sla_days } = req.body;
    if (!title) return res.status(400).json({ error: 'عنوان الزامی است' });

    const id = 'tkt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    // Calculate SLA deadline (default 3 days for normal, 1 for critical)
    let slaDeadline = null;
    if (sla_days || priority >= 3) {
      const days = sla_days || (priority >= 4 ? 1 : priority >= 3 ? 2 : 3);
      const d = new Date();
      d.setDate(d.getDate() + days);
      slaDeadline = d.toISOString().slice(0, 10);
    }

    const r = await query(
      `INSERT INTO support_tickets
         (id, title, center_key, center_name, reporter, assigned_to, category, priority, description, sla_deadline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [id, title, center_key || null, center_name || null,
       req.user.username, assigned_to || null,
       category || 'other', parseInt(priority) || 2,
       description || null, slaDeadline]
    );

    // Push Telegram notification to assigned person
    if (assigned_to && assigned_to !== req.user.username) {
      try {
        const notifId = 'ntf_' + Date.now();
        await query(
          `INSERT INTO notifications (id, to_user, msg, at)
           VALUES ($1, $2, $3, NOW())`,
          [notifId, assigned_to, '🎧 تیکت جدید: ' + title + (center_name ? ' — ' + center_name : '')]
        );
      } catch(_) {}
    }

    try { require('../routes/events').broadcast('support-updated', { by: req.user.username }); } catch(_) {}
    res.status(201).json(r.rows[0]);
  } catch(e) {
    console.error('[support POST /]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/support/:id  — ticket detail + comments ────────────────────────
router.get('/:id', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const isMgr = isManagerRole(user.role);
    const r = await query('SELECT * FROM support_tickets WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'تیکت یافت نشد' });
    const ticket = r.rows[0];

    // Access control: non-managers only see their own tickets
    if (!isMgr && ticket.reporter !== user.username && ticket.assigned_to !== user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }

    // Fetch comments — non-managers can't see internal comments
    const cmtRes = await query(
      `SELECT * FROM ticket_comments WHERE ticket_id = $1
       ${!isMgr ? 'AND is_internal = false' : ''}
       ORDER BY at ASC`,
      [req.params.id]
    );

    res.json({ ticket, comments: cmtRes.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/support/:id  — update ticket ───────────────────────────────────
router.put('/:id', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const isMgr = isManagerRole(user.role);
    const { status, assigned_to, priority, resolution, category, title, description } = req.body;

    const r = await query('SELECT * FROM support_tickets WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'تیکت یافت نشد' });
    const ticket = r.rows[0];

    if (!isMgr && ticket.assigned_to !== user.username && ticket.reporter !== user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }

    const updates = [];
    const params = [req.params.id];

    function addField(col, val) {
      if (val !== undefined) {
        params.push(val);
        updates.push(col + ' = $' + params.length);
      }
    }

    addField('status', status);
    addField('assigned_to', assigned_to);
    addField('priority', priority !== undefined ? parseInt(priority) : undefined);
    addField('resolution', resolution);
    addField('category', category);
    addField('title', title);
    addField('description', description);

    if (status === 'resolved' || status === 'closed') {
      updates.push('resolved_at = NOW()');
      updates.push('done = true');
    }

    if (!updates.length) return res.status(400).json({ error: 'هیچ تغییری ارسال نشد' });

    updates.push('updated_at = NOW()');

    const upd = await query(
      `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    // Notify reporter on resolve
    if (status === 'resolved' && ticket.reporter && ticket.reporter !== user.username) {
      try {
        await query(
          `INSERT INTO notifications (id, to_user, msg, at)
           VALUES ($1, $2, $3, NOW())`,
          ['ntf_' + Date.now(), ticket.reporter, '✅ تیکت «' + ticket.title + '» حل شد']
        );
      } catch(_) {}
    }

    try { require('../routes/events').broadcast('support-updated', { by: user.username }); } catch(_) {}
    res.json(upd.rows[0]);
  } catch(e) {
    console.error('[support PUT /:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/support/:id/comment  — add comment ────────────────────────────
router.post('/:id/comment', requireAuth, async function(req, res) {
  try {
    const user = req.user;
    const isMgr = isManagerRole(user.role);
    const { body, is_internal } = req.body;
    if (!body) return res.status(400).json({ error: 'متن کامنت خالی است' });

    const tkt = await query('SELECT reporter, assigned_to FROM support_tickets WHERE id = $1', [req.params.id]);
    if (!tkt.rows.length) return res.status(404).json({ error: 'تیکت یافت نشد' });
    const t = tkt.rows[0];

    if (!isMgr && t.reporter !== user.username && t.assigned_to !== user.username) {
      return res.status(403).json({ error: 'دسترسی ندارید' });
    }

    // Only managers can post internal comments
    const internal = isMgr && !!is_internal;

    const id = 'cmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    const r = await query(
      `INSERT INTO ticket_comments (id, ticket_id, author, body, is_internal)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, req.params.id, user.username, body, internal]
    );

    // Notify the other party
    const notifyTo = user.username === t.reporter ? t.assigned_to : t.reporter;
    if (notifyTo && !internal) {
      try {
        await query(
          `INSERT INTO notifications (id, to_user, msg, at) VALUES ($1, $2, $3, NOW())`,
          ['ntf_' + Date.now(), notifyTo, '💬 پاسخ جدید در تیکت: ' + body.slice(0, 80)]
        );
      } catch(_) {}
    }

    res.status(201).json(r.rows[0]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
