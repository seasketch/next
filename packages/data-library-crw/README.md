# @seasketch/data-library-crw

Workstation job that builds NOAA Coral Reef Watch MRT PMTiles archives for the
Data Library. Annual products use one band per year. Daily DHW is a separate
archive covering the last 365 days.

| Product | Statistic | Periods | Archive | Size (v1) |
| --- | --- | --- | --- | --- |
| Degree Heating Week | annual max | 1986–present | `dataLibrary/crw-dhw-max-v1.pmtiles` | 389 MB |
| Degree Heating Week | annual max, 0.1 °C-weeks | 1986–present | `dataLibrary/crw-dhw-max-q-v1.pmtiles` | 244 MB |
| Degree Heating Week | daily | last 365 days | `dataLibrary/crw-dhw-daily-v1.pmtiles` | 1.4 GB |
| Degree Heating Week | weekly samples | last 52 weeks | `dataLibrary/crw-dhw-weekly-v1.pmtiles` | 202 MB |
| Degree Heating Week | weekly, ~100 KB blocks | last 52 weeks | `dataLibrary/crw-dhw-weekly-b-v1.pmtiles` | 202 MB |
| Degree Heating Week | weekly, ~100 KB blocks | 1986–present | `dataLibrary/crw-dhw-weekly-all-v1.pmtiles` | 4.6 GB |
| Degree Heating Week | weekly, ~128 KB blocks | last 24 months | `dataLibrary/crw-dhw-weekly-24-v1.pmtiles` | 376 MB |
| Bleaching Alert Area | annual max | 1986–present | `dataLibrary/crw-baa-max-v1.pmtiles` | 54 MB |
| Bleaching Alert Area | weekly samples | last 24 months | `dataLibrary/crw-baa-weekly-24-v1.pmtiles` | 83 MB |
| SST Anomaly | annual mean | 1985–present | `dataLibrary/crw-ssta-mean-v1.pmtiles` | 362 MB |
| SST Anomaly | weekly samples | last 24 months | `dataLibrary/crw-ssta-weekly-24-v1.pmtiles` | 1.0 GB |
| SST (CoralTemp) | annual mean | 1985–present | `dataLibrary/crw-sst-mean-v1.pmtiles` | 499 MB |
| SST (CoralTemp) | weekly samples | last 24 months | `dataLibrary/crw-sst-weekly-24-v1.pmtiles` | 1.0 GB |

Native resolution of the 5 km source is about zoom 5. Tiles are packed to
**z0–5** with bands grouped into Range-addressable gzip blocks (8 per block
for annual products, 30 for daily DHW; BAA packs each tile as one block).
One fetch pulls a block of adjacent periods, so scrubbing the timeslider does
not issue a request per band per tile. Blocks are also the unit of
mapbox-gl's decoded-band LRU (30 blocks per tile), so keeping a product at or
under 30 blocks lets a full timeline pass stay decoded. All products encode
with spatial `delta`+`zigzag` MRT filters (inverted natively by mapbox-gl),
and daily DHW quantizes to 0.1 °C-weeks — together ~2.4× smaller than the
naive encoding. Tiles are served with exact Range responses (partial mode):
a viewport downloads one ~180 KB block per tile up front, not whole multi-MB
tiles.
Each year is warped to EPSG:3857 on its own, then stacked with a VRT — a
single 40-band mosaic is too slow to cut tiles from.

The job does **not** write production `data_sources` rows. After the archive is
on R2, a SeaSketch admin registers it through the superuser Versioning UI.

## Prerequisites

- GDAL CLI (`gdalinfo`, `gdal_translate`, `gdalwarp`, `gdalbuildvrt`) with the
  **netCDF** driver (not HDF5-only — local `.nc` files need CF georeferencing)
- Network access to NOAA CRW
  `…/nc/v1.0/annual/` and `…/nc/v1.0/daily/dhw/<year>/`

## Commands

```bash
cd packages/data-library-crw

# Degree Heating Week (annual max) end-to-end
npm run build -- --product dhw-max

# Daily DHW for the last 365 days (separate archive)
npm run build -- --product dhw-daily

# Or step by step
npm run download -- --product dhw-max
npm run stack -- --product dhw-max
npm run encode -- --product dhw-max
npm run pack -- --product dhw-max
npm run runbook -- --product dhw-max
npm run verify -- --product dhw-max
```

`--product all` (or a comma list) builds every layer. `--start-year` /
`--end-year` override the annual range. `--start-date` / `--end-date` override
the daily window (default: yesterday UTC, 365 days). Daily downloads skip a 404
(today’s file is often unpublished).

Outputs land in `work/`. The packed archive is `work/dist/crw-<product>-v1.pmtiles`.

## Local demo

```bash
npm run demo   # http://127.0.0.1:8767/
```

The page can use a local `work/dist/crw-*-v1.pmtiles` or
`https://tiles.seasketch.org/dataLibrary/crw-*-v1`. The Mapbox token comes from
`packages/client/.env`.

## Upload

One PUT per product to `ssn-tiles` (not a `{z}/{x}/{y}` tree):

```bash
npm run upload -- --product dhw-max
```

Uses `R2_ENDPOINT` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` from the
environment or `packages/api/.env`. Falls back to
`wrangler r2 object put` against `packages/pmtiles-server/wrangler.toml`.
Refuses to overwrite an existing key unless `--force` is passed.

Public URLs after upload:

```
https://tiles.seasketch.org/dataLibrary/crw-dhw-max-v1.json
https://tiles.seasketch.org/dataLibrary/crw-dhw-max-v1/{z}/{x}/{y}.mrt
```
