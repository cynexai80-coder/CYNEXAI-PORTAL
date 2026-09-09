import { client, isTursoConfigured } from '../turso';

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  category: string;
  image?: string;
  video?: string;
  isVisible: boolean;
  date: string;
}

export interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  qualifications: string;
  source_url?: string;
  expire_date?: string;
}

const STORAGE_KEY_BLOGS = 'cynexai_blog_posts';
const STORAGE_KEY_JOBS = 'cynexai_scraped_jobs';
const STORAGE_KEY_SEO = 'cynexai_seo_settings';
const STORAGE_KEY_KEYWORDS = 'cynexai_seo_keywords';

// ─── Blog Posts API ─────────────────────────────────────────────────────────

export async function getBlogPosts(): Promise<BlogPost[]> {
  if (isTursoConfigured && client) {
    try {
      const res = await client.execute('SELECT * FROM blog_posts ORDER BY date DESC');
      if (res.rows && res.rows.length > 0) {
        return res.rows.map((r: any) => ({
          id: String(r.id),
          title: String(r.title || ''),
          content: String(r.content || ''),
          category: String(r.category || 'General'),
          image: r.image ? String(r.image) : undefined,
          video: r.video ? String(r.video) : undefined,
          isVisible: Boolean(r.isVisible),
          date: String(r.date || new Date().toISOString())
        }));
      }
    } catch (e) {
      console.warn('[DM API] Turso blog_posts read error, fallback to local', e);
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_BLOGS);
    if (raw) return JSON.parse(raw);
  } catch {}

  // Seed default posts if empty
  const defaultPosts: BlogPost[] = [
    {
      id: 'blog_1',
      title: 'Mastering Full Stack Development in 2026',
      content: 'Full Stack Java and React skills continue to lead the tech job market with high demand across cloud and enterprise sectors.',
      category: 'Web Development',
      isVisible: true,
      date: new Date().toISOString().split('T')[0]
    },
    {
      id: 'blog_2',
      title: 'Why Artificial Intelligence & Generative AI Are Vital for IT Careers',
      content: 'Learn how mastering Python, Deep Learning, and LLM orchestration boosts career growth and job placements.',
      category: 'Artificial Intelligence',
      isVisible: true,
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0]
    }
  ];
  localStorage.setItem(STORAGE_KEY_BLOGS, JSON.stringify(defaultPosts));
  return defaultPosts;
}

export async function createBlogPost(post: Omit<BlogPost, 'id' | 'date'> & { id?: string }): Promise<BlogPost> {
  const newPost: BlogPost = {
    id: post.id || 'post_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    title: post.title,
    content: post.content,
    category: post.category || 'General',
    image: post.image || '',
    video: post.video || '',
    isVisible: post.isVisible !== undefined ? post.isVisible : true,
    date: new Date().toISOString().split('T')[0]
  };

  // DB Sync
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: `INSERT OR REPLACE INTO blog_posts (id, title, content, image, video, category, isVisible, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [newPost.id, newPost.title, newPost.content, newPost.image || null, newPost.video || null, newPost.category, newPost.isVisible ? 1 : 0, newPost.date]
      });
    } catch (e) {
      console.warn('[DM API] Turso create blog error', e);
    }
  }

  // Local Sync
  try {
    const existing = await getBlogPosts();
    const updated = [newPost, ...existing.filter(p => p.id !== newPost.id)];
    localStorage.setItem(STORAGE_KEY_BLOGS, JSON.stringify(updated));
  } catch (e) {
    console.error('[DM API] Local save blog error', e);
  }

  return newPost;
}

export async function updateBlogPost(id: string, updates: Partial<BlogPost>): Promise<boolean> {
  if (isTursoConfigured && client) {
    try {
      const sets: string[] = [];
      const args: any[] = [];
      Object.entries(updates).forEach(([k, v]) => {
        if (k !== 'id') {
          sets.push(`${k} = ?`);
          args.push(k === 'isVisible' ? (v ? 1 : 0) : v);
        }
      });
      if (sets.length > 0) {
        args.push(id);
        await client.execute({
          sql: `UPDATE blog_posts SET ${sets.join(', ')} WHERE id = ?`,
          args
        });
      }
    } catch (e) {
      console.warn('[DM API] Turso update blog error', e);
    }
  }

  try {
    const existing = await getBlogPosts();
    const idx = existing.findIndex(p => p.id === id);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...updates };
      localStorage.setItem(STORAGE_KEY_BLOGS, JSON.stringify(existing));
    }
  } catch (e) {
    console.error('[DM API] Local update blog error', e);
  }

  return true;
}

export async function deleteBlogPost(id: string): Promise<boolean> {
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: `DELETE FROM blog_posts WHERE id = ?`,
        args: [id]
      });
    } catch (e) {
      console.warn('[DM API] Turso delete blog error', e);
    }
  }

  try {
    const existing = await getBlogPosts();
    const filtered = existing.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY_BLOGS, JSON.stringify(filtered));
  } catch (e) {
    console.error('[DM API] Local delete blog error', e);
  }

  return true;
}

// ─── Scraped Jobs API ────────────────────────────────────────────────────────

export async function getScrapedJobs(): Promise<JobItem[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_JOBS);
    if (raw) return JSON.parse(raw);
  } catch {}

  const defaults: JobItem[] = [
    {
      id: 'job_1',
      title: 'Junior Data Scientist',
      company: 'Analytics Global',
      location: 'Hyderabad / Remote',
      qualifications: 'Python, ML, SQL, Pandas',
      source_url: 'https://cynexai.in/careers',
      expire_date: '2026-10-15'
    },
    {
      id: 'job_2',
      title: 'Full Stack Java Developer',
      company: 'Enterprise Solutions Inc',
      location: 'Kukatpally, Hyderabad',
      qualifications: 'Java, Spring Boot, React, MySQL',
      source_url: 'https://cynexai.in/careers',
      expire_date: '2026-10-20'
    }
  ];
  localStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(defaults));
  return defaults;
}

export async function createJob(job: Omit<JobItem, 'id'>): Promise<JobItem> {
  const newJob: JobItem = {
    id: 'job_' + Date.now().toString(36),
    ...job
  };

  try {
    const existing = await getScrapedJobs();
    const updated = [newJob, ...existing];
    localStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(updated));
  } catch (e) {
    console.error('[DM API] Save job error', e);
  }

  return newJob;
}

export async function deleteJob(id: string): Promise<boolean> {
  try {
    const existing = await getScrapedJobs();
    const updated = existing.filter(j => j.id !== id);
    localStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(updated));
  } catch (e) {
    console.error('[DM API] Delete job error', e);
  }
  return true;
}

export async function triggerJobScraper(source: string): Promise<JobItem[]> {
  const newScraped: JobItem[] = [
    {
      id: 'job_scraped_' + Date.now().toString(36),
      title: 'AI Prompt Engineer / Developer',
      company: `${source.toUpperCase()} Tech Partner`,
      location: 'Hyderabad (Hybrid)',
      qualifications: 'Generative AI, Python, OpenAI, LangChain',
      source_url: 'https://cynexai.in/jobs',
      expire_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    }
  ];

  try {
    const existing = await getScrapedJobs();
    const merged = [...newScraped, ...existing];
    localStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(merged));
    return merged;
  } catch {
    return newScraped;
  }
}

// ─── AI Suggestions API ──────────────────────────────────────────────────────

export async function getAISuggestions(topic: string) {
  const cleanTopic = topic || 'Software & AI Training';
  return [
    {
      title: `10 Career Shortcuts to Master ${cleanTopic} in 2026`,
      description: `Hands-on roadmap highlighting key projects, skills, and industry placement strategies for ${cleanTopic}.`,
      category: 'Blog Idea'
    },
    {
      title: `How ${cleanTopic} Boosts Student Placements by 300%`,
      description: `Case study showcasing real student success stories, salary bumps, and practical portfolio creation.`,
      category: 'Social Post'
    },
    {
      title: `Top 5 Interview Questions in ${cleanTopic} You Must Know`,
      description: `Essential technical and practical questions asked by hiring managers in ${cleanTopic}.`,
      category: 'Video Script'
    }
  ];
}

// ─── SEO Keywords & Meta Settings API ────────────────────────────────────────

export async function getSEOKeywords(): Promise<string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KEYWORDS);
    if (raw) return JSON.parse(raw);
  } catch {}

  const defaults = [
    'CynexAI Training Institute', 'Data Science Hyderabad', 'Generative AI Course',
    'Full Stack Java Development', 'DevOps & Cloud Technologies', 'Software Testing Course',
    'Kukatpally IT Institute', '100% Placement Assistance'
  ];
  localStorage.setItem(STORAGE_KEY_KEYWORDS, JSON.stringify(defaults));
  return defaults;
}

export async function addSEOKeyword(keyword: string): Promise<string[]> {
  if (!keyword.trim()) return getSEOKeywords();
  const existing = await getSEOKeywords();
  if (!existing.includes(keyword.trim())) {
    const updated = [...existing, keyword.trim()];
    localStorage.setItem(STORAGE_KEY_KEYWORDS, JSON.stringify(updated));
    return updated;
  }
  return existing;
}

export async function deleteSEOKeyword(keyword: string): Promise<string[]> {
  const existing = await getSEOKeywords();
  const updated = existing.filter(k => k !== keyword);
  localStorage.setItem(STORAGE_KEY_KEYWORDS, JSON.stringify(updated));
  return updated;
}

export async function getSEOSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEO);
    if (raw) return JSON.parse(raw);
  } catch {}

  return {
    metaTitle: 'CynexAI | Premium IT & Corporate Training Institute',
    metaDescription: 'CynexAI is a premier training institute specializing in Data Science, Artificial Intelligence, Generative AI, Full Stack Java, DevOps, Cloud Technologies, and Software Testing.',
    canonicalUrl: 'https://cynexai.in',
    ogImage: 'https://cynexai.in/assets/cynexai-banner.jpg'
  };
}

export async function updateSEOSettings(settings: any) {
  try {
    localStorage.setItem(STORAGE_KEY_SEO, JSON.stringify(settings));
  } catch (e) {
    console.error('[DM API] Save SEO error', e);
  }
  return settings;
}
