import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as activitiesApi from '../activities';
import { client } from '../../turso';
import { getCurrentUser } from '../../auth';

vi.mock('../../turso', () => ({
  client: {
    execute: vi.fn(),
  },
  isTursoConfigured: true,
}));

vi.mock('../../auth', () => ({
  getCurrentUser: vi.fn(),
}));

describe('Activities API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockReturnValue({ id: 'user_1', role: 'Sales/HR', name: 'John', email: 'john@cynexai.com' });
  });

  describe('createActivity', () => {
    it('creates an activity linked to a lead', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 1,
        lastInsertRowid: undefined,
      });

      const activityData = {
        type: 'Call' as const,
        content: 'Discussed pricing',
        lead_id: 'lead_123',
      };

      const result = await activitiesApi.createActivity(activityData);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.startsWith('act_')).toBe(true);
      
      expect(client.execute).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(client.execute).mock.calls[0][0] as any;
      expect(callArgs.sql).toContain('INSERT INTO crm_activities');
      expect(callArgs.args).toEqual([
        result,
        'lead_123',
        null,
        'user_1',
        'Call',
        'Discussed pricing'
      ]);
    });

    it('creates an activity linked to a student', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 1,
        lastInsertRowid: undefined,
      });

      const activityData = {
        type: 'Meeting' as const,
        content: 'Orientation',
        student_id: 'std_456',
      };

      const result = await activitiesApi.createActivity(activityData);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const callArgs = vi.mocked(client.execute).mock.calls[0][0] as any;
      expect(callArgs.args).toEqual([
        result,
        null,
        'std_456',
        'user_1',
        'Meeting',
        'Orientation'
      ]);
    });
  });

  describe('getActivitiesByLead', () => {
    it('fetches chronological activities for a lead', async () => {
      const mockRows = [
        { id: 'act_1', type: 'Call', content: 'C1', created_at: '2026-07-08T10:00:00Z', user_name: 'John' },
        { id: 'act_2', type: 'Note', content: 'C2', created_at: '2026-07-08T11:00:00Z', user_name: 'John' }
      ];
      
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: mockRows as any,
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

      const result = await activitiesApi.getActivitiesByLead('lead_123');
      
      expect(result).toEqual(mockRows);
      
      const callArgs = vi.mocked(client.execute).mock.calls[0][0] as any;
      expect(callArgs.sql.replace(/\s+/g, ' ')).toContain('SELECT crm_activities.*, COALESCE(users.name, erp_users.name) as user_name FROM crm_activities');
      expect(callArgs.sql.replace(/\s+/g, ' ')).toContain('WHERE lead_id = ? ORDER BY crm_activities.created_at DESC');
      expect(callArgs.args).toEqual(['lead_123']);
    });
  });

  describe('getActivitiesByStudent', () => {
    it('fetches chronological activities for a student', async () => {
      const mockRows = [
        { id: 'act_3', type: 'Meeting', content: 'M1', created_at: '2026-07-08T12:00:00Z', user_name: 'Jane' }
      ];
      
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: mockRows as any,
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

      const result = await activitiesApi.getActivitiesByStudent('std_456');
      
      expect(result).toEqual(mockRows);
      
      const callArgs = vi.mocked(client.execute).mock.calls[0][0] as any;
      expect(callArgs.sql.replace(/\s+/g, ' ')).toContain('WHERE student_id = ? ORDER BY crm_activities.created_at DESC');
      expect(callArgs.args).toEqual(['std_456']);
    });
  });
  
  describe('updateActivity', () => {
    it('updates activity content', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [{ user_id: 'user_1' }] as any,
        columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [], columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      const result = await activitiesApi.updateActivity('act_1', { content: 'Updated content' });
      
      expect(result.success).toBe(true);
      expect(client.execute).toHaveBeenCalledTimes(2);
      
      const callArgs = vi.mocked(client.execute).mock.calls[1][0] as any;
      expect(callArgs.sql).toContain('UPDATE crm_activities SET content = ? WHERE id = ?');
      expect(callArgs.args).toEqual(['Updated content', 'act_1']);
    });
    
    it('fails if unauthorized', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [{ user_id: 'user_2' }] as any, // Not user_1
        columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      const result = await activitiesApi.updateActivity('act_1', { content: 'Updated content' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(client.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteActivity', () => {
    it('deletes an activity', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [{ user_id: 'user_1' }] as any,
        columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [], columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      const result = await activitiesApi.deleteActivity('act_1');
      
      expect(result.success).toBe(true);
      expect(client.execute).toHaveBeenCalledTimes(2);
      
      const callArgs = vi.mocked(client.execute).mock.calls[1][0] as any;
      expect(callArgs.sql).toContain('DELETE FROM crm_activities WHERE id = ?');
      expect(callArgs.args).toEqual(['act_1']);
    });
  });
});
