---
name: GMW sparse COG + tiled geography stats
overview: One HTTP Range–readable sparse multi-band COG as the overlay-engine source for Global Mangrove Watch (and similar cubes). Change geography/large-window raster stats to walk COG tiles instead of densifying the subject bbox. Keep MRT as a display derivative only. Repeatable workstation recipe from the GMW 1° zip; not a Lambda job.
todos:
  - id: spike-ifd
    content: Spike geotiff.js / geoblaze.parse on a sparse global GMW mosaic (IFD size, first Range, Vanuatu-window tile count vs the existing 2° clip)
    status: pending
  - id: tile-reader
    content: Implement tile-at-a-time pixel walk in overlay-engine (skip sparse empty tiles, mask polygon per 512² block, never allocate the EEZ bbox)
    status: pending
  - id: geography-path
    content: Route geography raster_overlay_area / raster_stats through the tiled reader when the window exceeds a threshold; keep geoblaze.stats for small fragments
    status: pending
  - id: tests-parity
    content: Regression tests — Vanuatu EEZ km² on the 2° 2018 clip equals the same polygon on a global sparse COG (within float error); Fiji EEZ must not OOM
    status: pending
  - id: band-when
    content: Metric contract for band/year (parameter on raster_overlay_area, or one-pass areas-by-when) so timeseries widgets use one sourceUrl
    status: pending
  - id: gmw-cog-recipe
    content: Repeatable GDAL recipe (vsizip 1° cells → gdalwarp SKIP_NOSOURCE SPARSE_OK BigTIFF/COG, no dense overviews) + host with HTTP Range
    status: pending
  - id: display-split
    content: Keep canonical COG for analysis; MRT/raster-array remains map display only (do not point overlay-engine at .mrt tiles)
    status: pending
isProject: false
---

# Sparse global COG + tiled geography raster stats

Pick-up branch for later. **Do not** mix with uncommitted `@seasketch/raster-array` / MRT PoC work on `feature/temporal-data`.

Related docs: [docs/temporal-data/temporal-data.md](docs/temporal-data/temporal-data.md), existing metric types in [packages/overlay-engine/src/metrics/metrics.ts](packages/overlay-engine/src/metrics/metrics.ts), streaming path in [packages/overlay-engine/src/geoblazeBandStats.ts](packages/overlay-engine/src/geoblazeBandStats.ts).

---

## Decision summary

- **One overlay source per metric** = one Range-readable GeoTIFF/COG URL. No gdaltindex, no 1,696 1° files as metric sources, no per-country clips as the architecture.
- **Map ≠ analysis.** Canonical asset for overlay-engine is a **sparse multi-band COG**. MRT (`raster-array`) is a display derivative (timeslider), same role PMTiles plays for single-band rasters today ([temporal-data.md](docs/temporal-data/temporal-data.md) rendering vs reporting).
- **COG already fetches tiles of interest.** Vanuatu EEZ vs a global GMW COG should Range-read roughly the same coastal 512² tiles as today’s 2° clip. The bug is overlay-engine **allocating a dense array for the geography bbox** (ocean zeros), not HTTP Range.
- **Geography `vrm: false` stays.** Native ~25–30 m on tiles that have data. Do not upsample EEZs.
- **GMW mosaic is workstation-only.** Upload Lambda (15 min, 5 GB `/tmp`) cannot hold or warp this cube. Repeatable local/`gdalwarp` is fine.
- **Do not VRT the tropical envelope then `gdalwarp`/`gdal_translate` to COG with overviews.** That logical raster is ~1.34M × 296k × 41; GDAL tried ~1 TB for overviews. Combine by passing **all 1° cells as `gdalwarp` sources** with `SKIP_NOSOURCE` + `SPARSE_OK`.
- **`raster_overlay_area` is single-band today** (`maxs.length > 1` throws). Timeseries needs a band/`when` parameter or one spatial pass returning areas-by-year. Same `sourceUrl`.

---

## Context from the GMW / MRT spike

### Data

- **GMW v4.1 zip** `~/Downloads/GMW-all_v4112.zip` (~1.3 GB): **1,696** 1° GeoTIFFs, **41 Byte bands** (1985–2025), nodata `0`, mangrove `1`, ~0.000269°/px (~30 m). Read via GDAL `/vsizip/{zip}/file.tif` (no 3 GB extract).
- **Vanuatu file already used in reports:** `~/Downloads/globalMangroveWatch2018.tif.zip`. Name says global; the GeoTIFF is **not**. Extent **167–169°E, 16–18°S**, 8797 × 9199, **1 band Float32**, EPSG:3857, **~25.3 m/px**, ~612 KB on disk. Same GMW resolution family; a **coastal clip**. Overlay-engine only windows that 2° raster, so the rest of the Vanuatu EEZ is “no intersection” = 0 mangrove without being read. That is why geography stats feel cheap today.

### Approaches that failed (do not revive)

| Approach | Why it failed |
| --- | --- |
| Warp the tropics as one dense 3857 COG | Envelope is enormous; COG overviews asked for ~1 TB disk |
| `gdalbuildvrt` of 1,696 cells then warp the VRT | GDAL treats the VRT as one source and walks empty ocean |
| Per-tile `gdal_translate` from a 1,696-file mosaic VRT | ~4 s/tile; z0 overlaps every source |
| Per-cell warp + sparse XYZ cut in a bespoke tiler | Works for MRT encode but is not a sustainable ingest model |
| Encode MRT from a 1696-file VRT under 15 min Lambda | Wrong budget; analysis is not MRT |

### Approach that works for a **single raster**

```
gdalwarp -t_srs EPSG:4326|3857 -of GTiff \
  -co TILED=YES -co COMPRESS=DEFLATE -co SPARSE_OK=YES -co BIGTIFF=YES \
  -wo SKIP_NOSOURCE=YES -srcnodata 0 -dstnodata 0 \
  --optfile sources.optfile  gmw-global.tif
```

Four distant 1° cells: ~20 s, **36 MB** sparse 3857 GTiff, logical size still ~731k × 133k. Full globe: ~5 s/cell × 1,696 ≈ **2–3 hours**, expected **~10–20 GB** on disk (not 960 GB uncompressed cell pixels). Use `--optfile` so 1,696 paths do not hit `ARG_MAX`. **Do not** use `-of COG` with default overviews on this canvas.

MRT encode (display) can `gdal_translate -projwin` from that mosaic; that is a separate pipeline. Overlay-engine must not consume `.mrt`.

---

## Why geography stats blow up on a global file *today*

[packages/overlay-engine/src/geoblazeBandStats.ts](packages/overlay-engine/src/geoblazeBandStats.ts):

- `MAX_COLLECTED_PIXELS = 32e6` — above this, **stream** instead of `geoblaze.stats` (which builds a JS array of every value). Fiji EEZ **bathy** geography test is ~8.1e6 pixels on a **regional coarse** COG (`testing-fiji-bathy-3.tif`), under the collect limit.
- Streaming still, for a typical single EEZ polygon (`usedPercentage > 0.01`), calls **`raster.getValues` on the combined bbox** at native width/height, then scanline-masks the polygon. Histogram RAM is tiny; **the `sample` array is dense**, including ocean.
- Geography subjects default **`vrm: false`** in [packages/overlay-worker/src/overlay-worker.ts](packages/overlay-worker/src/overlay-worker.ts) (avoid VRM array blow-ups). That prevents upsampling; it does not downsample.

Against the Vanuatu **clip**, the raster bbox *is* 2° × 2° (~81M pixels max) — streaming’s intended scale.

Against a **global** 30 m COG, Vanuatu EEZ **intersects the raster extent**, so the window becomes the **EEZ bbox at 30 m** (mostly ocean). Sparse COG tiles are not downloaded, but `getValues` still tries to allocate width × height × bands.

**Correct mental model:** COG I/O is already tiled. Overlay-engine must **accumulate stats per COG tile**, not densify the subject envelope.

---

## Overlay-engine: tiled geography stats

### Goal

Vanuatu EEZ + global sparse GMW COG ≈ Vanuatu EEZ + `globalMangroveWatch2018.tif` for mangrove km² (plus any mangroves the 2° clip omitted). Fiji/Palau/Florida use the **same `sourceUrl`**. No OOM.

### Algorithm (new path)

1. `geoblaze.parse(sourceUrl)` / `GeoTIFF.fromUrl` once (access token as today).
2. Read tile size from the IFD (expect 512).
3. Enumerate tiles whose footprints intersect the **polygon** (not only bbox). Cheap AABB vs tile grid, then optional polygon test.
4. **Skip empty sparse tiles** (offset 0 / missing). That is the GMW “only coast” property.
5. For each remaining tile: Range-read that block only (~512 × 512 × bands bytes for Byte data). Mask with dufour-peyton (or existing scanline) **in tile CRS**. Histogram / area conversion unchanged (`pixelCountsToAreaKm2`, geodesic `groundPixelDimensionsMeters`).
6. Sum counts across tiles → existing `RasterOverlayAreaMetricValue`.

Peak RAM ≈ one tile × bands, not EEZ × 30 m. Tile count for Vanuatu ≈ tiles in the 2° clip, not tiles in the EEZ bbox.

Use this path when:

- subject is geography, or
- `estimatedCollectedPixels(window, vrm) > MAX_COLLECTED_PIXELS`, or
- raster width/height is huge (global canvas) even if the geography is small — **still tile-walk**; do not `getValues` a 10° window.

Keep `geoblaze.stats` for small fragment windows on regional COGs (current happy path).

### Files to change

- [packages/overlay-engine/src/geoblazeBandStats.ts](packages/overlay-engine/src/geoblazeBandStats.ts) — `forEachIntersectingPixel` / `streamBandStats`; add `forEachIntersectingCogTile`.
- [packages/overlay-engine/src/rasterOverlayArea.ts](packages/overlay-engine/src/rasterOverlayArea.ts) — stop throwing on multi-band **or** select a band; still histogram nodata via geoblaze/COG nodata.
- [packages/overlay-engine/src/rasterStats.ts](packages/overlay-engine/src/rasterStats.ts) — same reader for `raster_stats` geography.
- [packages/overlay-worker/src/overlay-worker.ts](packages/overlay-worker/src/overlay-worker.ts) — no API change if the engine picks the path internally; optional flag later.
- Tests: [packages/overlay-engine/__tests__/rasterOverlayArea.test.ts](packages/overlay-engine/__tests__/rasterOverlayArea.test.ts), [packages/overlay-engine/__tests__/geoblazeBandStats.test.ts](packages/overlay-engine/__tests__/geoblazeBandStats.test.ts), geography-stats / GFW regression as smoke (must not allocate EEZ-sized arrays).

### IFD spike (do first)

A 512² tiling of ~1.34M × 296k is ~1.5e6 tiles per IFD. `geotiff.js` must parse offsets on open. If that is hundreds of MB or multi-second, mitigate **in the file**, still one URL:

- larger block size (1024) to shrink the IFD
- GeoTIFF tiling + sparse; confirm `geotiff.fromUrl` uses ranged IFD reads
- optional **mask/overview inside the same COG** used only to skip empty tiles (not a second metric source)

### Bands / years (reporting)

Today [rasterOverlayArea.ts](packages/overlay-engine/src/rasterOverlayArea.ts) throws if `raster.maxs.length > 1`. Combining `raster_stats` fragments also rejects multiple bands.

Pick one (same `sourceUrl`):

- **A (smaller):** `MetricDependencyParameters.band` (1-based) or `when: "2018"`. Timeseries widget = 41 deps. Wasteful if PIXEL-interleaved (re-read tiles).
- **B (better for GMW):** one tile walk, histogram every band, `areasByWhen: { "1985": km², ... }` or a new metric type `raster_overlay_area_by_when`. Matches [temporal-data.md](docs/temporal-data/temporal-data.md) “bands instead of features.”

InlineMetric “latest year” / “mean 2015–2025” is widget config over B, not 41 TOC layers.

GDAL band descriptions / SeaSketch temporal metadata: band 1 = 1985, …, 41 = 2025. Ingest copies that onto the overlay source the same way other temporal sidecars will.

### Non-goals for this engine change

- Pointing overlay-engine at MRT
- Virtual resampling of geographies
- 1° COG index as `sourceUrl`s
- Rewriting fragment collar overlap math

---

## Repeatable GMW → sparse COG workflow

Workstation. Input: `GMW-all_v4112.zip` (or extracted dir). Output: one object on S3/R2 with HTTP Range (same hosting as other reporting COGs).

### 1. List sources

`unzip -Z -1` → `*_mng_ext.tif`. GDAL paths: `/vsizip/{/abs/path/GMW-all_v4112.zip}/GMW_N25W081_v4112_mng_ext.tif`.

### 2. Mosaic + warp in one `gdalwarp` (do not VRT-then-warp)

Write `gmw.optfile` (one arg per line): flags, then every vsizip path, then dest.

Recommended **analysis** CRS: **EPSG:4326** (native GMW, geodesic area already handled in overlay-engine). 3857 is acceptable (Vanuatu 2018 is 3857) but 4326 avoids a second mercator resample of the cube.

```
-overwrite
-t_srs
EPSG:4326
-r
near
-of
GTiff
-co
TILED=YES
-co
BLOCKXSIZE=512
-co
BLOCKYSIZE=512
-co
COMPRESS=DEFLATE
-co
SPARSE_OK=YES
-co
BIGTIFF=YES
-co
NUM_THREADS=ALL_CPUS
-wo
SKIP_NOSOURCE=YES
-srcnodata
0
-dstnodata
0
```

Then all sources, then `gmw-v4112.tif`.

Expect ~2–3 hours, ~10–20 GB. Re-run is idempotent if dest is replaced.

**Do not** `-of COG` with default overviews. Optional later: sparse overviews or a mask band in the **same** file if the IFD spike requires it.

Copy band metadata (years) with `gdal_edit` / PAM or write descriptions during warp if GDAL preserves them from the first source.

### 3. Validate before hosting

- `gdalinfo`: 41 bands, Byte, nodata 0, tiled, BigTIFF
- `gdal_translate -srcwin` a Vanuatu window; file size of that extract should be in the same ballpark as `globalMangroveWatch2018.tif` for one band
- `geoblaze.parse(file:// or http)` + small polygon (Florida Bay / Vanuatu 2°) — must not load GB
- Compare class-`1` km² on the 2018 clip vs band 2018 of the cube for the same sketch

### 4. Host

Same as other `REPORTING_COG` uploads: public or signed URL, **Accept-Ranges**, no gzip of the object (Range + gzip breaks readers). Overlay worker already attaches the overlay-engine access token query param.

### 5. Display derivative (optional, separate)

MRT z0–10 from the same mosaic for `raster-array` timeslider. Not required for overlay-engine. Encode can skip warp if the mosaic is already 3857; 4326 mosaic would still warp for MRT. Tile candidates should use data footprints (1° cells or COG tile index) so empty ocean XYZ is not spawned — that is an **encoder** optimization, not a second overlay source.

### 6. What not to automate on Lambda

This cube does not fit 5 GB `/tmp` or 15 minutes. Data Library “upload GMW zip” for analysis should be a documented workstation/batch job (or a fat EC2/Spot task), then register the COG URL. Small regional GMW clips can keep using the existing spatial-uploads COG path.

---

## Suggested implementation order

1. Finish or reuse a sparse mosaic locally; IFD + `geoblaze.parse` spike.
2. Tile-walk reader + unit tests on a **small** sparse mosaic (e.g. four 1° cells including Vanuatu-adjacent if present) vs `getValues` bbox (must match km², much less RAM).
3. Vanuatu EEZ parity: 2018 clip vs global cube band 2018.
4. Geography path wired for `raster_overlay_area` then `raster_stats`.
5. Band/`when` contract + a throwaway timeseries of 41 years on one Palau-sized polygon (latency budget).
6. Write the GDAL recipe into `packages/raster-array` or `packages/overlay-engine/scripts` once the file layout is proven — not into Lambda ingest.

---

## Open risks

- **geotiff.js vs million-tile IFD** — may need block size / IFD layout change; still one file.
- **PIXEL vs BAND interleave** — PIXEL makes a one-year query pay for 41 bands per tile; BAND/PLANAR is better if widgets usually request one year; PIXEL is better for one-pass timeseries.
- **Antimeridian EEZs** — existing GFW/Fiji 4326 work; tile walk must split tile ranges across the dateline the same way geographies already do.
- **Float32 vs Byte** — Vanuatu 2018 is Float32; v4.1 cells are Byte. Area of class `1` should still match after nodata handling.
