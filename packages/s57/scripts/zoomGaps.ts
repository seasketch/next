/**
 * Finds chart objects that disappear and come back as you zoom in. For each
 * comparison view it reads the tile under the centre at every zoom. Points
 * are matched across zooms by class, name and position (tiles quantise
 * coordinates, so within SAME_POINT degrees); areas count only where they
 * cover the centre, since a clipped area merely touching the tile is noise.
 * Lines are not checked, nor are classes a larger-scale chart replaces as a
 * set (soundings, depth areas): its selection differs from the chart before.
 *
 *   npm run gaps --workspace @seasketch/s57 -- [chart-dir]
 */
import { VectorTile } from "@mapbox/vector-tile";
import { closeSync, openSync, readFileSync, readSync } from "fs";
import path from "path";
import Pbf from "pbf";
import { PMTiles, Source, RangeResponse } from "pmtiles";
import { ENC_MAX_ZOOM } from "../src/layers";
import { WHOLE_CLASS } from "../src/peel";
import { ChartManifest, channelChartDir } from "./channel";
import { COMPARE_VIEWS } from "./compareViews";

class FileSource implements Source {
  constructor(private file: string) {}
  getKey() {
    return this.file;
  }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const fd = openSync(this.file, "r");
    try {
      const buffer = Buffer.alloc(length);
      const read = readSync(fd, buffer, 0, length, offset);
      return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + read) as ArrayBuffer };
    } finally {
      closeSync(fd);
    }
  }
}

const SAME_POINT = 0.003;
/** Cell limits run along round meridians and parallels, as do some view centres. */
const OFF_GRID = 0.00047;

type Ring = number[][];

function ringContains(ring: Ring, [x, y]: number[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function covers(geometry: { type: string; coordinates: unknown }, point: number[]) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates as Ring[]] : (geometry.coordinates as Ring[][]);
  return polygons.some(
    ([outer, ...holes]) => ringContains(outer, point) && !holes.some((hole) => ringContains(hole, point))
  );
}

function tileAt(lng: number, lat: number, zoom: number): [number, number] {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return [x, y];
}

async function main() {
  const dir = path.resolve(process.argv[2] || channelChartDir);
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as ChartManifest;
  const archives = manifest.map((entry) => ({
    maxzoom: entry.maxzoom,
    tiles: new PMTiles(new FileSource(path.join(dir, entry.file))),
  }));
  const places = new Map(COMPARE_VIEWS.map((view) => [view.name, view]));
  let gaps = 0;
  for (const view of places.values()) {
    const objects: { identity: string; at?: number[]; zooms: Set<number> }[] = [];
    const record = (identity: string, zoom: number, at?: number[]) => {
      let object = objects.find(
        (candidate) =>
          candidate.identity === identity &&
          (at === undefined) === (candidate.at === undefined) &&
          (!at ||
            (Math.abs(candidate.at![0] - at[0]) < SAME_POINT &&
              Math.abs(candidate.at![1] - at[1]) < SAME_POINT))
      );
      if (!object) objects.push((object = { identity, at, zooms: new Set() }));
      object.zooms.add(zoom);
    };
    for (let zoom = 8; zoom <= ENC_MAX_ZOOM; zoom += 1) {
      for (const archive of archives) {
        // Past its last zoom an archive is overzoomed, as the map does.
        const tileZoom = Math.min(zoom, archive.maxzoom);
        const [x, y] = tileAt(view.lng, view.lat, tileZoom);
        const tile = await archive.tiles.getZxy(tileZoom, x, y);
        if (!tile?.data) continue;
        const vt = new VectorTile(new Pbf(new Uint8Array(tile.data)));
        for (const name of Object.keys(vt.layers)) {
          const layer = vt.layers[name];
          for (let index = 0; index < layer.length; index += 1) {
            const feature = layer.feature(index);
            const obj = feature.properties.obj;
            if (typeof obj !== "string" || feature.type === 2 || WHOLE_CLASS.has(obj)) continue;
            const zmin = Number(feature.properties.zmin ?? 0);
            const zmax = Number(feature.properties.zmax ?? 99);
            if (zoom < zmin || zoom > zmax) continue;
            const label = feature.properties.OBJNAM;
            const identity = typeof label === "string" && label ? `${obj} "${label}"` : obj;
            const geometry = feature.toGeoJSON(x, y, tileZoom).geometry as {
              type: string;
              coordinates: unknown;
            };
            if (feature.type === 1) {
              const points =
                geometry.type === "Point"
                  ? [geometry.coordinates as number[]]
                  : (geometry.coordinates as number[][]);
              for (const point of points) record(identity, zoom, point);
            } else if (covers(geometry, [view.lng + OFF_GRID, view.lat + OFF_GRID])) {
              record(identity, zoom);
            }
          }
        }
      }
    }
    const lines: string[] = [];
    for (const { identity, at, zooms } of objects.sort((a, b) => a.identity.localeCompare(b.identity))) {
      const obj = at ? `${identity} @${at[0].toFixed(4)},${at[1].toFixed(4)}` : identity;
      const sorted = [...zooms].sort((a, b) => a - b);
      const missing: number[] = [];
      for (let zoom = sorted[0]; zoom <= sorted[sorted.length - 1]; zoom += 1) {
        if (!zooms.has(zoom)) missing.push(zoom);
      }
      if (missing.length) {
        gaps += 1;
        lines.push(`  ${obj} drawn ${sorted.join(",")} missing ${missing.join(",")}`);
      }
    }
    console.log(`${view.name} (${view.lat}, ${view.lng})${lines.length ? "" : "  no gaps"}`);
    for (const line of lines) console.log(line);
  }
  console.log(`${gaps} objects drop out and come back`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
