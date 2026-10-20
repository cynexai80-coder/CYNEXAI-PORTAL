/**
 * "Today" for CynexAI is the day in India (IST), not the UTC day.
 * `new Date().toISOString().split('T')[0]` gives the UTC date, which is the PREVIOUS day for anyone
 * working/learning between 00:00 and 05:30 IST (attendance, streaks, due dates, reports).
 */
const IST_TIME_ZONE = 'Asia/Kolkata';

export function dateInIST(d: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: IST_TIME_ZONE });
}

export const todayIST = (): string => dateInIST(new Date());

export const yesterdayIST = (): string => dateInIST(new Date(Date.now() - 24 * 60 * 60 * 1000));

/**
 * Parse a DB timestamp that may be either ISO ("2026-10-19T10:00:00.000Z") or SQLite CURRENT_TIMESTAMP
 * ("2026-10-19 10:00:00", which is UTC but has no zone and would otherwise be read as LOCAL time).
 */
export function parseDbTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const v = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(v) ? v.replace(' ', 'T') + 'Z' : v;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
