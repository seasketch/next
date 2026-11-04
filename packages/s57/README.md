# @seasketch/s57

Reads unencrypted NOAA S-57 cells, peels overlapping usage bands, and writes a PMTiles archive of Mapbox vector tiles. The chart style uses the S-52 day colours (shallow water is the saturated blue, deep water is the pale wash), italic soundings, and IALA-B buoy marks from `public/s57`.

SeaSketch's API calls `processEncFiles`. The demo is separate: it serves those tiles as `/{z}/{x}/{y}.mvt` and draws them with the same mapbox-gl 3.4 build the client uses.

```bash
# Cells live in .data/enc-fixtures/sb-channel (gitignored NOAA zips).
npm run chart --workspace @seasketch/s57
npm run demo --workspace @seasketch/s57
```

The demo is at http://localhost:4173. It is not for navigation.
