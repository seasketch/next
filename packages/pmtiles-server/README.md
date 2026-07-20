# Overlay Data Server

Cloudflare Worker for serving SeaSketch overlay data from the `ssn-tiles` R2
bucket.

The Worker has four responsibilities:

1. PMTiles-backed TileJSON, ZXY tiles, and browser previews.
2. Streaming whole-object downloads and efficient byte-range reads for
   FlatGeobuf, cloud-optimized GeoTIFF, PMTiles, and arbitrary object types.
3. FlatGeobuf property extraction through the legacy-compatible `/properties`
   API.
4. Overlay data-table aggregations (`…/dataTables/{uploadId}/query`) via
   hyparquet, sharing the parent layer's published-UUID ACL.

The default entrypoint is an uncached authorization and host-routing gateway.
It invokes isolated `TilesBackend`, `ObjectBackend`, `PropertiesBackend`, and
`DataTablesBackend` entrypoints after credentials have been removed.

## Routes

### Tiles, previews, and downloads

| Route                                                               | Result                       |
| ------------------------------------------------------------------- | ---------------------------- |
| `/projects/{slug}/public/{uuid}.json`                               | TileJSON                     |
| `/projects/{slug}/public/{uuid}/{z}/{x}/{y}.{mvt,pbf,png,webp,jpg}` | Tile                         |
| `/projects/{slug}/public/{uuid}`                                    | Browser preview              |
| `/projects/{slug}/public/{uuid}.{extension}`                        | Object download              |
| `/projects/{slug}/subdivided/{objectPath}`                          | Subdivided output            |
| `/{r2-key}` on `uploads.seasketch.org`                              | Raw R2 object                |

`GET` and `HEAD` are supported for raw objects. `?download=filename.ext` adds
`Content-Disposition: attachment`. Raw objects expose ETag and R2 HTTP
metadata, CORS, `Accept-Ranges: bytes`, and immutable cache headers.

Single RFC byte ranges are supported in closed (`bytes=0-1023`), open
(`bytes=1024-`), and suffix (`bytes=-1024`) forms. Invalid, multiple, and
unsatisfiable ranges return 416.

Host precedence is intentional:

- `uploads.seasketch.org` always treats a non-empty path as an opaque R2 key.
- `tiles.seasketch.org` gives TileJSON, ZXY, and preview routes precedence
  (including root fixture archives such as `crdss-cells-6/{z}/{x}/{y}.pbf`)
  and uses raw-object semantics for downloads.
- `overlay.seasketch.org/properties` retains the legacy properties contract.
- `workers.dev` supports the explicit routes and safe raw-object fallback for
  preview testing.

Consequently, a project `.json` path is raw JSON on the uploads host but
TileJSON on the tiles host. An extensionless published UUID is raw on uploads
and a preview on tiles.

### Data table queries

Overlay monitoring tables are stored under the parent layer UUID:

```text
projects/{slug}/public/{uuid}/dataTables/{uploadId}/data.parquet
projects/{slug}/public/{uuid}/dataTables/{uploadId}/column-stats.json
GET /projects/{slug}/public/{uuid}/dataTables/{uploadId}/query
```

Static parquet and `column-stats.json` are served by `ObjectBackend` (typically
on `uploads.seasketch.org`). The `/query` path is handled by
`DataTablesBackend` (hyparquet plan + execute). Paths classify as `published`
for the parent `{uuid}`, so map-access tokens and ACL docs apply the same way
as for tiles.

#### Query API

All queries are **GET** requests with parameters in the query string. There is
no request body. Parameter order does not matter; identical queries are
canonicalized for caching. When ACL enforcement is on, pass `access_token`
(and optional `ns`) like any other published overlay asset — credentials are
stripped before the backend runs.

Content negotiation for `/query`:

| Request | Response |
| ------- | -------- |
| `Accept: text/html` (browser default) | Interactive query builder UI |
| `Accept: application/json`, or `f=json` | JSON query results |
| `f=html` | Force the HTML UI regardless of `Accept` |

The HTML UI loads sibling `column-stats.json` from the same origin to populate
column pickers.

**Built-in parameters**

| Param | Required | Description |
| ----- | -------- | ----------- |
| `f` | No | `json` or `html`; overrides `Accept`. Omitted from cache keys. |
| `groupBy` | When aggregating | Comma-separated columns, e.g. `site` or `site,year`. Requires at least one `op`. |
| `op` | When `groupBy` is set | Comma-separated: `count`, `sum`, `mean`, `min`, `max`, `median`. Multiple ops share one `column` (except bare `count`). |
| `column` | When any `op` other than `count` alone | Numeric column to aggregate, e.g. `column=count`. |
| `orderBy` | No | Sort key with optional direction: `mean:desc`, `site` (asc). Valid keys are **groupBy columns** and **aggregation names** from `op`. |
| `limit` | No | Max groups or raw rows. Positive integer. **Omit for no limit.** |
| `offset` | No | Skip first N groups/rows after sorting (default `0`). |

**Query modes**

1. **Aggregated** — `groupBy` + `op` (+ `column` when needed). Returns a
   `groups` array. Each object has the group key column(s) plus one property
   per aggregation (`mean`, `count`, etc.).
2. **Raw rows** — omit `groupBy` and `op`. Returns a `rows` array of matching
   parquet records (all columns, subject to filters). Useful for inspection,
   not typical map joins.

**Aggregation semantics**

| `op` | Behavior |
| ---- | -------- |
| `count` | With `column`: count non-null values in that column per group (`COUNT(col)`). Without `column`: count matching rows per group (`COUNT(*)`). |
| `sum`, `mean` | Over non-null values in `column`. Groups with no non-null values return `null` for these ops. |
| `min`, `max` | Extremes over non-null values in `column`. |
| `median` | Median of non-null values in `column` (even-length groups average the two middle values). |

When multiple aggregations are requested (`op=mean,count&column=count`), each
group includes all of them, e.g.
`{ "site": "PINOS", "mean": 12.4, "count": 87 }`.

**Column filters (`q.` prefix)**

Filters restrict which parquet rows participate before aggregation or raw
output. Parameter names are `q.{columnName}`; operators are embedded in the
value (PostgREST-like):

| URL value | Meaning | Column types |
| --------- | ------- | ------------ |
| `{value}` or `eq.{value}` | equals | all |
| `neq.{value}` | not equals | all |
| `gt.{n}`, `gte.{n}`, `lt.{n}`, `lte.{n}` | comparisons | number, timestamp |
| `in.(a,b,"Smith, John")` | value in list | all; quote items that contain commas; `""` escapes `"` |
| `is.null` | column is null | all |
| `not.null` | column is not null | all |

Examples:

```text
q.year=2018
q.year=eq.2018
q.count=gte.5
q.observer=in.(CHAD BURT,BRAD BURT)
q.size=is.null
q.year=gte.2010&q.year=lte.2018
```

Rules:

- Unknown column names → `400` with
  `{ error, validColumns: [{ name, type }] }`.
- Type-invalid operators (e.g. `gt` on a string) → `400`.
- Timestamp filters accept ISO 8601; comparisons use epoch milliseconds.
- Boolean filters accept `true`/`false` or `1`/`0`.
- There is no `not.in`; use `neq` or multiple filters instead.

Implementation: `src/dataTables/params.ts`.

**JSON response**

```json
{
  "table": "projects/california/public/{uuid}/dataTables/{uploadId}",
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
| `rowsScanned` | Rows read from pruned row groups |
| `rowsMatched` | Rows passing all filters |
| `rowGroups.total` / `rowGroups.scanned` | Parquet row-group pruning stats |
| `timing` | Server-side phase timings (ms) |
| `groups` | Present when `groupBy` + `op` were requested |
| `rows` | Present for raw-row mode (no aggregation) |

Responses include `ETag`, `Cache-Control`, and `Vary: Accept`.

**Example (thematic map join)**

```text
GET /projects/california/public/{uuid}/dataTables/{uploadId}/query
  ?groupBy=site&op=mean,count&column=count
  &q.year=2018&q.classcode=PYCHEL&f=json
  &access_token=…
```

Map clients typically join `groups[]` to vector features using the data
table's join column (see `column-stats.json` → `join`). Structured UI
settings compile to these params via
`packages/client/src/dataLayers/dataTableQueryApi.ts`
(`buildDataTableQuerySearchParams`).

### Properties

```text
GET /properties?dataset={r2-key}
```

Query parameters:

- `dataset` (required): R2 key for a FlatGeobuf file.
- `include`: comma-separated property names.
- `includeProperties`: alias for `include`.
- `bbox=true`: adds antimeridian-aware `__bbox`.
- `cql2JSONQuery`: JSON-encoded CQL2 expression. Supported operators are
  `and`, `or`, `not`, `=`, `!=`, `<`, `<=`, `>`, `>=`, `like`, `ilike`, and
  `in`.
- `v`: ignored by the handler but retained in the backend cache key.

Each result contains `__offset` and `__byteLength`, matching the existing
overlay endpoint contract. Malformed input is 400 and a missing dataset is 404.

## Authorization

Canonical project URLs stay under `/projects/...`. Callers authorize with:

- `access_token` query param, or `Authorization: Bearer ...`
- optional `ns` query param for the ACL namespace (defaults to `prod`)

Credentials (`access_token`, `Authorization`, and `ns`) are stripped before
backend invocation and never enter a cache key.

Keys outside `projects/` are public fixtures. For example,
`/eez-land-joined.fgb` can be read without a token. Data-library keys below
`projects/superuser/public/` are also always public on every host.

### Map-access tokens

Published UUIDs use `acl/{ns}/projects/{slug}.json`. Public UUIDs need no
token. Protected UUIDs use the existing project-admin, superuser, and group
rules. Published-layer ACL enforcement is controlled by `AUTH_ACL_ENABLED`
(default off / public capability-URLs).

### Slack alerts on ACL deny (rollout)

When `SLACK_WEBHOOK_URL` is set and `AUTH_DENY_SLACK_ENABLED` is not
`"false"`, the gateway posts coalesced Slack messages for denials on:

- TileJSON (`…/public/{uuid}` or `{uuid}.json`)
- Downloads (`?download=`)
- Direct `.fgb` / `.geojson` / `.geojson.json` object access
- `/properties?dataset=…`

ZXY tiles are ignored. Rapid denials for the same object+reason are
coalesced in-memory (~3s burst, ~60s cooldown). Messages include project
slug and a credential-stripped object URL.

```bash
echo 'https://hooks.slack.com/services/…' | wrangler secret put SLACK_WEBHOOK_URL
```

### Subdivided outputs

Subdivided outputs (`projects/{slug}/subdivided/...`) do not consult the ACL
document and do not infer a published-layer UUID. By default they are public.
Set `AUTH_SUBDIVIDED_ACL_ENABLED=true` to require a map-access token for the
path slug with project-admin role (or a SeaSketch superuser), or an
overlay-engine token. This switch is independent of `AUTH_ACL_ENABLED`, so
subdivided outputs can be gated before published map tiles. When
`AUTH_ACL_ENABLED` is later turned on, subdivided outputs remain protected
even if the subdivided-specific flag is left unset.

Other unrecognized project-owned keys follow `AUTH_ACL_ENABLED` and fail
closed with the same admin-only policy when enforcement is on.

### Overlay-engine tokens

A token with `type="overlay-engine"` is a service-wide read bypass for all
overlay resources, including ranges and properties. Map-access and
overlay-engine claim validation remain separate; another token type cannot
receive this bypass.

Both token types require a numeric, unexpired `exp`. Overlay-engine tokens
always require RS256 signature and issuer verification against `JWKS_URL`,
regardless of `ns`. Map-access tokens require the same when `ns=prod`.

### Authorization during local development

Local SeaSketch installs still write tiles into the shared production
`ssn-tiles` bucket and hit the production Worker. They publish ACL documents
under a dedicated non-prod namespace (for example `dev-$USER`) and send that
same value as `?ns=` on tile and download requests.

`ns` does two jobs together:

1. **Which ACL document is consulted** — `acl/{ns}/projects/{slug}.json`.
   A local client's protected layers are authorized only against *their*
   namespace's ACL docs, not against `acl/prod/...`.
2. **Whether unverified map-access tokens are allowed** — for `ns=prod`,
   JWKS + issuer verification is mandatory. For any other `ns`, JWKS is tried
   first; if it fails (typical for tokens signed by a laptop API), the Worker
   falls back to decode-and-trust for **map-access** tokens only (still
   requiring `type=map-access` and an unexpired `exp`). Overlay-engine tokens
   never use decode-and-trust — they are a bucket-wide bypass and must always
   verify against `JWKS_URL`.

So a locally signed map-access token can unlock data that is protected under
that local `ns`, but the same token cannot be used with `ns=prod` to read
production ACL-protected layers.

## Caching

The default gateway is never fronted by Workers Caching, so authorization runs
on every protected request. Tiles and property query responses use cached named
entrypoints after auth.

`ObjectBackend` is not fronted by Workers Caching because a cache miss can
strip `Range` and request the complete object. It instead uses
`caches.default` with synthetic keys containing the object key and exact range.
The cache stores an internal 200 representation and reconstructs the outward
206 response. This provides PoP caching for frequently read FGB/COG headers,
indexes, and data windows without buffering whole downloads.

Protected outward responses are marked private even when an internal backend
response is shared safely after gateway authorization.

## Local development

```sh
npm install
npm test
npm run typecheck
npm run dev
```

Copy `.dev.vars.example` to `.dev.vars` and provide required values. Do not
commit secrets.

## Preview deployment and domain remapping

Deploy under the new Worker name first; this leaves the current production
worker available:

```sh
npx wrangler deploy
```

Run `npm run smoke -- https://overlay-data-server.<account>.workers.dev`
before changing DNS. The smoke script accepts optional `SMOKE_PROJECT_KEY`,
`SMOKE_TOKEN`, and `SMOKE_NS` environment variables for protected checks.

The manual production sequence is:

1. Validate a root FGB, a TIFF range, TileJSON, a ZXY tile, a download, and
   public/protected properties on the preview URL.
2. Map `uploads.seasketch.org` and verify opaque object compatibility.
3. Map `overlay.seasketch.org` and verify `/properties` parity.
4. Verify protected project URLs with `access_token` (and optional `ns`), plus
   subdivided, data-library, and fixture cases.

DNS, infrastructure, and caller migrations are intentionally outside this
package.
