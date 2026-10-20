/**
 * Single source of truth for "was this student present?".
 * An explicit 'Absent' status always wins (a manual "Absent" mark must never count as present).
 */
export interface AttendanceLogLike {
  status?: string | null;
  attendance_type?: string | null;
  duration_minutes?: number | string | null;
}

const PRESENT_TYPES = ['Offline_QR', 'Manual', 'Online'];

export function isPresentLog(log: AttendanceLogLike | null | undefined): boolean {
  if (!log) return false;
  const status = String(log.status || '').toLowerCase();
  if (status === 'absent') return false;
  const duration = Number(log.duration_minutes) || 0;
  return (
    duration >= 5 ||
    status === 'present' ||
    (PRESENT_TYPES.includes(String(log.attendance_type || '')) && status !== 'pending')
  );
}

export function isPendingLog(log: AttendanceLogLike | null | undefined): boolean {
  if (!log) return false;
  const duration = Number(log.duration_minutes) || 0;
  return duration > 0 && duration < 5 && !isPresentLog(log) && String(log.status || '').toLowerCase() !== 'absent';
}
