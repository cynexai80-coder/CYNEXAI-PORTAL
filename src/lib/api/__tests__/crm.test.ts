import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateLeadStatus, addActivity, getStudentActivities } from '../crm';
import { client } from '../../turso';

vi.mock('../../turso', () => ({
  client: {
    execute: vi.fn(),
  },
  isTursoConfigured: true,
}));

describe('CRM API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Strict Stage Transitions', () => {
    it('updates lead status and records stage history', async () => {
      (client!.execute as any).mockImplementation(async (query: any) => {
        const sql = typeof query === 'string' ? query : query.sql;
        if (sql.includes('crm_leads')) return { rows: [{ id: 'lead_123', status: 'Contacted' }] };
        return { rows: [] };
      });
      
      const result = await updateLeadStatus('lead_123', 'Admission Completed', 'user_1');
      
      expect(result.success).toBe(true);
      expect(client!.execute).toHaveBeenCalled();
    });

    it('allows moving a lead to Admission Completed if a Demo Completed activity exists', async () => {
      // Mock client.execute to simulate existing demo
      (client!.execute as any).mockImplementation(async (query: any) => {
        const sql = typeof query === 'string' ? query : query.sql;
        if (sql.includes('crm_leads')) return { rows: [{ id: 'lead_123', status: 'Contacted' }] };
        if (sql.includes('crm_activities')) return { rows: [{ id: 'act_1', type: 'Meeting', content: 'Demo' }] };
        if (sql.includes('demos')) return { rows: [{ id: 'demo_1', status: 'Completed' }] };
        return { rows: [] };
      });
      
      const result = await updateLeadStatus('lead_123', 'Admission Completed', 'user_1');
      
      expect(result.success).toBe(true);
      expect(client!.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('UPDATE crm_leads SET status = ?')
        })
      );
    });
  });

  describe('CRM Activities', () => {
    it('can add a new activity to a lead', async () => {
      (client!.execute as any).mockResolvedValueOnce({ rows: [] });

      const activityId = await addActivity('lead_123', 'user_1', 'Call', 'Discussed pricing');

      expect(activityId).toBeDefined();
      expect(client!.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('INSERT INTO crm_activities')
        })
      );
    });

    it('can add a student activity and retrieve it', async () => {
      (client!.execute as any).mockResolvedValueOnce({ rows: [] });

      const activityId = await addActivity(null, 'user_1', 'Note', 'Student note', 'student_123');
      expect(activityId).toBeDefined();

      (client!.execute as any).mockResolvedValueOnce({ rows: [{ id: activityId, student_id: 'student_123', user_id: 'user_1', type: 'Note', content: 'Student note' }] });

      const activities = await getStudentActivities('student_123');
      expect(activities.length).toBe(1);
      expect(activities[0].student_id).toBe('student_123');
    });
  });
});
