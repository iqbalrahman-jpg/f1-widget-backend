import { getOrRefresh, readCache, type ResourceResult } from "./cache/cache";
import type {
  ApiEnvelope,
  DriversData,
  LatestRaceResults,
  NextRaceData,
  ResponseMeta,
  ScheduleData,
  SeasonProgressData,
  WidgetSnapshot,
} from "./domain/models";
import { normalizeDrivers, normalizeLatestResults, normalizeSchedule } from "./domain/normalizers";
import { filterDrivers } from "./domain/driver-search";
import { resultsFreshnessMs, selectRaceState } from "./domain/race-state";
import { calculateSeasonProgress } from "./domain/season-progress";
import type { Env } from "./env";
import { JolpicaClient } from "./jolpica/client";

const KEYS = {
  schedule: "v1:schedule",
  drivers: "v1:drivers",
  results: "v1:results",
} as const;

const SCHEDULE_FRESHNESS_MS = 12 * 60 * 60 * 1_000;
const DRIVERS_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1_000;

export class F1Service {
  private readonly client: JolpicaClient;

  constructor(
    private readonly env: Env,
    private readonly now: Date,
  ) {
    this.client = new JolpicaClient(env);
  }

  async drivers(search: string | null = null): Promise<ApiEnvelope<DriversData>> {
    const drivers = await getOrRefresh({
      kv: this.env.F1_CACHE,
      key: KEYS.drivers,
      resourceName: "drivers",
      freshnessMs: DRIVERS_FRESHNESS_MS,
      now: this.now,
      load: async () => normalizeDrivers(await this.client.getDrivers()),
    });

    return {
      data: { drivers: filterDrivers(drivers.data.drivers, search) },
      meta: this.meta({ drivers }),
    };
  }

  async widgetSnapshot(driverId: string): Promise<ApiEnvelope<WidgetSnapshot>> {
    const { schedule, results } = await this.raceResources();

    const selectedResult = results.data?.results.find((item) => item.driver.id === driverId) ?? null;
    const driverResultState = results.data === null
      ? "unavailable"
      : selectedResult
        ? "available"
        : "driverNotFound";

    return {
      data: {
        driverResultState,
        driverResult: selectedResult,
        raceState: selectRaceState(schedule.data, results.data, this.now),
      },
      meta: this.meta({ schedule, results }),
    };
  }

  async nextRace(): Promise<ApiEnvelope<NextRaceData>> {
    const { schedule, results } = await this.raceResources();

    return {
      data: {
        raceState: selectRaceState(schedule.data, results.data, this.now),
      },
      meta: this.meta({ schedule, results }),
    };
  }

  async seasonProgress(): Promise<ApiEnvelope<SeasonProgressData>> {
    const { schedule, results } = await this.raceResources();

    return {
      data: calculateSeasonProgress(schedule.data, results.data),
      meta: this.meta({ schedule, results }),
    };
  }

  private async raceResources(): Promise<{
    schedule: ResourceResult<ScheduleData>;
    results: ResourceResult<LatestRaceResults | null>;
  }> {
    const schedule = await getOrRefresh({
      kv: this.env.F1_CACHE,
      key: KEYS.schedule,
      resourceName: "schedule",
      freshnessMs: SCHEDULE_FRESHNESS_MS,
      now: this.now,
      load: async () => normalizeSchedule(await this.client.getSchedule()),
    });

    const cachedResults = await readCache<LatestRaceResults | null>(this.env.F1_CACHE, KEYS.results);
    const results = await getOrRefresh({
      kv: this.env.F1_CACHE,
      key: KEYS.results,
      resourceName: "results",
      freshnessMs: resultsFreshnessMs(schedule.data, cachedResults?.data ?? null, this.now),
      now: this.now,
      load: async () => normalizeLatestResults(await this.client.getLatestResults()),
    });

    return { schedule, results };
  }

  async health(): Promise<Record<string, unknown>> {
    const [schedule, drivers, results] = await Promise.all([
      readCache<ScheduleData>(this.env.F1_CACHE, KEYS.schedule),
      readCache<DriversData>(this.env.F1_CACHE, KEYS.drivers),
      readCache<LatestRaceResults | null>(this.env.F1_CACHE, KEYS.results),
    ]);

    return {
      status: "ok",
      checkedAt: this.now.toISOString(),
      cache: {
        scheduleUpdatedAt: schedule?.fetchedAt ?? null,
        driversUpdatedAt: drivers?.fetchedAt ?? null,
        resultsUpdatedAt: results?.fetchedAt ?? null,
      },
    };
  }

  private meta(resources: {
    schedule?: ResourceResult<ScheduleData>;
    results?: ResourceResult<LatestRaceResults | null>;
    drivers?: ResourceResult<DriversData>;
  }): ResponseMeta {
    return {
      generatedAt: this.now.toISOString(),
      stale: Boolean(resources.schedule?.stale || resources.results?.stale || resources.drivers?.stale),
      scheduleUpdatedAt: resources.schedule?.fetchedAt ?? null,
      resultsUpdatedAt: resources.results?.fetchedAt ?? null,
      driversUpdatedAt: resources.drivers?.fetchedAt ?? null,
    };
  }
}
