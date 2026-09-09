import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getStudentDashboardData,
  getClassFlowData,
  getLeaderboardData,
  getStudentReferrals,
  saveQaResponse,
  saveMockInterview,
  getLastMockInterview,
  getAnnouncements,
  submitOnlineAttendance,
  processVoiceInterview,
  getInitialInterviewAudio
} from './student';
import { client } from '../turso';

vi.mock('../turso', () => ({
  client: {
    execute: vi.fn()
  },
  isTursoConfigured: true
}));

describe('Student API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStudentDashboardData', () => {
    it('should fetch all dashboard components', async () => {
      vi.mocked(client!.execute).mockResolvedValue({ rows: [] } as any);
      vi.mocked(client!.execute)
        .mockResolvedValueOnce({ rows: [{ id: 'std_1', streak: 5, coins: 100 }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'Course 1' }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'm1', title: 'Module 1', map_order: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'cl1', module_id: 'm1', status: 'completed' }] } as any)
        .mockResolvedValueOnce({ rows: [{ lesson_id: 'cl1' }] } as any);

      const result = await getStudentDashboardData('std_1');

      expect(client!.execute).toHaveBeenCalled();
      expect(result.gamification.streak).toBe(5);
    });

    it('should return null course if no active course found', async () => {
      vi.mocked(client!.execute).mockResolvedValue({ rows: [] } as any);
      const result = await getStudentDashboardData('std_1');
      expect(result.course).toBeNull();
    });
  });

  describe('getClassFlowData', () => {
    it('should return class and questions', async () => {
      vi.mocked(client!.execute)
        .mockResolvedValueOnce({ rows: [{ id: 'cl1', title: 'SQL Basics', youtube_video_id: 'abc123', meet_link: null, type: 'recorded', status: 'completed', ai_summary: '', description: '' }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'q1', class_id: 'cl1', type: 'mcq', question_text: 'What is SQL?', options_json: '[]', correct_answer_idx: 0 }] } as any);

      const result = await getClassFlowData('cl1');
      expect(result.classData?.title).toBe('SQL Basics');
      expect(result.questions).toHaveLength(1);
    });

    it('should return null classData if class not found', async () => {
      vi.mocked(client!.execute)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await getClassFlowData('invalid');
      expect(result.classData).toBeNull();
    });
  });

  describe('getLeaderboardData', () => {
    it('should return students sorted by referral count', async () => {
      vi.mocked(client!.execute).mockResolvedValueOnce({
        rows: [
          { student_id: 's1', student_name: 'Alice', referral_count: 5, coins: 200 },
          { student_id: 's2', student_name: 'Bob', referral_count: 3, coins: 100 }
        ]
      } as any);

      const result = await getLeaderboardData();
      expect(result).toHaveLength(2);
      expect(result[0].student_name).toBe('Alice');
    });
  });

  describe('getStudentReferrals', () => {
    it('should return referrals for a student', async () => {
      vi.mocked(client!.execute).mockResolvedValueOnce({
        rows: [{ id: 'ref1', referred_lead_id: 'lead1', status: 'Completed', reward_paid: 0, lead_name: 'Rahul', created_at: '2026-07-01' }]
      } as any);

      const result = await getStudentReferrals('stu_1');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('Completed');
    });
  });

  describe('saveQaResponse', () => {
    it('should insert a qa response and update student coins', async () => {
      vi.mocked(client!.execute).mockResolvedValue({ rows: [] } as any);

      await saveQaResponse({ studentId: 'std_1', classId: 'cl1', questionId: 'q1', answerIdx: 0, isCorrect: true });
      expect(client!.execute).toHaveBeenCalled();
    });
  });

  describe('saveMockInterview', () => {
    it('should insert a mock interview record and update coins', async () => {
      vi.mocked(client!.execute).mockResolvedValue({ rows: [] } as any);

      await saveMockInterview({ studentId: 'std_1', transcript: 'Hello world', feedback: 'Good', score: 8.5, coinsAwarded: 10 });
      expect(client!.execute).toHaveBeenCalled();
    });
  });

  describe('getLastMockInterview', () => {
    it('should return the last interview for a student', async () => {
      vi.mocked(client!.execute).mockResolvedValueOnce({
        rows: [{ id: 'mi1', student_id: 'std_1', created_at: '2026-07-10T10:00:00Z', score: 7.5 }]
      } as any);

      const result = await getLastMockInterview('std_1');
      expect(result?.score).toBe(7.5);
    });

    it('should return null if no previous interview', async () => {
      vi.mocked(client!.execute).mockResolvedValueOnce({ rows: [] } as any);
      const result = await getLastMockInterview('std_1');
      expect(result).toBeNull();
    });
  });

  describe('getAnnouncements', () => {
    it('should return active announcements', async () => {
      vi.mocked(client!.execute).mockResolvedValueOnce({
        rows: [{ id: 'ann1', title: 'Welcome!', body: 'Welcome to CynexAI', is_active: 1 }]
      } as any);

      const result = await getAnnouncements();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Welcome!');
    });
  });

  describe('submitOnlineAttendance', () => {
    it('should insert attendance log for online student', async () => {
      vi.mocked(client!.execute)
        .mockResolvedValueOnce({ rows: [{ id: 'cl1', status: 'in_progress' }] } as any) // class status check
        .mockResolvedValueOnce({ rows: [] } as any); // insert attendance

      const result = await submitOnlineAttendance('std_1', 'cl1');
      expect(result.success).toBe(true);
    });

    it('should fail if class is not live', async () => {
      vi.mocked(client!.execute).mockResolvedValueOnce({
        rows: [{ id: 'cl1', status: 'scheduled' }]
      } as any);

      const result = await submitOnlineAttendance('std_1', 'cl1');
      expect(result.success).toBe(false);
    });
  });

  describe('Voice Interview APIs', () => {
    it('should send audio blob and return transcript and aiResponse', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('transcriptions')) {
          return { ok: true, json: async () => ({ text: 'I am learning data science.' }) };
        }
        if (typeof url === 'string' && url.includes('chat/completions')) {
          return { ok: true, json: async () => ({ choices: [{ message: { content: 'That is great. What algorithm do you like?' } }] }) };
        }
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8), json: async () => ({ audioBase64: 'mock_base64' }) };
      });

      try {
        vi.stubEnv('VITE_GROQ_VOICE_API', 'mock_key');
        vi.stubEnv('VITE_DEEPGRAM_VOICE_API', 'mock_key');
        const dummyBlob = new Blob(['audio data'], { type: 'audio/webm' });
        const result = await processVoiceInterview(dummyBlob, [], 'What are you learning?', 1, 'aura-orion-en');
        
        expect(result.transcript).toBe('I am learning data science.');
        expect(result.aiResponse).toBe('That is great. What algorithm do you like?');
        expect(result.audioBase64).toBeDefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('getInitialInterviewAudio', () => {
    it('should fetch the initial audio blob from backend', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('chat/completions')) {
          return { ok: true, json: async () => ({ choices: [{ message: { content: 'Welcome to the interview' } }] }) };
        }
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8), json: async () => ({ audioBase64: 'mock_base64' }) };
      });

      try {
        vi.stubEnv('VITE_GROQ_VOICE_API', 'mock_key');
        vi.stubEnv('VITE_DEEPGRAM_VOICE_API', 'mock_key');
        const result = await getInitialInterviewAudio('Welcome to the interview', 'aura-asteria-en');
        expect(result.audioBase64).toBeDefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
