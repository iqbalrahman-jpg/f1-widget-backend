export interface Driver {
  id: string;
  code: string | null;
  givenName: string;
  familyName: string;
  permanentNumber: string | null;
  constructorName: string | null;
}

export type ResultStatusKind = "finished" | "dnf" | "dns" | "dsq";

export interface ResultStatus {
  kind: ResultStatusKind;
  label: string;
}

export interface DriverRaceResult {
  driver: Driver;
  raceName: string;
  raceDate: string;
  startDate: string | null;
  finishingPosition: number | null;
  gridPosition: number | null;
  positionsChanged: number | null;
  status: ResultStatus;
}

export interface RaceSummary {
  season: string;
  round: string;
  raceName: string;
  circuitId: string;
  circuitName: string;
  locality: string;
  country: string;
  scheduledDate: string;
  startDate: string | null;
}

export type RaceState =
  | { kind: "upcoming"; nextRace: RaceSummary }
  | { kind: "inProgress"; race: RaceSummary }
  | { kind: "awaitingResults"; race: RaceSummary }
  | { kind: "seasonCompleted" };

export interface LatestRaceResults {
  season: string;
  round: string;
  raceName: string;
  raceDate: string;
  startDate: string | null;
  results: DriverRaceResult[];
}

export interface DriversData {
  drivers: Driver[];
}

export interface ScheduleData {
  season: string | null;
  races: RaceSummary[];
}

export type DriverResultState = "available" | "driverNotFound" | "unavailable";

export interface WidgetSnapshot {
  driverResultState: DriverResultState;
  driverResult: DriverRaceResult | null;
  driverStanding: DriverStanding | null;
  raceState: RaceState;
}

export interface DriverStanding {
  driverId: string;
  position: number | null;
  points: number;
  wins: number;
  constructorName: string | null;
}

export interface StandingsData {
  season: string | null;
  round: string | null;
  standings: DriverStanding[];
}

export interface NextRaceData {
  raceState: RaceState;
}

export interface SeasonProgressData {
  season: string | null;
  totalRaces: number;
  completedRaces: number;
  remainingRaces: number;
  completionPercentage: number;
  recentRaceCountry: string | null;
}

export interface ResponseMeta {
  generatedAt: string;
  stale: boolean;
  scheduleUpdatedAt: string | null;
  resultsUpdatedAt: string | null;
  driversUpdatedAt: string | null;
  standingsUpdatedAt: string | null;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}
