import duckdb from "duckdb";

export const CSV_NULL_STRINGS_BASE = ["", "N/A", "#N/A", "NULL", "null"];
export const CSV_NULL_STRINGS_WITH_NA = [...CSV_NULL_STRINGS_BASE, "NA"];

export type CsvColumnPlan = {
  name: string;
  duckDbType: string;
  nullifyNa: boolean;
};

function run(conn: duckdb.Connection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function all<T>(conn: duckdb.Connection, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
  });
}

export function nullstrOption(nullStrings: string[]): string {
  return `nullstr=[${nullStrings.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")}]`;
}

export function isNumericDuckDbType(type: string): boolean {
  return /INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL|HUGEINT/i.test(type);
}

function quoteColumn(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Compare two typed CSV reads (with vs without treating "NA" as null) to decide
 * per-column whether bare "NA" is missing data or a valid string code.
 */
export function decideNaNullHandling(
  strictType: string,
  naNullType: string,
  naLiteralCount: number,
  naLooksLikeValidCode: boolean,
): Pick<CsvColumnPlan, "duckDbType" | "nullifyNa"> {
  const strictIsNumeric = isNumericDuckDbType(strictType);
  const naNullIsNumeric = isNumericDuckDbType(naNullType);

  if (strictIsNumeric) {
    return { duckDbType: strictType, nullifyNa: true };
  }

  if (naNullIsNumeric) {
    // "NA" was blocking numeric inference (e.g. count column with R-style NA).
    return { duckDbType: naNullType, nullifyNa: true };
  }

  if (naLiteralCount > 0 && naLooksLikeValidCode) {
    // Column stays text either way; preserve literal "NA" codes (e.g. species).
    return { duckDbType: "VARCHAR", nullifyNa: false };
  }

  return { duckDbType: "VARCHAR", nullifyNa: true };
}

async function naLooksLikeValidCode(
  conn: duckdb.Connection,
  quotedColumn: string,
  naLiteralCount: number,
): Promise<boolean> {
  if (naLiteralCount === 0) {
    return false;
  }

  const freqRows = await all<{ max_c: number; median_c: number }>(
    conn,
    `SELECT
      MAX(c)::INTEGER as max_c,
      MEDIAN(c)::DOUBLE as median_c
    FROM (
      SELECT COUNT(*)::INTEGER as c
      FROM _csv_probe_strict
      WHERE CAST(${quotedColumn} AS VARCHAR) != 'NA'
        AND ${quotedColumn} IS NOT NULL
      GROUP BY CAST(${quotedColumn} AS VARCHAR)
    ) freq`,
  );
  const maxC = freqRows[0]?.max_c ?? 0;
  const medianC = freqRows[0]?.median_c ?? 0;
  const peerFrequency = Math.max(medianC, 1);

  // NA appears roughly as often as a typical category value, not a bulk missing marker.
  return naLiteralCount <= peerFrequency * 2 && naLiteralCount <= maxC;
}

export async function inferCsvColumnPlans(
  conn: duckdb.Connection,
  csvPath: string,
  readCsvOptionsSuffix: string,
): Promise<CsvColumnPlan[]> {
  const escapedPath = csvPath.replace(/'/g, "''");
  const baseNullstr = nullstrOption(CSV_NULL_STRINGS_BASE);
  const naNullstr = nullstrOption(CSV_NULL_STRINGS_WITH_NA);

  await run(
    conn,
    `CREATE OR REPLACE TEMP TABLE _csv_probe_strict AS SELECT * FROM read_csv('${escapedPath}', ${readCsvOptionsSuffix}, ${baseNullstr})`,
  );
  await run(
    conn,
    `CREATE OR REPLACE TEMP TABLE _csv_probe_na_null AS SELECT * FROM read_csv('${escapedPath}', ${readCsvOptionsSuffix}, ${naNullstr})`,
  );

  const strictSchema = await all<{ column_name: string; data_type: string }>(
    conn,
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '_csv_probe_strict' ORDER BY ordinal_position`,
  );
  const naNullSchema = await all<{ column_name: string; data_type: string }>(
    conn,
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '_csv_probe_na_null' ORDER BY ordinal_position`,
  );
  const naNullTypeByColumn = new Map(
    naNullSchema.map((col) => [col.column_name, col.data_type]),
  );

  const plans: CsvColumnPlan[] = [];
  for (const col of strictSchema) {
    const quoted = quoteColumn(col.column_name);
    const naLiteralRows = await all<{ count: number }>(
      conn,
      `SELECT COUNT(*)::INTEGER as count FROM _csv_probe_strict WHERE CAST(${quoted} AS VARCHAR) = 'NA'`,
    );
    const naLiteralCount = naLiteralRows[0]?.count ?? 0;
    const validNaCode = await naLooksLikeValidCode(
      conn,
      quoted,
      naLiteralCount,
    );
    const decision = decideNaNullHandling(
      col.data_type,
      naNullTypeByColumn.get(col.column_name) || "VARCHAR",
      naLiteralCount,
      validNaCode,
    );
    plans.push({
      name: col.column_name,
      ...decision,
    });
    if (!decision.nullifyNa && naLiteralCount > 0) {
      console.log(
        `[data-tables-handler] preserving literal "NA" in column ${col.column_name} (${naLiteralCount} row(s); looks like a category code)`,
      );
    }
  }

  await run(conn, "DROP TABLE IF EXISTS _csv_probe_strict");
  await run(conn, "DROP TABLE IF EXISTS _csv_probe_na_null");

  return plans;
}

export function buildTypedSelectSql(plans: CsvColumnPlan[]): string {
  return plans
    .map((plan) => {
      const quoted = quoteColumn(plan.name);
      if (isNumericDuckDbType(plan.duckDbType)) {
        const valueExpr = plan.nullifyNa
          ? `NULLIF(${quoted}, 'NA')`
          : quoted;
        return `TRY_CAST(${valueExpr} AS ${plan.duckDbType}) AS ${quoted}`;
      }
      if (plan.nullifyNa) {
        return `NULLIF(${quoted}, 'NA') AS ${quoted}`;
      }
      return `${quoted}`;
    })
    .join(", ");
}
