interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Executes a fetcher function and caches the result for ttlMs.
 * Subsequent calls with the same key within ttlMs return the cached result immediately.
 */
export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = memoryCache.get(key);
  if (existing && (now - existing.timestamp < existing.ttlMs)) {
    return existing.data;
  }
  const freshData = await fetcher();
  memoryCache.set(key, { data: freshData, timestamp: now, ttlMs });
  return freshData;
}

/**
 * Invalidates cache entries.
 * If keyPrefix is provided, deletes entries starting with keyPrefix.
 * If no keyPrefix is provided, clears the entire cache.
 */
export function invalidateQueryCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }
}
