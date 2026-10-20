/**
 * Real (not simulated) Python grading in the browser via Pyodide.
 * Test cases follow the format already produced by the AI question generator:
 *   [{ "input": "1, 2", "expected": "3", "desc": "optional" }]
 * where `input` is the argument list of the student's function call.
 *
 * NOTE: grading still happens on the student's device, so it is a learning aid, not tamper-proof.
 * Server-side grading is part of the server migration.
 */

const PYODIDE_VERSION = 'v0.24.1';

export async function ensurePyodide(): Promise<any> {
  const w = window as any;
  if (w.pyodide) return w.pyodide;
  if (!w.loadPyodide) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the Python runtime. Check your internet connection.'));
      document.body.appendChild(script);
    });
  }
  w.pyodide = await w.loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/` });
  return w.pyodide;
}

export interface PyTestCase {
  input?: string;
  expected?: string;
  desc?: string;
}

export interface GradeResult {
  ran: boolean;          // student code executed without raising
  graded: boolean;       // at least one test case could be evaluated
  passed: number;
  total: number;
  allPassed: boolean;    // ran && (not graded || every test passed)
  stdout: string;
  error?: string;
  details: string[];     // human readable per-test lines
}

export function parseTestCases(raw: unknown): PyTestCase[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter(t => t && (t.input !== undefined || t.expected !== undefined)) : [];
  } catch {
    return [];
  }
}

const normalise = (v: unknown) => String(v ?? '').trim().replace(/^(['"])(.*)\1$/s, '$2');

export async function gradePython(code: string, testCases: PyTestCase[]): Promise<GradeResult> {
  const result: GradeResult = { ran: false, graded: false, passed: 0, total: 0, allPassed: false, stdout: '', details: [] };
  let pyodide: any;
  try {
    pyodide = await ensurePyodide();
  } catch (e: any) {
    result.error = e?.message || 'Python runtime unavailable';
    return result;
  }

  let stdout = '';
  pyodide.setStdout({ batched: (m: string) => { stdout += m + '\n'; } });
  pyodide.setStderr({ batched: (m: string) => { stdout += m + '\n'; } });
  const ns = pyodide.globals.get('dict')();

  try {
    await pyodide.runPythonAsync(code, { globals: ns });
    result.ran = true;
  } catch (e: any) {
    result.error = String(e?.message || e);
    result.stdout = stdout;
    return result;
  }

  const fnMatch = code.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(/m);
  const usable = testCases.filter(t => t.input !== undefined && t.expected !== undefined);
  if (fnMatch && usable.length > 0) {
    result.graded = true;
    result.total = usable.length;
    for (const [i, tc] of usable.entries()) {
      const label = tc.desc || `Test ${i + 1}`;
      try {
        await pyodide.runPythonAsync(`__cx_result = str(${fnMatch[1]}(${tc.input}))`, { globals: ns });
        const actual = String(ns.get('__cx_result'));
        const ok = normalise(actual) === normalise(tc.expected);
        if (ok) result.passed++;
        result.details.push(`${ok ? '✔' : '✘'} ${label}: ${fnMatch[1]}(${tc.input}) → ${actual}${ok ? '' : `  (expected ${tc.expected})`}`);
      } catch (e: any) {
        result.details.push(`✘ ${label}: error – ${String(e?.message || e).split('\n').filter(Boolean).pop()}`);
      }
    }
  }

  result.stdout = stdout;
  result.allPassed = result.ran && (!result.graded || result.passed === result.total);
  return result;
}

export function formatGrade(r: GradeResult): string {
  const lines: string[] = ['⚡ Python (Pyodide) — real execution', '──────────────────────────────────────────────────'];
  if (!r.ran) {
    lines.push('✘ Your code raised an error:', r.error || 'Unknown error');
    return lines.join('\n');
  }
  if (r.stdout.trim()) lines.push('Output:', r.stdout.trim(), '');
  if (r.graded) {
    lines.push(...r.details, '──────────────────────────────────────────────────');
    lines.push(r.allPassed ? `✅ ${r.passed}/${r.total} test cases passed.` : `❌ ${r.passed}/${r.total} test cases passed.`);
  } else {
    lines.push('Ran without errors. (No automated test cases could be applied to this question.)');
  }
  return lines.join('\n');
}
