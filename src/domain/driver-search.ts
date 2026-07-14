import type { Driver } from "./models";

function searchable(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en");
}

export function filterDrivers(drivers: Driver[], search: string | null): Driver[] {
  const query = search?.trim();
  if (!query) return drivers;

  const normalizedQuery = searchable(query);
  return drivers.filter((driver) => {
    const fields = [
      driver.id,
      driver.code,
      driver.givenName,
      driver.familyName,
      `${driver.givenName} ${driver.familyName}`,
      driver.permanentNumber,
      driver.constructorName,
    ];
    return fields.some((field) => field !== null && searchable(field).includes(normalizedQuery));
  });
}

