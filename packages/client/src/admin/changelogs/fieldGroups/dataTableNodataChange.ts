import { normalizeNodataValues } from "@seasketch/geostats-types";
import { summary } from "./FieldGroupListItemBase";
import { tableVersionFromSummary } from "./dataTableSummary";

/** GraphQL enum value for `data_table:nodata` (codegen may lag the SQL enum). */
export const DATA_TABLE_NODATA_FIELD_GROUP = "DATA_TABLE_NODATA";

export function isNodataReprocess(meta: unknown, fromSummary: unknown, toSummary: unknown) {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    if ((meta as { reprocessed?: unknown }).reprocessed === true) {
      return true;
    }
  }
  const fromVersion = tableVersionFromSummary(summary(fromSummary));
  const toVersion = tableVersionFromSummary(summary(toSummary));
  return (
    fromVersion != null && toVersion != null && fromVersion !== toVersion
  );
}

export function nodataValuesLabel(
  value: unknown,
  noneText: string
): string {
  const values = normalizeNodataValues(
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { nodata_values?: unknown }).nodata_values ??
          (value as { nodataValues?: unknown }).nodataValues ??
          value
      : value
  );
  if (values.length === 0) {
    return noneText;
  }
  return values.map((item) => String(item)).join(", ");
}
