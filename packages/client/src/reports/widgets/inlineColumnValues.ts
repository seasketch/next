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
 * Numeric column-stat used by inline metrics. Missing or non-numeric cells
 * are treated as zero so empty overlaps read as 0, not NaN.
 */
export function numberColumnStatOrZero(
  values: ValuesForColumns | undefined,
  column: string,
  stat: InlineColumnStat
): number {
  const cell = values?.[column];
  if (!cell || !isNumberColumnValueStats(cell)) {
    return 0;
  }
  if (stat === "count") {
    return cell.count;
  }
  if (stat === "countDistinct") {
    return cell.countDistinct;
  }
  const n = cell[stat];
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}
