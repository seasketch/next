# Maintaining `@seasketch/h3-land`

This package builds the land-occupancy archive described in [README.md](./README.md). The range-request client is `src/client.ts`, exported as `@seasketch/h3-land/client`. `viewer/index.html` is a separate in-browser reader, and `OccupancyArchive` in `src/format.ts` answers `state` from a buffer that is already in memory.

## Products

Two files, both gitignored under `data/`:

| File | Role |
| --- | --- |
| `data/land-res8.sqlite` | Flat classification at resolution 8. One row per non-water cell. |
| `data/land-res8.h3ld` | Published resolution-8 archive. |
| `data/land-res9.sqlite` | Two-pass classification: sealed resolution-7 cells plus `fine` rows at resolution 9. |
| `data/land-res9.h3ld` | Published resolution-9 archive. |

The land polygons are `data/land-big-2.fgb` (about 1.2 GB, ~1,026,785 polygons), the same file served at `https://uploads.seasketch.org/land-big-2.fgb`. The shapes are subdivided and do not overlap. A cell can still sit on more than one piece, and those pieces must be unioned before the cell is called land.

Published archives:

```
r2://ssn-tiles/h3-land/v1/land-res8.h3ld
r2://ssn-tiles/h3-land/v1/land-res9.h3ld
https://tiles.seasketch.org/h3-land/v1/land-res8.h3ld
https://tiles.seasketch.org/h3-land/v1/land-res9.h3ld
```

The tiles worker serves that key as a public object with range requests. Its cache header is immutable for a year. Put a different build on a new key.

Resolution 9 is a second pass on top of resolution 7. Cells fully inside one land piece are stored once, at resolution 7, and every finer descendant is land. Only mixed resolution-7 cells get resolution-9 rows, in the `fine` table. The archive format does not change: pack paints those sealed descendants into the resolution-4 records. Keep the resolution-8 SQLite. It is a separate flat build.

## Commands

From `packages/h3-land`, Node 22.13 or newer. `node:sqlite` is built in. H3 indexes do not fit in a JavaScript number on Node 22.16, so reads use two 32-bit halves or `printf('%x', h3)`.

```sh
npm run cli -- generate \
  --input data/land-big-2.fgb \
  --output data/land-res8.sqlite

npm run cli -- stats --output data/land-res8.sqlite

npm run cli -- pack \
  --input data/land-res8.sqlite \
  --output data/land-res8.h3ld
```

`generate` accepts `--resolution`, `--epsilon`, `--bbox w,s,e,n`, `--limit`, `--commit-every`, and `--restart`. The same command resumes. The cursor is `meta.next_feature`. A feature that throws is not committed, so the rerun retries it. `--limit` stops without finalizing. `stats` reports `finalized: true` when the run is done.

`pack` refuses a database whose `meta.finalized` is not `1`. It reads `meta.resolution` and writes that fine resolution into the archive header. The first pass counts children per resolution-4 parent. Uniform land parents are kept as a count. The second pass stores positions only for mixed parents.

Upload from `packages/pmtiles-server`, which has Wrangler authenticated:

```sh
npx wrangler r2 object put ssn-tiles/h3-land/v1/land-res8.h3ld \
  --file=../h3-land/data/land-res8.h3ld \
  --content-type=application/octet-stream \
  --remote

npx wrangler r2 object put ssn-tiles/h3-land/v1/land-res9.h3ld \
  --file=../h3-land/data/land-res9.h3ld \
  --content-type=application/octet-stream \
  --remote
```

`npm run viewer` serves this package on port 8765. The map is `viewer/index.html`. `?url=` points it at another archive.

## Classification

`measureGeometry` in `src/classify.ts` runs h3’s `polygonToCellsExperimental` twice per polygon part.

- `containmentFull` cells are entirely inside that piece. They are land immediately. A neighboring piece is not required.
- `containmentOverlapping` cells that were not full contribute intersection area. `src/coverage.ts` clips the ring to the hex in a local equirectangular frame (Earth radius 6,371,008.8 m) and subtracts holes. The ratio is consistent because the hex area uses the same frame.
- Touches of 1 m² or less are ignored. Coverage that reaches 99.9% of the cell (`DEFAULT_COVER_EPSILON`) promotes the cell to land. A cover more than 1% over the cell area is still land and increments `oversize_count`.
- Pieces are accumulated in `LandStore`. A cell that is only partly covered by each of several subdivision neighbors becomes land when the areas sum. That is the case the epsilon exists for: a numerical sliver on a shared edge, not a channel.

Other geometry types throw. The generator commits every 100 polygons or 100,000 cells, and commits a larger polygon on its own. Water cells are absent from `cells`.

While a run is open, unresolved boundary area lives in the `partial` table and is reloaded on resume. `finalize` promotes or stores those rows into `cells`, deletes `partial`, and sets `finalized` when `failure_count` is 0.

## SQLite

```sql
meta(key TEXT PRIMARY KEY, value TEXT)
cells(h3 INTEGER PRIMARY KEY, state INTEGER) WITHOUT ROWID  -- 1 partial, 2 entire
partial(h3 INTEGER PRIMARY KEY, cover_m2 REAL)              -- only during a run
failures(feature_index INTEGER PRIMARY KEY, message TEXT)
```

`meta` records the input path, resolution, epsilon, bbox, generator version, and the counts. Resume refuses to continue when those parameters differ. `--restart` deletes the database and its `-wal` / `-shm` files.

`stats` trusts the meta counts. It does not `COUNT(*)` the cells table.

## Archive

`src/format.ts` is the layout. Header, then planes 0–4, then records. States are 0 water, 1 mixed, 2 land, four cells per byte, low bits first.

Rank within a resolution is `prefix[baseCell] + cellToChildPos(cell, 0)`, with the pentagon child count `1 + 5 * (7^res - 1) / 6`. `buildRankTables` checks the totals against `getNumCells`.

`parentAtCoarse` rewrites the H3 integer: resolution field set to 4, digits finer than 4 set to 7. `childPosition` is those digits read as base 7. Cells under a resolution-4 pentagon (digits 1–4 are 0 and the base cell is a pentagon) go through `cellToChildPos` instead, because the pentagon numbering is not raw base 7.

A resolution-4 parent is land when it has every expected child and every child is land (2,401, or 2,001 under a pentagon at resolution 8). Otherwise it is mixed and gets a record, indexed by `cellToChildPos(cell, 4)`. Coarser planes are the same rule rolled up from the resolution-4 states. `OccupancyArchive.open` checks magic, version, slot count, stride, and that the mixed count matches the coarse plane.

Resolution 8 numbers from the published file: 196,961,827 land cells, 1,837,466 mixed cells, 75,903 land parents, 16,001 mixed parents, 196,218 water parents, 9,700,684 bytes.

## Code

| Path | Role |
| --- | --- |
| `src/cli.ts` | `generate`, `stats`, `pack` |
| `src/generate.ts` | Stream the FlatGeobuf. Above resolution 7, seal then refine |
| `src/readFlatGeobuf.ts` | Sequential read. The R-tree is not used. |
| `src/classify.ts` | Full versus overlapping cells, area union |
| `src/coverage.ts` | Hex area and polygon intersection in meters |
| `src/db.ts` | SQLite schema, transactions, resume |
| `src/h3int.ts` | H3 index as `bigint` |
| `src/format.ts` | Archive encode and in-memory `state` |
| `src/pack.ts` | Pack flat `cells`, or sealed resolution-7 cells plus `fine` |
| `src/constants.ts` | State values, epsilon, default resolution 8 |
| `viewer/index.html` | Mapbox view. Range-reads the archive. |

Tests live in `src/__tests__/`. `format.test.ts` checks rank, the subdivision-union round trip through SQLite, pentagon child positions, and a resolution-9 cell. `classify.test.ts` and `coverage.test.ts` check the area rules, including two rectangles that only cover a cell together.

`npm test` and `npm run build` (`tsc`) are the checks. The viewer is not in the TypeScript build.

## Resolution 9

```sh
node --max-old-space-size=16384 --disable-warning=ExperimentalWarning dist/cli.js generate \
  --resolution 9 \
  --input data/land-big-2.fgb \
  --output data/land-res9.sqlite
```

The command runs two passes over the FlatGeobuf. Pass one classifies resolution 7. A cell H3 reports as fully contained is sealed. Overlapping cells, including ones that are 99.9% covered, stay mixed. Pass two clips each polygon to those mixed cells and measures their resolution-9 children. `meta.phase` is `coarse`, then `refine`, then `done`. Resume uses the same command; the cursor resets at the start of the refine pass.

`pack` reads `meta.base_resolution`. A resolution-4 cell whose every resolution-7 child is sealed becomes uniform land. Mixed resolution-4 cells get a record: sealed resolution-7 blocks are filled as land, and `fine` rows supply the coastline. The resolution-9 archive is published at `h3-land/v1/land-res9.h3ld`. Do not replace `land-res8.h3ld`.
