# @seasketch/data-library-gmw

Workstation job that builds the two Global Mangrove Watch Data Library products:

1. **`gmw-global.pmtiles`** — MRT v1 tiles in one PMTiles archive (map display)
2. **`analysis.tif`** — sparse **EPSG:4326** GeoTIFF (source CRS), bands as years (overlay engine)

It does **not** write production `data_sources` rows. After the files are on R2, a SeaSketch admin registers them through the superuser Versioning UI.

Notes on a later daily-check / ECS-or-EC2 run: [gmw-ecs-orchestration.md](../../design-docs/temporal-data/gmw-ecs-orchestration.md).

## How encode stays fast

The old path mosaiced 1,696 cells into one 1.3M-wide GeoTIFF, then spawned `gdal_translate` for every XYZ candidate that touched a 1° footprint (~336k tiles, ~20 hours). ~89% of those windows were empty ocean.

The job now:

1. **Occupancy** — downsample each 1° cell (`-r max`, uses the existing overviews) and keep only XYZ tiles that actually have mangrove in some year.
2. **Warp cells once** — each 1° GeoTIFF → a tiled EPSG:3857 sibling under `work/cells-3857/`.
3. **Encode** — `gdal_translate -projwin` from those warped cells (same CRS). Pack PMTiles at the end of `build`.
4. **Analysis** — same-CRS `gdalwarp` of the 1° cells **in EPSG:4326** (`SKIP_NOSOURCE`, no `-t_srs`). Do not warp to 3857. Display tiles still use the per-cell 3857 warp.

The day-long z0–12 tree at `packages/raster-array/demos/tiles/gmw-global` is left alone. A copy is at `gmw-global.preserved-z0-12`. This package writes only under `work/`.

## Prerequisites

- GDAL CLI (`gdalwarp`, `gdal_translate`, `gdalinfo`)
- Extracted cells in `~/Downloads/GMW-all_v4112/` (preferred) or the zip

## Commands

```bash
cd packages/data-library-gmw

# Occupancy + encode + pack + analysis + runbook
npm run build -- --release v4.1.2

# Or step by step
npm run occupancy
npm run warp
npm run encode -- --keep-existing
npm run pack
npm run analysis
npm run runbook -- --release v4.1.2
```

`--keep-existing` skips tiles already on disk so a run can resume. Outputs land in `work/dist/`.

## Local globe demo

```bash
npm run demo   # http://127.0.0.1:8765/gmw-global.html
```

The page can use the local `work/dist/gmw-global.pmtiles` or `https://tiles.seasketch.org/dataLibrary/gmw-global`. The Mapbox token comes from `packages/client/.env`. Legend stats are file size and zoom from the local archive only.

To pack the preserved day-long fixture without re-encoding:

```bash
npm run pack -- --scratch ../raster-array/demos/tiles/gmw-global.preserved-z0-12
```

## Upload

Two PUTs to `ssn-tiles` (not a `{z}/{x}/{y}` tree):

```
dataLibrary/gmw-global.pmtiles
dataLibrary/GLOBAL_MANGROVE_WATCH/{release}/analysis.tif
```

Then open the runbook and register those URLs on the superuser GMW layer.

## Analysis raster

`analysis.tif` is a tiled sparse GeoTIFF in **EPSG:4326**, mosaiced from the source 1° cells with no reprojection. Do not `gdal_translate -of COG` the tropical envelope without care — that can densify empty ocean. The 3857 fixture under `raster-array/fixtures` is display-only; analysis must not fall back to it.
