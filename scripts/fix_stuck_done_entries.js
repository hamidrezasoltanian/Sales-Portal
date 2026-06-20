'use strict';
/**
 * One-shot script: find week_entries stuck as done:true due to same-week
 * followup bug (scheduledDate > doneDate), then reset them to done:false.
 *
 * Run on production server:
 *   node scripts/fix_stuck_done_entries.js          -- preview only
 *   node scripts/fix_stuck_done_entries.js --fix    -- apply fix
 */

const fs = require('fs');
const path = require('path');

// Load .env
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(function(line) {
      const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
} catch (e) {}

const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'atena_crm',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
});

const DRY_RUN = !process.argv.includes('--fix');

async function main() {
  const client = await pool.connect();
  try {
    // Find affected entries: done=true AND scheduledDate > doneDate
    const { rows } = await client.query(`
      SELECT key,
             value->>'scheduledDate' AS scheduled_date,
             value->>'doneDate'      AS done_date,
             value->>'centerName'    AS center_name,
             value->>'addedBy'       AS added_by
      FROM   week_entries
      WHERE  (value->>'done')::boolean = true
        AND  value->>'scheduledDate' IS NOT NULL
        AND  value->>'doneDate'      IS NOT NULL
        AND  value->>'scheduledDate' > value->>'doneDate'
      ORDER BY value->>'doneDate' DESC
    `);

    if (rows.length === 0) {
      console.log('✅ هیچ آیتم آسیب‌دیده‌ای پیدا نشد.');
      return;
    }

    console.log(`\n📋 ${rows.length} آیتم آسیب‌دیده پیدا شد:\n`);
    console.log('─'.repeat(80));
    rows.forEach(function(r, i) {
      console.log(`${i + 1}. مرکز: ${r.center_name || '?'}`);
      console.log(`   کلید: ${r.key}`);
      console.log(`   تاریخ انجام: ${r.done_date}  →  تاریخ پیگیری (اشتباه): ${r.scheduled_date}`);
      console.log(`   اضافه‌کننده: ${r.added_by || '?'}`);
      console.log('');
    });
    console.log('─'.repeat(80));

    if (DRY_RUN) {
      console.log('\n⚠️  حالت پیش‌نمایش — برای اعمال تغییرات با --fix اجرا کنید:');
      console.log('   node scripts/fix_stuck_done_entries.js --fix\n');
      return;
    }

    // Apply fix: reset done fields, keep scheduledDate (already the correct next date)
    const keys = rows.map(function(r) { return r.key; });
    await client.query(`
      UPDATE week_entries
      SET    value = value
               - 'doneDate'
               - 'doneResult'
               - 'doneNote'
               - 'doneAmount'
               || jsonb_build_object('done', false),
             updated_at = NOW(),
             updated_by = 'fix_script'
      WHERE  key = ANY($1)
    `, [keys]);

    console.log(`\n✅ ${rows.length} آیتم اصلاح شد — done:false، doneDate/Result/Note پاک شد.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(function(err) {
  console.error('خطا:', err.message);
  process.exit(1);
});
