import type {
  Driver,
  DriversData,
  DriverRaceResult,
  LatestRaceResults,
  RaceSummary,
  ResultStatus,
  ScheduleData,
  StandingsData,
} from "./models";
import type { DriversResponse, ResultsResponse, ScheduleResponse, StandingsResponse } from "../jolpica/schemas";

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parsePositivePosition(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

export function parseNonNegativeNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function parseRaceStart(date: string, time: string | null | undefined): string | null {
  if (!time) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

export function classifyStatus(status: string): ResultStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("disqual")) return { kind: "dsq", label: "DSQ" };
  if (
    normalized.includes("did not start") ||
    normalized.includes("withdrew") ||
    normalized.includes("did not qualify") ||
    normalized.includes("did not prequalify")
  ) {
    return { kind: "dns", label: "DNS" };
  }
  if (normalized === "finished" || /^\+\d+\s+laps?$/.test(normalized)) {
    return { kind: "finished", label: "Finished" };
  }
  return { kind: "dnf", label: "DNF" };
}

function normalizeDriver(raw: {
  driverId: string;
  code?: string | null | undefined;
  givenName: string;
  familyName: string;
  permanentNumber?: string | null | undefined;
}, constructorName: string | null = null): Driver {
  return {
    id: raw.driverId,
    code: optionalText(raw.code)?.toUpperCase() ?? null,
    givenName: raw.givenName,
    familyName: raw.familyName,
    permanentNumber: optionalText(raw.permanentNumber),
    constructorName,
  };
}

function normalizeRace(raw: {
  season: string;
  round: string;
  raceName: string;
  Circuit: { circuitId: string; circuitName: string; Location: { locality: string; country: string } };
  date: string;
  time?: string | null | undefined;
}): RaceSummary {
  return {
    season: raw.season,
    round: raw.round,
    raceName: raw.raceName,
    circuitId: raw.Circuit.circuitId,
    circuitName: raw.Circuit.circuitName,
    locality: raw.Circuit.Location.locality,
    country: raw.Circuit.Location.country,
    scheduledDate: raw.date,
    startDate: parseRaceStart(raw.date, raw.time),
  };
}

export function normalizeDrivers(response: DriversResponse): DriversData {
  const drivers = response.MRData.DriverTable.Drivers.map((driver) => normalizeDriver(driver));
  drivers.sort((left, right) => left.familyName.localeCompare(right.familyName));
  return { drivers };
}

export function normalizeSchedule(response: ScheduleResponse): ScheduleData {
  return {
    season: response.MRData.RaceTable.season ?? null,
    races: response.MRData.RaceTable.Races.map(normalizeRace),
  };
}

export function normalizeLatestResults(response: ResultsResponse): LatestRaceResults | null {
  const race = response.MRData.RaceTable.Races[0];
  if (!race) return null;

  const results: DriverRaceResult[] = race.Results.map((result) => {
    const finishingPosition = parsePositivePosition(result.position);
    const gridPosition = parsePositivePosition(result.grid);
    const status = classifyStatus(result.status);
    const positionsChanged =
      status.kind === "finished" && finishingPosition !== null && gridPosition !== null
        ? gridPosition - finishingPosition
        : null;

    return {
      driver: normalizeDriver(result.Driver, result.Constructor.name),
      raceName: race.raceName,
      raceDate: race.date,
      startDate: parseRaceStart(race.date, race.time),
      finishingPosition,
      gridPosition,
      positionsChanged,
      status,
    };
  });

  return {
    season: race.season,
    round: race.round,
    raceName: race.raceName,
    raceDate: race.date,
    startDate: parseRaceStart(race.date, race.time),
    results,
  };
}

export function normalizeStandings(response: StandingsResponse): StandingsData {
  const table = response.MRData.StandingsTable;
  const list = table.StandingsLists[0];

  return {
    season: list?.season ?? table.season ?? null,
    round: list?.round ?? table.round ?? null,
    standings: (list?.DriverStandings ?? []).map((standing) => ({
      driverId: standing.Driver.driverId,
      position: parsePositivePosition(standing.position),
      points: parseNonNegativeNumber(standing.points),
      wins: Math.trunc(parseNonNegativeNumber(standing.wins)),
      constructorName: optionalText(standing.Constructors[0]?.name),
    })),
  };
}
