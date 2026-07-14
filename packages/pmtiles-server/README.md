# pmtiles-server

Cloudflare Worker that serves [PMTiles](https://github.com/protomaps/PMTiles) archives from R2 as a ZXY tile API for SeaSketch (Mapbox GL). Archives are immutable and content-addressed (updates publish a new filename), so responses are cached forever at the edge.

## Routes

| Path | Response |
|------|----------|
| `/{name}.json` | TileJSON |
| `/{name}/{z}/{x}/{y}.{ext}` | Tile (`pbf` / `png` / `jpg` / `webp` / …) |
| `/{name}` | Mapbox GL preview page (requires `MAPBOX_ACCESS_TOKEN`) |

Object key in R2: `{name}.pmtiles`.

## How it works

1. **Workers Caching** (`[cache] enabled = true`) sits in front of the Worker. Cache hits never invoke the Worker and collapse concurrent misses. Check `Cf-Cache-Status: HIT` after deploy.
2. On a miss, the Worker uses `pmtiles` with an R2 range `Source` and a shared isolate cache for headers/directories, so warm isolates typically need one R2 read per tile.
3. Cache-miss responses include `Server-Timing` with mutually exclusive stage durations (`total`, `header`, `tile` / `tilejson`) and an R2 read count in `desc`. These only appear when the Worker runs.

## Setup

```bash
npm install
npm start          # wrangler dev (local R2 by default)
npm run deploy
npm run typecheck
```

Secrets (not in the repo):

```bash
echo '<token>' | npx wrangler secret put MAPBOX_ACCESS_TOKEN
```

For local secrets / var overrides, use a gitignored `.dev.vars`:

```ini
MAPBOX_ACCESS_TOKEN=pk.…
# PUBLIC_HOSTNAME=localhost:8787
```

After changing `wrangler.toml`, regenerate types:

```bash
npx wrangler types
```

## Configuration

| Name | Where | Purpose |
|------|--------|---------|
| `TILES_BUCKET` | R2 binding | Archive storage (`ssn-tiles`) |
| `PUBLIC_HOSTNAME` | `[vars]` | Host in TileJSON tile URLs (default in toml: `tiles.seasketch.org`) |
| `MAPBOX_ACCESS_TOKEN` | secret | Preview page only |

Tile / TileJSON responses use `Cache-Control: public, immutable, max-age=31536000`. Preview uses `no-store`.
