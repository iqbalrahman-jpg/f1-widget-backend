import { describe, expect, it } from "vitest";
import { calculateSeasonProgress } from "../src/domain/season-progress";
import { latestResults, race, schedule } from "./fixtures";

describe("season progress", () => {
  it("calculates completed races from an unsorted schedule", () => {
    const result = calculateSeasonProgress(
      schedule([
        { ...race({ round: "3", startDate: "2026-08-01T14:00:00.000Z" }), country: "Future Country" },
        { ...race({ round: "1", startDate: "2026-07-01T14:00:00.000Z" }), country: "First Country" },
        { ...race({ round: "2", startDate: "2026-07-20T14:00:00.000Z" }), country: "Recent Country" },
      ]),
      latestResults("2"),
    );

    expect(result).toEqual({
      season: "2026",
      totalRaces: 3,
      completedRaces: 2,
      remainingRaces: 1,
      completionPercentage: 66.7,
      recentRaceCountry: "Recent Country",
    });
  });

  it("does not count a started race until its result is published", () => {
    const result = calculateSeasonProgress(
      schedule([
        race({ round: "1", startDate: "2026-07-01T14:00:00.000Z" }),
        race({ round: "2", startDate: "2026-07-14T12:00:00.000Z" }),
      ]),
      latestResults("1"),
    );
    expect(result.completedRaces).toBe(1);
    expect(result.completionPercentage).toBe(50);
    expect(result.recentRaceCountry).toBe("Test Country");
  });

  it("returns zero before any result exists", () => {
    expect(
      calculateSeasonProgress(
        schedule([race({ round: "1", startDate: "2026-03-01T14:00:00.000Z" })]),
        null,
      ),
    ).toMatchObject({
      completedRaces: 0,
      remainingRaces: 1,
      completionPercentage: 0,
      recentRaceCountry: null,
    });
  });

  it("returns zero values for an empty schedule", () => {
    expect(calculateSeasonProgress({ season: null, races: [] }, null)).toEqual({
      season: null,
      totalRaces: 0,
      completedRaces: 0,
      remainingRaces: 0,
      completionPercentage: 0,
      recentRaceCountry: null,
    });
  });

  it("ignores latest results from another season", () => {
    const oldResults = { ...latestResults("1"), season: "2025" };
    expect(
      calculateSeasonProgress(
        schedule([race({ round: "1", startDate: "2026-03-01T14:00:00.000Z" })]),
        oldResults,
      ),
    ).toMatchObject({ completedRaces: 0, recentRaceCountry: null });
  });

  it("returns no recent country when the result round is absent from the schedule", () => {
    const result = calculateSeasonProgress(
      schedule([race({ round: "1", startDate: "2026-03-01T14:00:00.000Z" })]),
      latestResults("99"),
    );

    expect(result).toMatchObject({ completedRaces: 0, recentRaceCountry: null });
  });

  it("returns one hundred percent after the final result", () => {
    const result = calculateSeasonProgress(
      schedule([
        race({ round: "1", startDate: "2026-03-01T14:00:00.000Z" }),
        { ...race({ round: "2", startDate: "2026-12-06T14:00:00.000Z" }), country: "Final Country" },
      ]),
      latestResults("2"),
    );
    expect(result).toMatchObject({
      completedRaces: 2,
      remainingRaces: 0,
      completionPercentage: 100,
      recentRaceCountry: "Final Country",
    });
  });
});
