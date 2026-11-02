import { all, run, DuckDBConnection } from "./duckDb";

export const CSV_NULL_STRINGS_BASE = ["", "N/A", "#N/A", "NULL", "null"];
export const CSV_NULL_STRINGS_WITH_NA = [...CSV_NULL_STRINGS_BASE, "NA"];

export type CsvColumnPlan = {
  name: string;
  duckDbType: string;
  nullifyNa: boolean;
  /**
   * Extra literals to store as NULL, besides "NA" when `nullifyNa` is set.
   * "NM" is included only when it behaves like a missing-data marker.
   */
  nullTokens?: string[];
};

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
 * True when `tokenCount` sits among the other values in the column, rather
 * than towering over them the way a bulk missing-data marker does.
 * `peerMax` / `peerMedian` are frequencies of the other distinct values.
 */
export function tokenLooksLikeCategoryCode(
  tokenCount: number,
  peerMax: number,
  peerMedian: number,
): boolean {
  if (tokenCount <= 0) {
    return false;
  }
  const peerFrequency = Math.max(peerMedian, 1);
  // Roughly as often as a typical category value, not a bulk missing marker.
  return tokenCount <= peerFrequency * 2 && tokenCount <= peerMax;
}

/**
 * Blank "NM" only when it does not behave like a peer category (a taxon
 * code, a methods code, and so on). Frequency is the signal: a code that
 * shows up about as often as the others is kept, even if the rest of the
 * column would otherwise be numeric.
 */
export function decideNmNullHandling(
  nmLiteralCount: number,
  nmLooksLikeValidCode: boolean,
): boolean {
  return nmLiteralCount > 0 && !nmLooksLikeValidCode;
}

/**
 * Type to store once sentinel tokens are removed. Null when any real
 * non-numeric value remains, or when nothing numeric is left.
 */
export function promotedNumericType(
  nonNumeric: number,
  nonInteger: number,
  numericCount: number,
): "BIGINT" | "DOUBLE" | null {
  if (numericCount <= 0 || nonNumeric > 0) {
    return null;
  }
  return nonInteger > 0 ? "DOUBLE" : "BIGINT";
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

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function tokenLiteralCount(
  conn: DuckDBConnection,
  quotedColumn: string,
  token: string,
): Promise<number> {
  const rows = await all<{ count: number }>(
    conn,
    `SELECT COUNT(*)::INTEGER as count FROM _csv_probe_strict WHERE CAST(${quotedColumn} AS VARCHAR) = ${sqlStringLiteral(token)}`,
  );
  return rows[0]?.count ?? 0;
}

async function tokenLooksLikeValidCode(
  conn: DuckDBConnection,
  quotedColumn: string,
  token: string,
  tokenCount: number,
): Promise<boolean> {
  if (tokenCount === 0) {
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
      WHERE CAST(${quotedColumn} AS VARCHAR) != ${sqlStringLiteral(token)}
        AND ${quotedColumn} IS NOT NULL
      GROUP BY CAST(${quotedColumn} AS VARCHAR)
    ) freq`,
  );
  return tokenLooksLikeCategoryCode(
    tokenCount,
    freqRows[0]?.max_c ?? 0,
    freqRows[0]?.median_c ?? 0,
  );
}

/**
 * BIGINT or DOUBLE when every remaining value is numeric after `tokens` are
 * treated as null. Decimal points and exponents stay DOUBLE, matching
 * read_csv. Returns null when the column should stay text.
 */
async function promotedTypeAfterNullTokens(
  conn: DuckDBConnection,
  quotedColumn: string,
  tokens: string[],
): Promise<"BIGINT" | "DOUBLE" | null> {
  const list = tokens.map(sqlStringLiteral).join(", ");
  const value = `CAST(${quotedColumn} AS VARCHAR)`;
  const rows = await all<{
    non_numeric: number;
    non_integer: number;
    numeric_count: number;
  }>(
    conn,
    `SELECT
      COUNT(*) FILTER (
        WHERE ${quotedColumn} IS NOT NULL
          AND ${value} NOT IN (${list})
          AND TRY_CAST(${value} AS DOUBLE) IS NULL
      )::INTEGER AS non_numeric,
      COUNT(*) FILTER (
        WHERE ${quotedColumn} IS NOT NULL
          AND ${value} NOT IN (${list})
          AND TRY_CAST(${value} AS DOUBLE) IS NOT NULL
          AND (
            regexp_matches(${value}, '[.eE]')
            OR TRY_CAST(${value} AS BIGINT) IS DISTINCT FROM TRY_CAST(${value} AS DOUBLE)
          )
      )::INTEGER AS non_integer,
      COUNT(*) FILTER (
        WHERE ${quotedColumn} IS NOT NULL
          AND ${value} NOT IN (${list})
          AND TRY_CAST(${value} AS DOUBLE) IS NOT NULL
      )::INTEGER AS numeric_count
    FROM _csv_probe_strict`,
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return promotedNumericType(
    row.non_numeric,
    row.non_integer,
    row.numeric_count,
  );
}

export async function inferCsvColumnPlans(
  conn: DuckDBConnection,
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
    const naLiteralCount = await tokenLiteralCount(conn, quoted, "NA");
    const validNaCode = await tokenLooksLikeValidCode(
      conn,
      quoted,
      "NA",
      naLiteralCount,
    );
    const decision = decideNaNullHandling(
      col.data_type,
      naNullTypeByColumn.get(col.column_name) || "VARCHAR",
      naLiteralCount,
      validNaCode,
    );
    const nmLiteralCount = await tokenLiteralCount(conn, quoted, "NM");
    const validNmCode = await tokenLooksLikeValidCode(
      conn,
      quoted,
      "NM",
      nmLiteralCount,
    );
    const nullifyNm = decideNmNullHandling(nmLiteralCount, validNmCode);
    const nullTokens = nullifyNm ? ["NM"] : [];
    let duckDbType = decision.duckDbType;
    if (nullifyNm && !isNumericDuckDbType(duckDbType)) {
      const excluded = decision.nullifyNa ? ["NA", "NM"] : ["NM"];
      const promoted = await promotedTypeAfterNullTokens(
        conn,
        quoted,
        excluded,
      );
      if (promoted) {
        duckDbType = promoted;
      }
    }
    plans.push({
      name: col.column_name,
      duckDbType,
      nullifyNa: decision.nullifyNa,
      nullTokens,
    });
    if (!decision.nullifyNa && naLiteralCount > 0) {
      console.log(
        `[data-tables-handler] preserving literal "NA" in column ${col.column_name} (${naLiteralCount} row(s); looks like a category code)`,
      );
    }
    if (nmLiteralCount > 0) {
      console.log(
        nullifyNm
          ? `[data-tables-handler] treating "NM" as null in column ${col.column_name} (${nmLiteralCount} row(s); looks like a missing-data marker)`
          : `[data-tables-handler] preserving literal "NM" in column ${col.column_name} (${nmLiteralCount} row(s); looks like a category code)`,
      );
    }
  }

  await run(conn, "DROP TABLE IF EXISTS _csv_probe_strict");
  await run(conn, "DROP TABLE IF EXISTS _csv_probe_na_null");

  return plans;
}

/**
 * Leading and trailing whitespace only. ASCII whitespace and Unicode space
 * separators count. Spaces between words stay.
 */
function trimEdgeWhitespaceExpr(quotedColumn: string): string {
  return `regexp_replace(${quotedColumn}, '^[\\s\\p{Z}\\x85]+|[\\s\\p{Z}\\x85]+$', '', 'g')`;
}

function planNullTokens(plan: CsvColumnPlan): string[] {
  const tokens: string[] = [];
  if (plan.nullifyNa) {
    tokens.push("NA");
  }
  for (const token of plan.nullTokens ?? []) {
    if (!tokens.includes(token)) {
      tokens.push(token);
    }
  }
  return tokens;
}

function nullifyTokensExpr(expr: string, tokens: string[]): string {
  if (tokens.length === 0) {
    return expr;
  }
  const list = tokens.map(sqlStringLiteral).join(", ");
  return `CASE WHEN ${expr} IN (${list}) THEN NULL ELSE ${expr} END`;
}

export function buildTypedSelectSql(plans: CsvColumnPlan[]): string {
  return plans
    .map((plan) => {
      const quoted = quoteColumn(plan.name);
      const tokens = planNullTokens(plan);
      if (isNumericDuckDbType(plan.duckDbType)) {
        const valueExpr = nullifyTokensExpr(quoted, tokens);
        return `TRY_CAST(${valueExpr} AS ${plan.duckDbType}) AS ${quoted}`;
      }
      const trimmed = `NULLIF(${trimEdgeWhitespaceExpr(quoted)}, '')`;
      return `${nullifyTokensExpr(trimmed, tokens)} AS ${quoted}`;
    })
    .join(", ");
}
