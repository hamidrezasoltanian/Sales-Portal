'use strict';

const { query } = require('../db');
const seed = require('./hr-onboarding-seed-data');

function uid(prefix) {
  return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

async function ensureOnboardingSeeded() {
  const cnt = await query('SELECT COUNT(*)::int AS c FROM hr_onboarding_phases');
  if ((cnt.rows[0] && cnt.rows[0].c) > 0) {
    await ensureKb();
    return { seeded: false };
  }

  const phases = seed.phases || [];
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const phaseId = 'obp_' + p.phase;
    await query(
      `INSERT INTO hr_onboarding_phases (id, phase_key, title, timeline, owner_label, description, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (phase_key) DO NOTHING`,
      [phaseId, p.phase, p.title, p.timeline || '', p.owner || '', p.description || '', i]
    );
    const tasks = p.tasks || [];
    for (let j = 0; j < tasks.length; j++) {
      const t = tasks[j];
      await query(
        `INSERT INTO hr_onboarding_tasks
           (id, phase_id, task_key, category, task_name, assigned_to, is_required, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (phase_id, task_key) DO NOTHING`,
        [
          'obt_' + t.id,
          phaseId,
          t.id,
          t.category || '',
          t.task_name,
          t.assigned_to || '',
          t.is_required !== false,
          j,
        ]
      );
    }
  }
  await ensureKb(true);
  console.log('[hr-onboarding] seeded', phases.length, 'phases');
  return { seeded: true };
}

async function ensureKb(force) {
  const existing = await query(`SELECT key FROM hr_onboarding_kb WHERE key = 'dataset'`);
  if (existing.rows.length && !force) return;
  await query(
    `INSERT INTO hr_onboarding_kb (key, value, updated_by)
     VALUES ('dataset', $1, 'system')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(seed.kb || {})]
  );
}

async function getTemplate() {
  await ensureOnboardingSeeded();
  const phases = await query(
    `SELECT * FROM hr_onboarding_phases WHERE active = TRUE ORDER BY sort_order, created_at`
  );
  const tasks = await query(
    `SELECT * FROM hr_onboarding_tasks WHERE active = TRUE ORDER BY sort_order, created_at`
  );
  const byPhase = {};
  tasks.rows.forEach(function (t) {
    if (!byPhase[t.phase_id]) byPhase[t.phase_id] = [];
    byPhase[t.phase_id].push(t);
  });
  return phases.rows.map(function (p) {
    return Object.assign({}, p, { tasks: byPhase[p.id] || [] });
  });
}

async function getKb() {
  await ensureOnboardingSeeded();
  const r = await query(`SELECT value FROM hr_onboarding_kb WHERE key = 'dataset'`);
  return (r.rows[0] && r.rows[0].value) || {};
}

module.exports = {
  uid,
  ensureOnboardingSeeded,
  getTemplate,
  getKb,
};
