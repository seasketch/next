import Papa from "papaparse";

export type CalculationRowsCsvColumn = {
  id: string;
  label: string;
};

/**
 * CSV of the rows currently shown in the QA/QC table. Null and undefined
 * cells are blank so a numeric zero stays distinguishable in a spreadsheet.
 * Duplicate display labels are disambiguated with the column id.
 */
export function calculationRowsToCsv(
  columns: CalculationRowsCsvColumn[],
  rows: { [column: string]: unknown }[]
): string {
  const headers = csvHeaders(columns);
  const data = rows.map((row) => {
    const record: { [header: string]: string | number | boolean } = {};
    columns.forEach((column, index) => {
      record[headers[index]] = csvCell(row[column.id]);
    });
    return record;
  });
  return Papa.unparse(
    { fields: headers, data },
    { header: true, newline: "\n" }
  );
}

export function calculationRowsExportFilename(parts: string[]): string {
  const base = parts
    .map((part) =>
      part
        .trim()
        .replace(/[/\\?%*:|"<>]/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
    )
    .filter(Boolean)
    .join("-");
  // eslint-disable-next-line i18next/no-literal-string
  return `${base || "rows"}.csv`;
}

export function downloadCalculationRowsCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvHeaders(columns: CalculationRowsCsvColumn[]): string[] {
  const seen = new Map<string, number>();
  return columns.map((column) => {
    const label = column.label || column.id;
    const count = seen.get(label) || 0;
    seen.set(label, count + 1);
    if (count === 0) {
      return label;
    }
    return `${label} (${column.id})`;
  });
}

function csvCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) {
    return "";
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  return String(value);
}
