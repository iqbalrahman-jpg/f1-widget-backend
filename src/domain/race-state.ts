import type { LatestRaceResults, RaceState, RaceSummary, ScheduleData } from "./models";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1_000;

function raceSortValue(race: RaceSummary): number {
  if (race.startDate) return new Date(race.startDate).valueOf();
  return new Date(`${race.scheduledDate}T23:59:59.999Z`).valueOf();
}

function isResultForRace(results: LatestRaceResults | null, race: RaceSummary): boolean {
  return results?.season === race.season && results.round === race.round;
}

export function selectRaceState(
  schedule: ScheduleData,
  latestResults: LatestRaceResults | null,
  now: Date,
): RaceState {
  const races = [...schedule.races].sort((left, right) => raceSortValue(left) - raceSortValue(right));
  const nowMs = now.valueOf();
  const todayUtc = now.toISOString().slice(0, 10);

  const started = races
    .filter((race) => race.startDate !== null && new Date(race.startDate).valueOf() <= nowMs)
    .at(-1);

  if (started && !isResultForRace(latestResults, started)) {
    const elapsed = nowMs - new Date(started.startDate as string).valueOf();
    return elapsed < FOUR_HOURS_MS
      ? { kind: "inProgress", race: started }
      : { kind: "awaitingResults", race: started };
  }

  const nextRace = races.find((race) => {
    if (race.startDate) return new Date(race.startDate).valueOf() > nowMs;
    return race.scheduledDate >= todayUtc;
  });

  return nextRace ? { kind: "upcoming", nextRace } : { kind: "seasonCompleted" };
}

export function resultsFreshnessMs(
  schedule: ScheduleData,
  latestResults: LatestRaceResults | null,
  now: Date,
): number {
  const nowMs = now.valueOf();
  const latestStarted = [...schedule.races]
    .filter((race) => race.startDate !== null && new Date(race.startDate).valueOf() <= nowMs)
    .sort((left, right) => raceSortValue(left) - raceSortValue(right))
    .at(-1);

  if (latestStarted && !isResultForRace(latestResults, latestStarted)) {
    return 60 * 60 * 1_000;
  }
  return 24 * 60 * 60 * 1_000;
}

