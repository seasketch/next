/**
 * Columns an admin may check as replicate identifiers.
 *
 * Transect, quadrat, station, haul and camera numbers are usually stored as
 * integers, so the list must keep numeric columns. Only the join column and
 * the configured value columns are left out. Identifiers that are already
 * saved stay visible even when they would otherwise be excluded, so the form
 * always shows what it will save and lets the admin uncheck them.
 */
export function replicateIdentifierChoices(options: {
  /** Filterable column names, already sorted, with time-source columns removed. */
  columns: string[];
  joinColumn?: string | null;
  /** Configured value columns. Empty means any numeric column may be a value. */
  valueColumns: string[];
  /** Identifiers saved on the table or in the current draft. */
  identifiers: string[];
}): string[] {
  const values = new Set(options.valueColumns);
  const choices = options.columns.filter(
    (column) => column !== options.joinColumn && !values.has(column)
  );
  const seen = new Set(choices);
  for (const column of options.identifiers) {
    if (column && !seen.has(column) && column !== options.joinColumn) {
      choices.push(column);
      seen.add(column);
    }
  }
  return choices.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}
