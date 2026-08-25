import { isNumberColumnValueStats, ValuesForColumns } from "overlay-engine";

export type InlineColumnStat =
  | "mean"
  | "min"
  | "max"
  | "stdDev"
  | "sum"
  | "count"
  | "countDistinct";

/**
 * Column-stat used by inline metrics. Missing cells and inapplicable stats
 * (e.g. mean on a string column) are treated as zero so empty overlaps read
 * as 0, not NaN. countDistinct is valid on number, string, and boolean
 * columns.
 */
export function numberColumnStatOrZero(
  values: ValuesForColumns | undefined,
  column: string,
  stat: InlineColumnStat
): number {
  const cell = values?.[column];
  if (!cell) {
    return 0;
  }
  if (stat === "countDistinct") {
    return typeof cell.countDistinct === "number" &&
      Number.isFinite(cell.countDistinct)
      ? cell.countDistinct
      : 0;
  }
  if (!isNumberColumnValueStats(cell)) {
    return 0;
  }
  if (stat === "count") {
    return cell.count;
  }
  const n = cell[stat];
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}
