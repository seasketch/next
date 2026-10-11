# Water-path performance

Measured 7 October 2026 on an Apple M1 Pro (10 cores, 32 GB), from a local Node process against the R2 files the overlay worker uses. Wall times include the network. CPU time is `process.cpuUsage` for that call (user + system), so it excludes time spent waiting on the socket. A Lambda next to the bucket will spend less time waiting; the byte counts and the CPU split will not change.

The tables through "Hierarchical router" are the tangent search, the hex-grid search (`algorithm: "h3"`), and the hierarchical search (`algorithm: "hierarchy"`). As of 8 October 2026 the default is the occupancy search (`ACTIVE_WATER_PATH_ALGORITHM = "occupancy"`), measured in the last section. The other three stay callable. All four read the same two FlatGeobuf files:

- Land: `https://uploads.seasketch.org/land-big-2.fgb`. Spatial index 43,809,560 bytes.
- Ports: `https://uploads.seasketch.org/testing-world-ports.fgb`. Spatial index 154,920 bytes.

These numbers are the product default: 200 miles (321.9 km) and the closest 3 ports. An earlier pass on this machine used 40–180 km disks and 5 MB pages with no feature-page cache. That pass is what the three changes below were aimed at. The comparison is in the last section.

## What changed

The tables below were measured while a feature-page cache lived inside `fgb-source`. That cache was removed. Range caching belongs in the caller's `fetchRangeFn`. The overlay worker already does this. `SourceCache` keeps one source per URL again. Distance-to-shore and the water-path metric both open the land file at 1 MB pages, so they share that source. The unit tests use `fgb-source`'s default page size, which is also 1 MB.

What the October measurements actually changed:

1. **Feature pages were cached on the FlatGeobuf source**, keyed by the exact byte range, with in-flight reads shared. A buffer larger than the cache was not stored. Header and index reads stayed outside that cache. `SourceCache` kept a separate source when the same URL was opened at a different page size. None of that remains in `fgb-source`.
2. **The water-path worker opened land and ports at 1 MB pages** with a 256 MB page cache on the source. At the time of these tables, distance-to-shore still requested 5 MB pages. It now requests 1 MB as well.
3. **`hits` does less work per segment.** Shore edges sit in 2 km cells instead of 8 km, and a stamp array replaces the per-call set. Land containment uses the same grid. Graph links, which join offshore hull vertices, skip the interior point-in-polygon samples; a crossing there has to meet a shore edge. Departure links skip those samples too. The finished route is still sampled. A long segment walks the cells it crosses instead of every cell in its bounding box. Short edges still scan the box.

## What is slow now

On the tangent router, one Fiji search is about 2 s once the pages are in memory, and about 3.6 s the first time those pages are downloaded. Building the visibility graph is 0.5–0.9 s. Linking the sketch and the three ports onto that graph (`navigate`) is 1.0–1.8 s. Clipping and offsetting the coast is under 170 ms. Shortening the finished line is under 15 ms.

The hex router no longer re-downloads the same page for every res-6 cell. A Fiji sketch is 8–11 s, almost all CPU (11,000–14,000 expansions, 53,000–65,000 land-segment tests). The download is the same 7.3 MB the tangent router fetches once.

Opening the land index is still once per source: 44.0 MB, 2.2 s of wall time, 0.5 s of CPU. The ports index is inside that same open (four requests total). Later sketches on those source objects do not pay it again.

## How a read worked in these measurements

`createSource` requests `[0, 32KB]`, then, because the land index does not fit, requests `[0, index end]` again. Those two responses are the 43.8 MB above.

A feature query groups R-tree hits into 1 MB pages. `getFeaturesAsync` asks the source for each page. During these measurements the first request downloaded the page and stored the bytes, and a later query reused that buffer. That store was the `fgb-source` cache that has since been removed. Three page reads ran at a time.

`estimatedBytes.requested` on the query plan is still not a usable size. `bytesForPage` overwrites a known range end with `start + 1200` whenever the range already has an end. The numbers below are the HTTP bodies.

## Tangent router, 200 miles, 3 ports, 1 MB pages

Land and ports load together. Load time is the slower of the two. The first Fiji sketch downloads the pages; the other four Fiji sketches are cache hits on the same source. Wallis, Gull Island, and the Golden Gate do not overlap that disk, so each pays for its own pages. Graph time is `buildNavGraph`. Navigate time is every `navigate` call for that sketch, including departure and arrival clearance, not just the heap.

| Sketch | Matches | Wall | CPU | Downloaded | Requests | Land / ports | Scene | Graph | Navigate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Port test | 3 | 3.57 s | 2.56 s | 7.3 MB | 7 | 1,451 / 5 | 60 ms | 0.80 s | 1.84 s |
| West of the dateline | 3 | 2.03 s | 2.09 s | 0 | 0 | 1,475 / 5 | 50 ms | 0.55 s | 1.36 s |
| East of the dateline | 3 | 1.98 s | 2.06 s | 0 | 0 | 1,432 / 5 | 51 ms | 0.54 s | 1.29 s |
| Straddling the antimeridian | 3 | 2.10 s | 2.08 s | 0 | 0 | 1,469 / 5 | 45 ms | 0.56 s | 1.42 s |
| Natewa Bay | 3 | 2.04 s | 2.02 s | 0 | 0 | 1,473 / 5 | 44 ms | 0.53 s | 1.38 s |
| Gull Island | 3 | 2.46 s | 2.24 s | 3.1 MB | 3 | 1,100 / 22 | 28 ms | 0.67 s | 1.45 s |
| Golden Gate | 3 | 2.25 s | 2.21 s | 2.1 MB | 2 | 1,213 / 36 | 170 ms | 0.90 s | 0.97 s |
| Wallis | 1 | 0.11 s | 0.06 s | 2.0 MB | 2 | 77 / 1 | 4 ms | 11 ms | 16 ms |

A Fiji disk at this radius is about 1,400 obstacles, 11,000 nodes, and 31,000 graph links. That is roughly twice the obstacles and four times the links of the old 120–180 km disks. Graph time did not grow with that; it dropped, because most links are short shore edges and those now hit a 2 km cell instead of an 8 km one. Navigate grew. It tests a tangent from the sketch to every offshore hull in the disk, and several of the third-place ports (Levuka, Suva) are only reached by one of those long tangents. Dropping the long tangents cuts navigate to about 0.15 s and also drops those ports, so they stay.

Wallis has one port inside 200 miles. The other sketches return three. The routes are the same lengths as the smaller-radius runs: the closest three harbors were already inside the old limits. The extra time is the larger coastline, not a longer winning path.

## Hex-grid router, same limit, same pages

The hex search still runs a bbox query per res-6 parent. Parsed features were already cached per cell. For these runs, pages were cached on the source too, so a Fiji sketch downloaded 7.3 MB once instead of about 1.6 GB. Later Fiji sketches on the same source downloaded nothing. That page cache is no longer in `fgb-source`.

| Sketch | Matches | Wall | CPU | Downloaded | Requests | Expansions | Land-segment tests |
|---|---:|---:|---:|---:|---:|---:|---:|
| Port test | 3 | 11.1 s | 9.4 s | 7.3 MB | 7 | 12,902 | 61,805 |
| West of the dateline | 3 | 7.8 s | 8.0 s | 0 | 0 | 11,329 | 55,979 |
| East of the dateline | 3 | 9.0 s | 8.8 s | 0 | 0 | 13,624 | 64,460 |
| Straddling the antimeridian | 3 | 9.5 s | 9.6 s | 0 | 0 | 13,639 | 64,623 |
| Natewa Bay | 3 | 9.6 s | 8.2 s | 0 | 0 | 11,073 | 53,345 |
| Gull Island | 3 | 4.2 s | 2.0 s | 1.0 MB | 1 | 1,510 | 7,596 |
| Golden Gate | 3 | 1.9 s | 0.90 s | 1.1 MB | 1 | 473 | 2,835 |
| Wallis | 1 | 2.1 s | 0.82 s | 2.0 MB | 2 | 957 | 3,835 |

CPU is lower than the old 14–22 s on the smaller disks even though the disk is larger, because the repeated GeoJSON parses of the same page are gone with the repeated downloads. The remaining time is the hex walk itself. The tangent router does the same coastline once, in about 2 s. The first hex result on the dateline sketch is still Savusavu Bay, at 81.3 km.

## Where the time went compared with the first pass

| | First pass | This pass |
|---|---|---|
| Radius / results | 40–180 km, usually 1 port | 200 miles, 3 ports |
| Page size | 5 MB in the worker, 1 MB in tests | 1 MB for this metric |
| Feature pages | fetched again on every query | cached on the source |
| Tangent, Fiji, warm | 1.1–2.0 s at 1 MB, one port | about 2.0 s, three ports, larger disk |
| Tangent, Wallis | 0.70 s at 5 MB, 0.08 s at 1 MB | 0.11 s |
| Hex, Fiji | 70–110 s, 1.2–1.8 GB | 8–11 s, 7.3 MB once |
| Hex, Golden Gate | 8.8 s / 125 MB at 5 MB | 1.9 s / 1.1 MB |

## What is left

The tangent router's remaining second is `navigate`: clearance tests from the sketch to hull vertices across the whole disk. The long ones are load-bearing for the third port. A spatial cutoff that keeps those ports would be the next tangent change. The hex router's remaining time is CPU in the cell walk, not I/O. The 44 MB index fetch is still the right shape and should stay once per warm worker.

## Hierarchical router

`searchWaterPathByHierarchy` walks open ocean at H3 resolution 4. A cell the land index misses is one step. A cell the index touches is split, down to resolution 8, and only children with a center in the water are entered. Polygons are read for those fine cells, not for the whole search disk. The cell centers are then string-pulled, and a shortcut is kept only when the line does not intersect land. The index test is a local early-exit over the FlatGeobuf R-tree; `fgb-source` was not changed.

Same machine, same 200 mile / 3 port defaults, sources already open. CPU is the whole search. These routes had no interior land samples.

| Sketch | CPU | Closest port | Water |
|---|---:|---|---:|
| Port test | 2.0 s | Savusavu Bay | 82.1 km |
| West of the dateline | 3.1 s | Savusavu Bay | 42.2 km |
| East of the dateline | 5.5 s | Savusavu Bay | 106 km |
| Straddling the antimeridian | 4.4 s | Savusavu Bay | 79.4 km |
| Natewa Bay | 2.5 s | Savusavu Bay | 141 km |
| Wallis | 31 ms | Mata-Utu | 24.0 km |
| Gull Island | 1.6 s | Prisoners | 43.2 km |
| Golden Gate | 61 ms | San Francisco | 12.6 km |

Open water is a coarse step, so Wallis and the Golden Gate are tens of milliseconds. A Fiji coast is still about 2–5 s, because the frontier drops to resolution 8 wherever the index sees land. That is faster than the hex router and, on the Golden Gate and Wallis, faster than the tangent router. It is not yet faster than the tangent router on the Fiji sketches. The occupancy router replaced the tangent router as the default on 8 October.

## Occupancy router

`searchWaterPathByOccupancy` reads the res-9 H3 land archive at `https://tiles.seasketch.org/h3-land/v1/land-res9.h3ld` (67,446,345 bytes, stride 4,202, 16,031 mixed records). A water cell is one step, lifted to the coarsest water parent at resolution 7 or 4 that does not contain the cell just left. Mixed cells are opened only near the sketch, the port, or the straight-line corridor. The chain is string-pulled, and a segment through a mixed cell is checked against shoreline polygons from the same land file. Record blocks are 16 records (67,232 bytes) and the client keeps up to 64 MB of them. Opening the archive reads the 84,083-byte prefix once, header then planes. That prefix is outside the per-search counters below.

Measured 8 October 2026 on the same machine, same 200 mile / 3 port defaults. Land and ports were already open at 1 MB pages with a 256 MB page cache. Wall and CPU are a second pass over the sketches, so those pages and the archive blocks were already in memory. CPU is one `process.cpuUsage` diff (user + system) around the call. H3LD bytes and requests are the client's counters from the first pass, in this order. The second pass requested nothing. Land feature-page bodies are not in this table; the 44 MB index open happened before the timed calls.

| Sketch | Matches | Wall | CPU | H3LD | Requests | Expansions | Closest port | Water |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Port test | 2 | 1.48 s | 1.50 s | 0.54 MB | 1 | 4,584 | Savusavu Bay | 81.4 km |
| West of the dateline | 2 | 0.77 s | 0.77 s | 0 | 0 | 301 | Savusavu Bay | 42.6 km |
| East of the dateline | 1 | 5.40 s | 5.67 s | 0 | 0 | 17,535 | Malai | 152 km |
| Straddling the antimeridian | 1 | 1.33 s | 1.34 s | 0 | 0 | 1,724 | Savusavu Bay | 80.5 km |
| Natewa Bay | 1 | 1.63 s | 1.65 s | 0 | 0 | 12,566 | Malai | 142 km |
| Wallis | 1 | 24 ms | 25 ms | 0.07 MB | 1 | 0 | Mata-Utu | 24.5 km |
| Gull Island | 3 | 2.38 s | 2.32 s | 0.47 MB | 3 | 1,174 | Prisoners | 42.5 km |
| Golden Gate | 3 | 0.13 s | 0.15 s | 0.13 MB | 1 | 232 | Sausalito | 10.8 km |
| Cape Cod Bay | 3 | 2.99 s | 2.94 s | 0.34 MB | 2 | 12,922 | Plymouth | 22.5 km |
| Bogue Banks | 1 | 3.50 s | 3.65 s | 0.34 MB | 2 | 448 | Morehead City | 26.2 km |
| Hood Canal | 1 | 1.89 s | 1.89 s | 0.27 MB | 1 | 412 | Hoodsport | 18.9 km |
| Tofino | 2 | 4.22 s | 4.21 s | 0.20 MB | 1 | 22 | Clayoquot | 14.8 km |
| Bosphorus | 3 | 3.20 s | 3.29 s | 0.87 MB | 3 | 333 | Istinye | 23.8 km |
| Sydney Heads | 2 | 0.91 s | 0.92 s | 0.40 MB | 1 | 202 | Botany Bay | 22.0 km |
| Beagle Channel | 2 | 1.40 s | 1.53 s | 0.81 MB | 2 | 375 | Puerto Williams | 22.1 km |
| Mississippi delta | 3 | 2.82 s | 2.86 s | 0.20 MB | 1 | 7,070 | Loop Terminal | 71.8 km |
| Aleutian dateline | 1 | 1.18 s | 1.32 s | 0.34 MB | 2 | 0 | Constantine Harbor | 85.3 km |
| Monterey coast | 3 | 0.19 s | 0.20 s | 0 | 0 | 357 | Monterey | 18.0 km |

The first pass of these eighteen sketches downloaded 4.98 MB of records in 21 requests. The port test's single request is 128 records (eight blocks coalesced). The other Fiji sketches then hit that cache. Monterey hits the California blocks already fetched for Gull Island and the Golden Gate. The file is 67.4 MB. This set of coasts used the 84 KB prefix plus those 4.98 MB of records.

The first sketch also pays the prefix and that 0.54 MB on the clock: port test cold was 3.41 s wall and 2.22 s CPU, against 1.48 s / 1.50 s warm. Wallis cold was 0.62 s wall and 69 ms CPU for one 67 KB block, then 24 ms warm. After the first visit to a coast, wall and CPU stay within a few hundred milliseconds of each other, so the remaining time is computation.

Expansions are cells popped, summed across the ports tried for that sketch. One walk stops at 12,000, which is why the east-of-dateline total can pass that. That sketch is the long case: 17,535 cells, 5.7 s, one route (Malai, 152 km, 11 vertices). Natewa Bay (12,566), Cape Cod Bay (12,922), and the Mississippi delta (7,070) are the other large walks.

A clear straight line expands nothing. Wallis is the small version: 24 ms once its block is cached. The Aleutian route is also direct (0 expansions, 85 km) and still 1.3 s. It read 0.34 MB of mixed records, so the line is not a pure resolution-4 water shortcut; those stretches are checked against shoreline polygons. Tofino (22 expansions, 4.2 s), Bogue Banks (448, 3.6 s), and the Bosphorus (333, 3.3 s) are the same shape of cost. The cell walk is a small share of the call. The rest is straight-line attempts and the polygons loaded where those lines leave coarse water.

Warm CPU against the 7 October tables:

- Faster than a warm Fiji tangent search (about 2.0 s) on the port test (1.50 s), west of the dateline (0.77 s), the antimeridian straddle (1.34 s), and Natewa Bay (1.65 s). Faster on the Golden Gate (0.15 s vs 2.21 s) and Wallis (25 ms vs 60 ms).
- Gull Island is 2.32 s, beside the tangent router's 2.24 s and the hierarchy router's 1.6 s. The hex router's Gull Island CPU was 2.0 s.
- East of the dateline is 5.67 s. The tangent router did that sketch in 2.06 s and returned three ports. The hierarchy router took 5.5 s and named Savusavu Bay. This search names Malai.

Everywhere else in the shared set, occupancy is well under the hex router's 8–11 s on Fiji and under its 0.8–2 s on Wallis and the Golden Gate.

The Golden Gate route is Sausalito at 10.8 km. The hierarchy router reached San Francisco at 12.6 km. Cape Cod Bay reaches Plymouth, Bogue Banks reaches Morehead City, and Hood Canal reaches Hoodsport. Those harbor sketches were not in the 7 October tables. Their warm CPU runs from 0.15 s on an open approach to about 4 s where the straight line into the harbor has to be rejected.

## Same search on the res-8 archive

The router takes its fine resolution from the archive header. Pointing `H3_LAND_URL` at `https://tiles.seasketch.org/h3-land/v1/land-res8.h3ld` (9,700,684 bytes, stride 601, 16,001 mixed records, fine resolution 8) runs the same search one level coarser. Parents are still resolution 7 and 4. A record block is 16 × 601 = 9,616 bytes.

Same machine, same sketches, same 200 mile / 3 port defaults, 8 October 2026. Wall and CPU are again the warm pass. The res-9 column is the table above.

| Sketch | CPU, res 9 | CPU, res 8 | Expansions, res 9 | Expansions, res 8 |
|---|---:|---:|---:|---:|
| Port test | 1.50 s | 1.33 s | 4,584 | 1,052 |
| West of the dateline | 0.77 s | 0.75 s | 301 | 212 |
| East of the dateline | 5.67 s | 4.38 s | 17,535 | 4,293 |
| Straddling the antimeridian | 1.34 s | 1.31 s | 1,724 | 648 |
| Natewa Bay | 1.65 s | 1.88 s | 12,566 | 3,738 |
| Wallis | 25 ms | 25 ms | 0 | 0 |
| Gull Island | 2.32 s | 2.29 s | 1,174 | 296 |
| Golden Gate | 0.15 s | 0.17 s | 232 | 43 |
| Cape Cod Bay | 2.94 s | 2.86 s | 12,922 | 3,390 |
| Bogue Banks | 3.65 s | 4.42 s | 448 | 133 |
| Hood Canal | 1.89 s | 1.72 s | 412 | 57 |
| Tofino | 4.21 s | 4.63 s | 22 | 18 |
| Bosphorus | 3.29 s | 3.37 s | 333 | 1,867 |
| Sydney Heads | 0.92 s | 1.09 s | 202 | 77 |
| Beagle Channel | 1.53 s | 1.35 s | 375 | 80 |
| Mississippi delta | 2.86 s | 2.47 s | 7,070 | 1,238 |
| Aleutian dateline | 1.32 s | 1.37 s | 0 | 0 |
| Monterey coast | 0.20 s | 0.16 s | 357 | 67 |

Warm CPU across the eighteen sketches is 36.2 s at res 9 and 35.6 s at res 8. The long walks shrink by about three or four times (east of the dateline 17,535 cells to 4,293, Cape Cod Bay 12,922 to 3,390, the Mississippi delta 7,070 to 1,238), and those sketches are a second or so faster. The sketches that were already short walks do not move, because their time is the straight-line tests and the shoreline polygons. Tofino is 4.6 s at res 8 against 4.2 s at res 9, with 18 expansions against 22. The Bosphorus is the exception on the walk itself: 1,867 cells at res 8 against 333 at res 9, and the CPU stays at about 3.3 s.

The first pass downloaded 0.70 MB of records in 23 requests, against 4.98 MB in 21 requests at res 9. That is the stride. A res-8 block is 9.6 KB and a res-9 block is 67 KB, and the two archives touched about the same number of records (1,168 and 1,184). Wallis is one block either way: 9.6 KB cold, then 25 ms.

The closest harbor is the same on 16 sketches. A straight line that was already clear is the same length (Wallis 24.5 km, Clayoquot 14.8 km, Loop Terminal 71.8 km, Constantine Harbor 85.3 km). A route that follows a coast comes out 0.4–2.0 km longer at res 8: Savusavu Bay 83.4 km against 81.4, Malai 153 km against 152, Sausalito 11.3 km against 10.8, Plymouth 24.0 km against 22.5, Monterey 18.7 km against 18.0.

Two harbors change. Bogue Banks returns Beaufort at 25.9 km instead of Morehead City at 26.2 km. The nearest-port suite fails there and passes the other seventeen. Beagle Channel returns Ushuaia at 22.4 km instead of Puerto Williams at 22.1 km; Williams is still second, at 23.6 km. Sampled with the suite's own window (skip the first 2 km and the last 2.5 km, every 80 m), none of the res-8 routes hit land. A tighter window, 200 m off each end, finds shore contact on the Bogue Banks line (13 samples), Hood Canal (28), the east-of-dateline approach (45), the Bosphorus (11), and Cape Cod Bay (3). Those samples sit inside the band the suite ignores.
