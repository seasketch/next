# pmtiles-server

Cloudflare Worker that serves [PMTiles](https://github.com/protomaps/PMTiles) archives from R2 as authenticated ZXY tiles and TileJSON for SeaSketch (Mapbox GL).

Hosted archives are content-addressed and immutable (a data update publishes a new object key). After authorization, allow responses for tiles and TileJSON use long-lived edge caching. Protected responses are marked private so shared caches do not reuse another user’s tokens.

Production hostname: `https://tiles.seasketch.org`.

SeaSketch publishes the data and its access policy; `pmtiles-server` enforces that policy before reading and serving the corresponding PMTiles archive.

## Routes

All paths are under `/v2/{ns}/…`, where `{ns}` is the ACL namespace (production uses `prod`).

Hosted overlays live at object keys of the form `projects/{slug}/public/{uuid}.pmtiles`. The URL path before `/v2/{ns}` is stripped for backend lookup, so these routes map 1:1 onto those keys:

| Path                                                       | Response                            |
| ---------------------------------------------------------- | ----------------------------------- |
| `/v2/{ns}/projects/{slug}/public/{uuid}/{z}/{x}/{y}.{ext}` | Tile (e.g. `.mvt`, `.png`, `.webp`) |
| `/v2/{ns}/projects/{slug}/public/{uuid}.json`              | TileJSON                            |
| `/v2/{ns}/projects/{slug}/public/{uuid}`                   | Mapbox GL preview page              |

Preview pages require the `MAPBOX_ACCESS_TOKEN` Worker secret. For protected tilesets, open the preview with `?access_token=…`, or use the token dialog shown when the gateway returns 401/403. The preview map attaches the token to subsequent `/v2/` TileJSON and tile requests.

## Authorization Tokens

### How to send a token

Provide a SeaSketch **map access** JWT in one of:

1. Query string (preferred for Mapbox GL / browser maps — avoids CORS preflight on every tile):  
   `?access_token=<jwt>`
2. Header (fine for non-browser clients):  
   `Authorization: Bearer <jwt>`

The query parameter is stripped before the tile backend runs so cache keys stay clean.

Public tilesets (listed in the [Project ACL Document](#access-control-documents)) do not require a token. Missing or invalid credentials on a protected tileset yield **401**; authenticated but insufficient access yields **403**.

### Token source

For namespace `prod` (protected layers), the Worker accepts only an **unexpired** RS256 JWT that:

1. Has an `iss` claim in the known SeaSketch issuer set (`seasketch.org`, `api.seasket.ch`, with or without `https://`), and
2. Has a signature that verifies against the Worker’s public JWKS (`JWKS_URL`, default [`https://api.seasket.ch/.well-known/jwks.json`](https://api.seasket.ch/.well-known/jwks.json)).

### Required claims

| Claim         | Type                  | Meaning                                                                                        |
| ------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| `type`        | string                | Must be `"map-access"`                                                                         |
| `iss`         | string                | Must be a known SeaSketch issuer when the signature is JWKS-verified                           |
| `projectId`   | number                | Project the token is scoped to                                                                 |
| `projectSlug` | string                | Canonical project slug (must match the ACL document’s `slug`, except for SeaSketch superusers) |
| `userId`      | number                | Authenticated user                                                                             |
| `role`        | `"admin"` \| `"user"` | Project admin (or platform superuser treated as admin) vs participant                          |
| `groups`      | number[]              | Project group ids the user belongs to                                                          |
| `isSuperuser` | boolean (optional)    | Platform superuser; bypasses project ACL checks                                                |
| `exp`         | number                | Expiration (unix seconds); the token must not be expired                                       |

## Access Control Documents

Project ACL documents tell the Worker which overlay tile UUIDs are public and which require a map-access JWT (and under what role/group rules). The Worker does not query SeaSketch’s database; it only reads these JSON files from R2. **SeaSketch must rewrite the document whenever a project’s Overlay Table of Contents is published**, so the gateway’s view of public vs protected matches what was just published.

Until a layer appears as `public` (or an appropriate `protected` entry) in the published document, its UUID is treated as **admins-only**: clients need a valid admin (or superuser) token. That covers drafts and anything else not yet reflected by a publish.

### Location and shape

Per-project ACL JSON lives in the tiles R2 bucket:

```text
acl/{ns}/projects/{slug}.json
```

Example:

```json
{
  "v": 1710000000000,
  "slug": "example-project",
  "public": ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
  "rules": [
    { "t": "admins_only" },
    { "t": "group", "g": [12, 34] },
    { "t": "group", "g": [56] }
  ],
  "protected": {
    "11111111-2222-3333-4444-555555555555": [0],
    "66666666-7777-8888-9999-aaaaaaaaaaaa": [1, 2]
  }
}
```

| Field       | Meaning                                                                    |
| ----------- | -------------------------------------------------------------------------- |
| `v`         | Version stamp (milliseconds). Higher values win if concurrent writes race. |
| `slug`      | Canonical project slug; compared to token `projectSlug`.                   |
| `public`    | Tile UUIDs anyone may fetch without a token.                               |
| `rules`     | Deduplicated admins-only and group ACL rules.                              |
| `protected` | Map of tile UUID → indexes in `rules`.                                     |

Each protected UUID references every non-public ACL attached to its layer or an ancestor folder in the published TOC. **All referenced rules must pass.** A group rule passes when the token contains at least one id in that rule’s `g` list; project admins bypass the rule checks. This preserves nested TOC behavior—for example, a layer inside two group-limited folders requires membership matching both folder rules—while allowing all descendants of a folder to reuse one rule entry.

**Unlisted UUIDs** (not in `public` or `protected`) are treated as **`admins_only`**.

The Worker caches ACL docs in-memory per isolate and **revalidates against R2 before treating a request as a definitive deny**, so a layer that recently became public is not stuck denied on a stale isolate.

## Using with a Development Environment

Production ACL and client URLs use namespace **`prod`**. Local and staging installs share the same R2 bucket, so each developer (or environment) must use a **distinct namespace** in the `/v2/{ns}/…` path and when writing ACL objects (`TILES_ACL_NAMESPACE` on the API; `REACT_APP_TILES_ACL_NAMESPACE` on the client). The API refuses to write the `prod` namespace unless `NODE_ENV=production`.

### Unverified (dev) tokens

For any namespace **other than `prod`**:

1. The Worker first tries full JWKS signature verification (same as production).
2. If that fails (typical for JWTs signed by a laptop API whose keys are not in production JWKS), the Worker **decodes the JWT without verifying the signature** and trusts the claims.

Trusted / unverified tokens still must:

- Have `type: "map-access"`
- Have a non-expired `exp`

They are **never** accepted for namespace `prod`. That keeps forged local tokens from authorizing production ACL documents, while still letting you hit `tiles.seasketch.org/v2/<your-ns>/…` with a map-access JWT from your local API.

### Preview + tokens in development

Same as production: `?access_token=` on the preview URL, or the HTML token dialog when the gateway rejects the request.

## Other Considerations

- **Data library (`superuser` storage path).** Objects under `/projects/superuser/public/{uuid}` are the shared data library. The gateway always allows these as public: it does **not** load an ACL document or require a token, regardless of namespace.
- **Path slug vs project slug.** The `{slug}` in `/projects/{slug}/public/…` is the storage path (often the project slug at upload time). ACL lookup prefers the token’s `projectSlug` when a token is present, so renamed projects or copied data-library-style URLs still authorize against the correct project ACL.
- **Caching.** Public allow responses may use immutable public cache headers. Non-public allows are forced to `Cache-Control: private, …` so intermediaries do not share protected tiles across users. The Worker’s gateway entrypoint itself is not Workers-Cache–eligible; the tile backend entrypoint is.
- **JWKS cache.** Verified production tokens use an in-isolate JWKS cache (about one hour). If a newly rotated signing `kid` is missing, the Worker refetches JWKS once and retries verification.
- **Observability.** Auth decisions are logged as JSON (`msg: "tile-auth"`). Responses include `X-SS-Tile-Auth` (`allow:…` or `deny:…`). Cache misses that hit the tile backend may include `Server-Timing`.

## Deployment

```bash
npm install
npm start          # wrangler dev
npm test
npm run typecheck
npm run deploy
```

| Binding / var         | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `TILES_BUCKET`        | R2 bucket for PMTiles, hosted downloads, + ACL docs (`ssn-tiles`)      |
| `PUBLIC_HOSTNAME`     | Host embedded in TileJSON `tiles` URLs (default `tiles.seasketch.org`) |
| `JWKS_URL`            | JWKS endpoint for verifying production map-access JWTs                 |
| `MAPBOX_ACCESS_TOKEN` | Secret; Mapbox GL for preview pages only                               |

### Auth-aware object downloads

Hosted overlays (GeoJSON, FlatGeobuf, PMTiles, originals, …) are stored in the
same R2 bucket as tile archives. The worker serves whole objects at:

```
/v2/{ns}/projects/{slug}/public/{uuid}.geojson?download=My%20Layer.geojson&access_token=...
/v2/{ns}/projects/{slug}/public/{uuid}.pmtiles?download=My%20Layer.pmtiles&access_token=...
```

`?download=` sets `Content-Disposition: attachment` (same as uploads-server).
ACL checks use the UUID the same way as TileJSON / tiles.

```bash
echo '<pk.token>' | npx wrangler secret put MAPBOX_ACCESS_TOKEN
```

Local overrides go in a gitignored `.dev.vars`. After changing `wrangler.toml`, regenerate types with `npx wrangler types`.
