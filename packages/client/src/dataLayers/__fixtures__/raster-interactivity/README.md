# Raster interactivity fixtures

Pre-extracted PNG tiles from SeaSketch RGB-encoded rasters (PMTiles v3,
512×512 RGBA PNGs). No runtime PMTiles dependency — tests use PNG RGBA samples
and slim geostats JSON.

## Continuous Gray — GFW fishing effort

| File | Tile |
|------|------|
| `gfw-2-0-2.png` | z=2, x=0, y=2 |
| `gfw-3-0-4.png` | z=3, x=0, y=4 |

`gfw.geostats.json` / `gfw.samples.json` — encoding metadata and known
pixel RGB→value samples from `gfw-2-0-2.png`.

## Categorical Palette — NLCD land cover

Source archive: `274f98aa-4b68-4feb-bb09-91f233dc1c8a.pmtiles` (zooms 9–11,
Santa Barbara area). Byte-encoded (`byteEncoding: true`); category codes are
NLCD-style integers (11, 21, 22, …, 95).

| File | Tile |
|------|------|
| `nlcd-9-85-203.png` | z=9, x=85, y=203 |
| `nlcd-10-170-407.png` | z=10, x=170, y=407 |

`nlcd.geostats.json` / `nlcd.samples.json` — slim Palette geostats and known
pixel RGB→category samples from `nlcd-9-85-203.png`.
