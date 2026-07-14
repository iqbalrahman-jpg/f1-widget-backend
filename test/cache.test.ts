import { describe, expect, it, vi } from "vitest";
import { getOrRefresh, type CacheEntry } from "../src/cache/cache";

class MemoryKv {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

function kv(value?: CacheEntry<{ value: string }>): MemoryKv {
  const store = new MemoryKv();
  if (value) store.values.set("resource", JSON.stringify(value));
  return store;
}

describe("request-driven KV caching", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");

  it("returns fresh KV without invoking the loader", async () => {
    const store = kv({ schemaVersion: 1, fetchedAt: "2026-07-14T11:30:00.000Z", data: { value: "cached" } });
    const load = vi.fn(async () => ({ value: "fresh" }));

    const result = await getOrRefresh({
      kv: store as unknown as KVNamespace,
      key: "resource",
      resourceName: "test",
      freshnessMs: 60 * 60 * 1_000,
      now,
      load,
    });

    expect(result.data.value).toBe("cached");
    expect(result.stale).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("refreshes expired KV and replaces it", async () => {
    const store = kv({ schemaVersion: 1, fetchedAt: "2026-07-14T10:00:00.000Z", data: { value: "old" } });
    const result = await getOrRefresh({
      kv: store as unknown as KVNamespace,
      key: "resource",
      resourceName: "test",
      freshnessMs: 60 * 60 * 1_000,
      now,
      load: async () => ({ value: "new" }),
    });

    expect(result.data.value).toBe("new");
    expect(JSON.parse(store.values.get("resource") ?? "").data.value).toBe("new");
  });

  it("returns stale KV when refresh fails", async () => {
    const store = kv({ schemaVersion: 1, fetchedAt: "2026-07-13T10:00:00.000Z", data: { value: "old" } });
    const result = await getOrRefresh({
      kv: store as unknown as KVNamespace,
      key: "resource",
      resourceName: "test",
      freshnessMs: 60 * 60 * 1_000,
      now,
      load: async () => Promise.reject(new Error("offline")),
    });

    expect(result).toMatchObject({ data: { value: "old" }, stale: true });
    expect(JSON.parse(store.values.get("resource") ?? "").data.value).toBe("old");
  });

  it("throws when refresh fails without cached data", async () => {
    await expect(
      getOrRefresh({
        kv: kv() as unknown as KVNamespace,
        key: "resource",
        resourceName: "test",
        freshnessMs: 60 * 60 * 1_000,
        now,
        load: async () => Promise.reject(new Error("offline")),
      }),
    ).rejects.toMatchObject({ name: "ResourceUnavailableError", resource: "test" });
  });
});
