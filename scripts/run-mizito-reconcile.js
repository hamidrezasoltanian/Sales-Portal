const fs = require('fs');
const path = require('path');
const { query, pool } = require('../server/db');

const PROVINCES = [
  {"id":"p1","row":1,"name":"فارس","potential":1,"biopsyPct":7.28,"owner":"Sarah.hosseini"},
  {"id":"p2","row":2,"name":"اصفهان","potential":1,"biopsyPct":7.68,"owner":"Sarah.hosseini"},
  {"id":"p3","row":3,"name":"سیستان و بلوچستان","potential":1,"biopsyPct":4.16,"owner":"Mohammad.seyedsalehi"},
  {"id":"p4","row":4,"name":"مازندران","potential":1,"biopsyPct":4.93,"owner":"Mohammad.seyedsalehi"},
  {"id":"p5","row":5,"name":"آذربایجان شرقی","potential":1,"biopsyPct":5.86,"owner":"Mohammad.seyedsalehi"},
  {"id":"p6","row":6,"name":"لرستان","potential":2,"biopsyPct":2.64,"owner":"Mohammad.seyedsalehi"},
  {"id":"p7","row":7,"name":"بوشهر","potential":2,"biopsyPct":1.74,"owner":"Mohammad.seyedsalehi"},
  {"id":"p8","row":8,"name":"گلستان","potential":2,"biopsyPct":2.8,"owner":"Mohammad.seyedsalehi"},
  {"id":"p9","row":9,"name":"خراسان جنوبی","potential":3,"biopsyPct":1.15,"owner":"Rambod.ghasemi"},
  {"id":"p10","row":10,"name":"چهارمحال و بختیاری","potential":3,"biopsyPct":1.42,"owner":"Mohammad.seyedsalehi"},
  {"id":"p11","row":11,"name":"اردبیل","potential":3,"biopsyPct":1.91,"owner":"Mohammad.seyedsalehi"},
  {"id":"p12","row":12,"name":"خراسان رضوی","potential":1,"biopsyPct":9.64,"owner":"Rambod.ghasemi"},
  {"id":"p13","row":13,"name":"یزد","potential":2,"biopsyPct":1.71,"owner":"Rambod.ghasemi"},
  {"id":"p14","row":14,"name":"قم","potential":2,"biopsyPct":1.94,"owner":"Rambod.ghasemi"},
  {"id":"p15","row":15,"name":"زنجان","potential":2,"biopsyPct":1.59,"owner":"Rambod.ghasemi"},
  {"id":"p16","row":16,"name":"مرکزی","potential":2,"biopsyPct":2.15,"owner":"Rambod.ghasemi"},
  {"id":"p17","row":17,"name":"گیلان","potential":2,"biopsyPct":3.81,"owner":"Rambod.ghasemi"},
  {"id":"p18","row":18,"name":"خراسان شمالی","potential":3,"biopsyPct":1.29,"owner":"Rambod.ghasemi"},
  {"id":"p19","row":19,"name":"ایلام","potential":3,"biopsyPct":0.87,"owner":"Rambod.ghasemi"},
  {"id":"p20","row":20,"name":"خوزستان","potential":1,"biopsyPct":7.07,"owner":"Reyhane.kashisaz"},
  {"id":"p21","row":21,"name":"کرمانشاه","potential":1,"biopsyPct":2.93,"owner":"Reyhane.kashisaz"},
  {"id":"p22","row":22,"name":"آذربایجان غربی","potential":1,"biopsyPct":4.9,"owner":"Reyhane.kashisaz"},
  {"id":"p23","row":23,"name":"کرمان","potential":1,"biopsyPct":4.75,"owner":"Reyhane.kashisaz"},
  {"id":"p24","row":24,"name":"البرز","potential":2,"biopsyPct":4.07,"owner":"Reyhane.kashisaz"},
  {"id":"p25","row":25,"name":"همدان","potential":2,"biopsyPct":2.6,"owner":"Reyhane.kashisaz"},
  {"id":"p26","row":26,"name":"قزوین","potential":2,"biopsyPct":1.91,"owner":"Reyhane.kashisaz"},
  {"id":"p27","row":27,"name":"کردستان","potential":2,"biopsyPct":2.4,"owner":"Reyhane.kashisaz"},
  {"id":"p28","row":28,"name":"هرمزگان","potential":2,"biopsyPct":2.66,"owner":"Reyhane.kashisaz"},
  {"id":"p29","row":29,"name":"کهگیلویه و بویراحمد","potential":3,"biopsyPct":1.07,"owner":"Reyhane.kashisaz"},
  {"id":"p30","row":30,"name":"سمنان","potential":3,"biopsyPct":1.05,"owner":"Reyhane.kashisaz"}
];

function normalizeName(name) {
  if (!name) return '';
  return name
    .replace(/[\u200c\s\.\-\(\)]/g, '')
    .replace(/بیمارستان/g, '')
    .replace(/کلینیک/g, '')
    .replace(/تصویربرداری/g, '')
    .replace(/سونوگرافی/g, '')
    .replace(/رادیولوژی/g, '')
    .replace(/دکتر/g, '')
    .replace(/مطب/g, '')
    .replace(/شرکت/g, '')
    .replace(/تجهیزات/g, '')
    .replace(/پزشکی/g, '')
    .replace(/داروخانه/g, '')
    .replace(/مرکز/g, '')
    .replace(/خیریه/g, '')
    .trim();
}

async function main() {
  try {
    console.log('════════════════════════════════════════════════════════');
    console.log('  Flow CRM — Mizito Database Reconcile Script (SQL Version 3)');
    console.log('════════════════════════════════════════════════════════');

    // 1. Load CRM centers
    const masterRes = await query(`SELECT "key", "data" FROM centers_master WHERE "key" IN ('CENTERS', 'PC_RAW')`);
    let centers = [];
    let pcRaw = {};

    masterRes.rows.forEach(r => {
      if (r.key === 'CENTERS') centers = r.data || [];
      else if (r.key === 'PC_RAW') pcRaw = r.data || {};
    });

    const crmCenters = [];
    
    // Process CENTERS (Tehran)
    centers.forEach(c => {
      crmCenters.push({
        key: 'center_' + c.id,
        name: c.name,
        normName: normalizeName(c.name),
        province: 'tehran'
      });
    });

    // Process PC_RAW (Other Provinces)
    Object.keys(pcRaw).forEach(provName => {
      const list = pcRaw[provName] || [];
      const provObj = PROVINCES.find(p => p.name === provName || p.id === provName);
      if (!provObj) return;

      list.forEach(c => {
        const rowId = Array.isArray(c) ? c[0] : (c.row || c[0] || 0);
        const name = Array.isArray(c) ? c[1] : (c.name || c[1] || '');
        crmCenters.push({
          key: `pc_${provObj.id}||${rowId}`,
          name: name,
          normName: normalizeName(name),
          province: provObj.id
        });
      });
    });

    console.log(`Loaded ${crmCenters.length} CRM centers from database.`);

    // 2. Parse mizito.txt
    const content = fs.readFileSync(path.resolve(__dirname, '../mizito.txt'), 'utf8');
    const lines = content.split('\n');

    const mizitoCenters = [];
    let currentCenter = null;

    lines.forEach((line, index) => {
      if (index === 0 || !line.trim()) return;
      
      const parts = line.split('\t').map(p => p.trim());
      const rowId = parseInt(parts[0]);

      if (!isNaN(rowId) && parts.length >= 7) {
        if (currentCenter) {
          mizitoCenters.push(currentCenter);
        }
        currentCenter = {
          rowId: rowId,
          name: parts[1],
          brand: parts[2],
          phone: parts[3],
          mobile: parts[4],
          email: parts[5],
          address: parts[6],
          tags: parts[7] || '',
          contacts: []
        };
        const contactName = parts[8];
        const contactPhone = parts[9];
        if (contactName || contactPhone) {
          currentCenter.contacts.push({ name: contactName, phone: contactPhone });
        }
      } else if (currentCenter) {
        const contactName = parts[0] || parts[8] || '';
        const contactPhone = parts[1] || parts[9] || '';
        if (contactName.trim() || contactPhone.trim()) {
          currentCenter.contacts.push({ name: contactName.trim(), phone: contactPhone.trim() });
        }
      }
    });

    if (currentCenter) {
      mizitoCenters.push(currentCenter);
    }

    console.log(`Parsed ${mizitoCenters.length} centers from mizito.txt.`);

    // 3. Match and Update SQL center_contacts
    let updateCount = 0;
    let contactCount = 0;
    
    // Clear old contacts before rewrite to avoid duplicates
    console.log('Clearing old records from center_contacts...');
    await query("DELETE FROM center_contacts WHERE updated_by = 'mizito_reconcile'");

    // For HCP creation later
    const allMatchedContacts = [];

    for (const mc of mizitoCenters) {
      const mcNorm = normalizeName(mc.name);
      
      // Strict Exact Normalized Name Match Only to prevent wrong mappings
      const matched = crmCenters.find(cc => cc.normName === mcNorm);

      if (matched && mc.contacts.length > 0) {
        // Collect all contacts to map to HCP tables later
        mc.contacts.forEach(c => {
          allMatchedContacts.push({
            centerKey: matched.key,
            centerName: matched.name,
            contactName: c.name.trim() || 'مخاطب بدون نام',
            phone: c.phone
          });
        });

        // Enforce 200 char limit on contact_name
        let allNames = mc.contacts.map(c => c.name.trim()).filter(Boolean).join(' / ');
        if (allNames.length > 190) {
          allNames = allNames.substring(0, 187) + '...';
        }
        if (!allNames) allNames = 'مخاطب بدون نام';
        
        const phonesSet = new Set();
        mc.contacts.forEach(c => {
          if (c.phone) {
            const rawPhone = c.phone.replace(/[^0-9]/g, '');
            if (rawPhone) phonesSet.add(c.phone.trim());
          }
        });
        const allPhones = Array.from(phonesSet);

        // Insert directly into center_contacts table with ON CONFLICT RESOLUTION
        await query(
          `INSERT INTO center_contacts (center_key, center_name, contact_name, contact_title, phones, address, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (center_key) 
           DO UPDATE SET 
             contact_name = EXCLUDED.contact_name, 
             phones = EXCLUDED.phones,
             address = EXCLUDED.address,
             updated_by = 'mizito_reconcile',
             updated_at = NOW()`,
          [
            matched.key,
            matched.name,
            allNames,
            '', // title
            allPhones,
            mc.address || '',
            'mizito_reconcile'
          ]
        );
        contactCount += mc.contacts.length;
        updateCount++;
      }
    }

    console.log(`Successfully imported ${contactCount} contacts for ${updateCount} matched centers into center_contacts table.`);

    // 4. Populate healthcare_professionals & affiliations from collected list
    console.log('Populating healthcare_professionals & hcp_affiliations...');
    await query(`TRUNCATE TABLE hcp_affiliations CASCADE;`);
    await query(`TRUNCATE TABLE healthcare_professionals CASCADE;`);
    
    let hcpCount = 0;
    let affCount = 0;

    for (const c of allMatchedContacts) {
      const name = c.contactName;
      const phones = c.phone ? [c.phone.trim()] : [];
      const title = '';
      const centerKey = c.centerKey;

      if (!name || name === 'مخاطب بدون نام') continue;

      let hcpId = null;
      if (phones.length > 0) {
        const checkRes = await query(
          `SELECT id FROM healthcare_professionals WHERE name = $1 AND phones && $2::text[]`,
          [name, phones]
        );
        if (checkRes.rows.length) {
          hcpId = checkRes.rows[0].id;
        }
      } else {
        const checkRes = await query(
          `SELECT id FROM healthcare_professionals WHERE name = $1 AND (phones IS NULL OR cardinality(phones) = 0)`,
          [name]
        );
        if (checkRes.rows.length) {
          hcpId = checkRes.rows[0].id;
        }
      }

      if (!hcpId) {
        hcpId = 'hcp_' + Math.random().toString(36).substring(2, 11);
        await query(
          `INSERT INTO healthcare_professionals (id, name, specialty, rank, phones, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [hcpId, name, null, title || null, phones, 'mizito_reconcile']
        );
        hcpCount++;
      }

      await query(
        `INSERT INTO hcp_affiliations (center_key, hcp_id, role, influence_level, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (center_key, hcp_id) DO NOTHING`,
        [centerKey, hcpId, title || null, 'Decision Maker', 'mizito_reconcile']
      );
      affCount++;
    }

    console.log(`HCP generation complete: Generated ${hcpCount} healthcare professionals and ${affCount} affiliations.`);

    // 5. Trigger auto-restart
    const dbPath = path.resolve(__dirname, '../server/db.js');
    let dbContent = fs.readFileSync(dbPath, 'utf8');
    dbContent += `\n// Trigger restart ${Date.now()}`;
    fs.writeFileSync(dbPath, dbContent, 'utf8');
    console.log('✅ Re-migration triggered successfully. Restarting servers.');

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

main();
