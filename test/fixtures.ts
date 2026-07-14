import type { LatestRaceResults, RaceSummary, ScheduleData } from "../src/domain/models";

export function rawRace(options: {
  round: string;
  raceName: string;
  date: string;
  time?: string;
}) {
  return {
    season: "2026",
    round: options.round,
    raceName: options.raceName,
    Circuit: {
      circuitName: `${options.raceName} Circuit`,
      Location: { locality: "Test City", country: "Test Country" },
    },
    date: options.date,
    ...(options.time ? { time: options.time } : {}),
  };
}

export function rawResult(options: {
  driverId?: string;
  position?: string;
  grid?: string;
  status?: string;
}) {
  return {
    position: options.position ?? "4",
    positionText: options.position ?? "4",
    grid: options.grid ?? "7",
    status: options.status ?? "Finished",
    Driver: {
      driverId: options.driverId ?? "leclerc",
      permanentNumber: "16",
      code: "LEC",
      givenName: "Charles",
      familyName: "Leclerc",
    },
    Constructor: { name: "Ferrari" },
  };
}

export function race(options: {
  round: string;
  startDate: string | null;
  raceName?: string;
  scheduledDate?: string;
}): RaceSummary {
  const scheduledDate = options.scheduledDate ?? options.startDate?.slice(0, 10) ?? "2026-07-20";
  return {
    season: "2026",
    round: options.round,
    raceName: options.raceName ?? `Race ${options.round}`,
    circuitName: "Test Circuit",
    locality: "Test City",
    country: "Test Country",
    scheduledDate,
    startDate: options.startDate,
  };
}

export function schedule(races: RaceSummary[]): ScheduleData {
  return { season: "2026", races };
}

export function latestResults(round: string, driverId = "leclerc"): LatestRaceResults {
  return {
    season: "2026",
    round,
    raceName: `Race ${round}`,
    raceDate: "2026-07-13",
    startDate: "2026-07-13T14:00:00.000Z",
    results: [
      {
        driver: {
          id: driverId,
          code: "LEC",
          givenName: "Charles",
          familyName: "Leclerc",
          permanentNumber: "16",
          constructorName: "Ferrari",
        },
        raceName: `Race ${round}`,
        raceDate: "2026-07-13",
        startDate: "2026-07-13T14:00:00.000Z",
        finishingPosition: 4,
        gridPosition: 7,
        positionsChanged: 3,
        status: { kind: "finished", label: "Finished" },
      },
    ],
  };
}

