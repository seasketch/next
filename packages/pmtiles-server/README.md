# Overlay Data Server

Cloudflare Worker for serving SeaSketch overlay data from the `ssn-tiles` R2
bucket.

The Worker has three responsibilities:

1. PMTiles-backed TileJSON, ZXY tiles, and browser previews.
2. Streaming whole-object downloads and efficient byte-range reads for
   FlatGeobuf, cloud-optimized GeoTIFF, PMTiles, and arbitrary object types.
3. FlatGeobuf property extraction through the legacy-compatible `/properties`
   API.

The default entrypoint is an uncached authorization and host-routing gateway.
It invokes isolated `TilesBackend`, `ObjectBackend`, and `PropertiesBackend`
entrypoints after credentials have been removed.

## Routes

### Tiles, previews, and downloads

| Route                                                               | Result                       |
| ------------------------------------------------------------------- | ---------------------------- |
| `/projects/{slug}/public/{uuid}.json`                               | TileJSON                     |
| `/projects/{slug}/public/{uuid}/{z}/{x}/{y}.{mvt,pbf,png,webp,jpg}` | Tile                         |
| `/projects/{slug}/public/{uuid}`                                    | Browser preview              |
| `/projects/{slug}/public/{uuid}.{extension}`                        | Object download              |
| `/projects/{slug}/subdivided/{objectPath}`                          | Admin-only subdivided output |
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
rules.

Subdivided outputs (`projects/{slug}/subdivided/...`) do not consult the ACL
document and do not infer a published-layer UUID. They require a map-access
token for the path slug with project-admin role, or a SeaSketch superuser.
Other unrecognized project-owned keys fail closed with the same admin-only
policy.

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
