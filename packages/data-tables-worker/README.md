# data-tables-worker

Cloudflare Worker that serves highly cacheable GET queries over SeaSketch
overlay data tables stored as parquet in R2. It powers map visualizations by
answering questions like "average PYCHEL count per site in 2018" which can
then be joined against survey-site vector tiles in mapbox-gl-js.

The engine is built on [hyparquet](https://github.com/hyparam/hyparquet) and
only reads the byte ranges it needs from R2: the parquet footer, plus the
column chunks for columns referenced by the query. Row groups are pruned two
ways: min/max column statistics, and bloom filters for `eq`/`in` predicates
(essential for high-cardinality string columns like species codes, where
min/max spans the whole alphabet in every row group). Execution is columnar:
filters are evaluated against just the filter columns to produce matched row
indices, and the remaining columns are only decoded for row groups with
matches -- no per-row objects are materialized during scans.

## Table assets

Each uploaded data table lives at an immutable R2 prefix:

```
{tablePath} = projects/{slug}/public/dataTables/{uploadId}
```

| URL | Description |
| --- | ----------- |
| `GET /{tablePath}/query` | Run a query (JSON or HTML UI). See [Query API](#query-api) below. |
| `GET /{tablePath}/column-stats.json` | Column metadata, distinct values, and join statistics. Used to build filter UIs. |
| `GET /{tablePath}/data.parquet` | Download the underlying parquet file. |

In production, `{tablePath}` is typically exposed on the worker as
`https://data-tables.seasketch.org/{tablePath}` (or via `queryUrl` on
`OverlayDataTable` in GraphQL).

## Query API

All queries are **GET** requests with parameters in the query string. There is
no request body. Parameter order does not matter; identical queries are
canonicalized for caching (see [Caching](#caching)).

Content negotiation for `/query`:

| Request | Response |
| ------- | -------- |
| `Accept: text/html` (browser default) | Interactive query builder UI |
| `Accept: application/json`, or `f=json` | JSON query results |
| `f=html` | Force the HTML UI regardless of `Accept` |

The demo UI at `/query` loads `column-stats.json` from the same origin to
populate column pickers and saved form state in `localStorage`.

### Built-in parameters

| Param | Required | Description |
| ----- | -------- | ----------- |
| `f` | No | `json` or `html`; overrides `Accept`-based format selection. Omitted from cache keys. |
| `groupBy` | When aggregating | Comma-separated column names, e.g. `groupBy=site` or `groupBy=site,year`. Requires at least one `op`. |
| `op` | When `groupBy` is set | Comma-separated aggregations: `count`, `sum`, `mean`, `min`, `max`, `median`. Multiple ops share one `column` (except `count` — see below). |
| `column` | When any `op` other than `count` alone | Numeric column to aggregate, e.g. `column=count`. |
| `orderBy` | No | Sort key with optional direction: `orderBy=mean:desc`, `orderBy=site` (asc). Valid keys are **groupBy columns** and **aggregation names** from `op`. |
| `limit` | No | Max groups or raw rows returned. Positive integer. **Omit for no limit.** |
| `offset` | No | Skip first N groups/rows after sorting (default `0`). |

**Query modes:**

1. **Aggregated** — `groupBy` + `op` (+ `column` when needed). Returns a `groups`
   array. Each object contains the group key column(s) plus one property per
   aggregation (`mean`, `count`, etc.).
2. **Raw rows** — omit `groupBy` and `op`. Returns a `rows` array of matching
   parquet records (all columns, subject to filters). Useful for inspection, not
   typical map joins.

**Aggregation semantics:**

| `op` | Behavior |
| ---- | -------- |
| `count` | With `column`: count non-null values in that column per group (SQL `COUNT(col)`). Without `column`: count matching rows per group (`COUNT(*)`). |
| `sum`, `mean` | Computed over non-null values in `column`. Groups with no non-null values return `null` for these ops. |
| `min`, `max` | Extremes over non-null values in `column`. |
| `median` | Median of non-null values in `column` (even-length groups average the two middle values). |

When multiple aggregations are requested (`op=mean,count&column=count`), each
group object includes all of them, e.g. `{ "site": "PINOS", "mean": 12.4, "count": 87 }`.

### Column filters (`q.` prefix)

Filters restrict which parquet rows participate before aggregation or raw
output. Parameter names are `q.{columnName}`; operators are embedded in the
value using a PostgREST-like syntax:

| URL value | Meaning | Column types |
| --------- | ------- | ------------ |
| `{value}` or `eq.{value}` | equals | all |
| `neq.{value}` | not equals | all |
| `gt.{n}`, `gte.{n}`, `lt.{n}`, `lte.{n}` | comparisons | number, timestamp |
| `in.(a,b,"Smith, John")` | value in list | all; quote items that contain commas; `""` escapes `"` |
| `is.null` | column is null | all |
| `not.null` | column is not null | all |

Examples:

```
q.year=2018                              equality (bare value)
q.year=eq.2018                           equality (explicit)
q.count=gte.5                            numeric comparison
q.observer=in.(CHAD BURT,BRAD BURT)     IN list
q.size=is.null                         null test
q.year=gte.2010&q.year=lte.2018        repeated params AND together
```

Rules:

- Unknown column names → `400` with `{ error, validColumns: [{ name, type }] }`.
- Type-invalid operators (e.g. `gt` on a string column) → `400` with message.
- Timestamp filters accept ISO 8601 strings; comparisons use epoch milliseconds.
- Boolean filters accept `true`/`false` or `1`/`0`.

There is **no** `not.in` operator; express exclusion with `neq` or multiple
filters as appropriate.

Implementation reference: `src/params.ts` (`parseQueryParams`, `parseInList`).

### Response format (JSON)

Successful `f=json` responses:

```json
{
  "table": "projects/california/public/dataTables/{uploadId}",
  "totalRows": 353253,
  "rowsScanned": 353253,
  "rowsMatched": 2328,
  "rowGroups": { "total": 3, "scanned": 3 },
  "timing": { "metadataMs": 209, "executeMs": 230, "totalMs": 439 },
  "groups": [
    { "site": "PINOS", "mean": 1, "count": 1 }
  ]
}
```

| Field | Description |
| ----- | ----------- |
| `table` | R2 prefix queried |
| `totalRows` | Rows in the parquet file |
| `rowsScanned` | Rows read from pruned row groups (after statistics/bloom pruning) |
| `rowsMatched` | Rows passing all filters |
| `rowGroups.total` / `rowGroups.scanned` | Parquet row-group pruning stats |
| `timing` | Server-side phase timings (ms); CPU-bound work may not be fully reflected in `executeMs` |
| `groups` | Present when `groupBy` + `op` were requested |
| `rows` | Present for raw-row mode (no aggregation) |

Responses include `ETag`, `Cache-Control`, and `Vary: Accept` headers.

### `column-stats.json`

Static metadata written at upload time (`DataTablesColumnStats` in
`packages/geostats-types`). Shape:

```json
{
  "table": "Swath Protocol Data",
  "rowCount": 353253,
  "columns": [
    {
      "attribute": "classcode",
      "type": "string",
      "count": 353253,
      "values": [{ "value": "PYCHEL", "count": 12345 }]
    }
  ],
  "join": {
    "column": "site",
    "overlayAttribute": "site",
    "matchRate": 1,
    "matchedRows": 367,
    "unmatchedRows": 0,
    "unmatchedOverlayValues": 0
  }
}
```

- `columns[].attribute` — parquet column name (use in `q.` filters and `groupBy`).
- `columns[].type` — `string`, `number`, `boolean`, `date`, etc.
- `columns[].values` — distinct values with counts (for categorical pickers).
- `join.column` — key in the data table; `join.overlayAttribute` — matching
  attribute on the vector layer. Map clients join query results to features
  using these columns.

### Errors

Client errors (`400`) return JSON:

```json
{ "error": "Unknown column \"foo\".", "validColumns": [{ "name": "site", "type": "string" }] }
```

Missing table → `404`. Unexpected failures → `500` with `{ "error": "Internal server error" }`.

### Map visualization patterns

These are the primary SeaSketch use cases; each maps directly to query params:

| Use case | Typical query | Join key |
| -------- | ------------- | -------- |
| **Thematic map** — one value per overlay feature | `groupBy={join.column}&op=mean&column=count&q.classcode=PYCHEL&q.year=2024` | `join.column` ↔ feature attribute |
| **Site time series** — values over time for one feature | `groupBy=year&op=sum&column=count&q.site=PINOS&q.classcode=PYCHEL` | filter to selected site |
| **Multi-species comparison** | `groupBy=site&op=sum&column=count&q.classcode=in.(PYCHEL,KELKEL)&q.year=2024` | same as thematic map |

The map client fetches aggregated results, builds a lookup `{ [joinKey]: value }`,
and drives Mapbox GL paint/layout properties from that lookup.

### Structured settings → query string

Map UI code (e.g. `DataTableQuerySettings` in
`packages/client/src/dataLayers/dataTableQueryApi.ts`) should compile to the
same parameter names the worker expects. Use
`buildDataTableQuerySearchParams()` in that module, or follow this mapping:

| Structured field | Query param |
| ---------------- | ----------- |
| `groupBy: "site"` | `groupBy=site` |
| `groupBy: ["site", "year"]` | `groupBy=site,year` |
| `op: "mean"` | `op=mean` |
| `op: ["mean", "count"]` | `op=mean,count` |
| `column: "count"` | `column=count` |
| `filters: [{ column: "year", op: "eq", value: "2024" }]` | `q.year=2024` |
| `filters: [{ column: "count", op: "gte", value: "5" }]` | `q.count=gte.5` |
| `filters: [{ column: "classcode", op: "in", value: "PYCHEL,KELKEL" }]` | `q.classcode=in.(PYCHEL,KELKEL)` |
| `filters: [{ column: "size", op: "isNull" }]` | `q.size=is.null` |
| `filters: [{ column: "depth", op: "notNull" }]` | `q.depth=not.null` |

Filter `op` values in TypeScript match `FilterOperator` in `src/params.ts`
(`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `isNull`, `notNull`).

### Example

```
GET /projects/california/public/dataTables/{uploadId}/query
  ?groupBy=site&op=mean,count&column=count&q.year=2018&q.classcode=PYCHEL&f=json
```

```json
{
  "table": "projects/california/public/dataTables/…",
  "totalRows": 353253,
  "rowsScanned": 353253,
  "rowsMatched": 3,
  "rowGroups": { "total": 3, "scanned": 3 },
  "timing": { "metadataMs": 209, "executeMs": 230, "totalMs": 439 },
  "groups": [
    { "site": "PINOS", "mean": 1, "count": 1 },
    { "site": "PESCADERO_DC", "mean": 1, "count": 1 },
    { "site": "LITTLE_IRISH_CEN", "mean": 1, "count": 1 }
  ]
}
```

## Caching

Table paths are versioned (each replacement upload gets a new uploadId
directory), so content at a given URL is immutable. Caching is intentionally
simple — three layers, each with a clear job:

1. **HTTP response cache (primary).** Query JSON and `column-stats.json` are
   served with `Cache-Control: public, max-age=86400, s-maxage=604800,
   immutable` and a strong `ETag` (R2 object etag + canonicalized query).
   Workers Cache (`cache.enabled` in wrangler.jsonc) stores identical GET
   requests at the edge, so repeat queries never invoke the Worker at all.
   This is the main win for static data.

2. **In-memory parquet blocks (warm isolate).** Raw byte-range reads are
   rounded to 512 KiB blocks and kept in an isolate-global LRU (32 MiB).
   A warm isolate reuses fetched R2 bytes across queries that touch the same
   table, even when filter values differ.

3. **In-memory decoded columns (warm isolate, filter sweeps).** After blocks
   are fetched, parquet still has to decompress and expand columns — the
   CPU-heavy step. Decoded column arrays are cached in a second LRU (48 MiB),
   keyed by file version + column + row span. Changing species or year while
   scanning the same columns skips decode on subsequent queries within a
   session.

Parsed parquet footers and file stat (size/etag) are also memoized in isolate
memory per etag — cheap bookkeeping that avoids redundant R2 head() calls and
footer reads.

In dev (`DEV` var set, see `.dev.vars`), HTTP responses use `Cache-Control:
no-store` so you always see fresh results. In-memory caches still apply.
Files are fetched from `https://uploads.seasketch.org` instead of the R2
binding so `wrangler dev` works without credentials.

## Development

```sh
npm run dev      # wrangler dev on :8787 (public-URL fallback, no caching)
npm test         # vitest; engine tests run in Node against a real fixture parquet
npm run deploy   # wrangler deploy (custom domain is attached in the CF dashboard)
```

Engine logic (parsing, planning/pruning, filtering, aggregation) is plain
TypeScript with no Workers dependencies and is tested directly in Node
against `test/fixtures/data.parquet`, a real 353k-row PISCO kelp forest
monitoring table.
