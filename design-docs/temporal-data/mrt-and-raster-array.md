# MRT / raster-array: display tiles and Data Library products

Companion to [Temporal Data in SeaSketch](temporal-data.md). That document defines *when* a layer exists. This one defines how multi-band rasters become something the map and overlay engine can use.

The isolated encoder lives in `packages/raster-array` today. Nothing there is wired into the client, API, or `spatial-uploads-handler`. This plan is how that proof of concept becomes three products with a shared core — without changing upload behavior until it is explicitly turned on.

## Why two systems

Admin uploads and SeaSketch-operated global datasets are not the same job.

**1. Project admin uploads** (`spatial-uploads-handler` on Lambda)

An admin uploads one GeoTIFF or NetCDF. If it is several grayscale or palette (categorical) bands — a 1° Global Mangrove Watch cell, a small CRW NetCDF, a local annual stack — we can emit **MRT** for `raster-array` display. That is the raster half of the timeslider goal: one source, `raster-array-band` set from the map clock, no 41-layer folder.

Lambda is the constraint: 15 minutes, ~5 GB `/tmp`, ~10 GB RAM. The upload path must stay a **single file**, of **reasonable size**. No zip of 1,696 GMW cells, no tropical-envelope warp, no multi-hour encode. Ineligible files keep today’s path (RGB-packed **PMTiles** of band 1, plus a normalized GeoTIFF / Reporting COG).

**2. Data Library products** (workstation now; ECS/EC2 later)

Some datasets only the SeaSketch team can produce: full-globe GMW, possibly Coral Reef Watch if a single NetCDF is not enough. These are **bespoke, repeatable jobs** that *build* an already-tiled, already-analyzed product and leave it on R2. A SeaSketch admin then attaches that product to the Data Library template through the existing layer-versioning path. Users copy the library item into a project; they cannot upload the raw globe themselves. The job does not write production `data_sources` rows.

A multi-hour run is acceptable. Optimizations are still worth doing (see [GMW encode](#gmw-global-encode)).

These two systems share bytes-on-the-wire (MRT v1) and analysis semantics (one COG URL, bands as years). They do **not** share a mosaic/join pipeline.

## Architecture (three modules)

```
                    ┌─────────────────────────────────────┐
                    │  @seasketch/raster-array (core)     │
                    │  MRT v1 encode/decode, TileJSON,    │
                    │  quantization, XYZ window helpers   │
                    └───────────────┬─────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│ Upload adapter (Lambda)     │         │ Data Library jobs (workstation)  │
│ spatial-uploads-handler     │         │ e.g. packages/gmw-products       │
│ one file → MRT + TileJSON   │         │ GMW: z0–12 MRT + analysis COG    │
│ MRT_ENABLED on the Lambda   │         │ writes R2 + a runbook, not the DB│
└─────────────────────────────┘         └────────────────┬─────────────────┘
              │                                           │
              │                                           ▼
              │                         dataLibrary/{templateId}/{release}/
              │                         (public R2; no ACL token)
              │                                           │
              │                                           ▼
              │                         Superuser admin: Versioning UI
              │                         → replace_data_source (live fan-out)
              │                                           │
              └─────────────────────┬─────────────────────┘
                                    ▼
                    data_upload_outputs (type MRT, ReportingCOG, …)
                                    │
                                    ▼
                    Client: raster-array when url is MRT; PMTiles otherwise
                    (optional GUI on MRT output during transition)
```

Canonical pixels for **analysis** stay a COG (or a library-built analysis GeoTIFF). MRT is a **display derivative**, the same role PMTiles already plays for single-band rasters. See [Temporal Data](temporal-data.md#map-rendering).

### 1. Shared core — `@seasketch/raster-array`

Everything that speaks MRT imports this package. It must not know about GMW zip layouts, Lambda job records, or MapContext.

**In scope**

- MRT v1 container matching mapbox-gl-js 3.4 (`0x0d` header, gzip `NumericData`, NoData `0xffffffff`, offset/scale as protobuf **floats on fields 5/6**).
- `encodeMrtTile` / `decodeMrtTile`, quantization (`value = offset + scale * code`).
- TileJSON (`format: "mrt"`, `raster_layers`, band ids).
- Web Mercator XYZ helpers and “cut this window from a raster, encode one tile.”
- A **single-input** tiler: one GeoTIFF or one NetCDF subdataset → `{z}/{x}/{y}.mrt` + `tilejson.json`. This is what uploads call. Native zoom, cap (e.g. 12), skip-empty tiles, `bandsPerBlock`.
- Unit tests against the decoder; CLI `encode` / `inspect` for fixtures.

**Out of scope**

- Listing `/vsizip/` GMW 1° cells, coverage footprints, occupancy pyramids.
- Writing `data_upload_outputs`.
- Overlay-engine stats.

The current `packages/raster-array` PoC is this module plus GMW encode scripts and an extensive **demo viewer**. Keep the viewer in this package and adapt it (see [Demo viewer](#demo-viewer-fixtures-and-remote-tilesets)). Pull GMW zip/mosaic/globe-encode scripts out to module 3.

GDAL: the core may call `gdal_translate` / `gdalwarp` CLI, or accept pre-windowed typed arrays so Lambda can use the `gdal-async` binding it already has. Do not add npm deps the upload Lambda does not already ship.

### 2. Upload adapter — `spatial-uploads-handler`

A thin, **optional** step after today’s raster pipeline. The only gate is `MRT_ENABLED` on this Lambda ([below](#mrt_enabled)). No project feature flag, no API check.

**Eligibility** (when the env is `transition` or `true`)

- Input is **one** GeoTIFF or NetCDF (existing upload types).
- Gray or Palette — `SuggestedRasterPresentation` categorical or continuous, **not** RGB imagery. Single-band is eligible; a DEM is a fine one-band MRT.

A single GMW 1° cell (`3711²`, 41 Byte bands) is the design target. The full GMW zip is not. RGB and over-budget files always stay on today’s PMTiles path.

**What it writes** depends on the env — see [MRT_ENABLED](#mrt_enabled). Ingest still fills `data_sources.temporal` (`granularity: "band"`) from CF/NetCDF time or a regular year grid when `--start-year` / PAM tags exist. Admin can correct it later ([Temporal Data](temporal-data.md#what-ingest-writes-vs-what-admin-edits)).

**What it must not do**

- Mosaic, VRT-of-many, or zip explosion beyond “this one file.”
- Change styles, TOC, or `data_sources.url` when the env is off or the file is ineligible.
- Fail the job because MRT encode failed while `MRT_ENABLED=transition` — PMTiles remains the success path. When `MRT_ENABLED=true`, MRT *is* the product; encode failure fails the job.

### 3. Data Library jobs — starting with GMW

A **separate package** (proposed `packages/gmw-products`), not a mode of the upload handler and not a publisher of production metadata. The SeaSketch team runs it when GMW v4.1.x is released. Later the same pattern can host other cubes that do not fit Lambda.

**What the job does**

- Build the two products below.
- Upload them to a **root R2 prefix** that is public and easy to cite (no project slug, no layer UUID, no map-access token):

```
dataLibrary/GLOBAL_MANGROVE_WATCH/{release}/mrt/tilejson.json
dataLibrary/GLOBAL_MANGROVE_WATCH/{release}/mrt/{z}/{x}/{y}.mrt
dataLibrary/GLOBAL_MANGROVE_WATCH/{release}/analysis.tif
```

`classifyResource` already treats keys outside `projects/` as `public`. Putting library bytes under `dataLibrary/` — not `projects/superuser/public/{uuid}` — keeps them off the ACL path even if someone later tightens `superuser` keys. Existing library tiles that already live under `projects/superuser/public/{uuid}` stay valid; new products use the root folder.

- Print a **runbook** for the operator: public URLs, suggested changelog text, suggested `TemporalInfo`, and “open the superuser GMW layer → Versions → register these hosted products.” Do not print ad-hoc `UPDATE data_sources` SQL, and do not call Graphile / `replace_data_source` from the job.

Coral Reef Watch’s `updateCRWTemplate` job is a different pattern (download → `createSourceReplacementJob` → Lambda → `replace_data_source`). Do not copy that into `gmw-products`. CRW can stay on the upload path if each cube is one NetCDF that fits Lambda.

**Products** (one Data Library template, two derivatives)


| Artifact                          | Role           | Notes                                                                                   |
| --------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| Global **MRT** tileset z0–**12**  | Map display    | Native GMW is ~30 m ≈ z12. One `raster-array` source; bands `1985`…`2025`.              |
| Global **analysis GeoTIFF / COG** | Overlay engine | One `sourceUrl`, bands = years. Tiled, sparse, Range-friendly. Not an index of 1° COGs. |


Users never run this pipeline. Copying the library item into a project is enough; once an admin has attached an `MRT` output to the template, copies see `raster-array`.

#### How an update reaches production (admin UI, not generated SQL)

Library templates already *are* versioned. They are ordinary `superuser` TOC / layer / source rows tagged with `data_library_template_id`. `replace_data_source` (migration `000433`) is the hook:

1. Archives the previous source on the **template** layer (`archived_data_sources`, version++, optional changelog copied from the new source’s `data_sources.changelog`).
2. Stamps `data_library_template_id` on the new source.
3. Live-fans-out: every draft and published copy whose source is any stamped version of that template now points at the new source. Bounds update. Project admins do not republish.
4. Sets `seasketch.skip_library_source_side_effects` so consuming projects do **not** get a `layer:uploaded` changelog row or a “draft TOC has changes” badge. That is intentional — library updates are live, not a publish cycle.

`DataLibraryModal` only copies a template into a project (`copy_data_library_template_item`). Copies cannot be replaced (`copiedFromDataLibraryTemplateId` disables upload). The template itself can be replaced today only by **drag-drop through the upload Lambda** on the superuser layer’s Versioning panel — which cannot accept a globe already sitting on R2.

**Decision: extend that Versioning UI for hosted library products. Do not have `gmw-products` emit customized production SQL.**

Printed SQL looks attractive for a yearly job, and a script that *only* called `replace_data_source` after inserting a complete source would technically hit the versioning hook. It is still the wrong operator interface:

- The useful work is not `UPDATE url`. It is insert source + `MRT` / `ReportingCOG` outputs + `temporal` + `data_library_metadata` + changelog, then `replace_data_source(template_layer_id, new_source_id, …)`. Missing any of that (especially skipping `replace_data_source`) leaves copies on the old source or leaves outputs detached.
- `ReportingCOG` rows normally require a `source_processing_job_key`. A hand script has to know the library exception; a mutation can enforce it.
- Production layer / source ids change every release. A generated script either hardcodes them (stale on the second run) or re-implements `getTemplateDetails()`. The UI already has the template layer.
- There is no preview, no “are these URLs 200 + Range-ok?”, and no record of *who* flipped production except a psql session.
- Changelog authoring already lives on Layer Versioning. Reuse that modal; do not paste a string into SQL.

What to build instead (small, template-only):

- On a **superuser** TOC item that has `data_library_template_id` (not a project copy), Versioning grows a “register hosted products” action next to drag-drop.
- Operator pastes the runbook URLs (MRT TileJSON, analysis COG), edits the suggested changelog, confirms `TemporalInfo`.
- A staff mutation creates the new `data_sources` row in `superuser`, inserts `data_upload_outputs`, writes changelog / `temporal` / `data_library_metadata`, then calls **`replace_data_source`**. Same archive + live fan-out as a CRW or file replace.
- Rollback warning stays: rolling the template back in the UI does **not** fan out; ship a new hosted version instead.

One-time bootstrap of a *new* template (create the superuser layer, `assign_data_library_template_id`, add the `DataLibraryModal` card) can still be a one-shot SQL or a manual Superuser create. That is rare. Yearly GMW updates are not.

Do not add a second Data Library CMS. Do not auto-publish from the workstation job. The job’s contract is bytes on `dataLibrary/` plus a runbook; the admin UI is the only writer of production library metadata.

## `MRT_ENABLED`

One env var, on **`spatial-uploads-handler` only**. Absent or any other value is off. No `projects.feature_flags` bit. No GraphQL `FeatureFlags` field. The API server and the client do not read this variable.

| Value | Display products | `data_sources.url` | Default GL styles | Job if MRT encode fails |
| --- | --- | --- | --- | --- |
| *(unset / other)* | RGB-packed PMTiles only (today) | PMTiles | `raster-color-mix` (today) | n/a |
| `transition` | **Both** RGB PMTiles and MRT | **Still PMTiles** | Still mix / PMTiles | Succeed; omit the `MRT` output |
| `true` | **MRT only** (no RGB PMTiles) | **MRT TileJSON** | `raster-array` paint, no mix | **Fail** the upload |

`handleUpload` / `processRasterUpload` should look like:

```
const mode = process.env.MRT_ENABLED; // undefined | "transition" | "true"
if (mode === "transition" || mode === "true") {
  if (eligibleGrayOrPalette) {
    await encodeMrt(...)  // transition: catch; true: throw
  }
}
if (mode !== "true") {
  encodeRgbPmtiles(...)   // today's path; skipped when true (eligible rasters)
}
```

**`transition`** is how we inspect the product: tiles land under `…/mrt/`, the Worker preview can open them, we learn sizes and Range behavior, and we can wire the GUI cartography tools to an `MRT` output **without** flipping what the published map draws. `data_sources.url` stays the PMTiles archive so old clients and the current map path keep working.

**`true`** is the cutover for *new* continuous and categorical uploads. Those layers get an MRT tileset as the source of record: `url` points at `…/mrt/tilejson.json`, default styles assume `raster-array`, and the map renders MRT. RGB imagery and ineligible files are unchanged (still PMTiles). Existing layers uploaded under `transition` or before keep their PMTiles `url` until someone replaces the source.

Data Library GMW does not read `MRT_ENABLED`. The workstation job always builds MRT; the admin attach writes an MRT `url` / `MRT` output. Whether the map shows it is a property of that source, not of the Lambda env.

### Client (no flag)

The client has no MRT feature flag and does not ask the API whether uploads are in transition. It follows the source:

- **`url` is the MRT TileJSON** (`…/mrt/tilejson.json`, or an `MRT` output used as the source of record) → add `raster-array`, set `raster-array-band` from `TemporalInfo.mapping.bands` / the map clock. This is what `MRT_ENABLED=true` writes, and what a registered library product looks like.
- **`url` is still PMTiles** → today’s `seasketch-raster` path. If an `MRT` output is also present (`transition`), the **map stays on PMTiles**. Optionally the GUI cartography tools may target that MRT output so we can style-preview the new encoding before cutover.
- **No MRT at all** → today’s path. Do not infer MRT from `geostats.bands.length`.

Ship the client’s ability to add a `raster-array` source *before* setting `MRT_ENABLED=true` or attaching a library MRT `url`. Otherwise new uploads and GMW copies would point at a source the deployed client cannot draw.

Map/TOC GraphQL must return outputs (or the MRT TileJSON URL). Timeslider UI itself is a separate temporal-data rollout. This document only requires: no `raster-array` source unless the layer’s `url` is MRT, except the optional GUI preview against a transitional `MRT` output.

## Cartography and default styles

If MRT is the **preferred display encoding** for eligible rasters (Gray / Palette stacks, not RGB imagery), default style generation and the GUI cartography tools have to stop pretending the tile is an RGB-packed photograph. That is most of `raster-color-mix`, `byteEncoding`, and the 258-factor decode. The color work itself — palettes, `["raster-value"]` ramps, categorical `step` / `match` — stays.

Today’s path (`gl-style-builder`, `visualizationTypes.ts`, upload `processRasterUpload` defaults, `RasterLayerEditor`) encodes a scalar into RGB (`encodeValuesToRGB`) and recovers it on the GPU:

```
"raster-color-mix": [258*65536, 258*256, 258, -32768 + base]   // 24-bit
"raster-color-mix": [0, 0, 258, base]                          // byte / categorical
"raster-color": [ "interpolate"|"step", ["raster-value"], … ]
```

Hover / `{{value}}` re-parses that mix (`rasterValueEncoding.ts`) because the canvas pixel is not the data value. `determineVisualizationType` treats **absence** of `raster-color-mix` as RGB imagery. `byteEncoding` exists only to pick the blue-only mix.

MRT already stores a quantized scalar. Mapbox applies tile `offset` / `scale` and exposes `["raster-value"]` as the real sample. NoData is the reserved code (`0xffffffff`), not alpha 0. The layer is still `type: "raster"`; the **source** is `raster-array`. Paint that matters:

| Keep | Drop (MRT layers) | Add |
| --- | --- | --- |
| `raster-color` on `["raster-value"]` | `raster-color-mix` | `raster-array-band` (band id, e.g. `"2024"`) |
| `raster-color-range` as the *ramp domain* (min/max from geostats) | `byteEncoding` / `base` / `interval` in the style | |
| `raster-resampling`, `raster-opacity`, `s:type` / `s:palette` | RGB packing in PMTiles for that layer | |

A default continuous style is then: palette + geostats min/max → `raster-color` + `raster-color-range`, plus `raster-array-band` = last band (latest year) or band 1. Categorical: the same `step`/`match` we write today, without the `[0,0,258,base]` mix. That is simpler. The 258 / 32768 / interval algebra does not belong in the GUI.

**What is not simpler** is the transition and the type-detection bugs it trips:

- **One style, one source.** A mix expression on a `raster-array` source is wrong. `raster-array-band` on `seasketch-raster` PMTiles is ignored. Ingest emits mix styles while `url` is PMTiles (`transition` / off) and raster-array paint only when `url` is MRT (`true`). Do not write a hybrid paint block. The optional transitional GUI may build a *preview* style against the `MRT` output without saving it as the layer’s published style until cutover.
- **`determineVisualizationType` must not use “no mix ⇒ RGB image.”** Gate on MRT `url` / an `MRT` output under GUI preview, or on `raster-array-band` / `raster-color` without mix. Otherwise every MRT layer looks like a photograph and the GUI offers the wrong editor.
- **Interactivity.** MRT hover is `queryRasterValue` (already in the raster-array demos). Stop requiring `encodingParamsFromGlStyles` for those layers. `supportsSeasketchRasterInteractivity` should allow multi-band Gray/Palette when the source is MRT (today it demands a single band).
- **Scale / offset.** Prefer the MRT tile’s offset/scale (decoder). Geostats `scale`/`offset` remain for legends if we still want `s:respect-scale-and-offset`; do not also fold them into a mix.
- **Shared ramp, selected band.** For a 41-year cube the color map is one; the clock only changes `raster-array-band`. Default styles should not bake a year into `s:type`. RGB imagery stays on PMTiles with no `raster-color` — unchanged.

While PMTiles remains the fallback for ineligible files (RGB, over-budget, env off) and for `transition` uploads, keep the old builders on that path. The shared helpers (`buildContinuousRasterColorExpression`, palette metadata) should take a `sourceKind: "pmtiles-rgb" | "mrt"` (or equivalent) and omit mix when `mrt`. Upload default-style generation in `spatial-uploads-handler` uses the MRT branch **only** when `MRT_ENABLED=true` (when it also sets `url` to the TileJSON). Writing mix styles onto an MRT `url` is the bug to avoid at cutover.

Worker preview default styles ([above](#source-preview-use-mrt-when-present)) should call the same builder so “open this UUID” and the admin GUI do not drift.

## Hosting and HTTP

GL JS 3.4 probes `Range: bytes=0-16383` on each `.mrt`, then fetches gzip blocks. The tiles host must:

- Support HTTP Range.
- **Clamp** range ends to file size (RFC 9110). A 416 on a small tile breaks the layer (seen in the PoC demo server).

Store MRT as a **prefix under the published layer UUID**, same nesting as data tables — not a sibling PMTiles archive and not a new UUID. See [pmtiles-server](#pmtiles-server).

```
projects/{slug}/public/{uuid}/mrt/tilejson.json
projects/{slug}/public/{uuid}/mrt/{z}/{x}/{y}.mrt
```

Project uploads use that UUID prefix. Data Library products do **not** — they live at `dataLibrary/{templateId}/{release}/mrt/…` so they are public and stable to cite. Do not pack MRT into a PMTiles archive unless a later design adds an MRT-aware reader; GL JS wants ZXY + TileJSON.

## pmtiles-server

`packages/pmtiles-server` is the only public HTTP front for overlay bytes. MRT has to live here — not a second Worker and not only the raster-array demo server. Today the Worker already does three things we must reuse: **ACL + `access_token`**, **Range reads on raw R2 objects**, and a **per-source HTML preview** at `GET /projects/{slug}/public/{uuid}` (vector vs image raster). It does **not** yet speak MRT.

TilesBackend is the wrong place to add `{z}/{x}/{y}.mrt`. That handler opens a **PMTiles archive** (`createPMTiles(name)` → `getZxy`). MRT is a loose ZXY prefix plus a stored TileJSON. Adding `.mrt` to `TILE_EXT` / `isTilePresentationResource` would look for an archive named `…/mrt/8/72` and 404. Keep `.mrt` on **ObjectBackend** (uncached, Range reaches the isolate). Public fixture prefixes (`raster-array/gmw-global/…`) already take that path.

### Layout and auth

Anything under `projects/{slug}/public/{uuid}…` already classifies as `published` (or `data_library` when slug is `superuser`). The gateway authorizes once, strips `access_token` / `ns` / `Authorization`, then forwards. Put MRT under that UUID and **no new token scheme is required**. Mapbox-friendly `?access_token=` on TileJSON, each `.mrt`, and the preview page — same `transformRequest` pattern the current preview uses.


| Key                                      | Who                  | Token                             |
| ---------------------------------------- | -------------------- | --------------------------------- |
| `projects/{slug}/public/{uuid}/mrt/…`    | Project overlay      | Existing map-access ACL           |
| `projects/superuser/public/{uuid}/mrt/…` | Legacy library tiles | Library / public as today         |
| `dataLibrary/{templateId}/{release}/…`   | Data Library products | Public (root prefix, no ACL)     |
| `raster-array/gmw-global/…`              | Demo / fixtures      | Public (keys outside `projects/`) |


`data_upload_outputs` of type `MRT` stores the TileJSON URL:

`https://tiles.seasketch.org/projects/{slug}/public/{uuid}/mrt/tilejson.json`

Library products use the root prefix instead:

`https://tiles.seasketch.org/dataLibrary/GLOBAL_MANGROVE_WATCH/{release}/mrt/tilejson.json`

The SeaSketch client and the Worker preview both use that URL. `uploads.seasketch.org` stays opaque R2 (download / Range); presentation (preview, rewritten TileJSON) stays on `tiles.seasketch.org`.

### Range requests

GL JS 3.4 sends `Range: bytes=0-16383` on every `.mrt`, then fetches gzip blocks. ObjectBackend already sets `Accept-Ranges: bytes` and uses `getR2Range`. Two Worker bugs will break MRT if left as-is:

1. **Do not 416 oversize ends.** `rangeCache.ts` returns 416 when `end >= size`. Small tiles (common at low zoom) then fail the probe. Clamp `end` to `size - 1` and return 206, as the raster-array demo server does and RFC 9110 allows. Keep 416 only for a start past EOF or a malformed header.
2. **Expose `Content-Range` / `Accept-Ranges` to the browser** (`Access-Control-Expose-Headers`). CORS already allows `*`; GL JS must be able to read the range response.

Leave ObjectBackend **uncached** for Range (already true). Do not route `.mrt` through TilesBackend’s immutable Workers cache — that path assumes a full tile body, not a 16 KB probe.

Tests: fixture `.mrt` smaller than 16 KB with `Range: bytes=0-16383` → 206 + clamped `Content-Range`; published UUID prefix denied without token; public `raster-array/…` and `dataLibrary/…` prefixes allowed with no token.

### TileJSON

The encoder writes `tilejson.json` with local `tiles` URLs. At serve time, rewrite `tiles` to absolute `https://tiles.seasketch.org/{prefix}/{z}/{x}/{y}.mrt` (same host as the request). Do not bake `access_token` into stored JSON — the preview and Mapbox `transformRequest` append it per request.

`format` must stay `"mrt"`. `raster_layers[].fields.bands` is how the preview and the client pick `raster-array-band`.

Optional small helper on the Worker: if `GET …/public/{uuid}.json` (today: TileJSON **from the PMTiles archive**) should mention MRT, add a sibling field later. v1 can leave `.json` as PMTiles TileJSON so old clients keep working, and treat `…/mrt/tilejson.json` as the raster-array document.

### Source preview (use MRT when present)

`GET /projects/{slug}/public/{uuid}` is the existing “open this source in a map” URL. It always builds TileJSON from the PMTiles archive and renders **Mapbox GL JS 2.10** as `vector` or image `raster`. That cannot display MRT (`raster-array` landed in GL JS 3.1+).

**If** `…/mrt/tilejson.json` exists for that UUID, the preview must use it:

- Bump the preview (or an MRT branch of it) to **GL JS 3.4**, the version SeaSketch and the raster-array demos already use.
- `map.addSource` type `raster-array`, `url` = rewritten MRT TileJSON (with `access_token` / `ns` forwarded).
- **Default style** from TileJSON, not a cartographer: categorical / 0–1 presence → `raster-color` case like the mangrove demo (`1` = a green, nodata hidden); continuous → `raster-color` from `fields.range`. Nearest resampling. Opacity ~0.85.
- If `bands.length > 1`, show a compact year/band slider and set `raster-array-band` (last band / latest year by default). Playback is nice-to-have; the raster-array demo stays the richer harness.
- Keep the existing token dialog / `?access_token=` / 401–403 handling. `transformRequest` must attach the token to `.mrt` Range requests on the same origin.

**If** there is no MRT prefix, keep today’s PMTiles preview unchanged (still fine to upgrade GL JS in a follow-up, but not required for this work).

No client or project flag. Presence of the `…/mrt/tilejson.json` object is enough. That is the point of `MRT_ENABLED=transition`: open the Worker preview and inspect the product while the map still draws PMTiles.

### Demo viewer vs Worker preview

Two UIs, one HTTP contract:


|                    | `packages/raster-array` demos                   | Worker preview                           |
| ------------------ | ----------------------------------------------- | ---------------------------------------- |
| Purpose            | Encode / Range / band-block harness             | “Does this published source work?”       |
| Auth               | Public fixtures; no token                       | Full ACL + token prompt                  |
| Globe / large sets | `tiles.seasketch.org/raster-array/gmw-global/…` or a `dataLibrary/…` release | Same public `dataLibrary/…` prefix |
| Project uploads    | Not the target                                  | MRT prefix under the UUID                |


The raster-array demo should load remote tilesets through **the same Worker URLs** the production preview will use (rewritten TileJSON, Range, clamp). That is how we notice a 416 or CORS miss before a project layer does. Do not keep a special unauthenticated path for project UUIDs.

## Demo viewer, fixtures, and remote tilesets

`packages/raster-array` already has a real viewer: index, GMW regional, GMW globe, SST/NetCDF, MRT block grouping, Mapbox GFS control, year slider / playback, hover `queryRasterValue`, and a tiny Range-aware static server. **Keep it.** Adapt and improve it as the package’s visual test harness — this is how we prove encode, TileJSON, Range, and `raster-array-band` before anything is wired into the SeaSketch client. It is not a throwaway PoC page.

It is **not** the production map. Production adds a `raster-array` source when the layer’s `url` is MRT ([MRT_ENABLED](#mrt_enabled)).

### What stays local (fixtures)

Small tilesets that `npm run fixtures` can rebuild in minutes belong in the repo (or a `fixtures/` tree the demo server reads). Examples already in the PoC: Florida / Sundarbans / Borneo 1° GMW cells (maxzoom 11), synthetic SST, categorical all-bands-vs-split-blocks. Commit the encoded `{z}/{x}/{y}.mrt` + `tilejson.json` when they are small enough; otherwise commit only the source GeoTIFF/NetCDF and generate tiles in CI / `npm run fixtures`. Do **not** gitignore the whole `demos/tiles` tree if that is where committed fixtures live — ignore generated/local-only prefixes instead.

The local demo server (`npm run demo`, `http://127.0.0.1:8765`) remains for these fixtures and for iterating on a new encode before it is published. It already clamps oversize `Range` ends; keep that.

### What goes on R2 (large products)

The global GMW tileset is hundreds of MB at z0–10 and much larger at z11–12. Do not commit it, do not require every developer to run `gmw:global`, and do not serve it from `demos/tiles/gmw-global` as the default path.

Publish it to the `ssn-tiles` R2 bucket as a **public fixture prefix** (keys outside `projects/`, same class as `crdss-cells-6`). Example:

```
raster-array/gmw-global/tilejson.json
raster-array/gmw-global/{z}/{x}/{y}.mrt
raster-array/gmw-global/encode-stats.json
```

The demo references it through **pmtiles-server** on `tiles.seasketch.org` (Range-capable, public fixtures, no map-access token):

```
https://tiles.seasketch.org/raster-array/gmw-global/tilejson.json
https://tiles.seasketch.org/raster-array/gmw-global/{z}/{x}/{y}.mrt
```

TileJSON `tiles` must be those absolute HTTPS URLs. Confirm the Worker treats `.mrt` as a raw object (ObjectBackend) with RFC Range and **clamped** ends — TilesBackend ZXY is built for PMTiles/`pbf`/`png`, not MRT. If a root-fixture ZXY route 404s or 416s on `.mrt`, use the raw-object path; do not wrap the globe in a PMTiles archive.

A publish step (rclone / wrangler / one-off script in the GMW package) uploads after `gmw:global`. That is not part of `npm run fixtures`.

### Viewer behavior

- **Catalog.** Pages declare a tileset as `local` (fixture under `/tiles/{id}`) or `remote` (TileJSON URL on `tiles.seasketch.org`). The globe page is remote.
- **Fallback.** Optional: if a developer has encoded the globe locally, prefer `/tiles/gmw-global`; otherwise use the R2 URL. Missing remote tiles should say “not published” rather than “run gmw:global.”
- **Improve, don’t shrink.** Keep slider, playback, place jumps, hover query, encode-stats, and the official Mapbox control. Worth adding: a tileset picker driven by a small manifest, bandwidth/Range logging on the blocks page, and a note in the UI when a layer is remote vs fixture.
- **Token.** Mapbox style token still comes from `packages/client/.env`. Remote MRT URLs do not need it.

When the GMW encode job moves to `packages/gmw-products`, the **viewer stays here**. The job’s output is bytes under `dataLibrary/…` plus a runbook; the raster-array demo may consume a release URL or keep the separate `raster-array/gmw-global` fixture prefix. It is a consumer, not the publisher.

## GMW global encode

The PoC (`npm run gmw:global`) mosaics 1,696 vsizip cells to one sparse EPSG:3857 GeoTIFF (`SKIP_NOSOURCE`, `SPARSE_OK`, no COG overviews), then runs the single-file tiler with 1° `coverageBboxes`. That is correct enough to ship a library product, and too slow (~3.5 tiles/s, hours per extra zoom).

**Keep**

- Workstation / ECS, not Lambda.
- Incremental zoom (`--keep-existing --minzoom 12 --maxzoom 12`).
- One analysis raster (not 1,696 overlay sources).
- Native **z12** (~38 m/px vs ~30 m source). Regional fixtures already go to z11; the globe must match.

**Optimize in the GMW package, not the upload tiler**

1. **Occupancy before GDAL** — ~85% of z11 candidates inside 1° footprints are empty ocean. Skip tiles that miss allocated mosaic blocks or a 1-bit occupancy pyramid.
2. **Cut display tiles from the 1° cells (or a VRT of them)**, not from the 1.3M-wide mosaic. Cells are 3711² and already have overviews. The mosaic/COG is the *analysis* product; it is a poor XYZ read source.
3. In-process GDAL (Python/`rasterio` worker, or bindings) to avoid 10⁵ process spawns on a z12 pass.
4. Optional later: shard XYZ lists across ECS tasks.

A multi-hour z0–12 run is acceptable for a yearly library update. (1)+(2) should pull that toward tens of minutes.

### Analysis COG

Overlay-engine `raster_overlay_area` is single-band today and `getValues` on a geography-sized window densifies ocean. The library COG should be tiled/sparse so a follow-on overlay change can **walk 512² tiles**, skip empty ones, and histogram per tile — still one `sourceUrl`, bands as years (or one-pass areas-by-year). That work lives in `packages/overlay-engine`, gated on the COG existing; it is not a prerequisite to publish the MRT.

Do not ask the upload handler to build this globe COG.

## Implementation sequence

1. **Core cleanup** — Treat `packages/raster-array` as the shared library. Move GMW zip/mosaic/globe-encode scripts toward `packages/gmw-products` (or `scripts/` there). Keep and improve the demo viewer; commit small fixture tilesets; point the globe page at `tiles.seasketch.org`. No handler/client imports yet.
2. **pmtiles-server** — Clamp oversize MRT Range probes (no 416). Serve `…/mrt/{z}/{x}/{y}.mrt` + rewritten TileJSON on ObjectBackend under the published UUID (ACL unchanged). Public root prefixes for fixtures (`raster-array/…`) and library products (`dataLibrary/…`). Preview: if MRT TileJSON exists, GL JS 3.4 `raster-array` + default style + band slider; else today’s PMTiles preview.
3. **Additive schema** — `data_upload_output_type` value `MRT`. Handler `SupportedTypes` / `ResponseOutput` union. No GraphQL feature flag. Nothing writes `MRT` yet.
4. **Upload adapter, `MRT_ENABLED` unset** — Deploy the encoder behind the env. Tests: 1° GMW cell and synthetic stack emit MRT in `transition` / `true`; RGB GeoTIFF never does; unset env never does; `transition` keeps PMTiles `url` + mix styles; `true` sets MRT `url` + raster-array styles and skips RGB PMTiles.
5. **Client consume + cartography** — If `url` is MRT TileJSON, add `raster-array` and bind the clock to `raster-array-band`. GUI / `gl-style-builder` / `determineVisualizationType` branch on MRT vs RGB-packed PMTiles. Hover via `queryRasterValue`. Optional: GUI may target a transitional `MRT` output while `url` is still PMTiles. Ship this before `MRT_ENABLED=true`.
6. **GMW library job** — z0–12 MRT + analysis COG onto `dataLibrary/GLOBAL_MANGROVE_WATCH/{release}/`; print the runbook. Superuser Versioning “register hosted products” attaches them via `replace_data_source`. Occupancy / per-cell tiling as the first speed work.
7. **Overlay-engine** — Tile-walk + multi-band / `when` for library GMW (and later any multi-band Reporting COG). Separate PR.

## Non-goals

- MTS or Mapbox-hosted raster-array tilesets. Self-host `{z}/{x}/{y}.mrt`.
- Teaching the upload pipeline to join many GeoTIFFs.
- Replacing PMTiles for single-band or RGB rasters.
- Client or API feature flags for MRT. The only switch is `MRT_ENABLED` on the upload Lambda.
- Client `raster-array` support “because geostats lists 41 bands” or “because an `MRT` output exists” while `url` is still PMTiles (map stays on PMTiles in `transition`; GUI preview is optional).
- Running the globe encode on the upload Lambda.

## Current PoC facts (so implementers do not rediscover them)

- Decoder: mapbox-gl-js 3.4 `mrt_pbf_decoder.js`, not a public spec.
- GMW v4.1.2: 1,696 1° cells, 41 Byte bands, nodata `0`, mangrove `1`, 1985–2025, ~30 m.
- Globe mosaic (sparse 3857 GTiff): ~0.45 GB, 29.998 m/px, native zoom ~12.
- Globe MRT z0–10: 8,243 tiles, ~323 MB. z11 is a keep-existing pass (~65k candidates).
- Regional fixtures (`gmw-florida`, `gmw-sundarbans`, `gmw-borneo`) encode to **maxzoom 11** from the same source cells.
- Demo viewer: `packages/raster-array` → `npm run demo` → `http://127.0.0.1:8765`. Token from `packages/client/.env` (`REACT_APP_MAPBOX_ACCESS_TOKEN`). Keep this app; small tilesets as fixtures, globe from R2 / `tiles.seasketch.org`.

