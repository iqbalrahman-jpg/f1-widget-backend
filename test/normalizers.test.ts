import { describe, expect, it } from "vitest";
import {
  classifyStatus,
  normalizeLatestResults,
  parsePositivePosition,
  parseRaceStart,
} from "../src/domain/normalizers";
import { resultsResponseSchema } from "../src/jolpica/schemas";
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
  it("converts a UTC API timestamp into an absolute ISO date", () => {
    expect(parseRaceStart("2026-07-05", "14:00:00Z")).toBe("2026-07-05T14:00:00.000Z");
  });

  it("keeps a missing start time unknown", () => {
    expect(parseRaceStart("2026-07-05", undefined)).toBeNull();
  });
});

describe("upstream validation", () => {
  it("rejects malformed result responses", () => {
    expect(resultsResponseSchema.safeParse({ MRData: { RaceTable: { Races: [{ Results: null }] } } }).success).toBe(false);
  });
});
