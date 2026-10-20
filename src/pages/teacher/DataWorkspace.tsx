import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/erp/Button';

// Minimal CSV parser (handles quoted fields and commas inside quotes).
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
};

export const DataWorkspace: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Please choose a .csv file (export Excel sheets as CSV first).');
      if (file.size > 5 * 1024 * 1024) throw new Error('File is too large (max 5 MB).');
      const parsed = parseCsv(await file.text());
      if (parsed.length === 0) throw new Error('The file is empty.');
      setRows(parsed.slice(0, 500));
      setDataLoaded(true);
    } catch (err: any) {
      setError(err?.message || 'Could not read the file.');
      setDataLoaded(false);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const importExcel = () => fileRef.current?.click();
  const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const colLetter = (i: number) => String.fromCharCode(65 + (i % 26));

  return (
    <div className="absolute inset-0 bg-[#0d0d14] flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-white/5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-green-400" />
          <span className="text-sm font-bold text-slate-300">Spreadsheet & Data Viewer</span>
        </div>
        
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          <Button onClick={importExcel} disabled={loading} className="h-8 px-3 text-xs font-bold bg-green-700 hover:bg-green-800 text-white">
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-2" />} 
            Import CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col p-6 items-center justify-center">
        {!dataLoaded ? (
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
              <FileSpreadsheet className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Data Imported</h2>
            <p className="text-slate-400 mb-6 text-sm">Import a CSV file to display data dynamically for the class to follow along.</p>
            {error && <p className="text-red-400 text-sm font-semibold">{error}</p>}
          </div>
        ) : (
          <div className="w-full h-full bg-white dark:bg-black text-black rounded-lg overflow-hidden flex flex-col">
            <div className="bg-slate-100 dark:bg-zinc-900/50 border-b border-slate-300 dark:border-white/10 px-4 py-2 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">A1</span>
              <input type="text" className="flex-1 border border-slate-300 dark:border-white/10 px-2 py-0.5 text-sm" value={rows[0]?.[0] ?? ''} readOnly />
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-zinc-900/50">
                    <th className="border border-slate-300 dark:border-white/10 w-10 bg-slate-200 dark:bg-zinc-900/50"></th>
                    {Array.from({ length: colCount }, (_, i) => (
                      <th key={i} className="border border-slate-300 dark:border-white/10 px-4 py-1 text-center font-normal">{colLetter(i)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td className="border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-zinc-900/50 text-center text-xs text-slate-600">{i + 1}</td>
                      {Array.from({ length: colCount }, (_, c) => (
                        <td key={c} className="border border-slate-300 dark:border-white/10 px-2 py-1">{row[c] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
