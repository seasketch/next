import {
  DataTableNodataValue,
  DataTablesColumnStats,
  MAX_DATA_TABLE_NODATA_VALUES,
  normalizeNodataValues,
} from "@seasketch/geostats-types";

const COMMON_SENTINELS = new Set([
  "-88",
  "-99",
  "-999",
  "-9999",
  "-99999",
  "-32768",
  "NA",
]);

export function parseNodataToken(raw: string): DataTableNodataValue | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return trimmed;
}

export function formatNodataValue(value: DataTableNodataValue): string {
  return String(value);
}

export function nodataValuesFromUnknown(value: unknown): DataTableNodataValue[] {
  return normalizeNodataValues(value);
}

export function addNodataValue(
  values: DataTableNodataValue[],
  token: string
): DataTableNodataValue[] {
  const parsed = parseNodataToken(token);
  if (parsed == null) return values;
  return normalizeNodataValues([...values, parsed]);
}

export function removeNodataValue(
  values: DataTableNodataValue[],
  token: DataTableNodataValue
): DataTableNodataValue[] {
  return values.filter((value) =>
    typeof value === "number" || typeof token === "number"
      ? value !== token
      : value !== token
  );
}

export function previewFromColumnStats(
  columnStats: DataTablesColumnStats | undefined,
  values: DataTableNodataValue[],
  joinColumn?: string | null
): {
  totalRows: number;
  values: DataTableNodataValue[];
  columns: Array<{
    name: string;
    type: string;
    nonNullCount: number;
    matchCount: number;
    excluded: boolean;
    numeric: null;
  }>;
  joinColumnWarning: { column: string; matchCount: number } | null;
} | null {
  if (!columnStats?.columns || values.length === 0) {
    return null;
  }
  const sentinels = values.map((value) => String(value));
  const columns = columnStats.columns.map((column) => {
    const histogram = column.values || {};
    let matchCount = 0;
    for (const key of sentinels) {
      const count = histogram[key];
      if (typeof count === "number") {
        matchCount += count;
      }
    }
    return {
      name: column.attribute,
      type: column.type,
      nonNullCount: column.count,
      matchCount,
      excluded: column.attribute === joinColumn,
      numeric: null,
    };
  });
  const join = columns.find(
    (column) => column.excluded && column.matchCount > 0
  );
  return {
    totalRows: columnStats.rowCount,
    values,
    columns,
    joinColumnWarning: join
      ? { column: join.name, matchCount: join.matchCount }
      : null,
  };
}

/** Turn a failed preview response into a short, displayable message. */
export async function previewResponseError(response: Response): Promise<Error> {
  const text = (await response.text()).trim();
  let message = text;
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      message = parsed.error.trim();
    }
  } catch {
    /* keep raw text */
  }
  if (!message || message.length > 280 || /<html/i.test(message)) {
    // eslint-disable-next-line i18next/no-literal-string -- HTTP status fallback, not UI copy
    message = `Preview request failed (${response.status})`;
  }
  return new Error(message);
}

export function suggestNodataValues(
  columnStats: DataTablesColumnStats | undefined,
  selected: DataTableNodataValue[]
): DataTableNodataValue[] {
  if (!columnStats?.columns) return [];
  const selectedKeys = new Set(selected.map((value) => String(value)));
  const columnHits = new Map<string, number>();
  for (const column of columnStats.columns) {
    if (!column.values) continue;
    const seen = new Set<string>();
    for (const key of Object.keys(column.values)) {
      if (seen.has(key)) continue;
      seen.add(key);
      columnHits.set(key, (columnHits.get(key) || 0) + 1);
    }
  }
  const suggestions: DataTableNodataValue[] = [];
  for (const [key, hits] of columnHits) {
    if (selectedKeys.has(key)) continue;
    if (!COMMON_SENTINELS.has(key) && hits < 2) continue;
    const parsed = parseNodataToken(key);
    if (parsed == null) continue;
    suggestions.push(parsed);
  }
  return normalizeNodataValues(suggestions).slice(
    0,
    MAX_DATA_TABLE_NODATA_VALUES
  );
}
