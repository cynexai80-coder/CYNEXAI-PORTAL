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

// ─── Portal Settings (key-value feature flags) ────────────────────────────────

export async function getPortalSettings(): Promise<Record<string, string>> {
  return cachedQuery('portal_settings', async () => {
    try {
      const res = await executeWithRetry('SELECT key, value FROM portal_settings');
      const settings: Record<string, string> = {};
      for (const row of res.rows) {
        settings[row.key as string] = row.value as string;
      }
      return settings;
    } catch (e) {
      console.error('Failed to get portal settings', e);
      return {};
    }
  }, 10 * 60 * 1000); // 10 minutes TTL
}

export async function updatePortalSetting(key: string, value: string): Promise<void> {
  await executeWithRetry(
    `INSERT OR REPLACE INTO portal_settings (key, value, updated_at) VALUES (?, ?, ?)`,
    [key, value, new Date().toISOString()]
  );
  cacheInvalidate('portal_settings');
}

// ─── Announcements (Admin) ────────────────────────────────────────────────────

export async function getAnnouncementsAdmin(): Promise<any[]> {
  return cachedQuery('announcements_admin', async () => {
    try {
      const res = await executeWithRetry(
        'SELECT * FROM announcements ORDER BY created_at DESC'
      );
      return res.rows;
    } catch (e) {
      console.error('Failed to get announcements (admin)', e);
      return [];
    }
  }, 3 * 60 * 1000);
}

export async function createAnnouncement(title: string, body: string): Promise<void> {
  const id = `ann_${Date.now()}`;
  await executeWithRetry(
    `INSERT INTO announcements (id, title, body, is_active, created_at) VALUES (?, ?, ?, 1, ?)`,
    [id, title, body, new Date().toISOString()]
  );
  cacheInvalidate('announcements');
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await executeWithRetry(
    'UPDATE announcements SET is_active = 0 WHERE id = ?',
    [id]
  );
  cacheInvalidate('announcements');
}

// ─── Job Listings (Admin) ─────────────────────────────────────────────────────

export async function getJobListingsAdmin(): Promise<any[]> {
  return cachedQuery('job_listings_admin', async () => {
    try {
      const res = await executeWithRetry(
        'SELECT * FROM job_listings ORDER BY scraped_at DESC'
      );
      return res.rows;
    } catch (e) {
      console.error('Failed to get job listings (admin)', e);
      return [];
    }
  }, 5 * 60 * 1000);
}

export async function createJobListing(data: {
  title: string;
  company: string;
  location: string;
  qualifications: string;
  source_url: string;
  expire_date: string;
}): Promise<void> {
  const id = `job_${Date.now()}`;
  await executeWithRetry(
    `INSERT INTO job_listings (id, title, company, location, qualifications, source_url, expire_date, is_active, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [id, data.title, data.company, data.location, data.qualifications, data.source_url, data.expire_date, new Date().toISOString()]
  );
  cacheInvalidate('job_listings');
}

export async function deleteJobListing(id: string): Promise<void> {
  await executeWithRetry(
    'UPDATE job_listings SET is_active = 0 WHERE id = ?',
    [id]
  );
  cacheInvalidate('job_listings');
}

// ─── Course Shared Materials ──────────────────────────────────────────────────

export async function getCourseMaterials(): Promise<any[]> {
  return cachedQuery('course_materials', async () => {
    try {
      const res = await executeWithRetry(
        'SELECT * FROM course_shared_materials ORDER BY created_at DESC'
      );
      return res.rows;
    } catch (e) {
      console.error('Failed to get course materials', e);
      return [];
    }
  }, 5 * 60 * 1000);
}

export async function createCourseMaterial(data: {
  title: string;
  description: string;
  file_url: string;
  material_type: string;
  course_id?: string;
}): Promise<void> {
  const id = `mat_${Date.now()}`;
  await executeWithRetry(
    `INSERT INTO course_shared_materials (id, title, description, file_url, material_type, course_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.description, data.file_url, data.material_type, data.course_id ?? null, new Date().toISOString()]
  );
  cacheInvalidate('course_materials');
}

export async function deleteCourseMaterial(id: string): Promise<void> {
  await executeWithRetry(
    'DELETE FROM course_shared_materials WHERE id = ?',
    [id]
  );
  cacheInvalidate('course_materials');
}
