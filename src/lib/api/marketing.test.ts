import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMarketingMetrics, getMarketingCampaigns } from './marketing';
import { client } from '../turso';

// Mock the turso client
vi.mock('../turso', () => ({
  isTursoConfigured: true,
  client: {
    execute: vi.fn()
  }
}));

describe('Marketing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMarketingMetrics', () => {
    it('should return empty array if no client', async () => {
      // Simulate unconfigured client
      vi.mocked(client.execute).mockRejectedValueOnce(new Error('No client'));
      
      const result = await getMarketingMetrics();
      
      expect(result).toEqual([]);
    });

    it('should fetch and return metrics from database', async () => {
      const mockRows = [
        { id: '1', platform: 'Meta', spend: 100, leads_generated: 10, traffic: 500, updated_at: '2026-07-08' }
      ];
      
      vi.mocked(client.execute).mockResolvedValueOnce({ rows: mockRows } as any);
      
      const result = await getMarketingMetrics();
      
      expect(client.execute).toHaveBeenCalledWith({ sql: 'SELECT * FROM marketing_metrics', args: [] });
      expect(result).toEqual(mockRows);
    });
  });
});
