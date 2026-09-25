import { all, run, withDuckDb } from "./duckDb";

/**
 * Row-group clustering for overlay data-table parquet.
 *
 * Equality filters (`q.{column}=value`) can only prune row groups when a
 * value's min/max (or bloom) excludes other groups. Tables written in
 * arrival order often put every filter value in every group, so the Worker
 * decodes the whole file. Sorting by columns we *already know* will be
 * filtered — required filters, organism identity, time, join — packs each
 * value into one or two DuckDB row groups.
 *
 * Column names are never guessed. Only configured keys are used.
 */

const WHEN_START = "_when_start";
const WHEN_END = "_when_end";

export type ClusterColumnHints = {
  columns: string[];
  joinColumn?: string | null;
  organismColumn?: string | null;
  /** Subject column. Falls back to organismColumn. Bloom-filtered with the join column. */
  subjectColumn?: string | null;
  requiredFilterColumns?: string[] | null;
  temporalColumns?: string[] | null;
  /** Replicate columns, clustered immediately after `_when_start`. */
  replicateColumns?: string[] | null;
};

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function escapePath(path: string): string {
  return path.replace(/'/g, "''");
}

export function clusterColumns(hints: ClusterColumnHints): string[] {
  const have = new Set(hints.columns);
  const out: string[] = [];
  const add = (name?: string | null) => {
    if (!name || !have.has(name) || out.includes(name)) return;
    if (name === WHEN_END) return;
    out.push(name);
  };

  add(hints.subjectColumn || hints.organismColumn);
  for (const name of hints.requiredFilterColumns || []) {
    add(name);
  }
  if (have.has(WHEN_START)) {
    add(WHEN_START);
    for (const name of hints.replicateColumns || []) {
      add(name);
    }
  }
  for (const name of hints.temporalColumns || []) {
    add(name);
  }
  add(hints.joinColumn);
  const replicateCount = (hints.replicateColumns || []).filter(
    (name) => name && have.has(name) && name !== WHEN_END
  ).length;
  return out.slice(0, 4 + replicateCount);
}

/**
 * COPY observations, optionally clustered so filters can prune row groups.
 * DuckDB writes bloom filters for dictionary-encoded columns on its own, so
 * low-cardinality join and subject columns get them without an option.
 */
export function copyObservationsParquetSql(
  parquetPath: string,
  cluster: string[]
): string {
  const order = cluster.map(quoteIdent).join(", ");
  const select = order
    ? `SELECT * FROM observations ORDER BY ${order}`
    : `SELECT * FROM observations`;
  return `COPY (${select}) TO '${escapePath(parquetPath)}' (FORMAT PARQUET, ROW_GROUP_SIZE 122880)`;
}

/** Rewrite an existing observations parquet using configured cluster columns. */
export async function rewriteParquetClustered(
  parquetPath: string,
  hints: Omit<ClusterColumnHints, "columns">
): Promise<string[]> {
  return withDuckDb(async (conn) => {
    await run(
      conn,
      `CREATE OR REPLACE TABLE observations AS SELECT * FROM read_parquet('${escapePath(parquetPath)}')`
    );
    const schema = await all<{ column_name: string }>(
      conn,
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'observations'`
    );
    const cluster = clusterColumns({
      ...hints,
      columns: schema.map((row) => row.column_name),
    });
    await run(conn, copyObservationsParquetSql(parquetPath, cluster));
    return cluster;
  });
}
