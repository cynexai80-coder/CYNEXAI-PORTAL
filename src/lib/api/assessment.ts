import { client, isTursoConfigured } from '../turso';

export interface SQLTestResult {
  id: string;
  student_name: string;
  batch: string;
  score: number;
  answers_json: string;
  created_at: string;
}

export const submitSQLTest = async (
  studentName: string,
  batch: string,
  score: number,
  answers: Record<string, string>
): Promise<{ success: boolean; id?: string; error?: unknown }> => {
  if (!isTursoConfigured || !client) {
    // Never report success when nothing was saved: the candidate would believe the result was recorded.
    return { success: false, error: 'Database not connected' };
  }
  
  const id = 'test_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try {
    await client.execute({
      sql: `INSERT INTO sql_test_results (id, student_name, batch, score, answers_json) VALUES (?, ?, ?, ?, ?)`,
      args: [id, studentName, batch, score, JSON.stringify(answers)]
    });
    return { success: true, id };
  } catch (e) {
    console.error("Failed to submit test:", e);
    return { success: false, error: e };
  }
};

export const getSQLTestResults = async (): Promise<SQLTestResult[]> => {
  if (!isTursoConfigured || !client) return [];
  
  try {
    const result = await client.execute(`
      SELECT * FROM sql_test_results ORDER BY created_at DESC
    `);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      student_name: row.student_name,
      batch: row.batch,
      score: row.score,
      answers_json: row.answers_json,
      created_at: row.created_at
    }));
  } catch (e) {
    console.error("Failed to fetch test results:", e);
    return [];
  }
};
