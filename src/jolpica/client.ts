import type { Env } from "../env";
import {
  driversResponseSchema,
  resultsResponseSchema,
  scheduleResponseSchema,
  standingsResponseSchema,
  type DriversResponse,
  type ResultsResponse,
  type ScheduleResponse,
  type StandingsResponse,
} from "./schemas";

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly causeCode: "timeout" | "http" | "malformed" | "network",
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export class JolpicaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly env: Env) {
    this.baseUrl = env.JOLPICA_BASE_URL.endsWith("/")
      ? env.JOLPICA_BASE_URL
      : `${env.JOLPICA_BASE_URL}/`;
    const parsedTimeout = Number.parseInt(env.UPSTREAM_TIMEOUT_MS, 10);
    this.timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 5_000;
  }

  getSchedule(): Promise<ScheduleResponse> {
    return this.get("current/races.json", scheduleResponseSchema);
  }

  getDrivers(): Promise<DriversResponse> {
    return this.get("current/drivers.json", driversResponseSchema);
  }

  getLatestResults(): Promise<ResultsResponse> {
    return this.get("current/last/results.json", resultsResponseSchema);
  }

  getDriverStandings(): Promise<StandingsResponse> {
    return this.get("current/driverStandings.json", standingsResponseSchema);
  }

  private async get<T>(path: string, schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } }): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(new URL(path, this.baseUrl), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new UpstreamError(`Jolpica returned HTTP ${response.status}`, "http");
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new UpstreamError("Jolpica returned invalid JSON", "malformed");
      }

      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new UpstreamError("Jolpica response did not match the expected schema", "malformed");
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      if (controller.signal.aborted) {
        throw new UpstreamError("Jolpica request timed out", "timeout");
      }
      throw new UpstreamError("Jolpica request failed", "network");
    } finally {
      clearTimeout(timeout);
    }
  }
}
