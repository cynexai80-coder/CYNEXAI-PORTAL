import { client } from '../turso';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function executeWithRetry(query: string, args: any[] = [], retries = MAX_RETRIES): Promise<any> {
  try {
    if (!client) throw new Error('Database client not configured');
    return await client.execute({ sql: query, args });
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return executeWithRetry(query, args, retries - 1);
    }
    throw error;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentDashboardData {
  course: any;
  gamification: { streak: number; coins: number };
  modules: any[];
  upcomingClass: any | null;
}

export interface ClassFlowData {
  classData: any | null;
  questions: any[];
  hasWatched: boolean;
  hasAnswered: boolean;
  answeredQuestionIds: string[];
}

export interface LeaderboardEntry {
  student_id: string;
  student_name: string;
  referral_count: number;
  coins: number;
}

export interface Referral {
  id: string;
  referred_lead_id: string;
  status: string;
  reward_paid: number;
  lead_name: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  is_active: number;
  created_at: string;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  qualifications: string;
  source_url: string;
  expire_date: string;
}

export interface MockInterview {
  id: string;
  student_id: string;
  transcript: string;
  feedback: string;
  score: number;
  coins_awarded: number;
  created_at: string;
}

export async function getStudentMode(studentId: string): Promise<string> {
  try {
    const res = await executeWithRetry(
      `SELECT preferred_mode FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1`,
      [studentId, studentId]
    );
    return res.rows.length > 0 ? (res.rows[0].preferred_mode as string) || 'Online' : 'Online';
  } catch (e) {
    return 'Online';
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getStudentDashboardData(studentId: string): Promise<StudentDashboardData> {
  // NEVER throw from this function — always return a safe default
  let stu: any = null;
  try {
    const studentRow = await executeWithRetry(
      `SELECT * FROM students WHERE id = ? LIMIT 1`,
      [studentId]
    );
    // Also try portal_login_email match
    if (studentRow.rows.length > 0) {
      stu = studentRow.rows[0];
    } else {
      const byEmail = await executeWithRetry(
        `SELECT st.* FROM students st JOIN users u ON st.portal_login_email = u.email WHERE u.id = ? LIMIT 1`,
        [studentId]
      );
      if (byEmail.rows.length > 0) stu = byEmail.rows[0];
    }
  } catch { /* students table may not exist */ }

  const gamification = stu
    ? { streak: Number(stu.streak) || 0, coins: Number(stu.coins) || 0 }
    : { streak: 0, coins: 0 };

  // Find active course
  let activeCourse: any = null;
  try {
    // Try onboarding chain
    const chainRes = await executeWithRetry(
      `SELECT c.* FROM courses c
       JOIN sales s ON c.id = s.course_id
       JOIN onboardings o ON s.id = o.sale_id
       JOIN students st ON o.id = st.onboarding_id
       WHERE st.id = ?
       LIMIT 1`,
      [studentId]
    );
    if (chainRes.rows.length > 0) activeCourse = chainRes.rows[0];
  } catch { /* no chain */ }

  // Fallback: students.course field
  if (!activeCourse && stu?.course) {
    try {
      const directRes = await executeWithRetry(
        `SELECT * FROM courses WHERE name = ? OR title = ? LIMIT 1`,
        [stu.course, stu.course]
      );
      if (directRes.rows.length > 0) activeCourse = directRes.rows[0];
    } catch { /* no courses */ }
  }

  // Fallback: first course
  if (!activeCourse) {
    try {
      const fallback = await executeWithRetry(`SELECT * FROM courses ORDER BY created_at ASC LIMIT 1`);
      if (fallback.rows.length > 0) activeCourse = fallback.rows[0];
    } catch { /* no courses table */ }
  }

  if (!activeCourse) {
    return { course: null, gamification, modules: [], upcomingClass: null };
  }

  // Now we can parallelize the remaining independent tasks
  // 1. Fetch modules, classes, progress, QA (they depend on activeCourse.id)
  // 2. Fetch upcoming class (independent of course id)
  
  const [modulesDataResult, upcomingClassResult] = await Promise.all([
    (async () => {
      let modulesData: any[] = [];
      if (!activeCourse) return modulesData;

      try {
        const [modRes, clsRes, progRes, qaRes] = await Promise.all([
          // Get Modules
          executeWithRetry(
            `SELECT m.*, cmm.order_index as map_order
             FROM modules m
             JOIN course_module_mapping cmm ON m.id = cmm.module_id
             WHERE cmm.course_id = ?
             ORDER BY cmm.order_index ASC`,
            [activeCourse.id]
          ),
          // Get Classes
          executeWithRetry(
            `SELECT id, module_id, status, type FROM classes WHERE module_id IN (
               SELECT module_id FROM course_module_mapping WHERE course_id = ?
             )`,
            [activeCourse.id]
          ).catch(() => ({ rows: [] })),
          // Get Progress
          executeWithRetry(
            "SELECT lesson_id FROM student_progress WHERE student_id = ? AND completed = 1",
            [studentId]
          ).catch(() => ({ rows: [] })),
          // Get QA
          executeWithRetry(
            `SELECT class_id, COUNT(*) as cnt FROM qa_responses WHERE student_id = ? GROUP BY class_id`,
            [studentId]
          ).catch(() => ({ rows: [] }))
        ]);

        const clsRows = clsRes.rows || [];
        const completedSet = new Set((progRes.rows || []).map((r: any) => r.lesson_id));
        
        let qaByClass: Record<string, number> = {};
        (qaRes.rows || []).forEach((r: any) => { qaByClass[r.class_id] = Number(r.cnt); });

        modulesData = (modRes.rows || []).map((m: any) => {
          const mClasses = clsRows.filter((c: any) => c.module_id === m.id);
          const completed = mClasses.filter((c: any) => completedSet.has(c.id) || c.status === 'completed').length;
          const qaTotal = mClasses.reduce((s: number, c: any) => s + (qaByClass[c.id] || 0), 0);
          const quizClasses = mClasses.filter((c: any) => ['quiz','qa','q&a'].includes((c.type||'').toLowerCase())).length;
          const codeClasses = mClasses.filter((c: any) => ['code','exercise','coding'].includes((c.type||'').toLowerCase())).length;
          return {
            ...m,
            totalClasses: mClasses.length,
            completedClasses: completed,
            progressPct: mClasses.length > 0 ? Math.round((completed / mClasses.length) * 100) : 0,
            questionsAnswered: qaTotal,
            quizCount: quizClasses,
            codeExerciseCount: codeClasses,
          };
        });
      } catch { /* ignore */ }
      return modulesData;
    })(),

    (async () => {
      let upcomingClass = null;
      try {
        const tsRes = await executeWithRetry(
          `SELECT id, title, date, start_time, meet_link, 'live' as type FROM timetable_slots
           WHERE date >= date('now') ORDER BY date ASC, start_time ASC LIMIT 1`
        );
        if (tsRes.rows.length > 0) upcomingClass = tsRes.rows[0];
      } catch { /* no timetable */ }
      if (!upcomingClass) {
        try {
          const clsUp = await executeWithRetry(
            `SELECT id, title, date, start_time, meet_link, type FROM classes
             WHERE type = 'live' AND date >= date('now') ORDER BY date ASC, start_time ASC LIMIT 1`
          );
          if (clsUp.rows.length > 0) upcomingClass = clsUp.rows[0];
        } catch { /* ignore */ }
      }
      return upcomingClass;
    })()
  ]);

  return { course: activeCourse, gamification, modules: modulesDataResult, upcomingClass: upcomingClassResult };
}

// ─── Class Flow ───────────────────────────────────────────────────────────────

export async function getClassFlowData(classId: string, studentId?: string): Promise<ClassFlowData> {
  try {
    const clsRes = await executeWithRetry(
      `SELECT id, title, youtube_video_id, meet_link, type, status, ai_summary, description, ai_study_guide
       FROM classes WHERE id = ?`,
      [classId]
    );
    const questionsRes = await executeWithRetry(
      `SELECT * FROM class_questions WHERE class_id = ? ORDER BY created_at ASC`,
      [classId]
    );

    let hasWatched = false;
    let hasAnswered = false;
    let answeredQuestionIds: string[] = [];

    if (studentId) {
      const progRes = await executeWithRetry(
        `SELECT * FROM student_progress WHERE student_id = ? AND lesson_id = ? AND completed = 1`,
        [studentId, classId]
      );
      hasWatched = progRes.rows.length > 0;

      const qaRes = await executeWithRetry(
        `SELECT question_id FROM qa_responses WHERE student_id = ? AND class_id = ?`,
        [studentId, classId]
      );
      answeredQuestionIds = qaRes.rows.map((r: any) => r.question_id);
      hasAnswered = qaRes.rows.length > 0;
    }

    return {
      classData: clsRes.rows.length > 0 ? clsRes.rows[0] : null,
      questions: questionsRes.rows,
      hasWatched,
      hasAnswered,
      answeredQuestionIds
    };
  } catch (e) {
    console.error(e);
    return { classData: null, questions: [], hasWatched: false, hasAnswered: false, answeredQuestionIds: [] };
  }
}

export async function markClassWatched(studentId: string, classId: string): Promise<void> {
  try {
    let realStudentId = studentId;
    try {
      const res = await executeWithRetry(
        "SELECT id FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1",
        [studentId, studentId]
      );
      if (res.rows.length > 0) realStudentId = res.rows[0].id as string;
    } catch (e) {}

    const id = `sp_${Date.now()}`;
    await executeWithRetry(
      `INSERT OR IGNORE INTO student_progress (id, student_id, lesson_id, completed, created_at) VALUES (?, ?, ?, 1, ?)`,
      [id, studentId, classId, new Date().toISOString()]
    );
    // Update streak
    await executeWithRetry(
      `UPDATE students SET last_streak_date = ?, streak = streak + 1 WHERE id = ? AND (last_streak_date IS NULL OR last_streak_date != date('now'))`,
      [new Date().toISOString().split('T')[0], realStudentId]
    );
  } catch (e) {
    console.error('Failed to mark class watched', e);
  }
}

// ─── Q&A ──────────────────────────────────────────────────────────────────────

export interface QaResponseInput {
  studentId: string;
  classId: string;
  questionId: string;
  answerIdx?: number;
  isCorrect: boolean;
  codeAnswer?: string;
}

export async function saveQaResponse(input: QaResponseInput): Promise<void> {
  const id = `qa_${Date.now()}`;
  await executeWithRetry(
    `INSERT INTO qa_responses (id, student_id, class_id, question_id, answer_idx, is_correct, code_answer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.studentId, input.classId, input.questionId, input.answerIdx ?? null, input.isCorrect ? 1 : 0, input.codeAnswer ?? null, new Date().toISOString()]
  );
  if (input.isCorrect) {
    let realStudentId = input.studentId;
    try {
      const res = await executeWithRetry(
        "SELECT id FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1",
        [input.studentId, input.studentId]
      );
      if (res.rows.length > 0) realStudentId = res.rows[0].id as string;
    } catch (e) {}
    
    await executeWithRetry(
      `UPDATE students SET coins = coins + 5 WHERE id = ?`,
      [realStudentId]
    );
  }
}

// ─── Module Map ───────────────────────────────────────────────────────────────

export async function getModuleMapData(moduleId: string, studentId: string) {
  try {
    const modRes = await executeWithRetry("SELECT * FROM modules WHERE id = ?", [moduleId]);
    const clsRes = await executeWithRetry(
      "SELECT id, title, type, status, order_index, youtube_video_id, meet_link, date, start_time FROM classes WHERE module_id = ? ORDER BY order_index ASC",
      [moduleId]
    );
    const progRes = await executeWithRetry(
      "SELECT lesson_id FROM student_progress WHERE student_id = ? AND completed = 1",
      [studentId]
    );
    const qaRes = await executeWithRetry(
      `SELECT qr.class_id, cq.type 
       FROM qa_responses qr 
       JOIN class_questions cq ON qr.question_id = cq.id 
       WHERE qr.student_id = ?`,
      [studentId]
    );

    const completedQaIds = new Set<string>();
    const completedCodingIds = new Set<string>();
    qaRes.rows.forEach((r: any) => {
      if (r.type === 'mcq') completedQaIds.add(r.class_id);
      if (r.type === 'coding') completedCodingIds.add(r.class_id);
    });

    const studentRes = await executeWithRetry("SELECT batch_number FROM students WHERE id = ?", [studentId]);
    let batchProgress = null;
    if (studentRes.rows.length > 0 && studentRes.rows[0].batch_number) {
        const batchRes = await executeWithRetry("SELECT module_progress_json FROM batches WHERE id = ?", [studentRes.rows[0].batch_number]);
        if (batchRes.rows.length > 0 && batchRes.rows[0].module_progress_json) {
           try {
             batchProgress = JSON.parse(batchRes.rows[0].module_progress_json as string);
           } catch(e) {}
        }
    }

    return {
      moduleData: modRes.rows.length > 0 ? modRes.rows[0] : null,
      classes: clsRes.rows,
      completedLessonIds: new Set(progRes.rows.map((r: any) => r.lesson_id)),
      completedQaIds,
      completedCodingIds,
      batchProgress
    };
  } catch (e) {
    console.error(e);
    return { moduleData: null, classes: [], completedLessonIds: new Set(), completedQaIds: new Set(), completedCodingIds: new Set(), batchProgress: null };
  }
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export async function getActiveLiveClassStudent() {
  try {
    const res = await executeWithRetry("SELECT id, title, meet_link FROM classes WHERE type = 'live' AND status = 'in_progress' LIMIT 1");
    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function checkClassStatus(classId: string) {
  try {
    const res = await executeWithRetry("SELECT status FROM classes WHERE id = ?", [classId]);
    return res.rows.length > 0 ? res.rows[0].status : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function submitOnlineAttendance(studentId: string, classId: string): Promise<{ success: boolean; message: string }> {
  try {
    const clsRes = await executeWithRetry("SELECT id, status FROM classes WHERE id = ?", [classId]);
    if (clsRes.rows.length === 0) return { success: false, message: 'Class not found.' };
    const cls = clsRes.rows[0];
    if (cls.status !== 'in_progress') return { success: false, message: 'Class is not currently live.' };

    const id = `att_${Date.now()}`;
    await executeWithRetry(
      `INSERT OR IGNORE INTO attendance_logs (id, student_id, join_time) VALUES (?, ?, ?)`,
      [id, studentId, new Date().toISOString()]
    );
    return { success: true, message: 'Attendance marked successfully!' };
  } catch (e) {
    console.error(e);
    return { success: false, message: 'Failed to mark attendance.' };
  }
}

export async function getAttendanceHistory(studentId: string) {
  try {
    const res = await executeWithRetry(
      `SELECT al.*, c.title as class_title, c.date as class_date
       FROM attendance_logs al
       LEFT JOIN classes c ON al.batch_id = c.id OR c.id = al.student_id
       WHERE al.student_id = ?
       ORDER BY al.join_time DESC`,
      [studentId]
    );
    // Simpler query fallback
    const res2 = await executeWithRetry(
      `SELECT * FROM attendance_logs WHERE student_id = ? ORDER BY join_time DESC`,
      [studentId]
    );
    return res2.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export async function getLeaderboardData(): Promise<LeaderboardEntry[]> {
  try {
    const res = await executeWithRetry(
      `SELECT 
         r.referrer_student_id as student_id,
         u.name as student_name,
         COUNT(r.id) as referral_count,
         COALESCE(st.coins, 0) as coins
       FROM referrals r
       JOIN students st ON r.referrer_student_id = st.id
       JOIN users u ON st.portal_login_email = u.email
       WHERE r.status = 'Completed'
       GROUP BY r.referrer_student_id
       ORDER BY referral_count DESC
       LIMIT 50`
    );
    return res.rows.map((r: any) => ({
      student_id: r.student_id,
      student_name: r.student_name,
      referral_count: Number(r.referral_count),
      coins: Number(r.coins)
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ─── Referrals ────────────────────────────────────────────────────────────────

export async function getStudentReferrals(studentId: string): Promise<Referral[]> {
  try {
    const res = await executeWithRetry(
      `SELECT r.*, l.name as lead_name
       FROM referrals r
       LEFT JOIN crm_leads l ON r.referred_lead_id = l.id
       WHERE r.referrer_student_id = ?
       ORDER BY r.created_at DESC`,
      [studentId]
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      referred_lead_id: r.referred_lead_id,
      status: r.status,
      reward_paid: Number(r.reward_paid),
      lead_name: r.lead_name || 'Unknown',
      created_at: r.created_at
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getStudentReferralCode(studentId: string): Promise<string> {
  try {
    // Try by student id first, then by email match
    const res = await executeWithRetry(
      `SELECT student_code FROM students 
       WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?)
       LIMIT 1`,
      [studentId, studentId]
    );
    return res.rows.length > 0 ? ((res.rows[0].student_code as string) || studentId) : studentId;
  } catch (e) {
    return studentId;
  }
}

// ─── Mock Interview ──────────────────────────────────────────────────────────

export interface MockInterviewInput {
  studentId: string;
  transcript: string;
  feedback: string;
  score: number;
  coinsAwarded: number;
}

export async function saveMockInterview(input: MockInterviewInput): Promise<void> {
  const id = `mi_${Date.now()}`;
  
  // Resolve real student ID
  let realStudentId = input.studentId;
  try {
    const res = await executeWithRetry(
      "SELECT id FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1",
      [input.studentId, input.studentId]
    );
    if (res.rows.length > 0) realStudentId = res.rows[0].id as string;
  } catch (e) {}

  await executeWithRetry(
    `INSERT INTO mock_interviews (id, student_id, transcript, feedback, score, coins_awarded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.studentId, input.transcript, input.feedback, input.score, input.coinsAwarded, new Date().toISOString()]
  );
  if (input.coinsAwarded > 0) {
    await executeWithRetry(
      `UPDATE students SET coins = coins + ? WHERE id = ?`,
      [input.coinsAwarded, realStudentId]
    );
  }
}

export async function getLastMockInterview(studentId: string): Promise<MockInterview | null> {
  try {
    const res = await executeWithRetry(
      `SELECT * FROM mock_interviews WHERE student_id = ? ORDER BY created_at DESC LIMIT 1`,
      [studentId]
    );
    return res.rows.length > 0 ? (res.rows[0] as MockInterview) : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ─── Announcements ────────────────────────────────────────────────────────────

export async function getAnnouncements(): Promise<Announcement[]> {
  try {
    const res = await executeWithRetry(
      "SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 10"
    );
    
    const now = new Date().getTime();
    return (res.rows as Announcement[]).filter(a => {
      // Auto-hide reschedule popups after 48 hours so they don't pop forever
      if (a.title?.startsWith('⏰')) {
        const created = new Date(a.created_at).getTime();
        if (now - created > 172800000) return false;
      }
      return true;
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ─── Job Listings ─────────────────────────────────────────────────────────────

export async function getJobListings(): Promise<JobListing[]> {
  try {
    const res = await executeWithRetry(
      "SELECT * FROM job_listings WHERE is_active = 1 ORDER BY scraped_at DESC"
    );
    return res.rows as JobListing[];
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ─── Voice Interview ──────────────────────────────────────────────────────────


async function textToSpeech(text: string, voice: string): Promise<string> {
  const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_VOICE_API;
  if (!DEEPGRAM_API_KEY) throw new Error("Missing Deepgram API Key");

  // Map voice IDs to Deepgram Aura models
  const voiceMap: Record<string, string> = {
    'aura-asteria-en': 'aura-asteria-en',
    'aura-orion-en': 'aura-orion-en',
    'aura-helios-en': 'aura-helios-en',
    'aura-angus-en': 'aura-angus-en',
    'aura-stella-en': 'aura-stella-en',
    'aura-zeus-en': 'aura-zeus-en',
    // legacy piper voice names
    'en_US-libritts_r-medium': 'aura-asteria-en',
    'en_GB-alan-medium': 'aura-orion-en',
    'en_US-amy-medium': 'aura-stella-en',
    'en_US-l2arctic-medium': 'aura-zeus-en',
  };
  const targetVoice = voiceMap[voice] || 'aura-asteria-en';

  const response = await fetch(`https://api.deepgram.com/v1/speak?model=${targetVoice}&encoding=mp3`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Deepgram TTS failed: ${response.status} ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  // Use Uint8Array properly - btoa cannot handle values > 127 directly
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 8192; // process in chunks to avoid stack overflow
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  return `data:audio/mp3;base64,${base64}`;
}

async function speechToText(audioBlob: Blob): Promise<string> {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_VOICE_API;
  if (!GROQ_API_KEY) throw new Error("Missing Groq API Key");

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-large-v3');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) throw new Error('Groq STT failed');
  const data = await response.json();
  return data.text || '';
}

async function generateChatResponse(messages: any[]): Promise<string> {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_VOICE_API;
  if (!GROQ_API_KEY) throw new Error("Missing Groq API Key");

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.85,
      max_tokens: 200
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq LLM failed: ${response.status} ${errText}`);
  }
  const data = await response.json();
  return data.choices[0]?.message?.content || 'Hmm, I see. Could you tell me a bit more about that?';
}

// Indian HR interview structured question bank (used to guide the AI)
const INDIAN_HR_SYSTEM_PROMPT = `You are Priya Sharma, a senior HR manager at a reputed Indian IT/tech company based in Hyderabad. You have 10+ years of experience conducting interviews.

Your personality:
- Warm but professional, uses Indian professional English naturally
- Occasionally uses phrases like "So", "Alright", "Very good", "I see", "That's interesting"
- Direct and to the point, does not waste time
- Follows a structured interview flow

Interview structure you MUST follow (guide naturally through each phase):
1. Greeting & self-introduction request (turn 1)
2. Educational background & course details (turn 2-3)
3. Technical skills & what they've learned (turn 3-4)
4. Strengths and weaknesses (turn 4-5)
5. Situational/behavioral questions like "Tell me about a challenge you faced" (turn 5-7)
6. Why they want this career/role (turn 7-8)
7. Where they see themselves in 5 years (turn 8-9)
8. Salary expectations or availability (turn 9-10)
9. Any questions for us? (turn 10+)

Rules:
- Speak ONLY as the HR interviewer - do NOT act as both interviewer and candidate
- Ask ONLY ONE question per response
- Keep each response to 2-3 sentences maximum — clear and natural for spoken audio
- Do NOT use bullet points, asterisks, or markdown formatting in your responses
- Respond naturally to what the candidate says before asking next question
- Be encouraging but maintain professional evaluation tone
- NEVER end the interview yourself — only the candidate ends it`;

export async function getInitialInterviewAudio(context: string, voice: string, targetRole: string = 'General'): Promise<{ aiResponse: string, audioBase64: string }> {
  try {
    const messages = [
      { role: 'system', content: INDIAN_HR_SYSTEM_PROMPT },
      { role: 'user', content: `[CANDIDATE COURSE PROGRESS: ${context}]\n[TARGET JOB ROLE: ${targetRole}]\nThe candidate has just entered the interview room. You MUST interview them specifically for the "${targetRole}" role, asking technical questions tailored to that job, while strictly keeping in mind their current course progress and quiz answers (if they are a beginner, adapt accordingly). Start the interview with a warm professional greeting and ask them to introduce themselves. Keep it to 2 sentences maximum.` }
    ];
    
    const aiResponse = await generateChatResponse(messages);
    const audioBase64 = await textToSpeech(aiResponse, voice);
    
    return { aiResponse, audioBase64 };
  } catch (e) {
    console.error("Initial audio error:", e);
    throw e;
  }
}

export async function processVoiceInterview(audioBlob: Blob, chatHistory: any[], context: string, turnCount: number, voice: string = 'aura-asteria-en', targetRole: string = 'General'): Promise<{ transcript: string, aiResponse: string, audioBase64: string }> {
  try {
    // 1. STT
    const transcript = await speechToText(audioBlob);
    if (!transcript || transcript.trim().length < 2) {
      throw new Error('Could not understand audio. Please speak clearly.');
    }
    
    // 2. LLM — with Indian HR persona and turn awareness
    const messages = [
      { 
        role: 'system', 
        content: `${INDIAN_HR_SYSTEM_PROMPT}\n\n[CANDIDATE COURSE PROGRESS: ${context}]\n[TARGET JOB ROLE: ${targetRole}]\n[Current turn: ${turnCount}. Guide the interview naturally based on the turn number and conversation flow. Make sure to ask questions highly relevant to a ${targetRole} position, evaluating their technical or domain knowledge based on their course progress.]` 
      },
      ...chatHistory.map(h => ({ 
        role: h.role === 'user' ? 'user' : 'assistant', 
        content: h.content 
      })),
      { role: 'user', content: transcript }
    ];
    const aiResponse = await generateChatResponse(messages);
    
    // 3. TTS
    const audioBase64 = await textToSpeech(aiResponse, voice);
    
    return { transcript, aiResponse, audioBase64 };
  } catch (e) {
    console.error("Process voice interview error:", e);
    throw e;
  }
}

export async function spendCoins(studentId: string, amount: number): Promise<boolean> {
  try {
    const res = await executeWithRetry(
      "SELECT id, coins FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1",
      [studentId, studentId]
    );
    if (res.rows.length === 0) return false;
    
    const realStudentId = res.rows[0].id;
    const currentCoins = Number(res.rows[0].coins) || 0;
    if (currentCoins < amount) return false;
    
    await executeWithRetry(
      "UPDATE students SET coins = coins - ? WHERE id = ?",
      [amount, realStudentId]
    );
    return true;
  } catch (e) {
    console.error("Failed to spend coins", e);
    return false;
  }
}
