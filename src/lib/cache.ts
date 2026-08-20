// Global In-Memory & Session Caching Layer for Turso Database Optimization
// Eliminates duplicate reads, prevents query storms, and stays within free-tier budgets.

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutes default

/**
 * Get item from memory or sessionStorage cache
 */
export function cacheGet<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  const now = Date.now();
  if (entry) {
    if (entry.expiry > now) {
      return entry.data as T;
    }
    memoryCache.delete(key);
  }

  // Check sessionStorage as secondary persistent cache across page refreshes
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(`cynex_cache_${key}`);
      if (raw) {
        const parsed: CacheEntry<T> = JSON.parse(raw);
        if (parsed.expiry > now) {
          memoryCache.set(key, parsed);
          return parsed.data;
        }
        sessionStorage.removeItem(`cynex_cache_${key}`);
      }
    } catch {
      // Ignore storage errors
    }
  }

  return null;
}

/**
 * Store item in memory & sessionStorage cache
 */
export function cacheSet<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const expiry = Date.now() + ttlMs;
  const entry: CacheEntry<T> = { data, expiry };
  memoryCache.set(key, entry);

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`cynex_cache_${key}`, JSON.stringify(entry));
    } catch {
      // Storage quota or serialization fail - memoryCache still has it
    }
  }
}

/**
 * Invalidate cache by exact key or prefix
 */
export function cacheInvalidate(keyOrPrefix: string): void {
  for (const key of memoryCache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      memoryCache.delete(key);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const prefix = `cynex_cache_${keyOrPrefix}`;
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && (k === prefix || k.startsWith(prefix))) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Clear all cache entries
 */
export function cacheClearAll(): void {
  memoryCache.clear();
  inFlightRequests.clear();
  if (typeof window !== 'undefined') {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('cynex_cache_')) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Execute a query with caching and in-flight promise deduplication.
 * If 5 components request the same data at once, only 1 DB query is fired.
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  // Deduplicate concurrent in-flight calls
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      if (result !== undefined && result !== null) {
        cacheSet(key, result, ttlMs);
      }
      return result;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}
