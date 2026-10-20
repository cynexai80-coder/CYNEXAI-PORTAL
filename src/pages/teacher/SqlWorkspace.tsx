import React, { useRef, useState } from 'react';
import alasql from 'alasql';
import { Play, Database, Upload, Loader2, Table } from 'lucide-react';
import { Button } from '../../components/ui/erp/Button';

// A real in-browser SQL engine (alasql) over a small demo dataset - results are computed, not canned.
const buildGeneralDataset = () => {
  const db = new alasql.Database();
  db.exec('CREATE TABLE products (id INT, name STRING, category STRING, price INT)');
  db.exec(`INSERT INTO products VALUES
    (1, 'Laptop', 'Electronics', 55000), (2, 'Headphones', 'Electronics', 2500),
    (3, 'Python Book', 'Books', 600), (4, 'SQL Book', 'Books', 550),
    (5, 'T-Shirt', 'Clothing', 700), (6, 'Jeans', 'Clothing', 1800)`);
  db.exec('CREATE TABLE users (id INT, name STRING, city STRING)');
  db.exec(`INSERT INTO users VALUES
    (1, 'Asha', 'Hyderabad'), (2, 'Ravi', 'Bengaluru'), (3, 'Meena', 'Chennai'), (4, 'Kiran', 'Hyderabad')`);
  db.exec('CREATE TABLE sales (id INT, user_id INT, product_id INT, qty INT, sale_date STRING)');
  db.exec(`INSERT INTO sales VALUES
    (1, 1, 1, 1, '2026-01-05'), (2, 2, 3, 2, '2026-01-07'), (3, 3, 5, 3, '2026-02-11'),
    (4, 4, 2, 1, '2026-02-14'), (5, 1, 4, 1, '2026-03-02'), (6, 2, 6, 2, '2026-03-09')`);
  return db;
};

const formatRows = (rows: any[]): string => {
  if (!rows.length) return 'Query executed successfully. 0 rows returned.';
  const cols = Object.keys(rows[0]);
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length)));
  const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join(' | ');
  return [
    `Results (${rows.length} row${rows.length === 1 ? '' : 's'}):`,
    '',
    line(cols),
    widths.map(w => '-'.repeat(w)).join('-|-'),
    ...rows.map(r => line(cols.map(c => String(r[c] ?? 'NULL')))),
  ].join('\n');
};

export const SqlWorkspace: React.FC = () => {
  const [query, setQuery] = useState('-- Interactive SQL Terminal\n-- Tables: products, users, sales\n\nSELECT * FROM products LIMIT 10;');
  const [output, setOutput] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [datasetLoaded, setDatasetLoaded] = useState(false);
  const dbRef = useRef<any>(null);

  const loadDataset = () => {
    dbRef.current = buildGeneralDataset();
    setDatasetLoaded(true);
    setOutput('Dataset loaded into memory: tables "products", "users" and "sales". You can now query them.');
  };

  const runQuery = async () => {
    setIsExecuting(true);
    setOutput(null);
    if (!datasetLoaded || !dbRef.current) {
      setOutput('Error: No dataset loaded. Please load the dataset first.');
      setIsExecuting(false);
      return;
    }
    try {
      const statements = query
        .split('\n')
        .filter(l => !l.trim().startsWith('--'))
        .join('\n')
        .split(';')
        .map(q => q.trim())
        .filter(Boolean);
      let last: any = [];
      for (const stmt of statements) {
        last = dbRef.current.exec(stmt);
      }
      setOutput(Array.isArray(last) ? formatRows(last) : 'Query executed successfully.');
    } catch (e: any) {
      setOutput(`Error: ${e?.message || String(e)}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-[#0a0a0f] flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-white/5">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-slate-300">SQL Terminal</span>
        </div>
        
        <div className="flex items-center gap-2">
          {!datasetLoaded ? (
            <Button onClick={loadDataset} className="h-8 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">
              <Upload className="w-3.5 h-3.5 mr-2" /> Load General Dataset
            </Button>
          ) : (
            <div className="px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/20 flex items-center gap-2">
              <Table className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-bold text-green-400">general_dataset loaded</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative flex flex-col border-b border-white/5">
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-blue-300 font-mono p-6 text-sm resize-none outline-none z-10 relative"
          spellCheck={false}
        />
      </div>

      <div className="shrink-0 h-48 bg-[#0d0d14] relative z-20 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#11111a]">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Query Results</span>
          <Button
            onClick={runQuery}
            disabled={isExecuting}
            className="h-8 px-4 text-xs font-bold bg-green-700 hover:bg-green-800 text-white"
          >
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Play className="w-3.5 h-3.5 mr-2" />}
            {isExecuting ? 'Executing...' : 'Run Query'}
          </Button>
        </div>
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto bg-black">
          {output ? (
            <pre className={output.includes('Error') ? 'text-red-400' : 'text-slate-300 whitespace-pre-wrap'}>{output}</pre>
          ) : (
            <span className="text-slate-600 italic">Run a query to see results here...</span>
          )}
        </div>
      </div>
    </div>
  );
};
