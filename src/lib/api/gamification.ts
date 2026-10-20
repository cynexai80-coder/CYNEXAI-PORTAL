import { client } from '../turso';

export interface GameSetting {
  task_type: string;
  is_enabled: boolean;
  reward_amount: number;
}

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

export async function getGamificationSettings(): Promise<GameSetting[]> {
  try {
    const res = await executeWithRetry('SELECT * FROM gamification_settings');
    return res.rows.map((r: any) => ({
      task_type: r.task_type as string,
      is_enabled: Boolean(r.is_enabled),
      reward_amount: Number(r.reward_amount)
    }));
  } catch (error) {
    console.error("Failed to fetch gamification settings", error);
    return [];
  }
}

export async function updateGamificationSetting(taskType: string, isEnabled: boolean, rewardAmount: number): Promise<void> {
  try {
    await executeWithRetry(
      "INSERT OR REPLACE INTO gamification_settings (task_type, is_enabled, reward_amount) VALUES (?, ?, ?)",
      [taskType, isEnabled ? 1 : 0, rewardAmount]
    );
  } catch (error) {
    console.error("Failed to update gamification setting", error);
    throw error;
  }
}

export async function awardCoinsManually(targetStudentId: string, rewardAmount: number): Promise<void> {
  if (!Number.isFinite(rewardAmount) || Math.abs(rewardAmount) > 100000) {
    throw new Error('Invalid reward amount');
  }
  try {
    await executeWithRetry(
      "UPDATE students SET coins = coins + ? WHERE student_code = ? OR id = ?",
      [rewardAmount, targetStudentId, targetStudentId]
    );
  } catch (error) {
    console.error("Failed to manual reward", error);
    throw error;
  }
}
