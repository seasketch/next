import { GeostatsAttribute } from "@seasketch/geostats-types";
import { DataTableFilter, parseExcludedValues } from "./dataTableQueryApi";

/**
 * Values that should never appear as filter choices: nothing-seen
 * placeholders in the subject column (NO_ORG, "Not recorded") and rows to
 * ignore in whatever column they are keyed on. Both are admin settings on
 * the table; picking one on the map would either error (a nothing-seen
 * value cannot be filtered) or select rows the admin asked to leave out.
 */
export function hiddenFilterValuesByColumn(table: {
  subjectColumn?: string | null;
  effortMarkerValues?: (string | null)[] | null;
  excludedValues?: unknown;
}): { [column: string]: string[] } {
  const out: { [column: string]: string[] } = {};
  const markers = (table.effortMarkerValues || []).filter(
    (value): value is string => typeof value === "string" && value !== ""
  );
  if (table.subjectColumn && markers.length > 0) {
    out[table.subjectColumn] = [...markers];
  }
  for (const [column, values] of Object.entries(
    parseExcludedValues(table.excludedValues)
  )) {
    if (values.length === 0) continue;
    out[column] = [...new Set([...(out[column] || []), ...values])];
  }
  return out;
}

/**
 * Column stats with hidden values removed from each column's value list,
 * so option pickers and default required filters never offer them. Columns
 * without hidden values are returned as the same object.
 */
export function omitHiddenFilterValues(
  columns: GeostatsAttribute[],
  hidden: { [column: string]: string[] }
): GeostatsAttribute[] {
  let changed = false;
  const next = columns.map((column) => {
    const values = hidden[column.attribute];
    const stats = column as GeostatsAttribute & {
      values?: { [value: string]: number };
    };
    if (!values || values.length === 0 || !stats.values) return column;
    const drop = new Set(values);
    const kept: { [value: string]: number } = {};
    let dropped = false;
    for (const [value, count] of Object.entries(stats.values)) {
      if (drop.has(value)) {
        dropped = true;
      } else {
        kept[value] = count;
      }
    }
    if (!dropped) return column;
    changed = true;
    return { ...column, values: kept } as GeostatsAttribute;
  });
  return changed ? next : columns;
}

/**
 * Drops hidden values from saved eq/in filters so a stale selection (made
 * before the admin marked the value as nothing-seen) is never sent to the
 * worker, which would reject it. Returns the same array when nothing changes.
 */
export function omitHiddenFilterValuesFromFilters(
  filters: DataTableFilter[],
  hidden: { [column: string]: string[] }
): DataTableFilter[] {
  let changed = false;
  const next: DataTableFilter[] = [];
  for (const filter of filters) {
    const values = hidden[filter.column];
    if (!values || values.length === 0) {
      next.push(filter);
      continue;
    }
    const drop = new Set(values);
    if (filter.op === "eq" && filter.value != null && drop.has(filter.value)) {
      changed = true;
      continue;
    }
    if (filter.op === "in" && filter.values) {
      const kept = filter.values.filter((value) => !drop.has(value));
      if (kept.length !== filter.values.length) {
        changed = true;
        if (kept.length > 0) {
          next.push({ ...filter, values: kept });
        }
        continue;
      }
    }
    next.push(filter);
  }
  return changed ? next : filters;
}
