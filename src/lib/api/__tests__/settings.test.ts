import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as settingsApi from '../settings';
import { client } from '../../turso';

vi.mock('../../turso', () => ({
  client: {
    execute: vi.fn(),
    batch: vi.fn(),
  },
  isTursoConfigured: true,
}));

describe('Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setSetting', () => {
    it('replaces a GLOBAL setting row (NULL user_id never conflicts in SQLite, so delete + insert in one batch)', async () => {
      vi.mocked(client.batch).mockResolvedValueOnce([] as any);

      const result = await settingsApi.setSetting('global', 'company_name', 'CynexAI ERP');

      expect(result).toBe(true);
      expect(client.batch).toHaveBeenCalledTimes(1);
      const [stmts, mode] = vi.mocked(client.batch).mock.calls[0] as any;
      expect(mode).toBe('write');
      expect(stmts[0].sql).toContain('DELETE FROM settings WHERE user_id IS NULL');
      expect(stmts[0].args).toEqual(['global', 'company_name']);
      expect(stmts[1].sql).toContain('INSERT INTO settings');
      expect(stmts[1].args).toEqual(['global', 'company_name', 'CynexAI ERP']);
    });

    it('upserts a user-specific setting', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 1,
        lastInsertRowid: undefined,
      });

      const result = await settingsApi.setSetting('profile', 'theme', 'dark', 'usr_123');
      
      expect(result).toBe(true);
      
      const callArgs = vi.mocked(client.execute).mock.calls[0][0] as any;
      expect(callArgs.args).toEqual([
        'usr_123',
        'profile',
        'theme',
        'dark'
      ]);
    });
  });

  describe('getSetting', () => {
    it('retrieves a setting value', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [{ value: 'CynexAI ERP' }] as any,
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

      const value = await settingsApi.getSetting('global', 'company_name');
      
      expect(value).toBe('CynexAI ERP');
      
      const callArgs = vi.mocked(client.execute).mock.calls[0][0] as any;
      expect(callArgs.sql).toContain('SELECT value FROM settings');
      expect(callArgs.args).toEqual(['global', 'company_name']);
    });
    
    it('returns null if setting is not found', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [] as any,
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

      const value = await settingsApi.getSetting('global', 'unknown_key');
      
      expect(value).toBe(null);
    });
  });

  describe('getSettingsGroup', () => {
    it('retrieves all settings for a group as an object', async () => {
      vi.mocked(client.execute).mockResolvedValueOnce({
        rows: [
          { key: 'theme', value: 'light' },
          { key: 'notifications', value: 'email' }
        ] as any,
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

      const result = await settingsApi.getSettingsGroup('profile', 'usr_123');
      
      expect(result).toEqual({
        theme: 'light',
        notifications: 'email'
      });
      
      const callArgs = vi.mocked(client.execute).mock.calls[0][0] as any;
      expect(callArgs.args).toEqual(['usr_123', 'profile']);
    });
  });
});
