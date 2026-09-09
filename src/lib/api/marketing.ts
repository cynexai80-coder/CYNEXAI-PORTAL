import { client, isTursoConfigured } from '../turso';

export interface MarketingMetric {
  id: string;
  platform: string;
  spend: number;
  leads_generated: number;
  traffic: number;
  updated_at: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  spent: number;
  leads: number;
  platform: string;
}

const STORAGE_KEY_CAMPAIGNS = 'cynexai_marketing_campaigns';
const STORAGE_KEY_METRICS = 'cynexai_marketing_metrics';

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

export async function getMarketingMetrics(): Promise<MarketingMetric[]> {
  if (isTursoConfigured && client) {
    try {
      const res = await executeWithRetry('SELECT * FROM marketing_metrics');
      if (res && res.rows && res.rows.length > 0) {
        return res.rows.map((row: any) => ({
          id: String(row.id),
          platform: String(row.platform),
          spend: Number(row.spend || 0),
          leads_generated: Number(row.leads_generated || 0),
          traffic: Number(row.traffic || 0),
          updated_at: String(row.updated_at || new Date().toISOString())
        }));
      }
    } catch (error) {
      console.warn('Failed to fetch marketing metrics from Turso, fallback to local', error);
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_METRICS);
    if (raw) return JSON.parse(raw);
  } catch {}

  const defaults: MarketingMetric[] = [
    { id: 'm1', platform: 'Meta', spend: 45000, leads_generated: 120, traffic: 14500, updated_at: new Date().toISOString() },
    { id: 'm2', platform: 'Google', spend: 68000, leads_generated: 185, traffic: 22100, updated_at: new Date().toISOString() },
    { id: 'm3', platform: 'Website', spend: 0, leads_generated: 310, traffic: 48900, updated_at: new Date().toISOString() }
  ];
  localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(defaults));
  return defaults;
}

export async function getMarketingCampaigns(): Promise<MarketingCampaign[]> {
  if (isTursoConfigured && client) {
    try {
      const res = await executeWithRetry('SELECT * FROM marketing_campaigns');
      if (res && res.rows && res.rows.length > 0) {
        return res.rows.map((row: any) => ({
          id: String(row.id),
          name: String(row.name || ''),
          status: String(row.status || 'Active'),
          budget: Number(row.budget || 0),
          spent: Number(row.spent || 0),
          leads: Number(row.leads || 0),
          platform: String(row.platform || 'Meta')
        }));
      }
    } catch (error) {
      console.warn('Failed to fetch marketing campaigns from Turso, fallback to local', error);
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
    if (raw) return JSON.parse(raw);
  } catch {}

  const defaults: MarketingCampaign[] = [
    { id: 'camp_1', name: 'Full Stack Java Enrollment Q3', platform: 'Meta', status: 'Active', budget: 1500, spent: 12400, leads: 48 },
    { id: 'camp_2', name: 'Generative AI & Python Masterclass', platform: 'Google', status: 'Active', budget: 2500, spent: 28900, leads: 92 },
    { id: 'camp_3', name: 'DevOps & AWS Cloud Bootcamp', platform: 'Meta', status: 'Active', budget: 1200, spent: 9800, leads: 34 }
  ];
  localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(defaults));
  return defaults;
}

export async function createMarketingCampaign(camp: Omit<MarketingCampaign, 'id'>): Promise<MarketingCampaign> {
  const newCamp: MarketingCampaign = {
    id: 'camp_' + Date.now().toString(36),
    name: camp.name,
    platform: camp.platform || 'Meta',
    status: camp.status || 'Active',
    budget: Number(camp.budget || 0),
    spent: Number(camp.spent || 0),
    leads: Number(camp.leads || 0)
  };

  if (isTursoConfigured && client) {
    try {
      await executeWithRetry(
        `INSERT OR REPLACE INTO marketing_campaigns (id, name, platform, status, budget, spent, leads) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newCamp.id, newCamp.name, newCamp.platform, newCamp.status, newCamp.budget, newCamp.spent, newCamp.leads]
      );
    } catch (e) {
      console.warn('[Marketing API] Turso insert campaign error', e);
    }
  }

  try {
    const existing = await getMarketingCampaigns();
    const updated = [newCamp, ...existing];
    localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(updated));
  } catch (e) {
    console.error('[Marketing API] Local save campaign error', e);
  }

  return newCamp;
}

export async function updateMarketingCampaign(id: string, updates: Partial<MarketingCampaign>): Promise<boolean> {
  if (isTursoConfigured && client) {
    try {
      const sets: string[] = [];
      const args: any[] = [];
      Object.entries(updates).forEach(([k, v]) => {
        if (k !== 'id') {
          sets.push(`${k} = ?`);
          args.push(v);
        }
      });
      if (sets.length > 0) {
        args.push(id);
        await executeWithRetry(
          `UPDATE marketing_campaigns SET ${sets.join(', ')} WHERE id = ?`,
          args
        );
      }
    } catch (e) {
      console.warn('[Marketing API] Turso update campaign error', e);
    }
  }

  try {
    const existing = await getMarketingCampaigns();
    const idx = existing.findIndex(c => c.id === id);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...updates };
      localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(existing));
    }
  } catch (e) {
    console.error('[Marketing API] Local update campaign error', e);
  }

  return true;
}

export async function deleteMarketingCampaign(id: string): Promise<boolean> {
  if (isTursoConfigured && client) {
    try {
      await executeWithRetry(`DELETE FROM marketing_campaigns WHERE id = ?`, [id]);
    } catch (e) {
      console.warn('[Marketing API] Turso delete campaign error', e);
    }
  }

  try {
    const existing = await getMarketingCampaigns();
    const filtered = existing.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(filtered));
  } catch (e) {
    console.error('[Marketing API] Local delete campaign error', e);
  }

  return true;
}

export async function updateMarketingMetric(platform: string, spend: number, traffic: number, leads: number): Promise<boolean> {
  if (isTursoConfigured && client) {
    try {
      await executeWithRetry(
        `UPDATE marketing_metrics SET spend = ?, traffic = ?, leads_generated = ?, updated_at = CURRENT_TIMESTAMP WHERE platform = ?`,
        [spend, traffic, leads, platform]
      );
    } catch (e) {
      console.warn('[Marketing API] Turso update metric error', e);
    }
  }

  try {
    const existing = await getMarketingMetrics();
    const idx = existing.findIndex(m => m.platform === platform);
    if (idx !== -1) {
      existing[idx] = {
        ...existing[idx],
        spend: Number(spend),
        traffic: Number(traffic),
        leads_generated: Number(leads),
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(existing));
    }
  } catch (e) {
    console.error('[Marketing API] Local update metric error', e);
  }

  return true;
}
