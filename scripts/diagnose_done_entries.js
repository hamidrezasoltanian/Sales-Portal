'use strict';
/**
 * Diagnostic: check done:true week entries in BOTH the SQL table AND the blob.
 * Run: node scripts/diagnose_done_entries.js
 * Fix: node scripts/diagnose_done_entries.js --fix
 */

const fs = require('fs');
const path = require('path');

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

const DO_FIX = process.argv.includes('--fix');

async function main() {
  const client = await pool.connect();
  try {
    // ─── ۱. بررسی SQL week_entries ───────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════');
    console.log('  ۱. جدول week_entries (SQL)');
    console.log('══════════════════════════════════════════════════');

    const { rows: sqlRows } = await client.query(`
      SELECT key,
             value->>'scheduledDate' AS sdate,
             value->>'doneDate'      AS ddate,
             value->>'centerName'    AS cname,
             value->>'doneResult'    AS result
      FROM   week_entries
      WHERE  (value->>'done')::boolean = true
      ORDER BY key
    `);
    console.log(`done:true در SQL: ${sqlRows.length} آیتم`);
    sqlRows.forEach(function(r) {
      console.log(`  • ${r.cname||'?'} | هفته:${r.key.split(':::')[0]} | sDate:${r.sdate||'-'} | dDate:${r.ddate||'-'} | ${r.result||'-'}`);
    });

    // ─── ۲. بررسی Blob (app_data key='main') ────────────────────────────────
    console.log('\n══════════════════════════════════════════════════');
    console.log('  ۲. Blob (app_data → weekEntries)');
    console.log('══════════════════════════════════════════════════');

    const { rows: blobRows } = await client.query(
      "SELECT data FROM app_data WHERE key='main' LIMIT 1"
    );
    if (!blobRows.length || !blobRows[0].data) {
      console.log('blob یافت نشد.');
    } else {
      const db = blobRows[0].data;
      const we = db.weekEntries || {};
      const allKeys = Object.keys(we);
      const doneEntries = allKeys.filter(k => we[k] && we[k].done === true);

      console.log(`کل weekEntries در blob: ${allKeys.length}`);
      console.log(`done:true در blob: ${doneEntries.length}`);

      // نشان بده کدام‌ها فقط در blob هستن (در SQL نیستن)
      const sqlKeySet = new Set(sqlRows.map(r => r.key));
      const blobOnly = doneEntries.filter(k => !sqlKeySet.has(k));
      const inBoth   = doneEntries.filter(k =>  sqlKeySet.has(k));

      console.log(`\n  در هر دو جا (SQL + blob): ${inBoth.length} آیتم`);
      console.log(`  فقط در blob (مشکوک):      ${blobOnly.length} آیتم\n`);

      if (blobOnly.length > 0) {
        console.log('── آیتم‌های فقط در blob (done:true) ──');
        blobOnly.forEach(function(k) {
          const e = we[k];
          const weekId = k.split(':::')[0];
          console.log(`  • ${e.centerName||'?'} | هفته:${weekId} | sDate:${e.scheduledDate||'-'} | dDate:${e.doneDate||'-'} | نتیجه:${e.doneResult||'-'}`);
        });
      }

      if (DO_FIX) {
        // اصلاح: در blob، همه done:true رو به false برگردون
        let fixedCount = 0;
        doneEntries.forEach(function(k) {
          db.weekEntries[k].done = false;
          db.weekEntries[k].doneDate = null;
          db.weekEntries[k].doneResult = null;
          db.weekEntries[k].doneNote = null;
          fixedCount++;
        });
        // ذخیره blob
        await client.query(
          "UPDATE app_data SET data=$1, updated_at=NOW() WHERE key='main'",
          [db]
        );
        console.log(`\n✅ ${fixedCount} آیتم در blob اصلاح شد.`);

        // اصلاح SQL هم
        if (sqlRows.length > 0) {
          const sqlKeys = sqlRows.map(r => r.key);
          await client.query(`
            UPDATE week_entries
            SET value = value - 'doneDate' - 'doneResult' - 'doneNote' - 'doneAmount'
                        || jsonb_build_object('done', false),
                updated_at = NOW(), updated_by = 'fix_script'
            WHERE key = ANY($1)
          `, [sqlKeys]);
          console.log(`✅ ${sqlRows.length} آیتم در SQL اصلاح شد.`);
        }
        console.log('\nبرای اعمال تغییرات pm2 restart sales-portal را اجرا کنید.\n');
      } else {
        console.log('\n⚠️  حالت پیش‌نمایش. برای اصلاح:');
        console.log('   node scripts/diagnose_done_entries.js --fix\n');
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(function(err) {
  console.error('خطا:', err.message);
  process.exit(1);
});
