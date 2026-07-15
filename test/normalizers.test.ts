import { describe, expect, it } from "vitest";
import {
  classifyStatus,
  normalizeLatestResults,
  normalizeSchedule,
  normalizeStandings,
  parseNonNegativeNumber,
  parsePositivePosition,
  parseRaceStart,
} from "../src/domain/normalizers";
import { resultsResponseSchema, scheduleResponseSchema, standingsResponseSchema } from "../src/jolpica/schemas";
import { rawRace, rawResult } from "./fixtures";

function normalizeResult(result: ReturnType<typeof rawResult>) {
  const response = resultsResponseSchema.parse({
    MRData: {
      RaceTable: {
        Races: [
          {
            ...rawRace({ round: "12", raceName: "British Grand Prix", date: "2026-07-05", time: "14:00:00Z" }),
            Results: [result],
          },
        ],
      },
    },
  });
  return normalizeLatestResults(response)?.results[0];
}

describe("position normalization", () => {
  it.each([
    ["1", 1],
    ["20", 20],
    ["0", null],
    ["R", null],
    [null, null],
  ])("parses %s as %s", (input, expected) => {
    expect(parsePositivePosition(input)).toBe(expected);
  });

  it("calculates positions gained", () => {
    expect(normalizeResult(rawResult({ grid: "7", position: "4" }))?.positionsChanged).toBe(3);
  });

  it("calculates positions lost", () => {
    expect(normalizeResult(rawResult({ grid: "3", position: "8" }))?.positionsChanged).toBe(-5);
  });

  it("does not calculate a change for grid zero", () => {
    const result = normalizeResult(rawResult({ grid: "0", position: "4" }));
    expect(result?.gridPosition).toBeNull();
    expect(result?.positionsChanged).toBeNull();
  });

  it("does not present position changes for a DNF", () => {
    expect(
      normalizeResult(rawResult({ grid: "7", position: "15", status: "Engine" }))?.positionsChanged,
    ).toBeNull();
  });
});

describe("result status normalization", () => {
  it.each([
    ["Finished", "finished", "Finished"],
    ["+1 Lap", "finished", "Finished"],
    ["Engine", "dnf", "DNF"],
    ["Did not start", "dns", "DNS"],
    ["Withdrew", "dns", "DNS"],
    ["Disqualified", "dsq", "DSQ"],
  ] as const)("maps %s to %s", (raw, kind, label) => {
    expect(classifyStatus(raw)).toEqual({ kind, label });
  });
});

describe("race time parsing", () => {
  it("preserves the stable circuit ID", () => {
    const response = scheduleResponseSchema.parse({
      MRData: {
        RaceTable: {
          season: "2026",
          Races: [rawRace({ round: "12", raceName: "British Grand Prix", date: "2026-07-05" })],
        },
      },
    });

    expect(normalizeSchedule(response).races[0]?.circuitId).toBe("test_circuit");
  });

  it("converts a UTC API timestamp into an absolute ISO date", () => {
    expect(parseRaceStart("2026-07-05", "14:00:00Z")).toBe("2026-07-05T14:00:00.000Z");
  });

  it("keeps a missing start time unknown", () => {
    expect(parseRaceStart("2026-07-05", undefined)).toBeNull();
  });
});

describe("standings normalization", () => {
  it.each([
    ["147", 147],
    ["0.5", 0.5],
    ["-1", 0],
    ["invalid", 0],
    [null, 0],
  ])("parses %s points as %s", (input, expected) => {
    expect(parseNonNegativeNumber(input)).toBe(expected);
  });

  it("normalizes a driver's season standing", () => {
    const response = standingsResponseSchema.parse({
      MRData: {
        StandingsTable: {
          season: "2026",
          round: "9",
          StandingsLists: [
            {
              season: "2026",
              round: "9",
              DriverStandings: [
                {
                  position: "3",
                  points: "147",
                  wins: "1",
                  Driver: {
                    driverId: "hamilton",
                    permanentNumber: "44",
                    code: "HAM",
                    givenName: "Lewis",
                    familyName: "Hamilton",
                  },
                  Constructors: [{ name: "Ferrari" }],
                },
              ],
            },
          ],
        },
      },
    });

    expect(normalizeStandings(response)).toEqual({
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
    });
  });
});

describe("upstream validation", () => {
  it("rejects malformed result responses", () => {
    expect(resultsResponseSchema.safeParse({ MRData: { RaceTable: { Races: [{ Results: null }] } } }).success).toBe(false);
  });
});
