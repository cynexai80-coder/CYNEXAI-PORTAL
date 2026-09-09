import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGamificationSettings, updateGamificationSetting, awardCoinsManually } from './gamification';
import { client } from '../turso';

vi.mock('../turso', () => ({
  client: {
    execute: vi.fn()
  }
}));

describe('Gamification API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGamificationSettings', () => {
    it('should fetch settings from database', async () => {
      const mockRows = [{ task_type: 'daily_login', is_enabled: 1, reward_amount: 10 }];
      (client!.execute as any).mockResolvedValueOnce({ rows: mockRows } as any);
      
      const result = await getGamificationSettings();
      
      expect(client!.execute).toHaveBeenCalledWith({ sql: 'SELECT * FROM gamification_settings', args: [] });
      expect(result).toEqual([{ task_type: 'daily_login', is_enabled: true, reward_amount: 10 }]);
    });
  });

  describe('updateGamificationSetting', () => {
    it('should update the setting correctly', async () => {
      (client!.execute as any).mockResolvedValueOnce({ rows: [] } as any);
      await updateGamificationSetting('daily_login', false, 20);
      expect(client!.execute).toHaveBeenCalledWith({
        sql: "INSERT OR REPLACE INTO gamification_settings (task_type, is_enabled, reward_amount) VALUES (?, ?, ?)",
        args: ['daily_login', 0, 20]
      });
    });
  });

  describe('awardCoinsManually', () => {
    it('should increment coins for a specific student', async () => {
      (client!.execute as any).mockResolvedValueOnce({ rows: [] } as any);
      await awardCoinsManually('std_1', 50);
      expect(client!.execute).toHaveBeenCalledWith({
        sql: "UPDATE students SET coins = coins + ? WHERE student_code = ? OR id = ?",
        args: [50, 'std_1', 'std_1']
      });
    });
  });
});
