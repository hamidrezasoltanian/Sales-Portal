const { query } = require('../server/db');

(async () => {
  const mtrRes = await query("SELECT key, length(value::text) as size FROM app_data");
  console.log('App Data Rows:');
  console.log(mtrRes.rows);

  const mtrDetail = await query("SELECT key, value FROM app_data WHERE key = 'mtr'");
  if (mtrDetail.rows.length > 0) {
    const val = mtrDetail.rows[0].value;
    console.log('\nMTR Value Keys:', Object.keys(val));
    if (val.DATA) {
      console.log('MTR DATA length:', val.DATA.length);
      console.log('Sample MTR DATA row:', val.DATA.slice(0, 2));
    }
  }
})().catch(console.error);
