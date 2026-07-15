import { z } from "zod";

const driverSchema = z.object({
  driverId: z.string().min(1),
  permanentNumber: z.string().nullish(),
  code: z.string().nullish(),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
});

const circuitSchema = z.object({
  circuitId: z.string().min(1),
  circuitName: z.string().min(1),
  Location: z.object({
    locality: z.string().min(1),
    country: z.string().min(1),
  }),
});

const raceBaseSchema = z.object({
  season: z.string().min(1),
  round: z.string().min(1),
  raceName: z.string().min(1),
  Circuit: circuitSchema,
  date: z.string().min(1),
  time: z.string().nullish(),
});

export const scheduleResponseSchema = z.object({
  MRData: z.object({
    RaceTable: z.object({
      season: z.string().nullish(),
      Races: z.array(raceBaseSchema),
    }),
  }),
});

export const driversResponseSchema = z.object({
  MRData: z.object({
    DriverTable: z.object({
      Drivers: z.array(driverSchema),
    }),
  }),
});

const resultSchema = z.object({
  position: z.string().nullish(),
  positionText: z.string().nullish(),
  grid: z.string().nullish(),
  status: z.string().min(1),
  Driver: driverSchema,
  Constructor: z.object({
    name: z.string().min(1),
  }),
});

export const resultsResponseSchema = z.object({
  MRData: z.object({
    RaceTable: z.object({
      Races: z.array(
        raceBaseSchema.extend({
          Results: z.array(resultSchema),
        }),
      ),
    }),
  }),
});

const driverStandingSchema = z.object({
  position: z.string().nullish(),
  points: z.string().nullish(),
  wins: z.string().nullish(),
  Driver: driverSchema,
  Constructors: z.array(
    z.object({
      name: z.string().min(1),
    }),
  ),
});

export const standingsResponseSchema = z.object({
  MRData: z.object({
    StandingsTable: z.object({
      season: z.string().nullish(),
      round: z.string().nullish(),
      StandingsLists: z.array(
        z.object({
          season: z.string().nullish(),
          round: z.string().nullish(),
          DriverStandings: z.array(driverStandingSchema),
        }),
      ),
    }),
  }),
});

export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
export type DriversResponse = z.infer<typeof driversResponseSchema>;
export type ResultsResponse = z.infer<typeof resultsResponseSchema>;
export type StandingsResponse = z.infer<typeof standingsResponseSchema>;
