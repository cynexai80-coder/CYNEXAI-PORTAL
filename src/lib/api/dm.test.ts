import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getScrapedJobs,
  triggerJobScraper,
  getAISuggestions,
  getSEOKeywords,
  updateSEOSettings
} from './dm';

describe('DM API', () => {
  beforeEach(() => {
    // Reset any state if necessary
  });

  describe('Blog Management', () => {
    it('should create and retrieve a blog post', async () => {
      const newPost = { title: 'Test Post', content: 'Test Content', status: 'draft' };
      const created = await createBlogPost(newPost);
      expect(created.id).toBeDefined();
      expect(created.title).toBe(newPost.title);

      const posts = await getBlogPosts();
      expect(posts).toContainEqual(created);
    });

    it('should update an existing blog post', async () => {
      const created = await createBlogPost({ title: 'Old Title', content: 'Content', status: 'draft' });
      const updated = await updateBlogPost(created.id, { title: 'New Title' });
      
      expect(updated).toBe(true);
      
      const posts = await getBlogPosts();
      const post = posts.find(p => p.id === created.id);
      expect(post?.title).toBe('New Title');
      expect(post?.content).toBe('Content'); // should retain other fields
    });

    it('should delete a blog post', async () => {
      const created = await createBlogPost({ title: 'To Delete', content: 'Content', status: 'draft' });
      await deleteBlogPost(created.id);
      
      const posts = await getBlogPosts();
      expect(posts.find(p => p.id === created.id)).toBeUndefined();
    });
  });

  describe('Job Scraper', () => {
    it('does not fabricate jobs when the scraper is triggered (there is no scraper backend)', async () => {
      const result = await triggerJobScraper('linkedin');
      expect(Array.isArray(result)).toBe(true);
      expect(result.some(j => j.company.includes('Tech Partner'))).toBe(false);
    });

    it('should retrieve scraped jobs', async () => {
      const jobs = await getScrapedJobs();
      expect(Array.isArray(jobs)).toBe(true);
    });
  });

  describe('AI Content Suggestions', () => {
    it('should return AI suggestions for a topic', async () => {
      const suggestions = await getAISuggestions('marketing');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('title');
      expect(suggestions[0]).toHaveProperty('description');
    });
  });

  describe('SEO Management', () => {
    it('should retrieve SEO keywords', async () => {
      const keywords = await getSEOKeywords();
      expect(Array.isArray(keywords)).toBe(true);
    });

    it('should update SEO settings', async () => {
      const newSettings = { targetKeyword: 'AI Marketing', metaDescription: 'Test meta' };
      const updated = await updateSEOSettings(newSettings);
      expect(updated.targetKeyword).toBe('AI Marketing');
      expect(updated.metaDescription).toBe('Test meta');
    });
  });
});
