const {query} = require('/home/hamidreza/click-crm-v2/server/db');
async function migrate() {
  try {
    await query("ALTER TABLE healthcare_professionals ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;");
    await query("ALTER TABLE healthcare_professionals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;");
    console.log("Migration successful");
  } catch(e) { console.error(e); }
  process.exit(0);
}
migrate();
