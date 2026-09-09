import { client, isTursoConfigured } from '../turso';

export const setSetting = async (
  settingGroup: string,
  key: string,
  value: string,
  userId: string | null = null
): Promise<boolean> => {
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: `INSERT INTO settings (user_id, setting_group, key, value) 
              VALUES (?, ?, ?, ?) 
              ON CONFLICT(user_id, setting_group, key) DO UPDATE SET value = excluded.value`,
        args: [userId, settingGroup, key, value]
      });
      return true;
    } catch (e) {
      console.error("Failed to set setting", e);
    }
  }
  return false;
};

export const getSetting = async (
  settingGroup: string,
  key: string,
  userId: string | null = null
): Promise<string | null> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: `SELECT value FROM settings WHERE user_id ${userId ? '= ?' : 'IS NULL'} AND setting_group = ? AND key = ?`,
        args: userId ? [userId, settingGroup, key] : [settingGroup, key]
      });
      if (result.rows.length > 0) {
        return result.rows[0].value as string;
      }
    } catch (e) {
      console.error("Failed to get setting", e);
    }
  }
  return null;
};

export const getSettingsGroup = async (
  settingGroup: string,
  userId: string | null = null
): Promise<Record<string, string>> => {
  const settings: Record<string, string> = {};
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: `SELECT key, value FROM settings WHERE user_id ${userId ? '= ?' : 'IS NULL'} AND setting_group = ?`,
        args: userId ? [userId, settingGroup] : [settingGroup]
      });
      for (const row of result.rows) {
        settings[row.key as string] = row.value as string;
      }
    } catch (e) {
      console.error("Failed to get settings group", e);
    }
  }
  return settings;
};
