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

## Endpoint

```
GET https://data-tables.seasketch.org/{tablePath}/query
```

`{tablePath}` is the R2 prefix containing `data.parquet` and
`column-stats.json`, e.g. `projects/california/public/dataTables/{uploadId}`.

Content negotiation: requests with `Accept: text/html` receive an interactive
query UI for exploring the table; `application/json` (or `f=json`) receives
query results. The demo UI loads `{tablePath}/column-stats.json` via this worker
(same origin, with CDN fallback when R2 misses).

### Built-in parameters

| Param     | Description                                                                  |
| --------- | ---------------------------------------------------------------------------- |
| `f`       | `json` (default) or `html`; overrides Accept-based negotiation               |
| `groupBy` | Comma-separated column list. Requires `op`.                                  |
| `op`      | Comma-separated aggregations: `count`, `sum`, `mean`, `min`, `max`, `median` |
| `column`  | Column to aggregate. Required for every op except `count`.                   |
| `orderBy` | Output key with optional direction, e.g. `orderBy=mean:desc`                 |
| `limit`   | Max rows/groups returned (omit for no limit)                                   |
| `offset`  | Pagination offset                                                            |

Without `op`, the endpoint returns raw filtered rows.

### Column filters (`q.` prefix)

PostgREST-style operators embedded in the value:

```
q.year=2018                            equality (bare value)
q.count=gte.5                          gt / gte / lt / lte / neq (numeric or date columns)
q.observer=in.(CHAD BURT,BRAD BURT)   IN list ("quoted" items may contain commas)
q.size=is.null   q.size=not.null       null tests
q.year=gte.2010&q.year=lte.2018        repeated params AND together
```

Unknown columns or type-invalid operators return a 400 with the list of valid
columns.

### Example

```
/projects/california/public/dataTables/{uploadId}/query
  ?groupBy=site&op=mean,count&column=count&q.year=2018&q.classcode=PYCHEL
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
