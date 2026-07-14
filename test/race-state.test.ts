import { describe, expect, it } from "vitest";
import { resultsFreshnessMs, selectRaceState } from "../src/domain/race-state";
import { latestResults, race, schedule } from "./fixtures";

describe("race-state selection", () => {
  it("selects the earliest future race from an unsorted schedule", () => {
    const state = selectRaceState(
      schedule([
        race({ round: "3", startDate: "2026-08-01T14:00:00.000Z" }),
        race({ round: "1", startDate: "2026-07-01T14:00:00.000Z" }),
        race({ round: "2", startDate: "2026-07-20T14:00:00.000Z" }),
      ]),
      latestResults("1"),
      new Date("2026-07-14T00:00:00.000Z"),
    );

    expect(state.kind).toBe("upcoming");
    if (state.kind === "upcoming") expect(state.nextRace.round).toBe("2");
  });

  it("reports an in-progress race before results exist", () => {
    const currentRace = race({ round: "2", startDate: "2026-07-14T12:00:00.000Z" });
    const state = selectRaceState(
      schedule([currentRace]),
      latestResults("1"),
      new Date("2026-07-14T14:00:00.000Z"),
    );
    expect(state.kind).toBe("inProgress");
  });

  it("reports awaiting results four hours after the start", () => {
    const currentRace = race({ round: "2", startDate: "2026-07-14T12:00:00.000Z" });
    expect(
      selectRaceState(schedule([currentRace]), latestResults("1"), new Date("2026-07-14T17:00:00.000Z")).kind,
    ).toBe("awaitingResults");
  });

  it("reports season completed when no future race remains", () => {
    const completed = race({ round: "24", startDate: "2026-12-06T13:00:00.000Z" });
    expect(
      selectRaceState(schedule([completed]), latestResults("24"), new Date("2026-12-07T00:00:00.000Z")),
    ).toEqual({ kind: "seasonCompleted" });
  });

  it("handles an empty schedule at a season boundary", () => {
    expect(selectRaceState(schedule([]), null, new Date("2027-01-02T00:00:00.000Z"))).toEqual({
      kind: "seasonCompleted",
    });
  });

  it("keeps a date-only race upcoming through its UTC calendar date", () => {
    const dateOnly = race({ round: "2", startDate: null, scheduledDate: "2026-07-14" });
    const state = selectRaceState(schedule([dateOnly]), latestResults("1"), new Date("2026-07-14T20:00:00.000Z"));
    expect(state.kind).toBe("upcoming");
    if (state.kind === "upcoming") expect(state.nextRace.startDate).toBeNull();
  });
});

describe("result cache freshness", () => {
  const currentRace = race({ round: "2", startDate: "2026-07-14T12:00:00.000Z" });

  it("uses one-hour freshness while results are pending", () => {
    expect(
      resultsFreshnessMs(schedule([currentRace]), latestResults("1"), new Date("2026-07-14T14:00:00.000Z")),
    ).toBe(60 * 60 * 1_000);
  });

  it("returns to daily freshness after matching results arrive", () => {
    expect(
      resultsFreshnessMs(schedule([currentRace]), latestResults("2"), new Date("2026-07-14T14:00:00.000Z")),
    ).toBe(24 * 60 * 60 * 1_000);
  });
});

