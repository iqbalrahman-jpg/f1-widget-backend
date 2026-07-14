import { describe, expect, it } from "vitest";
import { jsonResponse } from "../src/http";

describe("HTTP caching", () => {
  const envelope = {
    data: { value: "test" },
    meta: {
      generatedAt: "2026-07-14T12:00:00.000Z",
      stale: false,
      scheduleUpdatedAt: null,
      resultsUpdatedAt: null,
      driversUpdatedAt: null,
    },
  };

  it("returns an ETag and honors If-None-Match", async () => {
    const first = await jsonResponse(new Request("https://example.test/v1/test"), envelope);
    const etag = first.headers.get("ETag");
    expect(etag).toBeTruthy();

    const second = await jsonResponse(
      new Request("https://example.test/v1/test", { headers: { "If-None-Match": etag as string } }),
      envelope,
    );
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  it("keeps the ETag stable when only generatedAt changes", async () => {
    const first = await jsonResponse(new Request("https://example.test/v1/test"), envelope);
    const later = await jsonResponse(new Request("https://example.test/v1/test"), {
      ...envelope,
      meta: { ...envelope.meta, generatedAt: "2026-07-14T12:05:00.000Z" },
    });
    expect(later.headers.get("ETag")).toBe(first.headers.get("ETag"));
  });
});
