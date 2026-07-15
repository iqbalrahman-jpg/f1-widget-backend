import type { LatestRaceResults, ScheduleData, SeasonProgressData } from "./models";

function raceSortValue(race: ScheduleData["races"][number]): number {
  if (race.startDate) return new Date(race.startDate).valueOf();
  return new Date(`${race.scheduledDate}T23:59:59.999Z`).valueOf();
}

export function calculateSeasonProgress(
  schedule: ScheduleData,
  latestResults: LatestRaceResults | null,
): SeasonProgressData {
  const races = [...schedule.races].sort((left, right) => raceSortValue(left) - raceSortValue(right));
  const season = schedule.season ?? races[0]?.season ?? null;
  const totalRaces = races.length;

  let completedRaces = 0;
  let recentRaceCountry: string | null = null;
  if (latestResults && latestResults.season === season) {
    const latestCompletedIndex = races.findIndex(
      (race) => race.season === latestResults.season && race.round === latestResults.round,
    );
    if (latestCompletedIndex >= 0) {
      completedRaces = latestCompletedIndex + 1;
      recentRaceCountry = races[latestCompletedIndex]?.country ?? null;
    }
  }

  const remainingRaces = totalRaces - completedRaces;
  const completionPercentage = totalRaces === 0
    ? 0
    : Math.round((completedRaces / totalRaces) * 1_000) / 10;

  return {
    season,
    totalRaces,
    completedRaces,
    remainingRaces,
    completionPercentage,
    recentRaceCountry,
  };
}
