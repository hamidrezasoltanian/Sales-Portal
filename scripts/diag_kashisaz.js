const { Pool } = require('c:/click-crm-app/node_modules/pg');
const fs = require('fs');

const envPath = 'c:/click-crm-app/.env';
if(fs.existsSync(envPath)){
  fs.readFileSync(envPath,'utf8').split('\n').forEach(function(line){
    const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$/);
    if(m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g,'');
  });
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main(){
  // 1. All users
  const u = await pool.query('SELECT id,username,name FROM users ORDER BY id');
  console.log('\n=== All Users ===');
  u.rows.forEach(r => console.log(' id=' + r.id + '  username=' + r.username + '  name=' + r.name));

  // 2. Settings members from DB blob
  const m = await pool.query("SELECT data->'settings'->'members' AS members FROM user_data LIMIT 1");
  if(m.rows.length && m.rows[0].members){
    console.log('\n=== settings.members (DB blob) ===');
    const members = m.rows[0].members;
    if(Array.isArray(members)) members.forEach(x => console.log('  id=' + x.id + '  name=' + x.name + '  role=' + x.role));
    else console.log(JSON.stringify(members));
  }

  // 3. WeekEntries - count by addedBy (owner resolution)
  const we = await pool.query(
    "SELECT we->>'addedBy' AS added_by, COUNT(*) AS cnt " +
    "FROM user_data, jsonb_each(data->'weekEntries') e(key, we) " +
    "GROUP BY 1 ORDER BY 2 DESC"
  );
  console.log('\n=== WeekEntries grouped by addedBy ===');
  we.rows.forEach(r => console.log('  addedBy=' + r.added_by + '  count=' + r.cnt));

  // 4. check week_entries API table if it exists
  try {
    const we2 = await pool.query(
      'SELECT owner_user_id, scheduled_date, COUNT(*) as cnt FROM week_entries GROUP BY 1,2 ORDER BY scheduled_date DESC, cnt DESC LIMIT 20'
    );
    console.log('\n=== week_entries API table (owner / date / count) ===');
    we2.rows.forEach(r => console.log('  owner=' + r.owner_user_id + '  date=' + r.scheduled_date + '  cnt=' + r.cnt));
  } catch(e){
    console.log('[week_entries table] not found or error: ' + e.message);
  }

  await pool.end();
}

main().catch(e => { console.error('FATAL: ' + e.message); pool.end(); });
