import { client, isTursoConfigured } from '../turso';
import { getCurrentUser } from '../auth';
import { cachedQuery, cacheInvalidate } from '../cache';

export interface CourseMaterial {
  id: string;
  course_id: string;
  title: string;
  url: string;
  type: string;
}

export const getCourseMaterials = async (courseId: string): Promise<CourseMaterial[]> => {
  return cachedQuery(`course_materials_${courseId}`, async () => {
    if (isTursoConfigured && client) {
      try {
        const result = await client.execute({
          sql: "SELECT * FROM course_materials WHERE course_id = ?",
          args: [courseId]
        });
        return result.rows.map(row => ({
          id: row.id as string,
          course_id: row.course_id as string,
          title: row.title as string,
          url: row.url as string,
          type: row.type as string
        }));
      } catch (e) {
        console.error("Failed to fetch course materials", e);
      }
    }
    return [];
  }, 5 * 60 * 1000);
};

export const addCourseMaterial = async (courseId: string, title: string, url: string, type: string = 'Demo Material'): Promise<string | null> => {
  try {
    const user = getCurrentUser();
    if (!user || !['Manager', 'CEO', 'DM', 'Admin'].includes(user.role)) return null;
    
    if (isTursoConfigured && client) {
      const id = 'mat_' + Math.random().toString(36).substr(2, 9);
      await client.execute({
        sql: 'INSERT INTO course_materials (id, course_id, title, url, type) VALUES (?, ?, ?, ?, ?)',
        args: [id, courseId, title, url, type]
      });
      cacheInvalidate(`course_materials_${courseId}`);
      return id;
    }
  } catch (e) {
    console.error("Failed to add course material", e);
  }
  return null;
};

export const deleteCourseMaterial = async (id: string, courseId?: string): Promise<boolean> => {
  try {
    const user = getCurrentUser();
    if (!user || !['Manager', 'CEO', 'DM', 'Admin'].includes(user.role)) return false;
    
    if (isTursoConfigured && client) {
      await client.execute({
        sql: 'DELETE FROM course_materials WHERE id = ?',
        args: [id]
      });
      if (courseId) {
        cacheInvalidate(`course_materials_${courseId}`);
      } else {
        cacheInvalidate('course_materials_');
      }
      return true;
    }
  } catch (e) {
    console.error("Failed to delete course material", e);
  }
  return false;
};
