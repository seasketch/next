import Papa from "papaparse";
import type { WidgetExportSection } from "./types";

export function sectionToCsv(section: WidgetExportSection): string {
  const fields = section.columns.map((c) => c.key);
  const rows = section.rows.map((row) => {
    const rec: Record<string, unknown> = {};
    for (const f of fields) {
      rec[f] = row[f] ?? "";
    }
    return rec;
  });
  return Papa.unparse(
    {
      fields,
      data: rows,
    },
    {
      header: true,
      quotes: true,
      newline: "\n",
    },
  );
}
