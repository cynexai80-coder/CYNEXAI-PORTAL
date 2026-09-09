import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getAllBatches, createBatch, getAllStudentsForAssignment, assignStudentsToBatch
} from '../batches';
import { client } from '../../turso';

vi.mock('../../turso', () => ({
  isTursoConfigured: true,
  client: {
    execute: vi.fn(),
  },
}));

describe('Batches API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (client!.execute as any).mockResolvedValue({ rows: [] });
  });

  it('getAllBatches returns batches list with enrolled student counts', async () => {
    (client!.execute as any).mockImplementation(async ({ sql }: { sql: string }) => {
      if (sql.includes('SELECT') && sql.includes('FROM batches b')) {
        return {
          rows: [
            { id: 'b1', name: 'DS_101', course_id: 'c1', primary_teacher_id: 't1', start_date: '2026-08-10', timing: 'Mon-Fri 10am', max_students: 30, current_enrolled: 0, status: 'Active', primary_teacher_name: 'John', course_name: 'Data Science' }
          ]
        };
      }
      if (sql.includes('SELECT batch_number, COUNT(*)')) {
        return {
          rows: [
            { batch_number: 'DS_101', cnt: 5 }
          ]
        };
      }
      return { rows: [] };
    });

    const result = await getAllBatches();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('DS_101');
    expect(result[0].current_enrolled).toBe(5);
  });

  it('createBatch inserts batch correctly', async () => {
    const newBatch = await createBatch({
      name: 'Python_102',
      max_students: 25,
      status: 'Active'
    });

    expect(newBatch).not.toBeNull();
    expect(newBatch?.name).toBe('Python_102');
    expect(newBatch?.max_students).toBe(25);
  });

  it('getAllStudentsForAssignment returns all students across tables', async () => {
    (client!.execute as any).mockResolvedValueOnce({
      rows: [
        { id: 's1', name: 'Divya Rupa', email: 'divya@test.com', student_code: 'STU001', course: 'Data Science', batch_number: '', status: 'Active' },
        { id: 's2', name: 'Nikhil', email: 'nikhil@test.com', student_code: 'STU002', course: 'Python', batch_number: 'DS_101', status: 'Active' }
      ]
    });

    const students = await getAllStudentsForAssignment();
    expect(students).toHaveLength(2);
    expect(students[0].name).toBe('Divya Rupa');
  });

  it('assignStudentsToBatch updates student batch number and live batch enrolled count', async () => {
    (client!.execute as any).mockImplementation(async ({ sql }: { sql: string }) => {
      if (sql.includes('SELECT id, portal_login_email FROM students')) {
        return { rows: [{ id: 's1', portal_login_email: 'divya@test.com' }] };
      }
      if (sql.includes('SELECT COUNT(*) as cnt FROM students')) {
        return { rows: [{ cnt: 1 }] };
      }
      return { rows: [] };
    });

    const success = await assignStudentsToBatch('DS_101', 'b1', ['s1']);
    expect(success).toBe(true);
  });
});
