const {query} = require('/home/hamidreza/click-crm-v2/server/db');
query("SELECT a.*, h.name FROM hcp_affiliations a JOIN healthcare_professionals h ON a.hcp_id = h.id WHERE a.center_key = 'pc_p4||93'")
  .then(r => console.log(r.rows))
  .catch(console.error)
  .finally(() => process.exit(0));
