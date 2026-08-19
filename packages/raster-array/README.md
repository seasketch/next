# @seasketch/raster-array

Isolated proof of concept: take a multi-band GeoTIFF or NetCDF and write **Mapbox Raster Tiles (MRT)** that Mapbox GL JS 3.1+ can consume as a `raster-array` source. Nothing here is wired into the SeaSketch client, API, or `spatial-uploads-handler`.

SeaSketch already keeps original uploads plus a canonical COG. MRT is a *display derivative*, the same role PMTiles plays for single-band rasters today. The encoder targets the MRT v1 decoder in `mapbox-gl-js` 3.4 (`src/data/mrt/`), not a published interchange spec. TileJSON includes `format: "mrt"` to match Mapbox-hosted raster-array tilesets. Offset/scale are protobuf **floats on fields 5/6**, which is what GL JS 3.4 actually reads.

## Why this exists

The 42-band (here: GMW v4.1 **41-year** 1985–2025) mangrove cube and CRW-style NetCDFs need one tileset whose years are `raster-array-band` values, so a timeslider does not swap sources. See `design-docs/temporal-data/temporal-data.md` and the rollout plan in `design-docs/temporal-data/mrt-and-raster-array.md`.

Local rasters, mosaics, and encoded tiles (`fixtures/`, `demos/tiles/`) are gitignored. Rebuild with `npm run fixtures` (GDAL; GMW samples need `~/Downloads/GMW-all_v4112.zip`) or point the globe demo at the public R2 prefix. Unit tests do not need those files.

## Pipeline

```
GeoTIFF / NetCDF  (or a mosaic of many GeoTIFFs — see GMW below)
    → gdal_translate (NetCDF subdataset → GeoTIFF, same as spatial-uploads-handler)
    → gdalwarp to a tiled sparse EPSG:3857 GeoTIFF
    → per XYZ tile: gdal_translate -projwin -of ENVI
    → gzip(protobuf uint32 samples) inside an MRT v1 container
    → {z}/{x}/{y}.mrt + TileJSON
```

Heavy lifting is GDAL CLI (`gdalinfo`, `gdalwarp`, `gdal_translate`, `gdalbuildvrt`) — the same tools `spatial-uploads-handler` uses in production. There is no `gdal-async` binding; Node 18 on this machine could not build it. Pixel values are quantized as:

```
value = offset + scale * code
code  = 2^32 - 1  → NoData
```

By default every band of a tile is one gzipped block, so the first Range request pulls the whole time series for that `z/x/y` and band switches are local. `--bands-per-block 1` emits one block per year instead.

## Commands

From `packages/raster-array`:

```bash
npm test
npm run fixtures          # synthetic rasters + GMW sample tiles → demos/tiles
npm run gmw:global        # mosaic GMW zip → one GeoTIFF, then encode z0–11
npm run gmw:global -- --minzoom 11 --maxzoom 11 --keep-existing
                          # add z11 onto an existing z0–10 tileset
npm run demo              # http://127.0.0.1:8765
```

Encode anything:

```bash
npx tsx src/cli.ts encode path/to/stack.tif ./out \
  --layer mangroves --start-year 1985 --maxzoom 11 --resampling near

npx tsx src/cli.ts inspect ./out/8/72/110.mrt
```

The demo server reads the Mapbox token from `packages/client/.env` (`REACT_APP_MAPBOX_ACCESS_TOKEN`). It answers HTTP Range requests on `.mrt` files (GL JS probes the first 16 KB of each tile, then fetches gzip blocks). Oversize `Range` ends are clamped to the file length so small tiles do not 416.

## Demos

| Page | What it tests |
| --- | --- |
| `/` | Index |
| `/mangrove.html` | GMW Florida / Sundarbans / Borneo + synthetic fallback, slider, hover query |
| `/gmw-global.html` | **All 1,696 GMW cells** as one mosaic, then the same encoder, z0–11 |
| `/sst.html` | NetCDF → continuous `raster-color` |
| `/blocks.html` | All-bands-in-one-block vs one-band-per-block (watch Range requests) |
| `/official.html` | Mapbox-hosted GFS temperature (control) |

## GMW test data

`~/Downloads/GMW-all_v4112.zip` — 1° tiles, **41 Byte bands**, nodata 0, mangrove = 1. Band 1 is 1985. The fixture script mosaics Florida Bay (`N25W081`+`N26W081`), Sundarbans, and a Borneo tile.

The globe demo is the same encoder as everything else. A workstation first combines the zip into **one** sparse Web Mercator GeoTIFF (logical size is the tropical envelope; `SPARSE_OK` keeps it on the order of the source cells, ~10–20 GB). That file is then `encode`d like any other raster. This will not fit on the upload Lambda (15 min / 5 GB `/tmp`); it is a repeatable local command:

```bash
npm run gmw:global                  # mosaic if missing, then tiles → demos/tiles/gmw-global
npm run gmw:global -- --mosaic-only
npm run gmw:global -- --rebuild-mosaic
npm run gmw:global -- --minzoom 11 --maxzoom 11 --keep-existing
```

`gdalwarp` of a *VRT of the union bbox* walks the empty ocean and will try to build terabyte overviews. The mosaic step therefore passes every cell as a `gdalwarp` source with `SKIP_NOSOURCE` and writes a GTiff (`SPARSE_OK`, no COG overviews). Tile candidates use the 1° cell footprints so we do not spawn GDAL for empty ocean inside the envelope (z0–11 from cell footprints; the envelope alone is hundreds of thousands of tiles). `--keep-existing` encodes only the requested zoom range into an existing folder and keeps TileJSON `minzoom` at 0. Stats: `demos/tiles/gmw-global/encode-stats.json`. Mosaic: `fixtures/gmw-global/gmw-global.3857.tif` (gitignored).
