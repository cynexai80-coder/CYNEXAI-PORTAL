import { client } from '../turso';
import { cachedQuery, cacheInvalidate } from '../cache';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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

// ---- Course Management ----
export const getCoursesFull = async () => {
  return cachedQuery('cms_courses_full', async () => {
    const coursesRes = await executeWithRetry('SELECT * FROM courses ORDER BY created_at DESC');
    const modulesRes = await executeWithRetry('SELECT m.*, cmm.course_id, cmm.order_index FROM modules m JOIN course_module_mapping cmm ON m.id = cmm.module_id ORDER BY cmm.order_index ASC');
    const classesRes = await executeWithRetry('SELECT * FROM classes ORDER BY order_index ASC');
    return { courses: coursesRes.rows, modules: modulesRes.rows, classes: classesRes.rows };
  }, 5 * 60 * 1000); // 5 minutes TTL
};

export const createCourse = async (id: string, title: string, description: string, instructorId: string, status: string) => {
  await executeWithRetry(
    'INSERT INTO courses (id, title, description, instructor_id, status) VALUES (?, ?, ?, ?, ?)',
    [id, title, description, instructorId, status]
  );
  cacheInvalidate('cms_courses');
};

export const createModule = async (moduleId: string, courseId: string, title: string, orderIndex: number, isItModule: boolean = true) => {
  await executeWithRetry('INSERT INTO modules (id, title, description, is_it_module) VALUES (?, ?, ?, ?)', [moduleId, title, '', isItModule ? 1 : 0]);
  await executeWithRetry(
    'INSERT INTO course_module_mapping (course_id, module_id, order_index) VALUES (?, ?, ?)',
    [courseId, moduleId, orderIndex]
  );
  cacheInvalidate('cms_courses');
  cacheInvalidate('modules_');
};

export const mapExistingModuleToCourse = async (courseId: string, moduleId: string, orderIndex: number) => {
  await executeWithRetry(
    'INSERT INTO course_module_mapping (course_id, module_id, order_index) VALUES (?, ?, ?)',
    [courseId, moduleId, orderIndex]
  );
  cacheInvalidate('cms_courses');
};

export const getAllModules = async () => {
  return cachedQuery('cms_all_modules', async () => {
    const res = await executeWithRetry('SELECT * FROM modules ORDER BY title ASC');
    return res.rows;
  }, 5 * 60 * 1000);
};

export const updateModuleCoding = async (moduleId: string, isItModule: boolean) => {
  await executeWithRetry('UPDATE modules SET is_it_module = ? WHERE id = ?', [isItModule ? 1 : 0, moduleId]);
  cacheInvalidate('cms_courses');
  cacheInvalidate(`module_details_${moduleId}`);
};

export const updateCoursePitch = async (courseId: string, pitchSummary: string, pitchScript: string) => {
  await executeWithRetry(
    'UPDATE courses SET sales_pitch_summary = ?, sales_pitch_script = ? WHERE id = ?',
    [pitchSummary, pitchScript, courseId]
  );
  cacheInvalidate('cms_courses');
  cacheInvalidate('pitch_');
};

export const deleteCourse = async (courseId: string) => {
  await executeWithRetry('DELETE FROM course_module_mapping WHERE course_id = ?', [courseId]);
  await executeWithRetry('DELETE FROM courses WHERE id = ?', [courseId]);
  cacheInvalidate('cms_courses');
};

export const removeModuleFromCourse = async (courseId: string, moduleId: string) => {
  await executeWithRetry('DELETE FROM course_module_mapping WHERE course_id = ? AND module_id = ?', [courseId, moduleId]);
  cacheInvalidate('cms_courses');
};

// ---- Module Editor ----
export const getModuleDetails = async (moduleId: string) => {
  return cachedQuery(`module_details_${moduleId}`, async () => {
    const modRes = await executeWithRetry('SELECT * FROM modules WHERE id = ?', [moduleId]);
    const clsRes = await executeWithRetry('SELECT * FROM classes WHERE module_id = ? ORDER BY order_index ASC', [moduleId]);
    return {
      module: modRes.rows.length > 0 ? modRes.rows[0] : null,
      classes: clsRes.rows
    };
  }, 3 * 60 * 1000);
};

export const createClassForModule = async (classId: string, moduleId: string, title: string, orderIndex: number, type: string) => {
  await executeWithRetry(
    'INSERT INTO classes (id, module_id, title, description, order_index, type) VALUES (?, ?, ?, ?, ?, ?)',
    [classId, moduleId, title, '', orderIndex, type]
  );
  cacheInvalidate('cms_courses');
  cacheInvalidate(`module_details_${moduleId}`);
};

export const deleteClass = async (classId: string) => {
  await executeWithRetry('DELETE FROM classes WHERE id = ?', [classId]);
  cacheInvalidate('cms_courses');
  cacheInvalidate('module_details_');
  cacheInvalidate(`class_${classId}`);
};

// ---- Class Editor ----
export const getClassDetails = async (classId: string) => {
  return cachedQuery(`class_${classId}`, async () => {
    const res = await executeWithRetry('SELECT * FROM classes WHERE id = ?', [classId]);
    return res.rows.length > 0 ? res.rows[0] : null;
  }, 3 * 60 * 1000);
};

export const getClassQuestions = async (classId: string) => {
  return cachedQuery(`class_questions_${classId}`, async () => {
    const res = await executeWithRetry('SELECT * FROM class_questions WHERE class_id = ? ORDER BY created_at ASC', [classId]);
    return res.rows;
  }, 3 * 60 * 1000);
};

export const updateClassMetadata = async (classId: string, title: string, description: string, youtubeLink: string, meetLink: string, docUrl?: string) => {
  await executeWithRetry(
    'UPDATE classes SET title = ?, description = ?, youtube_video_id = ?, meet_link = ?, doc_url = ? WHERE id = ?',
    [title, description, youtubeLink, meetLink, docUrl || null, classId]
  );
  cacheInvalidate(`class_${classId}`);
  cacheInvalidate('cms_courses');
  cacheInvalidate('module_details_');
};

export const updateClassAiMaterials = async (classId: string, ppt: string, keypoints: string, script: string, studyGuide: string = '') => {
  await executeWithRetry(
    'UPDATE classes SET ai_ppt_markdown = ?, ai_keypoints = ?, ai_script = ?, ai_study_guide = ? WHERE id = ?',
    [ppt, keypoints, script, studyGuide, classId]
  );
  cacheInvalidate(`class_${classId}`);
};

export const createClassQuestion = async (id: string, classId: string, type: string, questionText: string, optionsJson: string, correctAnswerIdx: number, boilerplateJson: string, testCasesJson: string) => {
  await executeWithRetry(
    `INSERT INTO class_questions (id, class_id, type, question_text, options_json, correct_answer_idx, boilerplate_json, test_cases_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, classId, type, questionText, optionsJson, correctAnswerIdx, boilerplateJson, testCasesJson]
  );
  cacheInvalidate(`class_questions_${classId}`);
};

export const deleteClassQuestion = async (qId: string) => {
  await executeWithRetry('DELETE FROM class_questions WHERE id = ?', [qId]);
  cacheInvalidate('class_questions_');
};
