const { createClient } = require('@libsql/client');
const fs = require('fs');

async function inspect() {
  const dbs = ['test_m1_schema.db', 'test_m1_mig.db'];
  
  for (const dbName of dbs) {
    if (fs.existsSync(dbName)) {
      console.log(`\n=================== ${dbName} ===================`);
      const client = createClient({ url: `file:${dbName}` });
      try {
        const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
        for (const t of tables.rows) {
          const tableName = t.name;
          if (tableName.startsWith('sqlite_')) continue;
          const countRes = await client.execute(`SELECT count(*) as c FROM "${tableName}"`);
          console.log(`Table: ${tableName.padEnd(30)} -> ${countRes.rows[0].c} rows`);
        }
      } catch (e) {
        console.error(`Error reading ${dbName}:`, e.message);
      }
    }
  }
}

inspect();
