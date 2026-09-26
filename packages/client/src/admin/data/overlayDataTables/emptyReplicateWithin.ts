import {
  WithinReplicateOp,
  withinOpForColumn,
} from "../../../dataLayers/dataTableQueryApi";

/**
 * The inside-a-replicate operation that decides what an empty replicate
 * becomes. `sum`, `max` and `min` of nothing read 0 (the total, largest and
 * smallest count of something nobody saw); a `mean` of nothing has no answer
 * and the replicate is left out. When the configured value columns split
 * between those two outcomes the answer differs per column, reported as
 * `"mixed"`.
 *
 * With no configured value columns any numeric column may be mapped, so the
 * operations that have been set explicitly are what the admin can reason
 * about; with none set, the default `sum` applies.
 */
export function emptyReplicateWithin(options: {
  valueColumns: string[];
  withinByColumn: { [column: string]: WithinReplicateOp };
}): WithinReplicateOp | "mixed" {
  const columns =
    options.valueColumns.length > 0
      ? options.valueColumns
      : Object.keys(options.withinByColumn);
  const ops = columns.map((column) =>
    withinOpForColumn(options.withinByColumn, column)
  );
  if (ops.length === 0) return "sum";
  const leftOut = ops.some((op) => op === "mean");
  const zero = ops.some((op) => op !== "mean");
  if (leftOut && zero) return "mixed";
  return ops[0];
}
