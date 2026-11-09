# @seasketch/s57

Reads unencrypted NOAA S-57 cells, peels overlapping usage bands, and writes Mapbox vector tiles as one PMTiles archive per chart scale (`small`, `coastal`, `approach`, `harbour`). Each archive is cut only as deep as its charts, and the style overzooms it past that, which keeps a large catalog from filling zoom 16 with open ocean. The chart style uses the S-52 day colours (shallow water is the saturated blue, deep water is the pale wash), italic soundings, and IALA-B buoy marks from `public/s57`.

SeaSketch's API calls `processEncFiles`. The demo is separate: it serves those tiles as `/tiles/{archive}/{z}/{x}/{y}.mvt` and draws them with the same mapbox-gl 3.4 build the client uses.

```bash
# Downloads the NOAA cells for the Santa Barbara Channel into
# .data/enc-fixtures/sb-channel (gitignored), then builds the tiles.
npm run chart --workspace @seasketch/s57
npm run demo --workspace @seasketch/s57
```

The same commands take a region. `california` is the state coast out to 200 nautical miles. `hawaii` is the main islands. `florida-east` is the Atlantic coast from the St. Marys River to Biscayne Bay, also out to 200 nautical miles. With no region, the chart is the Santa Barbara Channel. The demo serves every region that has been built and switches among them.

```bash
npm run chart --workspace @seasketch/s57 -- california
npm run chart --workspace @seasketch/s57 -- hawaii
npm run chart --workspace @seasketch/s57 -- florida-east
```

`npm run fetch --workspace @seasketch/s57 -- hawaii` downloads that region's cells and stops. The chart command does that itself when the zips are missing. Cells already the size NOAA published are kept, including a copy already downloaded for another region. The catalog is [charts.noaa.gov/ENCs/ENCProdCat.xml](https://charts.noaa.gov/ENCs/ENCProdCat.xml).

The build needs `ogr2ogr` and `tippecanoe` on `PATH`. Coverage peeling uses the `gdal-async` package, which brings its own GDAL, so Python and the `osgeo` module are not required. Run `npm install` at the repo root after pulling so that package is linked.

The demo is at http://localhost:4173. It is not for navigation.

`npm run site --workspace @seasketch/s57` copies whatever regions have been built into `site/charts` and writes a static viewer to `site/dist`. That folder is what the hosted chart publishes. Harbour archives are cut at zoom 14 and approach archives at zoom 13 so the published pack stays under the hosting size limit; the map overzooms the last tile. The local demo is unchanged and still builds the full zoom range. Mapbox GL 3.4 cannot read PMTiles itself, so the page's service worker answers the same `/tiles/.../*.mvt` requests the local demo serves. Rebuild and publish the site again after a style or tile change.
