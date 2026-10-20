export interface QRCodeResult {
  qrCode: string;
  expiresAt: number;
}

export interface AttendanceResult {
  success: boolean;
  message: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt?: number;
}

export interface AwardBadgeResult {
  success: boolean;
  awardedBadge: Badge;
}

export interface MockInterview {
  interviewId: string;
  questions: string[];
}

export interface InterviewFeedback {
  score: number;
  comments: string;
}

import { client, isTursoConfigured } from '../turso';
import { logQRAttendance } from './teacher';

const QR_KEY_PREFIX = 'qr_att_';
const QR_TTL_MS = 2 * 60 * 60 * 1000; // a classroom code is valid for 2 hours
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike characters

const randomCode = (len = 6): string => {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
};

/**
 * Creates a real, expiring attendance code for a class/session and stores it.
 * The QR shown to students contains {classId, token: code}; the same code can be typed manually.
 */
export async function generateQRAttendance(sessionId: string): Promise<QRCodeResult> {
  const code = randomCode(6);
  const expiresAt = Date.now() + QR_TTL_MS;
  if (isTursoConfigured && client) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO portal_settings (key, value, updated_at) VALUES (?, ?, ?)`,
      args: [QR_KEY_PREFIX + sessionId, JSON.stringify({ code, expiresAt }), new Date().toISOString()],
    });
  }
  return { qrCode: code, expiresAt };
}

/** Resolves a scanned QR payload or a typed code to the class it belongs to (or null if invalid/expired). */
export async function resolveAttendanceCode(raw: string): Promise<{ classId: string } | null> {
  if (!isTursoConfigured || !client) return null;
  const text = (raw || '').trim();
  if (!text) return null;
  let classId: string | undefined;
  let token = text.toUpperCase();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      classId = parsed.classId ? String(parsed.classId) : undefined;
      token = String(parsed.token || '').toUpperCase();
    }
  } catch { /* typed code */ }
  if (!token) return null;

  const now = Date.now();
  const rows = classId
    ? await client.execute({ sql: 'SELECT key, value FROM portal_settings WHERE key = ?', args: [QR_KEY_PREFIX + classId] })
    : await client.execute({ sql: 'SELECT key, value FROM portal_settings WHERE key LIKE ?', args: [QR_KEY_PREFIX + '%'] });
  for (const row of rows.rows) {
    try {
      const v = JSON.parse(String(row.value));
      if (String(v.code).toUpperCase() === token && Number(v.expiresAt) > now) {
        return { classId: String(row.key).slice(QR_KEY_PREFIX.length) };
      }
    } catch { /* skip malformed */ }
  }
  return null;
}

export async function markAttendanceWithQR(studentId: string, qrData: string): Promise<AttendanceResult> {
  const resolved = await resolveAttendanceCode(qrData);
  if (!resolved) {
    return { success: false, message: 'Invalid or expired attendance code. Ask your teacher to show the current QR code.' };
  }
  const ok = await logQRAttendance(studentId, resolved.classId);
  return ok
    ? { success: true, message: 'Attendance marked successfully!' }
    : { success: false, message: 'Could not save your attendance. Please try again.' };
}

export async function getBadges(studentId: string): Promise<Badge[]> {
  // Mock badges
  return [
    {
      id: 'badge_first_login',
      name: 'First Login',
      description: 'Logged in for the first time',
      icon: 'star',
      earnedAt: Date.now()
    },
    {
      id: 'badge_top_scorer',
      name: 'Top Scorer',
      description: 'Scored 100% in a quiz',
      icon: 'trophy'
    }
  ];
}

export async function awardBadge(studentId: string, badgeId: string): Promise<AwardBadgeResult> {
  // Mock awarding badge
  return {
    success: true,
    awardedBadge: {
      id: badgeId,
      name: 'Newly Awarded Badge',
      description: 'You just earned this badge!',
      icon: 'award',
      earnedAt: Date.now()
    }
  };
}

export async function startMockInterview(studentId: string, topic: string): Promise<MockInterview> {
  // Mock interview start
  return {
    interviewId: `interview_${Date.now()}`,
    questions: [
      'Tell me about yourself.',
      `What are your strengths in ${topic}?`,
      'Describe a challenging project you worked on.'
    ]
  };
}

export async function submitInterviewAnswer(interviewId: string, questionId: string, answer: string): Promise<InterviewFeedback> {
  // Mock answer submission and feedback
  return {
    score: 85,
    comments: 'Good answer, but could be more concise.'
  };
}
