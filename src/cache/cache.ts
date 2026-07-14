export interface CacheEntry<T> {
  schemaVersion: 1;
  fetchedAt: string;
  data: T;
}

export interface ResourceResult<T> {
  data: T;
  fetchedAt: string;
  stale: boolean;
}

export class ResourceUnavailableError extends Error {
  constructor(readonly resource: string) {
    super(`${resource} is unavailable and no cached value exists`);
    this.name = "ResourceUnavailableError";
  }
}

export async function readCache<T>(kv: KVNamespace, key: string): Promise<CacheEntry<T> | null> {
  const raw = await kv.get(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CacheEntry<T>>;
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.fetchedAt !== "string" ||
      Number.isNaN(new Date(parsed.fetchedAt).valueOf()) ||
      parsed.data === undefined
    ) {
      return null;
    }
    return parsed as CacheEntry<T>;
  } catch {
    return null;
  }
}

export async function getOrRefresh<T>(options: {
  kv: KVNamespace;
  key: string;
  resourceName: string;
  freshnessMs: number;
  now: Date;
  load: () => Promise<T>;
}): Promise<ResourceResult<T>> {
  const cached = await readCache<T>(options.kv, options.key);
  const ageMs = cached ? options.now.valueOf() - new Date(cached.fetchedAt).valueOf() : Infinity;

  if (cached && ageMs >= 0 && ageMs < options.freshnessMs) {
    return { data: cached.data, fetchedAt: cached.fetchedAt, stale: false };
  }

  let data: T;
  try {
    data = await options.load();
  } catch {
    if (cached) {
      return { data: cached.data, fetchedAt: cached.fetchedAt, stale: true };
    }
    throw new ResourceUnavailableError(options.resourceName);
  }

  const entry: CacheEntry<T> = {
    schemaVersion: 1,
    fetchedAt: options.now.toISOString(),
    data,
  };
  try {
    await options.kv.put(options.key, JSON.stringify(entry));
  } catch (error) {
    console.error(`Failed to persist ${options.resourceName} cache`, error);
  }
  return { data, fetchedAt: entry.fetchedAt, stale: false };
}
