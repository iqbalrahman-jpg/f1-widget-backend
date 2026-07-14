import { describe, expect, it } from "vitest";
import { filterDrivers } from "../src/domain/driver-search";
import type { Driver } from "../src/domain/models";

const drivers: Driver[] = [
  {
    id: "max_verstappen",
    code: "VER",
    givenName: "Max",
    familyName: "Verstappen",
    permanentNumber: "3",
    constructorName: null,
  },
  {
    id: "perez",
    code: "PER",
    givenName: "Sergio",
    familyName: "Pérez",
    permanentNumber: "11",
    constructorName: null,
  },
];

describe("driver search", () => {
  it.each(["vers", "VER", "max vers", "max_ver", "3"])("finds Verstappen using %s", (query) => {
    expect(filterDrivers(drivers, query).map((driver) => driver.id)).toEqual(["max_verstappen"]);
  });

  it("matches names without requiring accents", () => {
    expect(filterDrivers(drivers, "perez").map((driver) => driver.id)).toEqual(["perez"]);
  });

  it("returns all drivers for a blank search", () => {
    expect(filterDrivers(drivers, "  ")).toHaveLength(2);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterDrivers(drivers, "alonso")).toEqual([]);
  });
});

