const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backupDir = '/home/hamidreza/db_backups';

function getExtrasFromFullBackup(filename) {
  const filePath = path.join(backupDir, filename);
  try {
    // Stream and extract only the center_extras COPY section
    const content = execSync(`zcat "${filePath}" | sed -n '/COPY public.center_extras (/,/^\\\\./p'`).toString();
    const lines = content.split('\n');
    
    const records = [];
    for (const line of lines) {
      if (line.startsWith('COPY ') || line.startsWith('\\.') || !line.trim()) {
        continue;
      }
      const parts = line.split('\t');
      if (parts.length >= 3) {
        records.push({
          id: parts[0],
          row_num: parts[1],
          name: parts[2],
          province_id: parts[6]
        });
      }
    }
    return records;
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return null;
  }
}

async function compare() {
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('full_2026') && f.endsWith('.sql.gz'))
    .sort();

  console.log('Available full backups:');
  const backupLists = [];
  files.forEach(f => {
    const list = getExtrasFromFullBackup(f);
    if (list) {
      console.log(`- ${f}: ${list.length} extra centers`);
      backupLists.push({ file: f, list });
    }
  });

  // Compare each sequential pair to see what was added/deleted
  for (let i = 0; i < backupLists.length - 1; i++) {
    const b1 = backupLists[i];
    const b2 = backupLists[i+1];
    
    const map1 = new Map(b1.list.map(c => [c.id, c]));
    const map2 = new Map(b2.list.map(c => [c.id, c]));
    
    const deleted = [];
    for (const [id, c] of map1.entries()) {
      if (!map2.has(id)) deleted.push(c);
    }
    
    const added = [];
    for (const [id, c] of map2.entries()) {
      if (!map1.has(id)) added.push(c);
    }
    
    console.log(`\nChanges from ${b1.file} to ${b2.file}:`);
    console.log(`  Added: ${added.length}, Deleted: ${deleted.length}`);
    deleted.forEach(c => console.log(`    [DELETED] ID: ${c.id}, Name: ${c.name}`));
    added.forEach(c => console.log(`    [ADDED] ID: ${c.id}, Name: ${c.name}`));
  }
}

compare();
