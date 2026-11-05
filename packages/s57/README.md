# @seasketch/s57

Reads unencrypted NOAA S-57 cells, peels overlapping usage bands, and writes a PMTiles archive of Mapbox vector tiles. The chart style uses the S-52 day colours (shallow water is the saturated blue, deep water is the pale wash), italic soundings, and IALA-B buoy marks from `public/s57`.

SeaSketch's API calls `processEncFiles`. The demo is separate: it serves those tiles as `/{z}/{x}/{y}.mvt` and draws them with the same mapbox-gl 3.4 build the client uses.

```bash
# Downloads the NOAA cells for the Santa Barbara Channel into
# .data/enc-fixtures/sb-channel (gitignored), then builds the tiles.
npm run chart --workspace @seasketch/s57
npm run demo --workspace @seasketch/s57
```

`npm run fetch --workspace @seasketch/s57` downloads the cells and stops. The chart command does that itself when the zips are missing. Cells already the size NOAA published are kept. The catalog is [charts.noaa.gov/ENCs/ENCProdCat.xml](https://charts.noaa.gov/ENCs/ENCProdCat.xml).

The build needs `ogr2ogr` and `tippecanoe` on `PATH`. Coverage peeling uses the `gdal-async` package, which brings its own GDAL, so Python and the `osgeo` module are not required. Run `npm install` at the repo root after pulling so that package is linked.

The demo is at http://localhost:4173. It is not for navigation.
