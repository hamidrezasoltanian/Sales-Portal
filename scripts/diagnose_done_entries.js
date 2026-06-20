'use strict';
/**
 * Diagnostic: show breakdown of all done:true week entries.
 * Run on production server and share the output.
 *   node scripts/diagnose_done_entries.js
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

// Jalali today — approximate via Gregorian offset
function todayJalali() {
  const now = new Date();
  const gy = now.getFullYear(), gm = now.getMonth() + 1, gd = now.getDate();
  // g2j approximation (good enough for comparison)
  const g_d_no = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400);
  const j_d_no_start = 365 * 1348 + Math.floor((1348 + 3) / 4) - Math.floor((1348 + 99) / 100) + Math.floor((1348 + 399) / 400) + 79;
  // Use full g2j from a known algorithm
  let jy = 0, jm = 0, jd = 0;
  const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
  const g_y = gy - 1600; const g_m = gm - 1; const g_d = gd - 1;
  let g_d_no2 = 365 * g_y + Math.floor((g_y + 3) / 4) - Math.floor((g_y + 99) / 100) + Math.floor((g_y + 399) / 400);
  for (let i = 0; i < g_m; i++) g_d_no2 += gdm[i];
  if (g_m > 1 && ((g_y % 4 === 0 && g_y % 100 !== 0) || g_y % 400 === 0)) g_d_no2++;
  g_d_no2 += g_d;
  let j_d_no2 = g_d_no2 - 79;
  const j_np = Math.floor(j_d_no2 / 12053); j_d_no2 %= 12053;
  jy = 979 + 33 * j_np + 4 * Math.floor(j_d_no2 / 1461);
  j_d_no2 %= 1461;
  if (j_d_no2 >= 366) { jy += Math.floor((j_d_no2 - 1) / 365); j_d_no2 = (j_d_no2 - 1) % 365; }
  const jdm = [31,29,31,30,31,31,30,30,30,29,30,29,31];
  for (let i = 0; i < 11 && j_d_no2 >= jdm[i]; i++) { j_d_no2 -= jdm[i]; jm++; }
  jd = j_d_no2 + 1;
  const p2 = n => String(n).padStart(2, '0');
  return `${jy}/${p2(jm + 1)}/${p2(jd)}`;
}

async function main() {
  const today = todayJalali();
  console.log(`\nتاریخ امروز (تقریبی جلالی): ${today}\n`);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT key,
             value->>'scheduledDate' AS sdate,
             value->>'doneDate'      AS ddate,
             value->>'centerName'    AS cname,
             value->>'addedBy'       AS added_by,
             value->>'doneResult'    AS result,
             updated_at
      FROM   week_entries
      WHERE  (value->>'done')::boolean = true
      ORDER BY key
    `);

    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`  کل آیتم‌های done:true در week_entries: ${rows.length}`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    const buckets = {
      future_sdate_no_ddate: [],   // scheduledDate در آینده، doneDate ندارد
      future_sdate_with_ddate: [], // scheduledDate در آینده، doneDate دارد (buggy)
      past_sdate_no_ddate: [],     // scheduledDate گذشته، doneDate ندارد (قدیمی)
      past_sdate_with_ddate: [],   // scheduledDate گذشته، doneDate دارد (OK)
      no_sdate: [],                // scheduledDate ندارد
    };

    rows.forEach(function(r) {
      const sd = r.sdate || '';
      const dd = r.ddate || '';
      if (!sd) {
        buckets.no_sdate.push(r);
      } else if (sd > today) {
        if (!dd) buckets.future_sdate_no_ddate.push(r);
        else     buckets.future_sdate_with_ddate.push(r);
      } else {
        if (!dd) buckets.past_sdate_no_ddate.push(r);
        else     buckets.past_sdate_with_ddate.push(r);
      }
    });

    function show(label, list) {
      console.log(`── ${label}: ${list.length} آیتم`);
      list.slice(0, 10).forEach(function(r) {
        const weekId = r.key.split(':::')[0];
        console.log(`   • ${r.cname||'?'} | هفته:${weekId} | sDate:${r.sdate||'-'} | dDate:${r.ddate||'-'} | نتیجه:${r.result||'-'}`);
      });
      if (list.length > 10) console.log(`   ... و ${list.length - 10} مورد دیگر`);
      console.log('');
    }

    show('✅ طبیعی (sDate گذشته + dDate دارد)', buckets.past_sdate_with_ddate);
    show('⚠️  بدون dDate، sDate گذشته (قدیمی)', buckets.past_sdate_no_ddate);
    show('🔴 مشکوک: sDate آینده + dDate دارد', buckets.future_sdate_with_ddate);
    show('🔴 مشکوک: sDate آینده، بدون dDate', buckets.future_sdate_no_ddate);
    show('⚠️  بدون scheduledDate', buckets.no_sdate);

    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`خلاصه:`);
    console.log(`  طبیعی:                    ${buckets.past_sdate_with_ddate.length}`);
    console.log(`  قدیمی (بدون dDate):        ${buckets.past_sdate_no_ddate.length}`);
    console.log(`  مشکوک (sDate آینده+dDate): ${buckets.future_sdate_with_ddate.length}`);
    console.log(`  مشکوک (sDate آینده-dDate): ${buckets.future_sdate_no_ddate.length}`);
    console.log(`  بدون scheduledDate:        ${buckets.no_sdate.length}`);
    console.log(`═══════════════════════════════════════════════════════\n`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(function(err) {
  console.error('خطا:', err.message);
  process.exit(1);
});
