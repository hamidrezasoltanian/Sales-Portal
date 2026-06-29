'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = express.Router();

// ── Distribution Algorithm ──────────────────────────────────────
function computeAssignments(dbData, rules) {
  const { experts, lockContracts, freeNoResult } = rules;

  // Build province list from a static list (same as PROVINCES in frontend)
  // We derive province info from DB edits + PC_RAW centers stored in centers_master
  // But since we don't have the master data here directly, we work with edits

  const edits = dbData.edits || {};
  const callLog = dbData.callLog || [];
  const visitLog = dbData.visitLog || [];
  const salesLog = dbData.salesLog || [];

  // Build per-province owner and activity info from edits
  // Keys look like "pc_PROVID||ROW" or "center_N"
  const provOwners = {}; // provId -> { owners: Set, hasContract: bool, hasActivity: bool }
  const centerAssignments = []; // [{centerId, rtype, recKey, fromUser, provId, provName}]

  // Parse all edit keys
  Object.keys(edits).forEach(function (recKey) {
    const ed = edits[recKey];
    const owner = ed.owner;
    const status = ed.status || '';

    if (recKey.startsWith('pc_')) {
      // format: pc_PROVID||ROW
      const rest = recKey.slice(3); // PROVID||ROW
      const sepIdx = rest.indexOf('||');
      if (sepIdx === -1) return;
      const provId = rest.slice(0, sepIdx);

      if (!provOwners[provId]) {
        provOwners[provId] = { owners: new Set(), hasContract: false, hasActivity: false };
      }
      if (owner) provOwners[provId].owners.add(owner);
      if (status === 'قرارداد بسته شد') provOwners[provId].hasContract = true;

      centerAssignments.push({ recKey, rtype: 'pc', provId, fromUser: owner || '', status });
    } else if (recKey.startsWith('center_')) {
      // Tehran center
      centerAssignments.push({ recKey, rtype: 'center', provId: 'tehran', fromUser: owner || '', status });
    }
  });

  // Check activity in logs for each province
  const activeProvIds = new Set();
  [...callLog, ...visitLog].forEach(function (entry) {
    const provId = entry.provId || entry.province_id;
    if (provId) activeProvIds.add(provId);
    // Also check by centerKey
    if (entry.recKey) {
      const rest = entry.recKey.slice(3);
      const sepIdx = rest.indexOf('||');
      if (sepIdx > -1) activeProvIds.add(rest.slice(0, sepIdx));
    }
  });

  // Compute total centers per expert based on current state
  const totalCenters = centerAssignments.length;
  const expertTargets = {}; // expertId -> target count
  experts.forEach(function (e) {
    expertTargets[e.id] = Math.round((e.pct / 100) * totalCenters);
  });

  // Current counts per expert
  const expertCounts = {};
  experts.forEach(function (e) { expertCounts[e.id] = 0; });
  centerAssignments.forEach(function (c) {
    if (c.fromUser && expertCounts[c.fromUser] !== undefined) {
      expertCounts[c.fromUser]++;
    }
  });

  // Classify provinces
  const assignments = [];

  centerAssignments.forEach(function (center) {
    const provId = center.provId;
    const provInfo = provOwners[provId] || { owners: new Set(), hasContract: false, hasActivity: false };
    const hasActivity = activeProvIds.has(provId);
    const hasContract = provInfo.hasContract || center.status === 'قرارداد بسته شد';

    let isLocked = false;
    let toUser = center.fromUser;

    // Determine if locked
    if (lockContracts && hasContract) {
      isLocked = true;
      toUser = center.fromUser; // keep current owner
    } else if (!freeNoResult && hasActivity && !hasContract) {
      // Active but no result — keep locked unless freeNoResult is checked
      isLocked = true;
      toUser = center.fromUser;
    } else {
      // Free to reassign — pick expert most below their target
      isLocked = false;
      let bestExpert = null;
      let bestDelta = -Infinity;

      experts.forEach(function (e) {
        const target = expertTargets[e.id] || 0;
        const current = expertCounts[e.id] || 0;
        const delta = target - current;
        if (delta > bestDelta || bestExpert === null) {
          bestDelta = delta;
          bestExpert = e.id;
        }
      });

      if (bestExpert) {
        toUser = bestExpert;
        if (expertCounts[bestExpert] !== undefined) expertCounts[bestExpert]++;
        // Decrease previous owner count
        if (center.fromUser && expertCounts[center.fromUser] !== undefined && center.fromUser !== bestExpert) {
          expertCounts[center.fromUser]--;
        }
      }
    }

    assignments.push({
      recKey: center.recKey,
      rtype: center.rtype,
      centerId: center.recKey,
      centerName: center.recKey,
      provId: provId,
      provName: provId,
      fromUser: center.fromUser || '',
      toUser: toUser || center.fromUser || '',
      isLocked: isLocked,
      status: center.status,
    });
  });

  return assignments;
}

// GET /api/distribution/proposals — last 10
router.get('/proposals', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, created_by, status, rules, created_at, approved_at FROM distribution_proposals ORDER BY created_at DESC LIMIT 10'
    );
    return res.json(result.rows);
  } catch (e) {
    console.error('[distribution/proposals GET]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/distribution/proposals — compute and save proposal
router.post('/proposals', requireManager, async (req, res) => {
  const { rules } = req.body || {};
  if (!rules || !rules.experts || !Array.isArray(rules.experts)) {
    return res.status(400).json({ error: 'rules.experts الزامی است' });
  }

  try {
    // Load edits from normalized table
    const editsResult = await query('SELECT center_key, data FROM center_edits');
    const edits = {};
    editsResult.rows.forEach(function(r) { edits[r.center_key] = r.data; });
    const dbData = { edits };

    // Compute assignments
    const assignments = computeAssignments(dbData, rules);

    // Save proposal
    const result = await query(
      `INSERT INTO distribution_proposals (created_by, status, rules, assignments, created_at)
       VALUES ($1, 'draft', $2, $3, NOW())
       RETURNING id, created_by, status, rules, assignments, created_at`,
      [req.user.username, JSON.stringify(rules), JSON.stringify(assignments)]
    );

    return res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error('[distribution/proposals POST]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/distribution/proposals/:id/approve
router.put('/proposals/:id/approve', requireManager, async (req, res) => {
  const { id } = req.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return res.status(400).json({ error: 'شناسه نامعتبر' });
  const finalAssignments = req.body && req.body.assignments;

  try {
    // Load proposal
    const propResult = await query(
      'SELECT * FROM distribution_proposals WHERE id = $1',
      [numId]
    );
    if (propResult.rows.length === 0) {
      return res.status(404).json({ error: 'پیشنهاد یافت نشد' });
    }

    const proposal = propResult.rows[0];
    const assignments = finalAssignments || proposal.assignments || [];

    // Apply owner changes directly to center_edits
    let changed = 0;
    for (const a of assignments) {
      if (a.fromUser !== a.toUser && a.toUser) {
        await query(
          `INSERT INTO center_edits (center_key, data, updated_at, updated_by)
           VALUES ($1, jsonb_build_object('owner', $2::text, '_ts', $3::bigint), NOW(), $4)
           ON CONFLICT (center_key) DO UPDATE
             SET data = center_edits.data || jsonb_build_object('owner', $2::text, '_ts', $3::bigint),
                 updated_at = NOW(), updated_by = $4`,
          [a.recKey, a.toUser, Date.now(), req.user.username]
        );
        changed++;
      }
    }

    // Mark proposal as approved
    await query(
      'UPDATE distribution_proposals SET status = $1, approved_at = NOW(), assignments = $2 WHERE id = $3',
      ['approved', JSON.stringify(assignments), numId]
    );

    return res.json({ ok: true, changed });
  } catch (e) {
    console.error('[distribution/proposals/:id/approve]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

// PUT /api/distribution/proposals/:id/reject
router.put('/proposals/:id/reject', requireManager, async (req, res) => {
  const { id } = req.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return res.status(400).json({ error: 'شناسه نامعتبر' });

  try {
    const result = await query(
      "UPDATE distribution_proposals SET status = 'rejected' WHERE id = $1",
      [numId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'پیشنهاد یافت نشد' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[distribution/proposals/:id/reject]', e.message);
    return res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;
