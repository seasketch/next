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
| `/{r2-key}` on `uploads.seasketch.org`                              | Raw R2 object                |
| `/v2/{ns}/projects/{slug}/public/{uuid}.{extension}`                | Auth-aware object download   |
| `/v2/{ns}/projects/{slug}/subdivided/{objectPath}`                  | Admin-only subdivided output |

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

Both paths are accepted:

```text
GET /properties?dataset={r2-key}
GET /v2/{ns}/properties?dataset={r2-key}
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

Keys outside `projects/` are public fixtures. For example,
`/eez-land-joined.fgb` can be read without a token. Data-library keys below
`projects/superuser/public/` are also always public on every host and route.

Explicit `/v2/{ns}/...` routes always authorize protected project data. Tokens
may be supplied with `Authorization: Bearer ...` or `access_token=...`.
Credentials are stripped before backend invocation and never enter a cache key.

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
overlay resources, including ranges and properties.

- For namespace `prod`, RS256 signature and issuer verification against
  `JWKS_URL` is mandatory.
- For other namespaces, JWKS verification is attempted first and the existing
  decode-and-trust development behavior is then allowed.
- A numeric, unexpired `exp` is mandatory in both modes.

Map-access and overlay-engine claim validation remain separate; another token
type cannot receive this bypass.

### Legacy rollout switch

Historically, hosted overlay objects used an implicit capability-URL model:
content-addressed UUID paths under `projects/{slug}/public/{uuid}...` were
effectively unguessable secrets, so the Worker treated them as publicly
fetchable without tokens. Auth is now moving to explicit map-access /
overlay-engine tokens plus per-project ACL documents; this switch bridges the
two schemes during rollout.

`AUTH_LEGACY_PROJECT_PATHS` defaults to `"false"`. While false, non-v2
`projects/...` requests preserve that legacy capability-URL behavior so domains
can be remapped and tested without breaking callers. Authenticated routes
(`/v2` and legacy paths once the switch is on) strictly expect a published ACL
document; if the doc is missing, every layer UUID is treated as admins-only.

Set the switch to `"true"` only after legacy clients send tokens. It then
treats legacy project paths as namespace `prod` and applies the same published,
subdivided, and unknown-project rules described above. While ACLs are still
being generated, a missing project ACL document is treated as all UUIDs public
so authenticated clients are not locked out mid-rollout. Fixtures and
data-library objects remain public.

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
before changing DNS. The smoke script accepts optional `SMOKE_PROJECT_KEY` and
`SMOKE_TOKEN` environment variables for protected checks.

The manual production sequence is:

1. Validate a root FGB, a TIFF range, TileJSON, a ZXY tile, a download, and
   public/protected properties on the preview URL.
2. Map `uploads.seasketch.org` and verify opaque object compatibility.
3. Map `overlay.seasketch.org` and verify `/properties` parity.
4. Keep `AUTH_LEGACY_PROJECT_PATHS=false` during compatibility testing.
5. Migrate callers, then enable the switch and verify protected legacy,
   subdivided, data-library, and fixture cases.

DNS, infrastructure, and caller migrations are intentionally outside this
package.
