import {
  WithinReplicateOp,
  withinOpForColumn,
} from "../../../dataLayers/dataTableQueryApi";

/**
 * The inside-a-replicate operation that decides what an empty replicate
 * becomes. `sum` of nothing is 0; `mean`, `min` and `max` of nothing are
 * left out. When the configured value columns use different operations the
 * answer differs per column, reported as `"mixed"`.
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
  const ops = new Set(
    columns.map((column) => withinOpForColumn(options.withinByColumn, column))
  );
  if (ops.size === 0) return "sum";
  if (ops.size === 1) return [...ops][0];
  return "mixed";
}
