import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CacheEntry } from "../src/cache/cache";
import type { LatestRaceResults, ScheduleData, StandingsData } from "../src/domain/models";
import type { Env } from "../src/env";
import worker from "../src/index";
import { latestResults, race, schedule } from "./fixtures";

const testEnv = env as unknown as Env;

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("Worker routes", () => {
  it("rejects a missing driver ID", async () => {
    const response = await worker.fetch(new Request("https://example.test/v1/widget-snapshot"), testEnv);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_driver_id", retryable: false });
  });

  it("returns fresh cached drivers without calling Jolpica", async () => {
    const entry: CacheEntry<unknown> = {
      schemaVersion: 1,
      fetchedAt: new Date().toISOString(),
      data: {
        drivers: [
          {
            id: "leclerc",
            code: "LEC",
            givenName: "Charles",
            familyName: "Leclerc",
            permanentNumber: "16",
            constructorName: null,
          },
        ],
      },
    };
    await testEnv.F1_CACHE.put("v1:drivers", JSON.stringify(entry));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await worker.fetch(new Request("https://example.test/v1/drivers"), testEnv);
    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ data: { drivers: [{ id: "leclerc" }] } });
  });

  it("filters cached drivers by partial name", async () => {
    const entry: CacheEntry<unknown> = {
      schemaVersion: 1,
      fetchedAt: new Date().toISOString(),
      data: {
        drivers: [
          {
            id: "leclerc",
            code: "LEC",
            givenName: "Charles",
            familyName: "Leclerc",
            permanentNumber: "16",
            constructorName: null,
          },
          {
            id: "max_verstappen",
            code: "VER",
            givenName: "Max",
            familyName: "Verstappen",
            permanentNumber: "3",
            constructorName: null,
          },
        ],
      },
    };
    await testEnv.F1_CACHE.put("v1:drivers", JSON.stringify(entry));

    const response = await worker.fetch(
      new Request("https://example.test/v1/drivers?search=vers"),
      testEnv,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { drivers: [{ id: "max_verstappen" }] },
    });
  });

  it("rejects an excessively long search", async () => {
    const search = "a".repeat(81);
    const response = await worker.fetch(
      new Request(`https://example.test/v1/drivers?search=${search}`),
      testEnv,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_search" });
  });

  it("returns 503 when cold cache and Jolpica are unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const response = await worker.fetch(new Request("https://example.test/v1/drivers"), testEnv);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "upstream_unavailable", retryable: true });
  });

  it("returns a neutral state when the selected driver is missing", async () => {
    const fetchedAt = new Date().toISOString();
    const scheduleEntry: CacheEntry<ScheduleData> = {
      schemaVersion: 1,
      fetchedAt,
      data: schedule([race({ round: "1", startDate: "2099-07-20T14:00:00.000Z" })]),
    };
    const resultsEntry: CacheEntry<LatestRaceResults | null> = {
      schemaVersion: 1,
      fetchedAt,
      data: latestResults("0", "leclerc"),
    };
    await Promise.all([
      testEnv.F1_CACHE.put("v2:schedule", JSON.stringify(scheduleEntry)),
      testEnv.F1_CACHE.put("v1:results", JSON.stringify(resultsEntry)),
    ]);

    const response = await worker.fetch(
      new Request("https://example.test/v1/widget-snapshot?driverId=alonso"),
      testEnv,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { driverResultState: "driverNotFound", driverResult: null },
    });
  });

  it("returns season points for the selected driver's snapshot", async () => {
    const fetchedAt = new Date().toISOString();
    const scheduleEntry: CacheEntry<ScheduleData> = {
      schemaVersion: 1,
      fetchedAt,
      data: schedule([race({ round: "10", startDate: "2099-07-20T14:00:00.000Z" })]),
    };
    const resultsEntry: CacheEntry<LatestRaceResults | null> = {
      schemaVersion: 1,
      fetchedAt,
      data: latestResults("9", "hamilton"),
    };
    const standingsEntry: CacheEntry<StandingsData> = {
      schemaVersion: 1,
      fetchedAt,
      data: {
        season: "2026",
        round: "9",
        standings: [
          {
            driverId: "hamilton",
            position: 3,
            points: 147,
            wins: 1,
            constructorName: "Ferrari",
          },
        ],
      },
    };
    await Promise.all([
      testEnv.F1_CACHE.put("v2:schedule", JSON.stringify(scheduleEntry)),
      testEnv.F1_CACHE.put("v1:results", JSON.stringify(resultsEntry)),
      testEnv.F1_CACHE.put("v1:standings", JSON.stringify(standingsEntry)),
    ]);

    const response = await worker.fetch(
      new Request("https://example.test/v1/widget-snapshot?driverId=hamilton"),
      testEnv,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        driverResultState: "available",
        driverResult: { driver: { id: "hamilton" } },
        driverStanding: {
          driverId: "hamilton",
          position: 3,
          points: 147,
          constructorName: "Ferrari",
        },
      },
      meta: { standingsUpdatedAt: fetchedAt },
    });
  });

  it("returns next-race information without driver data", async () => {
    const fetchedAt = new Date().toISOString();
    const nextRace = race({ round: "10", startDate: "2099-07-20T14:00:00.000Z" });
    const scheduleEntry: CacheEntry<ScheduleData> = {
      schemaVersion: 1,
      fetchedAt,
      data: schedule([nextRace]),
    };
    const resultsEntry: CacheEntry<LatestRaceResults | null> = {
      schemaVersion: 1,
      fetchedAt,
      data: latestResults("9"),
    };
    await Promise.all([
      testEnv.F1_CACHE.put("v2:schedule", JSON.stringify(scheduleEntry)),
      testEnv.F1_CACHE.put("v1:results", JSON.stringify(resultsEntry)),
    ]);

    const response = await worker.fetch(new Request("https://example.test/v1/races/next"), testEnv);
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, unknown> };
    expect(body).toMatchObject({
      data: {
        raceState: {
          kind: "upcoming",
          nextRace: { round: "10", circuitId: "test_circuit" },
        },
      },
    });
    expect(body.data).not.toHaveProperty("driverResult");
    expect(body.data).not.toHaveProperty("driverResultState");
  });

  it("returns season progress without driver or race-list data", async () => {
    const fetchedAt = new Date().toISOString();
    const scheduleEntry: CacheEntry<ScheduleData> = {
      schemaVersion: 1,
      fetchedAt,
      data: schedule([
        race({ round: "1", startDate: "2026-03-01T14:00:00.000Z" }),
        race({ round: "2", startDate: "2099-07-20T14:00:00.000Z" }),
      ]),
    };
    const resultsEntry: CacheEntry<LatestRaceResults | null> = {
      schemaVersion: 1,
      fetchedAt,
      data: latestResults("1"),
    };
    await Promise.all([
      testEnv.F1_CACHE.put("v2:schedule", JSON.stringify(scheduleEntry)),
      testEnv.F1_CACHE.put("v1:results", JSON.stringify(resultsEntry)),
    ]);

    const response = await worker.fetch(
      new Request("https://example.test/v1/races/season-progress"),
      testEnv,
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, unknown> };
    expect(body.data).toEqual({
      season: "2026",
      totalRaces: 2,
      completedRaces: 1,
      remainingRaces: 1,
      completionPercentage: 50,
      recentRaceCountry: "Test Country",
    });
    expect(body.data).not.toHaveProperty("races");
    expect(body.data).not.toHaveProperty("driverResult");
  });
});
