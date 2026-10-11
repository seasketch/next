import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import type { Geometry } from "geojson";
import { collectCoarse, collectRefine, measureGeometry, type GeometryContribution } from "./classify";
import { BASE_RESOLUTION, DEFAULT_COVER_EPSILON, DEFAULT_RESOLUTION } from "./constants";
import { formatCount, LandStore, type LandParams } from "./db";
import { readFlatGeobuf } from "./readFlatGeobuf";

export type GenerateOptions = {
  input: string;
  output: string;
  resolution: number;
  epsilon: number;
  bbox: [number, number, number, number] | null;
  commitEvery: number;
  /** Stop after this many classified features. The cursor is saved. */
  limit: number | null;
  restart: boolean;
  /** Two-pass only: drop the fine cells and run the refine pass again. */
  redoRefine?: boolean;
};

export async function generateLandOccupancy(options: GenerateOptions): Promise<void> {
  if (options.resolution > BASE_RESOLUTION) {
    await generateHierarchical(options);
    return;
  }
  const sourcePath = await resolveInput(options.input, options.output);
  const params: LandParams = {
    input: options.input,
    resolution: options.resolution,
    epsilon: options.epsilon,
    bbox: options.bbox ? options.bbox.join(",") : "",
    sourcePath,
  };
  const store = LandStore.open(options.output, params, options.restart);
  if (store.finalized) {
    console.error(
      "dataset is already finalized. Pass --restart to build it again."
    );
    store.close();
    return;
  }

  let featuresCount: number | null = null;
  const started = performance.now();
  let index = 0;
  let attempted = 0;
  let batch: GeometryContribution[] = [];
  let batchCells = 0;
  let eof = true;
  const cursor = store.nextFeature;
  if (cursor > 0) {
    console.error(`resuming at feature ${formatCount(cursor)}`);
  }

  const log = (done: number) => {
    const elapsed = (performance.now() - started) / 1000;
    const rate = elapsed > 0 ? (done - cursor) / elapsed : 0;
    const rss = Math.round(process.memoryUsage().rss / 1e6);
    const total =
      featuresCount == null
        ? ""
        : ` / ${formatCount(featuresCount)} (${((done / featuresCount) * 100).toFixed(1)}%)`;
    const eta =
      featuresCount != null && rate > 0
        ? `, eta ${formatDuration((featuresCount - done) / rate)}`
        : "";
    console.error(
      `feature ${formatCount(done)}${total} at ${rate.toFixed(1)}/s, entire ${formatCount(store.entireCount)}, open boundary ${formatCount(store.openPartials)}, rss ${rss} MB${eta}`
    );
  };

  const flush = (nextFeature: number) => {
    for (const contribution of batch) store.apply(contribution, options.epsilon);
    batch = [];
    batchCells = 0;
    store.commit(nextFeature);
    log(nextFeature);
  };

  try {
    for await (const feature of readFlatGeobuf(sourcePath, (header) => {
      featuresCount = header.featuresCount;
      store.setFeaturesCount(header.featuresCount);
    })) {
      if (index < cursor) {
        index++;
        continue;
      }
      if (options.limit != null && attempted >= options.limit) {
        eof = false;
        break;
      }
      const geometry = feature.geometry;
      if (!geometry || (options.bbox && !geometryIntersects(geometry, options.bbox))) {
        index++;
        if (batch.length > 0 && index % options.commitEvery === 0) flush(index);
        continue;
      }
      let contribution: GeometryContribution;
      try {
        contribution = measureGeometry(geometry, options.resolution, options.epsilon);
      } catch (error) {
        flush(index);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `feature ${formatCount(index)} failed and was not committed, so a rerun retries it: ${message}`
        );
      }
      const cells = contribution.entire.size + contribution.cover.size;
      attempted++;
      if (cells > 100_000) {
        flush(index);
        const featureStarted = performance.now();
        store.apply(contribution, options.epsilon);
        index++;
        store.commit(index);
        const seconds = ((performance.now() - featureStarted) / 1000).toFixed(1);
        console.error(
          `  large feature: ${formatCount(contribution.entire.size)} entire, ${formatCount(contribution.cover.size)} boundary, wrote in ${seconds}s`
        );
        log(index);
        continue;
      }
      batch.push(contribution);
      batchCells += cells;
      index++;
      if (batch.length >= options.commitEvery || batchCells >= 100_000) flush(index);
    }
    flush(index);
    if (!eof) {
      console.error(
        `stopped after ${formatCount(attempted)} features at cursor ${formatCount(index)}. Rerun the same command to continue.`
      );
      return;
    }
    console.error("promoting boundary cells that are covered by more than one land piece...");
    const summary = store.finalize();
    console.error(
      `finalized. entire ${formatCount(summary.entire)}, partial ${formatCount(summary.partial)}, covers that exceeded the cell by >1% ${formatCount(summary.oversize)}. Cells with no row are water.`
    );
  } finally {
    store.close();
  }
}

function geometryIntersects(
  geometry: Geometry,
  bbox: [number, number, number, number]
): boolean {
  const box = geometryBBox(geometry);
  if (!box) return false;
  return box[0] <= bbox[2] && box[2] >= bbox[0] && box[1] <= bbox[3] && box[3] >= bbox[1];
}

function geometryBBox(
  geometry: Geometry
): [number, number, number, number] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (lng: number, lat: number) => {
    if (lng < minX) minX = lng;
    if (lat < minY) minY = lat;
    if (lng > maxX) maxX = lng;
    if (lat > maxY) maxY = lat;
  };
  walkCoordinates(geometry, visit);
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

function walkCoordinates(
  geometry: Geometry,
  visit: (lng: number, lat: number) => void
): void {
  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries) walkCoordinates(child, visit);
    return;
  }
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      for (const point of ring) visit(point[0]!, point[1]!);
    }
    return;
  }
  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const point of ring) visit(point[0]!, point[1]!);
      }
    }
  }
}

/**
 * Classify every land polygon at resolution 7, then walk the file again and
 * measure resolution-9 children only inside mixed cells.
 */
async function generateHierarchical(options: GenerateOptions): Promise<void> {
  const sourcePath = await resolveInput(options.input, options.output);
  const params: LandParams = {
    input: options.input,
    resolution: options.resolution,
    epsilon: options.epsilon,
    bbox: options.bbox ? options.bbox.join(",") : "",
    sourcePath,
    hierarchical: true,
  };
  const store = LandStore.open(options.output, params, options.restart);
  if (options.redoRefine) {
    console.error("discarding fine cells and restarting the refine pass");
    store.resetRefine();
  }
  if (store.finalized) {
    console.error("dataset is already finalized. Pass --restart to build it again.");
    store.close();
    return;
  }
  try {
    if (store.phase === "coarse") {
      console.error(`classifying land at resolution ${BASE_RESOLUTION}`);
      const finished = await scanFeatures(options, sourcePath, store, "coarse");
      if (!finished) return;
      console.error("sealing contained cells and keeping the mixed coastline for refinement");
      store.finishCoarse();
    }
    if (store.phase === "refine") {
      console.error(
        `refining mixed resolution-${BASE_RESOLUTION} cells to resolution ${options.resolution}`
      );
      const finished = await scanFeatures(options, sourcePath, store, "refine");
      if (!finished) return;
      console.error("promoting fine boundary cells...");
      const summary = store.finalize();
      console.error(
        `finalized. sealed resolution-${BASE_RESOLUTION} cells ${formatCount(summary.entire)}, fine partial ${formatCount(summary.partial)}, covers that exceeded the cell by >1% ${formatCount(summary.oversize)}.`
      );
    }
  } finally {
    store.close();
  }
}

async function scanFeatures(
  options: GenerateOptions,
  sourcePath: string,
  store: LandStore,
  phase: "coarse" | "refine"
): Promise<boolean> {
  let featuresCount: number | null = null;
  const started = performance.now();
  let index = 0;
  let attempted = 0;
  let sinceCommit = 0;
  let eof = true;
  const cursor = store.nextFeature;
  if (cursor > 0) console.error(`resuming at feature ${formatCount(cursor)}`);

  const log = (done: number) => {
    const elapsed = (performance.now() - started) / 1000;
    const rate = elapsed > 0 ? (done - cursor) / elapsed : 0;
    const rss = Math.round(process.memoryUsage().rss / 1e6);
    const total =
      featuresCount == null
        ? ""
        : ` / ${formatCount(featuresCount)} (${((done / featuresCount) * 100).toFixed(1)}%)`;
    const eta =
      featuresCount != null && rate > 0
        ? `, eta ${formatDuration((featuresCount - done) / rate)}`
        : "";
    console.error(
      `${phase} feature ${formatCount(done)}${total} at ${rate.toFixed(1)}/s, sealed ${formatCount(store.entireCount)}, open ${formatCount(store.openPartials)}, rss ${rss} MB${eta}`
    );
  };

  try {
    for await (const feature of readFlatGeobuf(sourcePath, (header) => {
      featuresCount = header.featuresCount;
      store.setFeaturesCount(header.featuresCount);
    })) {
      if (index < cursor) {
        index++;
        continue;
      }
      if (options.limit != null && attempted >= options.limit) {
        eof = false;
        break;
      }
      const geometry = feature.geometry;
      if (!geometry || (options.bbox && !geometryIntersects(geometry, options.bbox))) {
        index++;
        if (sinceCommit > 0 && index % options.commitEvery === 0) {
          store.commit(index);
          sinceCommit = 0;
          log(index);
        }
        continue;
      }
      let weight = 0;
      try {
        if (phase === "coarse") {
          const hit = collectCoarse(geometry, BASE_RESOLUTION);
          weight = hit.sealed.size + hit.overlap.size;
          if (weight > 100_000 && sinceCommit > 0) {
            store.commit(index);
            sinceCommit = 0;
            log(index);
          }
          store.applyCoarse(hit.sealed, hit.overlap);
        } else {
          const covers = collectRefine(
            geometry,
            BASE_RESOLUTION,
            options.resolution,
            (h3) => store.isMixed(h3)
          );
          weight = covers.size;
          if (weight > 100_000 && sinceCommit > 0) {
            store.commit(index);
            sinceCommit = 0;
            log(index);
          }
          store.applyRefine(covers, options.epsilon);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `feature ${formatCount(index)} failed and was not committed, so a rerun retries it: ${message}`
        );
      }
      attempted++;
      index++;
      sinceCommit++;
      if (sinceCommit >= options.commitEvery || weight > 100_000) {
        store.commit(index);
        sinceCommit = 0;
        log(index);
      }
    }
    if (sinceCommit > 0) {
      store.commit(index);
      log(index);
    }
    if (!eof) {
      console.error(
        `stopped after ${formatCount(attempted)} features at cursor ${formatCount(index)}. Rerun the same command to continue.`
      );
    }
    return eof;
  } catch (error) {
    throw error;
  }
}

async function resolveInput(input: string, output: string): Promise<string> {
  if (!/^https?:\/\//i.test(input)) {
    statSync(input);
    return input;
  }
  const dest = `${output}.source.fgb`;
  console.error(`downloading ${input} to ${dest}`);
  await run("curl", ["-L", "--fail", "--continue-at", "-", "-o", dest, input]);
  return dest;
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}`));
    });
  });
}

function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  const secs = whole % 60;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function defaultGenerateOptions(): Pick<
  GenerateOptions,
  "resolution" | "epsilon" | "commitEvery"
> {
  return {
    resolution: DEFAULT_RESOLUTION,
    epsilon: DEFAULT_COVER_EPSILON,
    commitEvery: 100,
  };
}
