require('dotenv').config({path: '/home/hamidreza/click-crm-v2/.env'});
const {query} = require('/home/hamidreza/click-crm-v2/server/db');

async function run(){
  try {
    await query('DELETE FROM center_contacts a USING center_contacts b WHERE a.id < b.id AND a.center_key = b.center_key;');
    await query('ALTER TABLE center_contacts ADD CONSTRAINT idx_center_contacts_key UNIQUE (center_key);');
    console.log('OK');
  } catch(e){
    console.log('Err:', e.message);
  }
  process.exit(0);
}
run();
