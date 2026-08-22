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

## MRT is a tile, not a tileset

The PoC encoder writes a slippy-map tree of `{z}/{x}/{y}.mrt` plus a `tilejson.json`. That is **correct as a tile format** and **wrong as a shipping format**.

**What Mapbox defined.** MRT is the bytes of **one** XYZ tile: a `0x0d` header, layer/band metadata, and gzip `NumericData` blocks. GL JS 3.4 `raster-array` consumes TileJSON (`format: "mrt"`) and then `GET …/{z}/{x}/{y}.mrt`, probing `Range: bytes=0-16383` and fetching only the band blocks it needs. Mapbox’s own Rasterarrays API is the same shape:

```
GET https://api.mapbox.com/rasterarrays/v1/{tileset_id}/{z}/{x}/{y}.mrt
```

Raster MTS *produces* those tiles and hosts them on Mapbox’s CDN. They do **not** publish a single-file tileset package — no MRT-flavored MBTiles, no archive spec. Their “package” is a hosted tileset id. Loose ZXY is how they operate because they already run a tile CDN that is comfortable with millions of objects.

**What SeaSketch needs.** We do not have that CDN, and we already learned this lesson. Uploading or syncing a directory of tiles to R2 does not scale: a GMW globe at z12 is hundreds of thousands of objects; a future high-zoom cube is millions. PUT/LIST/DELETE cost, timeout, and operational pain are why **PMTiles was the unlock** for hosting our own vector and RGB-raster tilesets. MRT does not get an exception. The display product we store and transfer is **one archive**, the same way today’s overlays are one `{uuid}.pmtiles`.

**Decision: pack MRT tiles into a PMTiles v3 archive.** PMTiles is format-agnostic — Tile Type `0x00` (Unknown / Other) plus JSON metadata `format: "mrt"` and the `raster_layers` document the encoder already writes. Each archive entry is the raw `.mrt` blob for that Z/X/Y. One object goes to R2. The Worker is the adapter GL JS never has to know about:

```
encode XYZ .mrt bytes
    → scratch {z}/{x}/{y}.mrt tree (+ tilejson.json)
    → raster-array pack (native JS PMTiles v3 writer)
    → one {name}.mrt.pmtiles on R2
    → TilesBackend getZxy → GET {name}/{z}/{x}/{y}.mrt  (+ Range into that tile)
    → GL JS raster-array (unchanged)
```

The Worker hop is the same as vector and RGB rasters. The **packer** is not: we write PMTiles in `@seasketch/raster-array` (Hilbert tile-ids, gzip directories, SHA-256 dedupe, `tile_compression = None`) instead of sqlite MBTiles + the `pmtiles` CLI. That keeps the later Lambda path free of extra binaries. The new parts on the wire are the MRT payload, `format: "mrt"` metadata, a `.mrt` ZXY extension, and honoring Range on the **extracted tile body**.

GL JS cannot open a `.pmtiles` URL as a `raster-array` source (its built-in PMTiles support is vector / image raster). Do not wait for Mapbox to add that. Do not invent a second archive format. Do **not** publish a loose `{z}/{x}/{y}.mrt` prefix to R2 except as tiny local demo fixtures.

Two Range layers, do not confuse them:

| Hop | What is Range-addressed | Who |
| --- | --- | --- |
| Worker → R2 | PMTiles header, directories, one tile payload | existing `pmtiles` reader |
| GL JS → Worker | Byte ranges **inside** that `.mrt` (16 KB probe, then gzip blocks) | TilesBackend must slice the extracted tile |

`tile_compression` on the archive must be **None** (or decompressed by `getZxy` before the response). MRT already has its own gzip blocks; a second gzip wrapped around the whole tile is fine only if the Worker unwraps it so the client sees the original MRT bytes. Offsets GL JS computes from the header are offsets into the MRT container, not into the PMTiles file.

PMTiles is not appendable. Incremental encode (`--keep-existing` for a z12 pass) writes a **scratch** directory or MBTiles; we pack **once** at the end. That is a workstation concern, not a reason to leave the published product as loose files.

## Architecture (three modules)

```
                    ┌─────────────────────────────────────┐
                    │  @seasketch/raster-array (core)     │
                    │  MRT v1 encode/decode, TileJSON,    │
                    │  pack to PMTiles, XYZ helpers       │
                    └───────────────┬─────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│ Upload adapter (Lambda)     │         │ Data Library jobs (workstation)  │
│ spatial-uploads-handler     │         │ packages/data-library-gmw        │
│ one file → one MRT PMTiles  │         │ GMW: z0–12 MRT archive + GeoTIFF │
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
                    Client: raster-array when url is the MRT archive; RGB PMTiles otherwise
                    (optional GUI on MRT output during transition)
```

Canonical pixels for **analysis** stay a COG (or a library-built analysis GeoTIFF). MRT is a **display derivative**, the same role PMTiles already plays for single-band rasters. See [Temporal Data](temporal-data.md#map-rendering).

### 1. Shared core — `@seasketch/raster-array`

Everything that speaks MRT imports this package. It must not know about GMW zip layouts, Lambda job records, or MapContext.

**In scope**

- MRT v1 container matching mapbox-gl-js 3.4 (`0x0d` header, gzip `NumericData`, NoData `0xffffffff`, offset/scale as protobuf **floats on fields 5/6**).
- `encodeMrtTile` / `decodeMrtTile`, quantization (`value = offset + scale * code`).
- TileJSON (`format: "mrt"`, `raster_layers`, band ids), stored in the PMTiles JSON metadata so the Worker can emit `{name}.json` the same way it does for vector archives.
- Web Mercator XYZ helpers and “cut this window from a raster, encode one tile.”
- A **single-input** tiler: one GeoTIFF or one NetCDF subdataset → scratch `{z}/{x}/{y}.mrt` → **one `{name}.mrt.pmtiles`**. The directory is not the product. Native zoom, cap (e.g. 12), skip-empty tiles, `bandsPerBlock`. Native JS packer (no MBTiles, no `pmtiles` CLI).
- Unit tests against the decoder and packer; CLI `encode` / `inspect` / `pack` for fixtures.

**Out of scope**

- Listing `/vsizip/` GMW 1° cells as a *library job* concern — but `listGmwSources` stayed in this package because regional fixtures (`npm run fixtures`) and `data-library-gmw` both need the same zip layout. Occupancy pyramids still belong in the GMW job.
- Writing `data_upload_outputs`.
- Overlay-engine stats.

Regional fixture demos stay here. The globe viewer lives with the job in `packages/data-library-gmw` (`npm run demo`). `scripts/encode-gmw-global.ts` is a stub that points there.

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

A **separate package** (`packages/data-library-gmw`), not a mode of the upload handler and not a publisher of production metadata. The SeaSketch team runs it when GMW v4.1.x is released. Later the same pattern can host other cubes that do not fit Lambda.

**What the job does**

- Build the two products below.
- Upload them to a **root R2 prefix** that is public and easy to cite (no project slug, no layer UUID, no map-access token). Two objects, not a tile tree:

```
dataLibrary/GLOBAL_MANGROVE_WATCH/{release}/display.mrt.pmtiles
dataLibrary/GLOBAL_MANGROVE_WATCH/{release}/analysis.tif
```

`classifyResource` already treats keys outside `projects/` as `public`. Putting library bytes under `dataLibrary/` — not `projects/superuser/public/{uuid}` — keeps them off the ACL path even if someone later tightens `superuser` keys. Existing library tiles that already live under `projects/superuser/public/{uuid}` stay valid; new products use the root folder.

- Print a **runbook** for the operator: public URLs, suggested changelog text, suggested `TemporalInfo`, and “open the superuser GMW layer → Versions → register these hosted products.” Do not print ad-hoc `UPDATE data_sources` SQL, and do not call Graphile / `replace_data_source` from the job.

Coral Reef Watch’s `updateCRWTemplate` job is a different pattern (download → `createSourceReplacementJob` → Lambda → `replace_data_source`). Do not copy that into `data-library-gmw`. CRW can stay on the upload path if each cube is one NetCDF that fits Lambda.

**Products** (one Data Library template, two derivatives)


| Artifact                          | Role           | Notes                                                                                   |
| --------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| Global **MRT PMTiles** z0–**12**  | Map display    | One archive. Native GMW is ~30 m ≈ z12. One `raster-array` source; bands `1985`…`2025`.  |
| Global **analysis GeoTIFF / COG** | Overlay engine | One `sourceUrl`, bands = years. Tiled, sparse, Range-friendly. Not an index of 1° COGs. |


Users never run this pipeline. Copying the library item into a project is enough; once an admin has attached an `MRT` output to the template, copies see `raster-array`.

#### How an update reaches production (admin UI, not generated SQL)

Library templates already *are* versioned. They are ordinary `superuser` TOC / layer / source rows tagged with `data_library_template_id`. `replace_data_source` (migration `000433`) is the hook:

1. Archives the previous source on the **template** layer (`archived_data_sources`, version++, optional changelog copied from the new source’s `data_sources.changelog`).
2. Stamps `data_library_template_id` on the new source.
3. Live-fans-out: every draft and published copy whose source is any stamped version of that template now points at the new source. Bounds update. Project admins do not republish.
4. Sets `seasketch.skip_library_source_side_effects` so consuming projects do **not** get a `layer:uploaded` changelog row or a “draft TOC has changes” badge. That is intentional — library updates are live, not a publish cycle.

`DataLibraryModal` only copies a template into a project (`copy_data_library_template_item`). Copies cannot be replaced (`copiedFromDataLibraryTemplateId` disables upload). The template itself can be replaced today only by **drag-drop through the upload Lambda** on the superuser layer’s Versioning panel — which cannot accept a globe already sitting on R2.

**Decision: extend that Versioning UI for hosted library products. Do not have `data-library-gmw` emit customized production SQL.**

Printed SQL looks attractive for a yearly job, and a script that *only* called `replace_data_source` after inserting a complete source would technically hit the versioning hook. It is still the wrong operator interface:

- The useful work is not `UPDATE url`. It is insert source + `MRT` / `ReportingCOG` outputs + `temporal` + `data_library_metadata` + changelog, then `replace_data_source(template_layer_id, new_source_id, …)`. Missing any of that (especially skipping `replace_data_source`) leaves copies on the old source or leaves outputs detached.
- `ReportingCOG` rows normally require a `source_processing_job_key`. A hand script has to know the library exception; a mutation can enforce it.
- Production layer / source ids change every release. A generated script either hardcodes them (stale on the second run) or re-implements `getTemplateDetails()`. The UI already has the template layer.
- There is no preview, no “are these URLs 200 + Range-ok?”, and no record of *who* flipped production except a psql session.
- Changelog authoring already lives on Layer Versioning. Reuse that modal; do not paste a string into SQL.

What to build instead (small, template-only):

- On a **superuser** TOC item that has `data_library_template_id` (not a project copy), Versioning grows a “register hosted products” action next to drag-drop.
- Operator pastes the runbook URLs (MRT archive / TileJSON, analysis COG), edits the suggested changelog, confirms `TemporalInfo`.
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
| `true` | **MRT PMTiles only** (no RGB PMTiles) | **MRT archive TileJSON** (`…/{uuid}.mrt`) | `raster-array` paint, no mix | **Fail** the upload |

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

**`transition`** is how we inspect the product: an `MRT` output (`{uuid}.mrt.pmtiles`) lands next to today’s RGB `{uuid}.pmtiles`, the Worker preview can open the MRT archive, we learn sizes and Range-on-extracted-tile behavior, and we can wire the GUI cartography tools to that output **without** flipping what the published map draws. `data_sources.url` stays the RGB PMTiles archive so old clients and the current map path keep working.

**`true`** is the cutover for *new* continuous and categorical uploads. Those layers get an MRT PMTiles archive as the source of record: `url` points at `…/{uuid}.mrt` (Worker TileJSON at `…/{uuid}.mrt.json`), default styles assume `raster-array`, and the map renders MRT. RGB imagery and ineligible files are unchanged (still image PMTiles). Existing layers uploaded under `transition` or before keep their RGB PMTiles `url` until someone replaces the source.

Data Library GMW does not read `MRT_ENABLED`. The workstation job always builds MRT; the admin attach writes an MRT `url` / `MRT` output. Whether the map shows it is a property of that source, not of the Lambda env.

### Client (no flag)

The client has no MRT feature flag and does not ask the API whether uploads are in transition. It follows the source:

- **`url` is the MRT archive** (`…/{uuid}.mrt`, or a library `…/display.mrt`) → add `raster-array` against the Worker TileJSON, set `raster-array-band` from `TemporalInfo.mapping.bands` / the map clock. This is what `MRT_ENABLED=true` writes, and what a registered library product looks like. Detect from the `MRT` output / TileJSON `format: "mrt"`, not from a loose `…/mrt/tilejson.json` prefix.
- **`url` is still the RGB/vector PMTiles** → today’s `seasketch-raster` path. If an `MRT` output is also present (`transition`), the **map stays on the RGB archive**. Optionally the GUI cartography tools may target that MRT output so we can style-preview the new encoding before cutover.
- **No MRT at all** → today’s path. Do not infer MRT from `geostats.bands.length`.

Ship the client’s ability to add a `raster-array` source *before* setting `MRT_ENABLED=true` or attaching a library MRT `url`. Otherwise new uploads and GMW copies would point at a source the deployed client cannot draw.

Map/TOC GraphQL must return outputs (or the MRT archive URL). Timeslider UI itself is a separate temporal-data rollout. This document only requires: no `raster-array` source unless the layer’s `url` is the MRT archive, except the optional GUI preview against a transitional `MRT` output.

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

While PMTiles remains the fallback for ineligible files (RGB, over-budget, env off) and for `transition` uploads, keep the old builders on that path. The shared helpers (`buildContinuousRasterColorExpression`, palette metadata) should take a `sourceKind: "pmtiles-rgb" | "mrt"` (or equivalent) and omit mix when `mrt`. Upload default-style generation in `spatial-uploads-handler` uses the MRT branch **only** when `MRT_ENABLED=true` (when it also sets `url` to the MRT archive). Writing mix styles onto an MRT `url` is the bug to avoid at cutover.

Worker preview default styles ([above](#source-preview-use-mrt-when-present)) should call the same builder so “open this UUID” and the admin GUI do not drift.

## Hosting and HTTP

GL JS 3.4 still talks ZXY + TileJSON. It probes `Range: bytes=0-16383` on each `{z}/{x}/{y}.mrt`, then fetches gzip blocks. The tiles host must:

- Present a TileJSON whose `tiles` template is `…/{z}/{x}/{y}.mrt` and `format` is `"mrt"`.
- Extract that tile from the **PMTiles archive** and honor Range **on the extracted MRT bytes**.
- **Clamp** range ends to the tile size (RFC 9110). A 416 on a small tile breaks the layer (seen in the PoC demo server).

Store the archive as a **sibling of today’s RGB/vector PMTiles**, same UUID, different suffix — not a directory of tiles and not a new UUID. See [pmtiles-server](#pmtiles-server).

```
projects/{slug}/public/{uuid}.pmtiles          # today’s RGB / vector (unchanged)
projects/{slug}/public/{uuid}.mrt.pmtiles      # MRT display archive
```

Worker presentation (same pattern as `{uuid}.json` / `{uuid}/{z}/{x}/{y}.png`):

```
GET …/public/{uuid}.mrt.json                   # TileJSON from archive metadata
GET …/public/{uuid}.mrt/{z}/{x}/{y}.mrt        # getZxy + Range into the tile
```

`createPMTiles(name)` already opens `{name}.pmtiles`. A request for `{uuid}.mrt/8/72/110.mrt` looks up `projects/{slug}/public/{uuid}.mrt.pmtiles`. That is why TilesBackend **is** the right place — the earlier “don’t pack MRT into PMTiles” note was wrong. GL JS wants ZXY; the Worker already synthesizes ZXY from an archive. Those are not in conflict.

Project uploads use that UUID sibling. Data Library products use a stable public key:

```
dataLibrary/{templateId}/{release}/display.mrt.pmtiles
```

`uploads.seasketch.org` stays opaque R2 (download the archive / the COG). Presentation (preview, TileJSON, ZXY) stays on `tiles.seasketch.org`.

## pmtiles-server

`packages/pmtiles-server` is the only public HTTP front for overlay bytes. MRT lives here — not a second Worker and not only the raster-array demo server. The Worker already did three things we reuse: **ACL + `access_token`**, **PMTiles `getZxy` on TilesBackend**, and a **per-source HTML preview** at `GET /projects/{slug}/public/{uuid}` (vector vs image raster). TilesBackend now also speaks MRT (see [Implementation notes](#implementation-notes-2026-08)).

TilesBackend is the **right** place to add `{z}/{x}/{y}.mrt`. Add `.mrt` to `TILE_EXT` / `isTilePresentationResource`. The archive name is `{uuid}.mrt` (file `{uuid}.mrt.pmtiles`), not `{uuid}/mrt/8/72`. Do **not** serve production tiles as loose objects on ObjectBackend — that is the millions-of-files path we are refusing.

ObjectBackend stays for whole-archive download (`GET …/{uuid}.mrt.pmtiles`) and for the analysis COG, the same way `{uuid}.pmtiles` is downloadable today.

### Layout and auth

Anything under `projects/{slug}/public/{uuid}…` already classifies as `published` (or `data_library` when slug is `superuser`). The gateway authorizes once, strips `access_token` / `ns` / `Authorization`, then forwards. The MRT sibling sits next to the existing archive — **no new token scheme**. Mapbox-friendly `?access_token=` on TileJSON, each `.mrt` tile URL, and the preview page — same `transformRequest` pattern the current preview uses.

TILEJSON_ROUTE today only matches `{UUID}.json`. Extend it (and `PUBLISHED_TILEJSON_OR_PREVIEW`) so `{UUID}.mrt.json` and `{UUID}.mrt/` preview resolve to the MRT archive. Root fixtures (`raster-array/gmw-global.mrt`) and `dataLibrary/…/display.mrt` need the same `{name}.json` / `{name}/{z}/{x}/{y}.mrt` pairing that `crdss-cells-6` already has for pbf.


| Key | Who | Token |
| --- | --- | --- |
| `projects/{slug}/public/{uuid}.mrt.pmtiles` | Project overlay | Existing map-access ACL |
| `projects/superuser/public/{uuid}.mrt.pmtiles` | Legacy library tiles | Library / public as today |
| `dataLibrary/{templateId}/{release}/display.mrt.pmtiles` | Data Library products | Public (root prefix, no ACL) |
| `raster-array/gmw-global.mrt.pmtiles` | Demo / fixtures | Public (keys outside `projects/`) |


`data_upload_outputs` of type `MRT` stores the archive URL (same convention as today’s PMTiles output: the `.pmtiles` object). Ingest strips the suffix when writing `data_sources.url`, exactly as `handleUpload` already does for `.pmtiles`:

```
https://tiles.seasketch.org/projects/{slug}/public/{uuid}.mrt.pmtiles
→ data_sources.url = …/public/{uuid}.mrt
```

Library products:

```
https://tiles.seasketch.org/dataLibrary/GLOBAL_MANGROVE_WATCH/{release}/display.mrt.pmtiles
```

The SeaSketch client and the Worker preview both use the Worker TileJSON (`…/{name}.json`), not a sidecar `tilejson.json` object in R2.

### Range requests

GL JS 3.4 sends `Range: bytes=0-16383` on every `.mrt` **tile URL**, then fetches gzip blocks. TilesBackend today returns the full `getZxy` body as `200` and ignores `Range`. For MRT it must:

1. `getZxy` the raw MRT bytes (PMTiles isolate cache already makes this cheap after the first directory read).
2. If the request has `Range`, slice that buffer. **Clamp** `end` to `size - 1` and return `206` + `Content-Range`. A 416 on a small tile (common at low zoom; the 16 KB probe is often larger than the tile) breaks the layer. Keep 416 only for a start past EOF or a malformed header.
3. **Expose `Content-Range` / `Accept-Ranges`** (`Access-Control-Expose-Headers`). CORS already allows `*`; GL JS must be able to read the range response.
4. `Content-Type: application/octet-stream` when metadata `format` is `mrt` / tile type is Unknown. Today’s `contentTypeForTileType` default is `application/x-protobuf`, which is wrong for MRT.

Do **not** put `206` slices in TilesBackend’s immutable Workers cache — those keys would miss on a different range of the same tile. Cache the full extracted tile inside the isolate (already true for PMTiles directories + `getZxy`) and slice per request. Returning `200` with the full tile (ignoring Range) is an acceptable fallback if slicing fights the existing cache, because the default encoder puts every band in one block; honoring Range is still the target so `--bands-per-block 1` stays useful.

Tests: archive whose extracted tile is smaller than 16 KB, `Range: bytes=0-16383` → `206` + clamped `Content-Range`; `{uuid}.mrt/{z}/{x}/{y}.mrt` denied without token; public `raster-array/gmw-global.mrt/…` and `dataLibrary/…/display.mrt/…` allowed with no token; `{uuid}.json` still describes the RGB/vector archive, not the MRT sibling.

### TileJSON

The encoder writes `format: "mrt"` and `raster_layers` into the **PMTiles JSON metadata**. TilesBackend `getTileJson` already builds `{name}.json` from that metadata for vector archives. For an MRT archive it must:

- Keep `format: "mrt"` and `raster_layers`.
- Set `tiles` to `{publicBase}/{name}/{z}/{x}/{y}.mrt` (not `.mvt` / `.png`).
- Not bake `access_token` into the JSON — the preview and Mapbox `transformRequest` append it per request.

`raster_layers[].fields.bands` is how the preview and the client pick `raster-array-band`.

`GET …/public/{uuid}.json` stays the RGB/vector TileJSON so old clients keep working. The raster-array document is `GET …/public/{uuid}.mrt.json`.

### Source preview (use MRT when present)

`GET /projects/{slug}/public/{uuid}` is the existing “open this source in a map” URL. It always builds TileJSON from `{uuid}.pmtiles` and renders **Mapbox GL JS 2.10** as `vector` or image `raster`. That cannot display MRT (`raster-array` landed in GL JS 3.1+).

**If** `{uuid}.mrt.pmtiles` exists, the preview (or an MRT branch of it, or `GET …/{uuid}.mrt`) must use it:

- Bump the preview (or an MRT branch of it) to **GL JS 3.4**, the version SeaSketch and the raster-array demos already use.
- `map.addSource` type `raster-array`, `url` = `{uuid}.mrt.json` (with `access_token` / `ns` forwarded).
- **Default style** from TileJSON, not a cartographer: categorical / 0–1 presence → `raster-color` case like the mangrove demo (`1` = a green, nodata hidden); continuous → `raster-color` from `fields.range`. Nearest resampling. Opacity ~0.85.
- If `bands.length > 1`, show a compact year/band slider and set `raster-array-band` (last band / latest year by default). Playback is nice-to-have; the raster-array demo stays the richer harness.
- Keep the existing token dialog / `?access_token=` / 401–403 handling. `transformRequest` must attach the token to `.mrt` Range requests on the same origin.

**If** there is no MRT archive, keep today’s PMTiles preview unchanged (still fine to upgrade GL JS in a follow-up, but not required for this work).

No client or project flag. Presence of `{uuid}.mrt.pmtiles` is enough. That is the point of `MRT_ENABLED=transition`: open the Worker preview on the MRT sibling while the map still draws the RGB archive.

### Demo viewer vs Worker preview

Two UIs, one HTTP contract:


|                    | `packages/raster-array` demos                   | Worker preview                           |
| ------------------ | ----------------------------------------------- | ---------------------------------------- |
| Purpose            | Encode / pack / Range / band-block harness      | “Does this published archive work?”      |
| Auth               | Public fixtures; no token                       | Full ACL + token prompt                  |
| Globe / large sets | `tiles.seasketch.org/raster-array/gmw-global.mrt.json` or a `dataLibrary/…/display.mrt.json` | Same public archive |
| Project uploads    | Not the target                                  | `{uuid}.mrt` sibling                     |


The raster-array demo should load remote tilesets through **the same Worker URLs** the production preview will use (archive TileJSON, ZXY `.mrt`, Range on the extracted tile). That is how we notice a 416 or CORS miss before a project layer does. Do not keep a special unauthenticated path for project UUIDs.

## Demo viewer, fixtures, and remote tilesets

`packages/raster-array` already has a real viewer: index, GMW regional, GMW globe, SST/NetCDF, MRT block grouping, Mapbox GFS control, year slider / playback, hover `queryRasterValue`, and a tiny Range-aware static server. **Keep it.** Adapt and improve it as the package’s visual test harness — this is how we prove encode, TileJSON, Range, and `raster-array-band` before anything is wired into the SeaSketch client. It is not a throwaway PoC page.

It is **not** the production map. Production adds a `raster-array` source when the layer’s `url` is the MRT archive ([MRT_ENABLED](#mrt_enabled)).

### What stays local (fixtures)

Small tilesets that `npm run fixtures` can rebuild in minutes belong in the repo (or a `fixtures/` tree the demo server reads). Examples already in the PoC: Florida / Sundarbans / Borneo 1° GMW cells (maxzoom 11), synthetic SST, categorical all-bands-vs-split-blocks.

A loose `{z}/{x}/{y}.mrt` tree is **fine here** — it is how we iterate on encode and Range-into-the-tile before packing. Commit the packed `{id}.mrt.pmtiles` (and a tiny source GeoTIFF/NetCDF) when the archive is small enough; otherwise commit only the source and generate in CI / `npm run fixtures`. The local demo server can keep serving a directory **or** open the packed archive the same way TilesBackend will. Do **not** gitignore the whole `demos/tiles` tree if that is where committed fixtures live — ignore generated/local-only prefixes instead.

The local demo server (`npm run demo`, `http://127.0.0.1:8765`) remains for these fixtures and for iterating on a new encode before it is published. It already clamps oversize `Range` ends; keep that, and add a path that serves ZXY from a local `.mrt.pmtiles` so pack/Range is tested without R2.

### What goes on R2 (large products)

The global GMW tileset is hundreds of MB at z0–10 and much larger at z11–12. Do not commit it, do not require every developer to run `data-library-gmw`, and do not upload a `demos/tiles/gmw-global/{z}/{x}/{y}` tree.

Publish **one archive** to the `ssn-tiles` R2 bucket as a **public fixture** (keys outside `projects/`, same class as `crdss-cells-6`):

```
raster-array/gmw-global.mrt.pmtiles
raster-array/gmw-global-encode-stats.json
```

The demo references it through **pmtiles-server** on `tiles.seasketch.org` (TilesBackend, public fixture, no map-access token):

```
https://tiles.seasketch.org/raster-array/gmw-global.mrt.json
https://tiles.seasketch.org/raster-array/gmw-global.mrt/{z}/{x}/{y}.mrt
```

A publish step (rclone / wrangler / one-off script in `packages/data-library-gmw`) uploads the packed archive after `npm run pack`. That is not part of `npm run fixtures`. One PUT, not 8,243 (z0–10) or hundreds of thousands (z12).

### Viewer behavior

- **Catalog.** Pages declare a tileset as `local` (fixture directory or local `.mrt.pmtiles`) or `remote` (Worker TileJSON on `tiles.seasketch.org`). The globe page is remote.
- **Fallback.** Optional: if a developer has packed the globe locally, prefer that file; otherwise use the R2 archive URL. Missing remote tiles should say “not published” rather than “run data-library-gmw.”
- **Improve, don’t shrink.** Keep slider, playback, place jumps, hover query, encode-stats, and the official Mapbox control. Worth adding: a tileset picker driven by a small manifest, bandwidth/Range logging on the blocks page, and a note in the UI when a layer is remote vs fixture.
- **Token.** Mapbox style token still comes from `packages/client/.env`. Remote MRT URLs do not need it.

The GMW encode job and globe demo live in `packages/data-library-gmw`. The job’s output is `display.mrt.pmtiles` + analysis GeoTIFF under `dataLibrary/…` plus a runbook. `npm run demo` there serves only that local archive.

## GMW global encode

The first globe encode (mosaic → `encodeTileset` with 1° `coverageBboxes`) wrote 38,230 tiles and skipped **297,822** empty windows (~89%). Wall time was ~20 hours of encode plus ~2.4 hours of mosaic. That tree is preserved at `packages/raster-array/demos/tiles/gmw-global.preserved-z0-12`. Do not overwrite `demos/tiles/gmw-global`.

**Current job (`packages/data-library-gmw`)**

1. **Occupancy** — each 1° cell is downsampled with `gdal_translate -r max` (cells already have 58…928 overviews). Any year ≠ nodata marks the coarse pixel; those pixels map to z12 XYZ, then parents down to z0. Result: ~38k tiles instead of ~336k GDAL windows.
2. **Warp each 1° cell to EPSG:3857 once** (tiled GTiff). Then each occupied tile is a same-CRS `gdal_translate -projwin` (or a small mosaic warp if it spans cells). Cutting from the 1.3M-wide tropical mosaic was the slow read. `build` packs `display.mrt.pmtiles` when encode finishes.
3. **Analysis mosaic** is separate and stays in **EPSG:4326** (source CRS). Same-CRS `gdalwarp` of the 1° cells (`SKIP_NOSOURCE`, no `-t_srs`). A VRT + translate of the tropical envelope densifies ocean. The `fixtures/gmw-global/gmw-global.3857.tif` file is a display leftover; do not copy it to `analysis.tif`.

`--keep-existing` resumes an encode. Scratch output is `work/tiles` only; the CLI refuses a folder named `gmw-global`.

**Keep**

- Workstation / ECS, not Lambda. See [GMW on EC2 / ECS](gmw-ecs-orchestration.md).
- Pack the PMTiles archive **once** at the end — the format is not appendable. The packer streams tile files so a 1.8 GB tree does not need 2× RAM.
- One analysis raster (not 1,696 overlay sources).
- Native **z12**. One `display.mrt.pmtiles`. Never rclone a `{z}/{x}/{y}.mrt` prefix to R2.

**Still worth doing later**

- Long-lived GDAL/rasterio workers so z12 is not 20k process spawns.
- Occupancy from allocated mosaic blocks / a 1-bit pyramid (current downsample is conservative; a few empty edge tiles remain).
- Optional: shard XYZ lists across ECS tasks.

### Analysis raster

Overlay-engine `raster_overlay_area` is single-band today and `getValues` on a geography-sized window densifies ocean. The library product should be tiled/sparse so a follow-on overlay change can **walk 512² tiles**, skip empty ones, and histogram per tile — still one `sourceUrl`, bands as years (or one-pass areas-by-year). That work lives in `packages/overlay-engine`; it is not a prerequisite to publish the MRT.

`data-library-gmw analysis` writes a **tiled sparse EPSG:4326 GeoTIFF** (`SPARSE_OK`) mosaiced from the source cells. Do **not** `gdal_translate -of COG` the tropical envelope without care — a naive COG translate densifies empty ocean and can balloon the file. Range-friendly COG conversion is a later overlay-engine concern.

Do not ask the upload handler to build this globe raster.

## Implementation sequence

1. **Core cleanup + pack** — **Done (2026-08).** `packages/raster-array` is the shared library. Encoder product is `{name}.mrt.pmtiles` via a native JS writer (scratch `{z}/{x}/{y}.mrt` → `pack`). Globe mosaic/encode/pack/runbook moved to `packages/data-library-gmw`. Demo viewer kept; globe page points at the Worker archive URL. No handler/client imports.
2. **pmtiles-server** — **Done (2026-08).** TilesBackend: `.mrt` ZXY from `{name}.mrt.pmtiles`, TileJSON at `{name}.mrt.json` with `format: "mrt"` / `raster_layers`, Range on the extracted tile (clamp, no 416). Preview: if the MRT sibling exists, GL JS 3.4 `raster-array` + default style + band slider; else today’s RGB/vector preview. Public root archives for fixtures (`raster-array/gmw-global.mrt`) and library products (`dataLibrary/…/display.mrt`).
3. **Additive schema** — `data_upload_output_type` value `MRT`. Handler `SupportedTypes` / `ResponseOutput` union. No GraphQL feature flag. Nothing writes `MRT` yet.
4. **Upload adapter, `MRT_ENABLED` unset** — Deploy the encoder behind the env. Tests: 1° GMW cell and synthetic stack emit **one** `.mrt.pmtiles` in `transition` / `true`; RGB GeoTIFF never does; unset env never does; `transition` keeps RGB PMTiles `url` + mix styles; `true` sets `url` to `…/{uuid}.mrt` + raster-array styles and skips RGB PMTiles.
5. **Client consume + cartography** — If `url` is the MRT archive, add `raster-array` and bind the clock to `raster-array-band`. GUI / `gl-style-builder` / `determineVisualizationType` branch on MRT vs RGB-packed PMTiles. Hover via `queryRasterValue`. Optional: GUI may target a transitional `MRT` output while `url` is still the RGB archive. Ship this before `MRT_ENABLED=true`.
6. **GMW library job** — **Workstation CLI + occupancy/cell encode done (2026-08); admin attach still open.** `packages/data-library-gmw` builds occupancy → cell-cut MRT → streamed `display.mrt.pmtiles` + analysis GeoTIFF and prints the runbook. Superuser Versioning “register hosted products” (not built yet) attaches them via `replace_data_source`. The first 20-hour tree is preserved; a production re-encode from this path has not finished on this machine yet.
7. **Overlay-engine** — Tile-walk + multi-band / `when` for library GMW (and later any multi-band Reporting COG). Separate PR.

## Non-goals

- MTS or Mapbox-hosted raster-array tilesets. We self-host a **PMTiles archive** and synthesize the ZXY API Mapbox’s CDN would have provided.
- Publishing a loose `{z}/{x}/{y}.mrt` tree to R2 (demo fixtures on disk are fine).
- A new archive format. PMTiles v3 + Tile Type Unknown + `format: "mrt"` metadata is enough. Do not wait for Mapbox GL JS to open `.pmtiles` as `raster-array`.
- Teaching the upload pipeline to join many GeoTIFFs.
- Replacing image/vector PMTiles for RGB imagery or vectors. MRT PMTiles is the display product for Gray / Palette stacks.
- Client or API feature flags for MRT. The only switch is `MRT_ENABLED` on the upload Lambda.
- Client `raster-array` support “because geostats lists 41 bands” or “because an `MRT` output exists” while `url` is still the RGB archive (map stays on RGB PMTiles in `transition`; GUI preview is optional).
- Running the globe encode on the upload Lambda.

## Current PoC facts (so implementers do not rediscover them)

- Decoder: mapbox-gl-js 3.4 `mrt_pbf_decoder.js`, not a public spec.
- Mapbox does not ship an MRT tileset archive. The PoC’s `{z}/{x}/{y}.mrt` tree matches their *tile* API, not a package we can put on R2.
- GMW v4.1.2: 1,696 1° cells, 41 Byte bands, nodata `0`, mangrove `1`, 1985–2025, ~30 m.
- Globe mosaic (sparse 3857 GTiff): ~0.45 GB, 29.998 m/px, native zoom ~12.
- Globe MRT z0–10: 8,243 tiles, ~323 MB. z11 is a keep-existing pass (~65k candidates). Those counts are why the published product must be one archive.
- Regional fixtures (`gmw-florida`, `gmw-sundarbans`, `gmw-borneo`) encode to **maxzoom 11** from the same source cells.
- Regional demos: `packages/raster-array` → `npm run demo` → `http://127.0.0.1:8766`. Globe: `packages/data-library-gmw` → `npm run demo` → `http://127.0.0.1:8765/gmw-global.html` (local `work/dist/display.mrt.pmtiles` only). Token from `packages/client/.env` (`REACT_APP_MAPBOX_ACCESS_TOKEN`).

## Implementation notes (2026-08)

Notes from the first isolated slice (raster-array packer, pmtiles-server MRT, `packages/data-library-gmw`). Client and `spatial-uploads-handler` were not touched.

### Package name

The Data Library job is `packages/data-library-gmw` (`@seasketch/data-library-gmw`), not `gmw-products`. It is listed in root `lerna.json`. The CLI does not call Graphile / `replace_data_source` and does not print production SQL.

### Native JS PMTiles writer

`@seasketch/raster-array` writes PMTiles v3 in-process (`src/pmtiles/`). No sqlite, no `pmtiles` CLI, no extra runtime deps — that is the Lambda-safe path later. Archives are clustered, SHA-256-deduped, `tile_type = Unknown`, `tile_compression = None`. Leaf directories are emitted when the gzipped root would exceed 16 KB. `pack` walks a scratch `{z}/{x}/{y}.mrt` tree plus `tilejson.json`. Incremental `--keep-existing` still writes that tree; pack once at the end.

### TileJSON for Unknown tile type

Official `pmtiles` `getTileJson` uses `tileTypeExt(Unknown) === ""`, so a Worker that only forwarded that document would advertise `{z}/{x}/{y}` with no `.mrt`. TilesBackend **rewrites** `tiles` to `{publicBase}/{name}/{z}/{x}/{y}.mrt` and copies `format` / `raster_layers` from archive metadata.

### `{name}.mrt.json` capture

The TileJSON / preview regex must be `/(.+\.mrt)\.json` and `/(.+\.mrt)/?$`. A first draft `/(.+)\.mrt.json` captured `gmw-global` and looked up `gmw-global.pmtiles` (404). `createPMTiles(name)` opens `{name}.pmtiles`, so the captured name has to keep the `.mrt` suffix (`gmw-global.mrt` → `gmw-global.mrt.pmtiles`).

OBJECT_ROUTE must skip `.mrt.json` so TileJSON is not treated as a raw object download. Fixture / library presentation uses `/\.mrt(?:\.json)?$/`, which does **not** match `.mrt.pmtiles` downloads.

### Range on extracted tiles

`sliceByteRange` clamps the 16 KB GL JS probe. A 416 on a small low-zoom tile breaks the layer. 206 responses use `Cache-Control: private, no-store` so immutable Workers cache does not store one byte-range of a tile. `Content-Type` for `.mrt` is `application/octet-stream`, not `application/x-protobuf`.

### GMW listing stayed in the core

Plan said listing `/vsizip/` cells was out of scope for `@seasketch/raster-array`. Regional fixtures and the library job both need the same zip layout, so `listGmwSources` / `parseGmwCellName` stayed in the core and are exported. Occupancy pyramids and globe orchestration still belong in `data-library-gmw`. The job imports raster-array **source** via relative paths (`../../raster-array/src/…`) so a `tsc` of the core is not required to run the CLI.

### Tiler already skips a second 3857 warp

`encodeTileset` detects an EPSG:3857 input and skips `gdalwarp`. The GMW mosaic can be fed straight into encode.

### What this slice did not do

- SeaSketch client `raster-array` source, timeslider, cartography.
- `MRT_ENABLED` / upload Lambda.
- Schema `data_upload_output_type = MRT`.
- Superuser Versioning “register hosted products” UI.
- A finished production re-encode from the new occupancy/cell-cut path (CLI is ready).

### GMW cell names are the NW origin

`GMW_N25W081` is lon −81…−80, lat **24…25** (GeoTIFF origin = NW corner). An earlier `parseGmwCellName` treated the number as the SW corner and shifted every coverage bbox 1° north. Occupancy and cell-cut encode use the corrected bounds.

### Occupancy + cell-cut encode (2026-08)

First globe encode stats (mosaic-backed `encodeTileset`): 336,052 candidates, 38,230 written, 297,822 empty, 1.8 GB, ~20 h. z12 alone was 244,466 candidates / 20,675 written.

The job no longer uses that tiler for the globe. Occupancy + warp-from-1° cells is the display path; the mosaic stays the analysis product. PMTiles pack is part of `build` and streams from the scratch tree.

Python `osgeo` / rasterio are **not** installed on the workstation that ran the PoC. Per-tile GDAL CLI remains; occupancy is what removes the empty-ocean majority.

GDAL's ENVI driver defaults to **BIP**. The generic ENVI reader (`readEnviBands`) is a per-sample DataView loop — ~seconds per 41-band tile. Always pass `-co INTERLEAVE=BSQ` and use `readEnviByteBands`. This was a large part of the original ~3.5 tiles/s.

MRT gzip of a 41 × 258² uint32 tile is ~0.5–1 s and is CPU-bound. Running it on the encode event loop serialized the whole job (~1.8 tiles/s on a 10-core machine). `encodeFromCells` now gzips in a `child_process.fork` pool (`tsx` loads the worker). Florida smoke (2 cells, 147 occupied tiles): **133 written in 50 s (~2.9/s)** vs ~20 h for the old 336k-candidate globe. Linear scale for 38k occupied tiles is a few hours, not a day. In-process GDAL would still help.

### Preserved fixture

`packages/raster-array/demos/tiles/gmw-global` and `gmw-global.preserved-z0-12` are the day-long z0–12 tree. `data-library-gmw` writes only under `work/` and refuses a scratch folder named `gmw-global`. Pack the preserved tree if you need an archive without re-encoding.

