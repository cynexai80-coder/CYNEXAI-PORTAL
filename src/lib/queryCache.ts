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
  arg2: number | (() => Promise<T>),
  arg3?: number | (() => Promise<T>)
): Promise<T> {
  let ttlMs = 30000;
  let fetcher: (() => Promise<T>) | undefined;

  if (typeof arg2 === 'function') {
    fetcher = arg2;
    if (typeof arg3 === 'number') ttlMs = arg3;
  } else if (typeof arg2 === 'number') {
    ttlMs = arg2;
    if (typeof arg3 === 'function') fetcher = arg3;
  }

  if (typeof fetcher !== 'function') {
    throw new Error(`cachedQuery: fetcher function is required for cache key "${key}"`);
  }

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
