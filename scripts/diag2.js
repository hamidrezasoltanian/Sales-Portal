const db = require('../server/db');

async function main(){
  const kashiUsername = 'Reyhane.kashisaz';
  
  // 1. Centers owned by kashisaz in center_extras
  const owned = await db.query(
    'SELECT COUNT(*) AS cnt FROM center_extras WHERE owner=$1',
    [kashiUsername]
  );
  console.log('\n=== center_extras owned by ' + kashiUsername + ' ===');
  console.log('  count=' + owned.rows[0].cnt);

  // 2. Rids of owned centers (sample)
  const ownedIds = await db.query(
    'SELECT id FROM center_extras WHERE owner=$1 LIMIT 10',
    [kashiUsername]
  );
  console.log('  sample ids: ' + ownedIds.rows.map(r=>r.id).join(', '));

  // 3. week_entries where added_by = kashisaz
  const weHers = await db.query(
    'SELECT COUNT(*) AS cnt FROM week_entries WHERE added_by=$1',
    [kashiUsername]
  );
  console.log('\n=== week_entries added_by kashisaz ===');
  console.log('  count=' + weHers.rows[0].cnt);

  // 4. week_entries where rec_key matches her center ids
  const weByCenter = await db.query(
    'SELECT we.rec_key, we.scheduled_date, we.done, we.added_by, we.center_name ' +
    'FROM week_entries we ' +
    'INNER JOIN center_extras ce ON ce.id = we.rid ' +
    'WHERE ce.owner=$1 ' +
    'ORDER BY we.scheduled_date DESC LIMIT 20',
    [kashiUsername]
  );
  console.log('\n=== week_entries for kashisaz centers (via rec_key join) ===');
  if(weByCenter.rows.length === 0){
    console.log('  *** NONE FOUND ***');
  } else {
    weByCenter.rows.forEach(r => console.log('  date=' + r.scheduled_date + '  name=' + r.center_name + '  added_by=' + r.added_by + '  done=' + r.done));
  }

  // 5. All distinct added_by values in week_entries
  const addedBys = await db.query(
    'SELECT added_by, COUNT(*) AS cnt FROM week_entries GROUP BY added_by ORDER BY cnt DESC'
  );
  console.log('\n=== week_entries added_by breakdown ===');
  addedBys.rows.forEach(r => console.log('  added_by=' + r.added_by + '  count=' + r.cnt));

  // 6. What are today's Jalali date week_entries scheduled for?
  const dates = await db.query(
    'SELECT scheduled_date, COUNT(*) cnt FROM week_entries GROUP BY scheduled_date ORDER BY scheduled_date DESC LIMIT 10'
  );
  console.log('\n=== week_entries by scheduled_date (recent) ===');
  dates.rows.forEach(r => console.log('  date=' + r.scheduled_date + '  cnt=' + r.cnt));

  process.exit(0);
}
main().catch(e => { console.error('FATAL: ' + e.message); process.exit(1); });
