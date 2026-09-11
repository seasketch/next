import { isOrganismInfo } from "@seasketch/geostats-types";

/** GraphQL enum value for `data_table:organism` (codegen may lag the SQL enum). */
export const DATA_TABLE_ORGANISM_FIELD_GROUP = "DATA_TABLE_ORGANISM";

export function isOrganismReprocess(meta: unknown): boolean {
  return Boolean(
    meta &&
      typeof meta === "object" &&
      !Array.isArray(meta) &&
      (meta as { reprocessed?: unknown }).reprocessed === true
  );
}

export function organismColumnLabel(value: unknown, noneText: string): string {
  const organism =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { organism?: unknown }).organism ?? value
      : value;
  if (!isOrganismInfo(organism)) {
    return noneText;
  }
  return organism.column;
}

export function organismFromSummary(value: unknown) {
  const organism =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { organism?: unknown }).organism ?? value
      : value;
  return isOrganismInfo(organism) ? organism : null;
}
