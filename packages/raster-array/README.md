# @seasketch/raster-array

Library and CLI for encoding multi-band GeoTIFF or NetCDF as Mapbox Raster
Tiles (MRT) and packing a scratch `{z}/{x}/{y}.mrt` tree into one PMTiles
archive. Used by `packages/data-library-gmw` and (later) overlay ingest.

```bash
npm test

npx tsx src/cli.ts encode path/to/stack.tif ./out \
  --layer mangroves --start-year 1985 --maxzoom 11 --resampling near --pmtiles

npx tsx src/cli.ts pack ./out ./out.pmtiles
npx tsx src/cli.ts inspect ./out/8/72/110.mrt
npx tsx src/cli.ts inspect ./out.pmtiles 8 72 110
```

The encode directory is scratch. The product is the `.pmtiles` archive.
Globe GMW encode and its viewer live in `packages/data-library-gmw`.
