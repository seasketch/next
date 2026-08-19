export type DroppedJoinInfo = {
  droppedJoinValues: string[];
  droppedRowCount?: number;
};

/**
 * Reads dropped-site metadata from column-stats.json. The file is untrusted
 * JSON at runtime, so this does not assume the TypeScript join shape is
 * present.
 */
export function droppedJoinInfoFromColumnStats(
  columnStats: unknown
): DroppedJoinInfo {
  if (!columnStats || typeof columnStats !== "object") {
    return { droppedJoinValues: [] };
  }
  if (!("join" in columnStats)) {
    return { droppedJoinValues: [] };
  }
  const join: unknown = columnStats.join;
  if (!join || typeof join !== "object" || Array.isArray(join)) {
    return { droppedJoinValues: [] };
  }
  const values =
    "droppedJoinValues" in join ? join.droppedJoinValues : undefined;
  const droppedJoinValues = Array.isArray(values)
    ? values.filter(
        (value): value is string => typeof value === "string" && value.length > 0
      )
    : [];
  const rawCount = "droppedRowCount" in join ? join.droppedRowCount : undefined;
  const droppedRowCount =
    typeof rawCount === "number" && Number.isFinite(rawCount)
      ? rawCount
      : undefined;
  return { droppedJoinValues, droppedRowCount };
}
