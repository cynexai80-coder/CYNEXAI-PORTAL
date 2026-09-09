const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const virinchiUrl = 'libsql://cynexai-virinchi-2003.aws-ap-south-1.turso.io';
const virinchiToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODY3MDAzNzgsImlkIjoiMDE5ZmZmYTQtMGMwMS03ZTM5LWE0MGQtNGQ1NjQzY2FlMmI2Iiwia2lkIjoiYzdhbkp0dS1RNE1rRUtCYlNEMlJ5TjI0X2ZsT3lZSE5qSmZHeS1PWTRfayIsInJpZCI6IjBkYTAxZTJmLWZjNTEtNDMzOC1iNjNkLTMyMmJlM2NmNmVhZCJ9.ddP_1AXyt2gTchobZh8CBrTFOrIBZGpa0y7uIAx7eMgG13rDhTM2YOjYOYGWNq5CkZl52dmtHXaAwpLp1zF4Bg';

const targetUrl = process.env.VITE_TURSO_DATABASE_URL;
const targetToken = process.env.VITE_TURSO_AUTH_TOKEN;

const clientVirinchi = createClient({ url: virinchiUrl, authToken: virinchiToken });
const clientTarget = createClient({ url: targetUrl, authToken: targetToken });

async function compare() {
  console.log('=== Comparing Turso Databases ===');
  console.log('Virinchi DB:', virinchiUrl);
  console.log('Target DB:  ', targetUrl);

  let virinchiTables = [];
  let targetTables = [];

  try {
    const resV = await clientVirinchi.execute("SELECT name FROM sqlite_master WHERE type='table'");
    virinchiTables = resV.rows.map(r => r.name).filter(n => !n.startsWith('sqlite_')).sort();
  } catch (e) {
    console.error('Error fetching Virinchi tables:', e.message);
  }

  try {
    const resT = await clientTarget.execute("SELECT name FROM sqlite_master WHERE type='table'");
    targetTables = resT.rows.map(r => r.name).filter(n => !n.startsWith('sqlite_')).sort();
  } catch (e) {
    console.error('Error fetching Target tables:', e.message);
  }

  console.log(`\nVirinchi DB has ${virinchiTables.length} tables:`, virinchiTables);
  console.log(`Target DB has ${targetTables.length} tables:`, targetTables);

  const missingInTarget = virinchiTables.filter(t => !targetTables.includes(t));
  const missingInVirinchi = targetTables.filter(t => !virinchiTables.includes(t));
  const commonTables = virinchiTables.filter(t => targetTables.includes(t));

  console.log(`\nMissing in Target DB (${missingInTarget.length}):`, missingInTarget);
  console.log(`Missing in Virinchi DB (${missingInVirinchi.length}):`, missingInVirinchi);

  console.log('\n--- Row count comparison for all Virinchi tables ---');
  for (const t of virinchiTables) {
    let countV = 0;
    let countT = 0;
    try {
      const cV = await clientVirinchi.execute(`SELECT count(*) as c FROM "${t}"`);
      countV = cV.rows[0].c;
    } catch (e) { countV = 'ERROR: ' + e.message; }

    if (targetTables.includes(t)) {
      try {
        const cT = await clientTarget.execute(`SELECT count(*) as c FROM "${t}"`);
        countT = cT.rows[0].c;
      } catch (e) { countT = 'ERROR: ' + e.message; }
    } else {
      countT = 'TABLE MISSING';
    }

    console.log(`${t.padEnd(30)} | Virinchi: ${String(countV).padStart(6)} | Target: ${String(countT).padStart(6)}`);
  }
}

compare();
