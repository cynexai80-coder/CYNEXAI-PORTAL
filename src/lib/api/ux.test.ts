import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory stand-in for the portal_settings table (where attendance codes are stored).
const store = new Map<string, string>();
vi.mock('../turso', () => ({
  isTursoConfigured: true,
  client: {
    execute: vi.fn(async ({ sql, args }: { sql: string; args: any[] }) => {
      if (sql.includes('INSERT OR REPLACE INTO portal_settings')) {
        store.set(args[0], args[1]);
        return { rows: [] };
      }
      if (sql.includes('FROM portal_settings WHERE key = ?')) {
        return { rows: store.has(args[0]) ? [{ key: args[0], value: store.get(args[0]) }] : [] };
      }
      if (sql.includes('FROM portal_settings WHERE key LIKE ?')) {
        const prefix = String(args[0]).replace('%', '');
        return { rows: [...store.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value })) };
      }
      return { rows: [] };
    }),
  },
}));
vi.mock('./teacher', () => ({ logQRAttendance: vi.fn().mockResolvedValue(true) }));

import { 
  generateQRAttendance, 
  markAttendanceWithQR, 
  getBadges, 
  awardBadge, 
  startMockInterview, 
  submitInterviewAnswer 
} from './ux';

describe('UX API Gaps', () => {
  beforeEach(() => {
    store.clear();
  });

  describe('QR Attendance', () => {
    it('allows teacher to generate a QR code for a session', async () => {
      const result = await generateQRAttendance('session_123');
      expect(result.qrCode).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('allows a student to mark attendance with the real QR payload', async () => {
      const qr = await generateQRAttendance('class_1');
      const payload = JSON.stringify({ classId: 'class_1', token: qr.qrCode });
      const result = await markAttendanceWithQR('student_456', payload);
      expect(result.success).toBe(true);
    });

    it('also accepts the code typed by hand (no class id needed)', async () => {
      const qr = await generateQRAttendance('class_2');
      const result = await markAttendanceWithQR('student_456', qr.qrCode.toLowerCase());
      expect(result.success).toBe(true);
    });

    it('rejects an invalid code and an arbitrary class id', async () => {
      await generateQRAttendance('class_3');
      expect((await markAttendanceWithQR('student_456', 'WRONG1')).success).toBe(false);
      expect((await markAttendanceWithQR('student_456', 'class_3')).success).toBe(false);
    });

    it('rejects an expired code', async () => {
      store.set('qr_att_class_4', JSON.stringify({ code: 'ABC234', expiresAt: Date.now() - 1000 }));
      const result = await markAttendanceWithQR('student_456', 'ABC234');
      expect(result.success).toBe(false);
    });
  });

  describe('Gamification Badges', () => {
    it('fetches a list of badges for a student', async () => {
      const badges = await getBadges('student_456');
      expect(Array.isArray(badges)).toBe(true);
    });

    it('awards a new badge to a student', async () => {
      const result = await awardBadge('student_456', 'badge_gold_star');
      expect(result.success).toBe(true);
      expect(result.awardedBadge.id).toBe('badge_gold_star');
    });
  });

  describe('AI Mock Interview', () => {
    it('starts a new mock interview session', async () => {
      const interview = await startMockInterview('student_456', 'react_developer');
      expect(interview.interviewId).toBeDefined();
      expect(interview.questions.length).toBeGreaterThan(0);
    });

    it('submits an answer and returns AI feedback', async () => {
      const feedback = await submitInterviewAnswer('interview_789', 'question_1', 'My answer is React is a library.');
      expect(feedback.score).toBeDefined();
      expect(feedback.comments).toBeDefined();
    });
  });
});
