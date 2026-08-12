/**
 * Geostats layers store `attributes` as an array of `{ attribute, type, ... }`.
 * Report column pickers expect a Record keyed by column name. Passing the array
 * through `Object.keys` / `Object.entries` treats indexes ("0", "5") as names.
 */

export type ColumnDetails = Record<
  string,
  { type: string; countDistinct: number }
>;

function countDistinctFromAttr(attr: {
  countDistinct?: unknown;
  values?: unknown;
}): number {
  if (typeof attr.countDistinct === "number" && Number.isFinite(attr.countDistinct)) {
    return attr.countDistinct;
  }
  const fromString = Number(attr.countDistinct);
  if (Number.isFinite(fromString) && fromString > 0) {
    return fromString;
  }
  if (attr.values && typeof attr.values === "object") {
    return Object.keys(attr.values).length;
  }
  return 0;
}

function detailsFromAttributeList(attributes: unknown[]): ColumnDetails {
  const details: ColumnDetails = {};
  for (const attr of attributes) {
    if (!attr || typeof attr !== "object") continue;
    const record = attr as {
      attribute?: unknown;
      type?: unknown;
      countDistinct?: unknown;
      values?: unknown;
    };
    const name = record.attribute;
    if (typeof name !== "string" || name.length === 0) continue;
    details[name] = {
      type: typeof record.type === "string" ? record.type : "",
      countDistinct: countDistinctFromAttr(record),
    };
  }
  return details;
}

/**
 * Accepts geostats `attributes` (array), a column_details Record, or the
 * mistaken array-as-record shape (`{ "0": { attribute: "fid", ... } }`).
 */
export function normalizeColumnDetails(columnDetails: unknown): ColumnDetails {
  if (!columnDetails || typeof columnDetails !== "object") {
    return {};
  }
  if (Array.isArray(columnDetails)) {
    return detailsFromAttributeList(columnDetails);
  }

  const entries = Object.entries(columnDetails as Record<string, unknown>);
  if (
    entries.length > 0 &&
    entries.every(
      ([key, value]) =>
        /^\d+$/.test(key) &&
        value !== null &&
        typeof value === "object" &&
        typeof (value as { attribute?: unknown }).attribute === "string",
    )
  ) {
    return detailsFromAttributeList(entries.map(([, value]) => value));
  }

  const details: ColumnDetails = {};
  for (const [name, value] of entries) {
    if (!name || !value || typeof value !== "object") continue;
    const record = value as { type?: unknown; countDistinct?: unknown };
    details[name] = {
      type: typeof record.type === "string" ? record.type : "",
      countDistinct: countDistinctFromAttr(record),
    };
  }
  return details;
}

export function knownColumnName(
  columnDetails: ColumnDetails,
  name: string | null | undefined,
): string | undefined {
  if (!name || !(name in columnDetails)) return undefined;
  return name;
}

const JUNK_COLUMN_PATTERNS = [
  /^shape[_-]?length$/i,
  /^shape[_-]?area$/i,
  /^area[_-]?km2?$/i,
  /^area$/i,
  /^length$/i,
  /^perimeter$/i,
  /^fid$/i,
  /^gid$/i,
  /^id$/i,
  /^objectid$/i,
  /^oid$/i,
  /^globalid$/i,
  /^uuid$/i,
  /_id$/i,
];

function isJunkColumn(name: string): boolean {
  return JUNK_COLUMN_PATTERNS.some((p) => p.test(name));
}

/**
 * Picks the best column to use for categorical map or report presentations.
 * Ranks columns by:
 *   * type - strings over booleans over numbers
 *   * cardinality - 2–20 distinct values is ideal; penalise all-unique (better
 *     used as a label) and very high cardinality
 *   * name - junk names (IDs, shape-area, etc.) are penalised
 */
export function pickBestCategoryColumn(
  columnDetails: unknown,
  featureCount: number,
): string | undefined {
  const details = normalizeColumnDetails(columnDetails);
  if (!Object.keys(details).length) return undefined;

  const scored = Object.entries(details)
    .map(([name, { type, countDistinct }]) => {
      let score = 0;

      if (countDistinct < 2) return { name, score: -Infinity };

      if (type === "string") score += 10;
      else if (type === "boolean") score += 5;
      else if (type === "number") score += 2;

      if (countDistinct <= 20) score += 8;
      else if (countDistinct <= 50) score += 4;
      else if (countDistinct <= 100) score += 1;
      else score -= 5;

      if (featureCount > 0 && countDistinct === featureCount) score -= 10;

      if (isJunkColumn(name)) score -= 20;

      return { name, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score === -Infinity) return undefined;
  return scored[0].name;
}

export function pickBestContinuousColumn(
  columnDetails: unknown,
  featureCount: number,
): string | undefined {
  const details = normalizeColumnDetails(columnDetails);
  if (!Object.keys(details).length) return undefined;

  const scored = Object.entries(details)
    .filter(([, { type }]) => type === "number")
    .map(([name, { countDistinct }]) => {
      let score = 0;
      const ratio = featureCount > 0 ? countDistinct / featureCount : 0;
      score += ratio * 10;
      if (countDistinct <= 2) score -= 8;
      if (isJunkColumn(name)) score -= 20;
      return { name, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return undefined;
  const best = scored[0];
  return best.score > -10 ? best.name : undefined;
}

export function pickBestLabelColumn(
  columnDetails: unknown,
  featureCount: number,
): string | undefined {
  const details = normalizeColumnDetails(columnDetails);
  if (!Object.keys(details).length) return undefined;

  const scored = Object.entries(details)
    .filter(([, { type }]) => type === "string")
    .map(([name, { countDistinct }]) => {
      let score = 0;
      const ratio = featureCount > 0 ? countDistinct / featureCount : 0;
      score += ratio * 10;
      if (isJunkColumn(name)) score -= 20;
      return { name, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return undefined;
  const best = scored[0];
  return best.score > -10 ? best.name : undefined;
}
