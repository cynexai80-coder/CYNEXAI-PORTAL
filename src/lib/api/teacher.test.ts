import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTimetables, saveTimetable, deleteTimetable, getActiveLiveClass, logAttendance } from './teacher';
import { client } from '../turso';

vi.mock('../turso', () => ({
  client: {
    execute: vi.fn()
  }
}));

describe('Teacher API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTimetables', () => {
    it('should fetch timetables from database', async () => {
      const mockRows = [{ id: 'tt_1', day_of_week: 'Monday', start_time: '09:00 AM', end_time: '10:00 AM', batch_id: 'b1', teacher_id: 't1', timing: 'Room 1' }];
      vi.mocked(client.execute).mockResolvedValueOnce({ rows: mockRows } as any);
      
      const result = await getTimetables();
      
      expect(client.execute).toHaveBeenCalledWith({ sql: 'SELECT * FROM timetable_slots', args: [] });
      expect(result).toEqual([{ id: 'tt_1', day: 'Monday', startTime: '09:00 AM', endTime: '10:00 AM', module: 'b1', teacher: 't1', room: 'Room 1' }]);
    });
  });

  describe('saveTimetable', () => {
    it('should insert a new timetable if id is empty', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({ rows: [] } as any);
      
      const session = { id: '', day: 'Monday', startTime: '10:00 AM', endTime: '11:00 AM', module: 'm1', teacher: 't1', room: 'R1' };
      await saveTimetable(session);
      
      expect(client.execute).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INSERT INTO timetable_slots')
      }));
    });
  });

  describe('deleteTimetable', () => {
    it('should delete a timetable by id', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({ rows: [] } as any);
      await deleteTimetable('tt_1');
      expect(client.execute).toHaveBeenCalledWith({
        sql: "DELETE FROM timetable_slots WHERE id = ?",
        args: ['tt_1']
      });
    });
  });

  describe('getActiveLiveClass', () => {
    it('should fetch the active live class for an instructor', async () => {
      const mockRows = [{ id: 'c1', title: 'Test Class', module_title: 'Test Mod' }];
      vi.mocked(client.execute).mockResolvedValueOnce({ rows: mockRows } as any);
      
      const result = await getActiveLiveClass('usr_teacher');
      
      expect(result).toEqual({ id: 'c1', title: 'Test Class', module_title: 'Test Mod' });
    });
  });

  describe('logAttendance', () => {
    it('should insert an attendance log', async () => {
      // every query (schema check, duplicate lookup, insert) returns "no rows"
      vi.mocked(client.execute).mockResolvedValue({ rows: [] } as any);
      await logAttendance('std_1', 'c1');
      
      expect(client.execute).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INSERT INTO attendance_logs')
      }));
    });
  });
});
