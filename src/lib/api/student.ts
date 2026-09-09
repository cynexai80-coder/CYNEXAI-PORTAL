import { client } from '../turso';
import { cachedQuery, cacheInvalidate } from '../cache';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;


export async function executeWithRetry(query: string, args: any[] = [], retries = MAX_RETRIES): Promise<any> {
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

const dashboardCache = new Map<string, { data: StudentDashboardData; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds fast cache

export async function getStudentDashboardData(studentId: string, forceRefresh = false): Promise<StudentDashboardData> {
  const cached = dashboardCache.get(studentId);
  if (!forceRefresh && cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

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
        let modRes = await executeWithRetry(
          `SELECT DISTINCT m.*, COALESCE(cmm.order_index, m.rowid) as map_order
           FROM modules m
           LEFT JOIN course_module_mapping cmm ON m.id = cmm.module_id AND (cmm.course_id = ? OR cmm.course_id = 'course_ds_mastery')
           ORDER BY map_order ASC`,
          [activeCourse.id]
        ).catch(() => ({ rows: [] }));

        if (!modRes.rows || modRes.rows.length === 0) {
          modRes = await executeWithRetry(
            `SELECT m.*, m.rowid as map_order FROM modules m ORDER BY m.rowid ASC`
          ).catch(() => ({ rows: [] }));
        }

        let clsRes = await executeWithRetry(
          `SELECT id, module_id, status, type FROM classes`
        ).catch(() => ({ rows: [] }));

        let realStudentId = studentId;
        try {
          const sRes = await executeWithRetry(
            "SELECT id FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1",
            [studentId, studentId]
          );
          if (sRes.rows.length > 0) realStudentId = sRes.rows[0].id as string;
        } catch {}

        const [progRes, qaRes] = await Promise.all([
          // Get Progress
          executeWithRetry(
            "SELECT lesson_id FROM student_progress WHERE (student_id = ? OR student_id = ?) AND completed = 1",
            [studentId, realStudentId]
          ).catch(() => ({ rows: [] })),
          // Get QA
          executeWithRetry(
            `SELECT class_id, COUNT(*) as cnt FROM qa_responses WHERE (student_id = ? OR student_id = ?) GROUP BY class_id`,
            [studentId, realStudentId]
          ).catch(() => ({ rows: [] }))
        ]);

        const clsRows = clsRes.rows || [];
        const completedSet = new Set((progRes.rows || []).map((r: any) => r.lesson_id));
        
        let qaByClass: Record<string, number> = {};
        (qaRes.rows || []).forEach((r: any) => { qaByClass[r.class_id] = Number(r.cnt); });

        modulesData = (modRes.rows || []).map((m: any) => {
          const mClasses = clsRows.filter((c: any) => c.module_id === m.id);
          const completed = mClasses.filter((c: any) => completedSet.has(c.id) || c.status === 'completed' || c.status === 'ended').length;
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
      const stuBatch = stu?.batch_number ? String(stu.batch_number).trim() : '';
      const bTerm1 = stuBatch.toLowerCase();
      const bTerm2 = stuBatch.toLowerCase().startsWith('batch ') ? 'batch_' + stuBatch.toLowerCase().replace('batch ', '') : stuBatch.toLowerCase();

      try {
        if (stuBatch) {
          const tsRes = await executeWithRetry(
            `SELECT id, title, day_of_week, start_time, timing, status, 'live' as type FROM timetable_slots
             WHERE LOWER(batch_id) LIKE ? OR LOWER(batch_id) LIKE ? OR course_name LIKE ?
             ORDER BY created_at DESC LIMIT 1`,
            [`%${bTerm1}%`, `%${bTerm2}%`, `%${activeCourse?.title || ''}%`]
          );
          if (tsRes.rows.length > 0) upcomingClass = tsRes.rows[0];
        }
        if (!upcomingClass) {
          const tsFallback = await executeWithRetry(
            `SELECT id, title, day_of_week, start_time, timing, status, 'live' as type FROM timetable_slots
             ORDER BY created_at DESC LIMIT 1`
          );
          if (tsFallback.rows.length > 0) upcomingClass = tsFallback.rows[0];
        }
      } catch { /* no timetable */ }

      if (!upcomingClass) {
        try {
          const clsUp = await executeWithRetry(
            `SELECT id, title, date, start_time, meet_link, type FROM classes
             WHERE type = 'live' ORDER BY order_index ASC LIMIT 1`
          );
          if (clsUp.rows.length > 0) upcomingClass = clsUp.rows[0];
        } catch { /* ignore */ }
      }
      return upcomingClass;
    })()
  ]);

  const result: StudentDashboardData = { course: activeCourse, gamification, modules: modulesDataResult, upcomingClass: upcomingClassResult };
  dashboardCache.set(studentId, { data: result, timestamp: Date.now() });
  return result;
}

// ─── Class Flow ───────────────────────────────────────────────────────────────

export async function getClassFlowData(classId: string, studentId?: string): Promise<ClassFlowData> {
  try {
    let targetClassId = classId;
    let clsRow: any = null;

    // 1. If classId is a timetable slot, find matching class from classes table
    if (classId.startsWith('ts_') || classId.startsWith('slot_') || classId.startsWith('tt_')) {
      const slotRes = await executeWithRetry('SELECT course_name FROM timetable_slots WHERE id = ?', [classId]);
      if (slotRes.rows.length > 0) {
        const rawCourse = slotRes.rows[0].course_name;
        let parsedCourses: string[] = [];
        try { parsedCourses = JSON.parse(rawCourse); } catch { parsedCourses = [rawCourse]; }
        if (!Array.isArray(parsedCourses)) parsedCourses = [parsedCourses];
        parsedCourses = parsedCourses.map(c => String(c).trim()).filter(Boolean);

        if (parsedCourses.length > 0) {
          const ph = parsedCourses.map(() => '?').join(',');
          const matchedClass = await executeWithRetry(
            `SELECT DISTINCT c.id, c.title, c.youtube_video_id, c.meet_link, c.type, c.status, c.ai_summary, c.description, c.ai_study_guide
             FROM classes c 
             JOIN modules m ON c.module_id = m.id 
             LEFT JOIN course_module_mapping cmm ON m.id = cmm.module_id
             LEFT JOIN courses crs ON cmm.course_id = crs.id
             WHERE (crs.title IN (${ph}) OR m.title IN (${ph}))
             ORDER BY c.order_index ASC LIMIT 1`,
            [...parsedCourses, ...parsedCourses]
          );
          if (matchedClass.rows.length > 0) {
            clsRow = matchedClass.rows[0];
            targetClassId = clsRow.id;
          }
        }
      }
    }

    if (!clsRow) {
      const clsRes = await executeWithRetry(
        `SELECT id, title, youtube_video_id, meet_link, type, status, ai_summary, description, ai_study_guide
         FROM classes WHERE id = ? LIMIT 1`,
        [targetClassId]
      );
      if (clsRes.rows.length > 0) {
        clsRow = clsRes.rows[0];
      }
    }

    // 2. Fetch questions for both targetClassId and classId
    const questionsRes = await executeWithRetry(
      `SELECT * FROM class_questions WHERE class_id = ? OR class_id = ? ORDER BY created_at ASC`,
      [targetClassId, classId]
    );

    const uniqueQMap = new Map<string, any>();
    (questionsRes.rows || []).forEach((q: any) => {
      if (!uniqueQMap.has(q.id)) uniqueQMap.set(q.id, q);
    });
    const questions = Array.from(uniqueQMap.values());

    let hasWatched = false;
    let hasAnswered = false;
    let answeredQuestionIds: string[] = [];

    if (studentId) {
      const progRes = await executeWithRetry(
        `SELECT * FROM student_progress WHERE student_id = ? AND (lesson_id = ? OR lesson_id = ?) AND completed = 1`,
        [studentId, targetClassId, classId]
      );
      hasWatched = progRes.rows.length > 0;

      const qaRes = await executeWithRetry(
        `SELECT question_id FROM qa_responses WHERE student_id = ? AND (class_id = ? OR class_id = ?)`,
        [studentId, targetClassId, classId]
      );
      answeredQuestionIds = (qaRes.rows || []).map((r: any) => r.question_id);
      hasAnswered = (qaRes.rows || []).length > 0;
    }

    return {
      classData: clsRow,
      questions,
      hasWatched,
      hasAnswered,
      answeredQuestionIds
    };
  } catch (e) {
    console.error('getClassFlowData error:', e);
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
    if (realStudentId !== studentId) {
      await executeWithRetry(
        `INSERT OR IGNORE INTO student_progress (id, student_id, lesson_id, completed, created_at) VALUES (?, ?, ?, 1, ?)`,
        [`${id}_r`, realStudentId, classId, new Date().toISOString()]
      );
    }
    // Update streak
    await executeWithRetry(
      `UPDATE students SET last_streak_date = ?, streak = streak + 1 WHERE id = ? AND (last_streak_date IS NULL OR last_streak_date != date('now'))`,
      [new Date().toISOString().split('T')[0], realStudentId]
    );
    cacheInvalidate(`student_dashboard_${studentId}`);
    dashboardCache.delete(studentId);
    dashboardCache.delete(realStudentId);

    // Sync manager_student_progress
    try {
      const cpRes = await executeWithRetry(
        `SELECT COUNT(DISTINCT lesson_id) as num FROM student_progress WHERE (student_id = ? OR student_id = ?) AND completed = 1`,
        [studentId, realStudentId]
      );
      const cpNum = Number(cpRes.rows[0]?.num) || 0;
      await executeWithRetry(
        `UPDATE manager_student_progress SET course_progress_num = ?, last_updated = CURRENT_TIMESTAMP WHERE student_id = ? OR student_id = ?`,
        [cpNum, realStudentId, studentId]
      );
    } catch (e) {}
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
  cacheInvalidate(`student_dashboard_${input.studentId}`);
  cacheInvalidate('student_leaderboard');
}

// ─── Module Map ───────────────────────────────────────────────────────────────

export async function getModuleMapData(moduleId: string, studentId: string) {
  try {
    let realStudentId = studentId;
    try {
      const res = await executeWithRetry(
        "SELECT id FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1",
        [studentId, studentId]
      );
      if (res.rows.length > 0) realStudentId = res.rows[0].id as string;
    } catch (e) {}

    const modRes = await executeWithRetry("SELECT * FROM modules WHERE id = ?", [moduleId]);
    const clsRes = await executeWithRetry(
      "SELECT id, title, type, status, order_index, youtube_video_id, meet_link, date, start_time FROM classes WHERE module_id = ? ORDER BY order_index ASC",
      [moduleId]
    );
    const progRes = await executeWithRetry(
      "SELECT lesson_id FROM student_progress WHERE (student_id = ? OR student_id = ?) AND completed = 1",
      [studentId, realStudentId]
    );
    const qaRes = await executeWithRetry(
      `SELECT qr.class_id, cq.type 
       FROM qa_responses qr 
       JOIN class_questions cq ON qr.question_id = cq.id 
       WHERE qr.student_id = ? OR qr.student_id = ?`,
      [studentId, realStudentId]
    );

    const completedQaIds = new Set<string>();
    const completedCodingIds = new Set<string>();
    qaRes.rows.forEach((r: any) => {
      if (r.type === 'mcq') completedQaIds.add(r.class_id);
      if (r.type === 'coding') completedCodingIds.add(r.class_id);
    });

    const completedLessonIds = new Set<string>(progRes.rows.map((r: any) => r.lesson_id));
    clsRes.rows.forEach((c: any) => {
      if (c.status === 'completed' || c.status === 'ended') {
        completedLessonIds.add(c.id);
      }
    });

    const studentRes = await executeWithRetry("SELECT batch_number FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1", [studentId, studentId]);
    let batchProgress = null;
    if (studentRes.rows.length > 0 && studentRes.rows[0].batch_number) {
        const batchNum = studentRes.rows[0].batch_number;
        const batchRes = await executeWithRetry("SELECT module_progress_json FROM batches WHERE id = ? OR name = ? LIMIT 1", [batchNum, batchNum]);
        if (batchRes.rows.length > 0 && batchRes.rows[0].module_progress_json) {
           try {
             batchProgress = JSON.parse(batchRes.rows[0].module_progress_json as string);
           } catch(e) {}
        }
    }

    return {
      moduleData: modRes.rows.length > 0 ? modRes.rows[0] : null,
      classes: clsRes.rows,
      completedLessonIds,
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
    const res = await executeWithRetry("SELECT id, status, type, meet_link, youtube_video_id FROM classes WHERE id = ?", [classId]);
    return res.rows.length > 0 ? res.rows[0] : null;
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
    if (cls.status !== 'in_progress' && cls.status !== 'live' && cls.status !== 'upcoming') {
      return { success: false, message: 'Class is not currently active.' };
    }

    const id = `att_${Date.now()}`;
    await executeWithRetry(
      `INSERT INTO attendance_logs (id, batch_id, student_id, join_time) VALUES (?, ?, ?, ?)`,
      [id, classId, studentId, new Date().toISOString()]
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
    if (res.rows.length > 0) return res.rows;
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
  return cachedQuery('student_leaderboard', async () => {
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
  }, 3 * 60 * 1000);
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

export interface InterviewEvaluation {

  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendations: string;
}

export async function saveMockInterview(input: {
  studentId: string;
  transcript: string;
  feedback: string;
  score: number;
  coinsAwarded: number;
  evaluation?: InterviewEvaluation;
  targetRole?: string;
}): Promise<void> {
  const id = `mi_${Date.now()}`;
  let realStudentId = input.studentId;

  try {
    const res = await executeWithRetry(
      "SELECT id FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1",
      [input.studentId, input.studentId]
    );
    if (res.rows.length > 0) realStudentId = res.rows[0].id as string;
  } catch (e) {}

  // Store JSON feedback payload if available, else store string feedback
  const feedbackData = input.evaluation 
    ? JSON.stringify({ ...input.evaluation, targetRole: input.targetRole || 'General' }) 
    : input.feedback;

  await executeWithRetry(
    `INSERT INTO mock_interviews (id, student_id, transcript, feedback, score, coins_awarded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, realStudentId, input.transcript, feedbackData, input.score, input.coinsAwarded, new Date().toISOString()]
  );

  // Also write to user ID if different so both lookups work seamlessly
  if (realStudentId !== input.studentId) {
    try {
      await executeWithRetry(
        `INSERT INTO mock_interviews (id, student_id, transcript, feedback, score, coins_awarded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`${id}_usr`, input.studentId, input.transcript, feedbackData, input.score, input.coinsAwarded, new Date().toISOString()]
      );
    } catch (e) {}
  }

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
      `SELECT * FROM mock_interviews WHERE student_id = ? OR student_id = (SELECT id FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?)) ORDER BY created_at DESC LIMIT 1`,
      [studentId, studentId, studentId]
    );
    return res.rows.length > 0 ? (res.rows[0] as MockInterview) : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getMockInterviewHistory(studentId: string): Promise<MockInterview[]> {
  try {
    const res = await executeWithRetry(
      `SELECT * FROM mock_interviews WHERE student_id = ? OR student_id = (SELECT id FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?)) ORDER BY created_at DESC LIMIT 20`,
      [studentId, studentId, studentId]
    );
    // Deduplicate by ID
    const unique = new Map<string, MockInterview>();
    for (const row of res.rows as MockInterview[]) {
      const baseId = row.id.replace('_usr', '');
      if (!unique.has(baseId)) unique.set(baseId, row);
    }
    return Array.from(unique.values());
  } catch (e) {
    console.error(e);
    return [];
  }
}


// ─── Announcements ────────────────────────────────────────────────────────────

export async function getAnnouncements(): Promise<Announcement[]> {
  return cachedQuery('student_announcements', async () => {
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
  }, 5 * 60 * 1000);
}

// ─── Job Listings ─────────────────────────────────────────────────────────────

export async function getJobListings(): Promise<JobListing[]> {
  return cachedQuery('student_job_listings', async () => {
    try {
      const res = await executeWithRetry(
        "SELECT * FROM job_listings WHERE is_active = 1 ORDER BY scraped_at DESC"
      );
      return res.rows as JobListing[];
    } catch (e) {
      console.error(e);
      return [];
    }
  }, 10 * 60 * 1000);
}

// ─── Voice Interview ──────────────────────────────────────────────────────────


export async function textToSpeech(text: string, voice: string): Promise<string> {
  const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_VOICE_API || 'ff72b49c11e1a77dd5b34bb7cb7ac8b40d3b97be';
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

function getGroqApiKey(): string {
  return import.meta.env.VITE_GROQ_VOICE_API || import.meta.env.VITE_GROQ_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('cynex_groq_key') : '') || '';
}

async function speechToText(audioBlob: Blob): Promise<string> {
  const GROQ_API_KEY = getGroqApiKey();
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

export function cleanAiTextResponse(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // First remove complete <think>...</think> blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // Handle unclosed <think> tags gracefully
  if (cleaned.includes('<think>')) {
    const afterThink = cleaned.replace(/<think>[\s\S]*/gi, '').trim();
    if (afterThink.length > 5) {
      cleaned = afterThink;
    } else {
      cleaned = cleaned.replace(/<think>/gi, '').trim();
    }
  }
  cleaned = cleaned.replace(/\*\*.*?\*\*/g, '');
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/^[\s\-*#]+/gm, '');
  return cleaned.trim();
}

async function generateChatResponse(messages: any[]): Promise<string> {
  const GROQ_API_KEY = getGroqApiKey();
  if (!GROQ_API_KEY) throw new Error("Missing Groq API Key");

  const candidateModels = [
    'groq/compound',
    'groq/compound-mini',
    'openai/gpt-oss-120b',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-20b'
  ];
  let lastErr = '';

  for (const model of candidateModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices[0]?.message?.content;
        if (rawContent) {
          const cleaned = cleanAiTextResponse(rawContent);
          if (cleaned) return cleaned;
          // Fallback if cleaning stripped everything
          const fallback = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<[^>]+>/g, '').trim();
          if (fallback) return fallback;
        }
      } else {
        lastErr = await response.text();
      }
    } catch (err: any) {
      lastErr = err.message || String(err);
    }
  }

  throw new Error(`Groq LLM failed: ${lastErr}`);
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
- CRITICAL: Output ONLY plain text for spoken audio. Do NOT include <think> tags, markdown, bold text, or internal notes.
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

export async function processTextInterviewResponse(userText: string, chatHistory: any[], context: string, turnCount: number, voice: string = 'aura-asteria-en', targetRole: string = 'General'): Promise<{ aiResponse: string, audioBase64: string }> {
  try {
    const messages = [
      { 
        role: 'system', 
        content: `${INDIAN_HR_SYSTEM_PROMPT}\n\n[CANDIDATE COURSE PROGRESS: ${context}]\n[TARGET JOB ROLE: ${targetRole}]\n[Current turn: ${turnCount}. Guide the interview naturally based on the turn number and conversation flow. Make sure to ask questions highly relevant to a ${targetRole} position, evaluating their technical or domain knowledge.]` 
      },
      ...chatHistory.map(h => ({ 
        role: h.role === 'user' ? 'user' : 'assistant', 
        content: h.content 
      })),
      { role: 'user', content: userText }
    ];
    const aiResponse = await generateChatResponse(messages);
    const audioBase64 = await textToSpeech(aiResponse, voice);
    return { aiResponse, audioBase64 };
  } catch (e) {
    console.error("Process text interview error:", e);
    throw e;
  }
}

export async function evaluateMockInterview(chatHistory: any[], targetRole: string = 'General'): Promise<InterviewEvaluation> {
  const formattedTranscript = chatHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  const prompt = `You are a expert HR Evaluation Director analyzing a candidate's mock interview performance for a "${targetRole}" position.

Transcript:
${formattedTranscript}

Perform a rigorous evaluation and output ONLY a JSON object matching this exact structure:
{
  "overallScore": 8.5,
  "technicalScore": 8.0,
  "communicationScore": 9.0,
  "confidenceScore": 8.5,
  "summary": "Brief summary of how the candidate performed overall.",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "improvements": ["Area for improvement 1", "Area for improvement 2"],
  "recommendations": "Concrete recommendations for their next interview."
}
Scores MUST be numbers between 1.0 and 10.0 based on actual answers given in transcript. If transcript is very short, adjust scores accordingly. Do not add markdown backticks around the JSON.`;

  try {
    const rawResponse = await generateChatResponse([{ role: 'user', content: prompt }]);
    const cleanJson = rawResponse.replace(/```json|```/gi, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      overallScore: Number(parsed.overallScore) || 7.0,
      technicalScore: Number(parsed.technicalScore) || 7.0,
      communicationScore: Number(parsed.communicationScore) || 7.5,
      confidenceScore: Number(parsed.confidenceScore) || 7.0,
      summary: parsed.summary || "Completed mock interview session.",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ["Good communication style", "Clear responses"],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : ["Elaborate more on technical project examples"],
      recommendations: parsed.recommendations || "Practice explaining past projects with concrete metrics and technical depth."
    };
  } catch (e) {
    console.error("Failed to evaluate mock interview with AI, using fallback scores", e);
    const turnCount = chatHistory.filter(m => m.role === 'user').length;
    const baseScore = Math.min(Math.max(turnCount * 1.5, 5.0), 9.5);
    return {
      overallScore: baseScore,
      technicalScore: baseScore,
      communicationScore: Math.min(baseScore + 0.5, 10),
      confidenceScore: baseScore,
      summary: `Candidate engaged in a ${turnCount}-turn mock interview for the ${targetRole} position.`,
      strengths: ["Active participation", "Clear verbal responses"],
      improvements: ["Provide deeper code or technical implementation details"],
      recommendations: "Review core module concepts and prepare STAR-method answers."
    };
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

// ─── Manager Student Management API ──────────────────────────────────────────────

export async function getManagerStudentProgress(): Promise<any[]> {
  try {
    const res = await executeWithRetry(`
      SELECT 
        sp.*,
        COALESCE(s.name, (SELECT name FROM users u WHERE u.email = s.portal_login_email)) as student_name,
        s.portal_login_email as student_email
      FROM manager_student_progress sp
      JOIN students s ON sp.student_id = s.id
      ORDER BY sp.course_progress_percentage DESC
    `);
    return res && res.rows ? res.rows : [];
  } catch (err) {
    console.error("getManagerStudentProgress DB error:", err);
    return [];
  }
}

export async function updateManagerStudentProgress(id: string, editForm: any): Promise<boolean> {
  const course_perc = editForm.course_progress_den > 0 ? Math.round((editForm.course_progress_num / editForm.course_progress_den) * 100) : 0;
  const att_perc = editForm.attendance_den > 0 ? Math.round((editForm.attendance_num / editForm.attendance_den) * 100) : 0;
  const quiz_perc = editForm.quiz_den > 0 ? Math.round((editForm.quiz_num / editForm.quiz_den) * 100) : 0;
  const int_perc = editForm.interview_den > 0 ? Math.round((editForm.interview_num / editForm.interview_den) * 100) : 0;
  const cod_perc = editForm.coding_den > 0 ? Math.round((editForm.coding_num / editForm.coding_den) * 100) : 0;

  await executeWithRetry(
    `UPDATE manager_student_progress SET 
      course_progress_num = ?, course_progress_den = ?, course_progress_percentage = ?,
      attendance_num = ?, attendance_den = ?, attendance_score = ?,
      quiz_num = ?, quiz_den = ?, quiz_score = ?,
      interview_num = ?, interview_den = ?, interview_score = ?,
      coding_num = ?, coding_den = ?, coding_test_score = ?,
      coins_spent = ?, leaderboard_rank = ?,
      last_updated = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [
      Number(editForm.course_progress_num), Number(editForm.course_progress_den), course_perc,
      Number(editForm.attendance_num), Number(editForm.attendance_den), att_perc,
      Number(editForm.quiz_num), Number(editForm.quiz_den), quiz_perc,
      Number(editForm.interview_num), Number(editForm.interview_den), int_perc,
      Number(editForm.coding_num), Number(editForm.coding_den), cod_perc,
      Number(editForm.coins_spent), Number(editForm.leaderboard_rank),
      id
    ]
  );
  return true;
}

export async function getStudentModulesAndActivity(studentId: string, courseTitle: string): Promise<{ modules: any[], recentActivity: any[] }> {
  try {
    const modRes = await executeWithRetry(
      `SELECT m.id, m.title,
        (SELECT COUNT(*) FROM classes c WHERE c.module_id = m.id) as total_classes,
        (SELECT COUNT(*) FROM student_progress sp JOIN classes c ON sp.lesson_id = c.id WHERE c.module_id = m.id AND sp.student_id = ? AND sp.completed = 1) as completed_classes
      FROM modules m
      JOIN course_module_mapping cmm ON m.id = cmm.module_id
      JOIN courses co ON cmm.course_id = co.id
      WHERE (co.title = ?)
      ORDER BY cmm.order_index ASC`,
      [studentId, courseTitle || '']
    ).catch(() => ({ rows: [] }));

    const actRes = await executeWithRetry(
      `SELECT sp.created_at, c.title as class_title, m.title as module_title
      FROM student_progress sp
      JOIN classes c ON sp.lesson_id = c.id
      JOIN modules m ON c.module_id = m.id
      WHERE sp.student_id = ? AND sp.completed = 1
      ORDER BY sp.created_at DESC LIMIT 10`,
      [studentId]
    ).catch(() => ({ rows: [] }));

    return { modules: modRes.rows || [], recentActivity: actRes.rows || [] };
  } catch (e) {
    console.error("getStudentModulesAndActivity error:", e);
    return { modules: [], recentActivity: [] };
  }
}

export async function adjustStudentMetrics(studentId: string, field: string, delta: number, reason?: string): Promise<boolean> {
  if (field === 'badges' && delta > 0) {
    for (let i = 0; i < delta; i++) {
      await executeWithRetry(
        `INSERT INTO badges (id, student_id, name, awarded_at) VALUES (?, ?, ?, ?)`,
        [`bdg_${Date.now()}_${i}`, studentId, reason || 'Achievement Badge', new Date().toISOString()]
      );
    }
  } else if (field !== 'badges') {
    await executeWithRetry(
      `UPDATE students SET ${field} = MAX(0, COALESCE(${field}, 0) + ?) WHERE id = ?`,
      [delta, studentId]
    );
  }
  return true;
}

export async function updateStudentModuleProgress(studentId: string, moduleId: string, action: 'add' | 'remove'): Promise<boolean> {
  if (action === 'add') {
    const res = await executeWithRetry(
      `SELECT c.id FROM classes c WHERE c.module_id = ? AND c.id NOT IN (SELECT lesson_id FROM student_progress WHERE student_id = ? AND completed = 1) ORDER BY c.order_index ASC LIMIT 1`,
      [moduleId, studentId]
    );
    let classId;
    if (res.rows.length > 0) {
      classId = res.rows[0].id as string;
    } else {
      classId = `cls_dummy_${Date.now()}`;
      await executeWithRetry(
        `INSERT INTO classes (id, module_id, title, order_index) VALUES (?, ?, 'Manual Progress Step', 999)`,
        [classId, moduleId]
      );
    }
    await executeWithRetry(
      `INSERT INTO student_progress (id, student_id, lesson_id, completed, created_at) VALUES (?, ?, ?, 1, ?)`,
      [`sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, studentId, classId, new Date().toISOString()]
    );
  } else {
    const res = await executeWithRetry(
      `SELECT sp.id FROM student_progress sp JOIN classes c ON sp.lesson_id = c.id WHERE sp.student_id = ? AND c.module_id = ? AND sp.completed = 1 ORDER BY sp.created_at DESC LIMIT 1`,
      [studentId, moduleId]
    );
    if (res.rows.length > 0) {
      await executeWithRetry(`DELETE FROM student_progress WHERE id = ?`, [res.rows[0].id]);
    }
  }
  return true;
}

export async function getStudentDetail(studentId: string): Promise<any | null> {
  const res = await executeWithRetry(`SELECT * FROM students WHERE id = ?`, [studentId]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

export async function getManagerStudents(
  search?: string,
  courseFilter?: string,
  batchFilter?: string,
  statusFilter?: string
): Promise<any[]> {
  try {
    let sql = `
      SELECT 
        s.id, COALESCE(s.name, (SELECT name FROM users u WHERE u.email = s.portal_login_email)) as name,
        s.portal_login_email as email, s.phone, s.course, s.batch_number, s.status, s.joining_date,
        s.portal_login_email,
        COALESCE(s.streak, 0) as streak,
        COALESCE(s.coins, 0) as coins,
        (SELECT COUNT(*) FROM badges b WHERE b.student_id = s.id) as badges,
        (SELECT COUNT(*) FROM student_progress sp WHERE sp.student_id = s.id AND sp.completed = 1) as completedClasses
      FROM students s
      WHERE (s.approval_status = 'Approved' OR s.approval_status IS NULL)
    `;
    const args: any[] = [];
    if (search && search.trim()) {
      sql += ` AND (s.name LIKE ? OR s.portal_login_email LIKE ? OR s.phone LIKE ? OR (SELECT name FROM users u WHERE u.email = s.portal_login_email) LIKE ?)`;
      const q = `%${search.trim()}%`;
      args.push(q, q, q, q);
    }
    if (courseFilter && courseFilter.trim()) {
      sql += ` AND LOWER(TRIM(s.course)) = LOWER(TRIM(?))`;
      args.push(courseFilter.trim());
    }
    if (batchFilter && batchFilter.trim()) {
      const rawNum = batchFilter.replace(/batch[_\s]*/i, '').trim();
      sql += ` AND (
        s.batch_number = ? 
        OR s.batch_number = ? 
        OR s.batch_number = ? 
        OR REPLACE(LOWER(s.batch_number), 'batch', '') = ?
      )`;
      args.push(batchFilter.trim(), `Batch ${rawNum}`, rawNum, rawNum);
    }
    if (statusFilter && statusFilter.trim()) {
      if (statusFilter.toLowerCase() === 'active') {
        sql += ` AND (s.status = 'Active' OR s.status = 'Onboarded' OR s.status IS NULL OR s.status = '')`;
      } else {
        sql += ` AND LOWER(s.status) = LOWER(?)`;
        args.push(statusFilter.trim());
      }
    }
    sql += ` ORDER BY s.name ASC LIMIT 200`;

    const res = await executeWithRetry(sql, args);
    return res && res.rows ? res.rows : [];
  } catch (e) {
    console.error("getManagerStudents error:", e);
    return [];
  }
}

export async function getUserPasswordEncrypted(email: string): Promise<string | null> {
  if (!email) return null;
  try {
    const res = await executeWithRetry(`SELECT password_encrypted FROM users WHERE email = ?`, [email]);
    return res.rows.length > 0 && res.rows[0].password_encrypted ? (res.rows[0].password_encrypted as string) : null;
  } catch (e) {
    console.error("getUserPasswordEncrypted error:", e);
    return null;
  }
}

export async function findUserIdByEmail(email: string): Promise<string | undefined> {
  if (!email) return undefined;
  try {
    const res = await executeWithRetry(`SELECT id FROM users WHERE email = ?`, [email]);
    return res.rows.length > 0 ? (res.rows[0].id as string) : undefined;
  } catch (e) {
    return undefined;
  }
}

export async function updateStudentLeadStatus(email?: string, phone?: string): Promise<boolean> {
  try {
    await executeWithRetry(
      `UPDATE crm_leads SET status = 'Closed Won' WHERE email = ? OR phone = ?`,
      [email || '', phone || '']
    );
    return true;
  } catch (e) {
    console.error("updateStudentLeadStatus error:", e);
    return false;
  }
}



