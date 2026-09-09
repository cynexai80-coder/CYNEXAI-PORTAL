require('dotenv').config({path: require('fs').existsSync('.env.prod') ? '.env.prod' : '.env'});
// To sync to prod, run this with the PROD credentials in .env or pass them directly.
// Example: VITE_TURSO_DATABASE_URL=... VITE_TURSO_AUTH_TOKEN=... node scripts/sync_prod_schema.cjs

if (!process.env.VITE_TURSO_DATABASE_URL) {
  console.log('Skipping schema sync: VITE_TURSO_DATABASE_URL is not set.');
  process.exit(0);
}

const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const client = createClient({ 
  url: process.env.VITE_TURSO_DATABASE_URL, 
  authToken: process.env.VITE_TURSO_AUTH_TOKEN 
});

const schemaPath = path.join(__dirname, '..', 'schema.json');
const idealSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

async function sync() {
  if (!process.env.VITE_TURSO_DATABASE_URL) {
    console.log('Skipping schema sync: VITE_TURSO_DATABASE_URL is not set.');
    return;
  }
  console.log('Starting sync with database:', process.env.VITE_TURSO_DATABASE_URL.substring(0, 30) + '...');
  const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  const existingTables = tablesRes.rows.map(r => r.name);

  for (const [tableName, columns] of Object.entries(idealSchema)) {
    if (tableName.startsWith('sqlite_')) continue;
    if (!existingTables.includes(tableName)) {
      console.log(`Table ${tableName} does not exist. Creating table...`);
      const colDefs = columns.map(col => {
        let def = `${col.name} ${col.type || 'TEXT'}`;
        if (col.name === 'id') def += ' PRIMARY KEY';
        if (col.dflt_value !== null && col.dflt_value !== undefined) {
          def += ` DEFAULT ${col.dflt_value}`;
        }
        return def;
      }).join(', ');
      try {
        await client.execute(`CREATE TABLE IF NOT EXISTS ${tableName} (${colDefs})`);
        console.log(`Successfully created table ${tableName}`);
      } catch (e) {
        console.error(`Failed to create table ${tableName}:`, e.message);
      }
      continue;
    }

    const info = await client.execute('PRAGMA table_info(' + tableName + ')');
    const existingColumns = info.rows.map(c => c.name);

    for (const col of columns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`Adding missing column ${col.name} to ${tableName}...`);
        const type = col.type || 'TEXT';
        let query = `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${type}`;
        if (col.dflt_value !== null) {
          query += ` DEFAULT ${col.dflt_value}`;
        }
        try {
            await client.execute(query);
            console.log(`Successfully added ${col.name}`);
        } catch (e) {
            console.error(`Failed to add ${col.name}:`, e.message);
        }
      }
    }
  }
  console.log('Sync complete!');
}

sync().catch(console.error);
