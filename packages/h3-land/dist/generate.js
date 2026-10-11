"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLandOccupancy = generateLandOccupancy;
exports.defaultGenerateOptions = defaultGenerateOptions;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const classify_1 = require("./classify");
const constants_1 = require("./constants");
const db_1 = require("./db");
const readFlatGeobuf_1 = require("./readFlatGeobuf");
async function generateLandOccupancy(options) {
    if (options.resolution > constants_1.BASE_RESOLUTION) {
        await generateHierarchical(options);
        return;
    }
    const sourcePath = await resolveInput(options.input, options.output);
    const params = {
        input: options.input,
        resolution: options.resolution,
        epsilon: options.epsilon,
        bbox: options.bbox ? options.bbox.join(",") : "",
        sourcePath,
    };
    const store = db_1.LandStore.open(options.output, params, options.restart);
    if (store.finalized) {
        console.error("dataset is already finalized. Pass --restart to build it again.");
        store.close();
        return;
    }
    let featuresCount = null;
    const started = performance.now();
    let index = 0;
    let attempted = 0;
    let batch = [];
    let batchCells = 0;
    let eof = true;
    const cursor = store.nextFeature;
    if (cursor > 0) {
        console.error(`resuming at feature ${(0, db_1.formatCount)(cursor)}`);
    }
    const log = (done) => {
        const elapsed = (performance.now() - started) / 1000;
        const rate = elapsed > 0 ? (done - cursor) / elapsed : 0;
        const rss = Math.round(process.memoryUsage().rss / 1e6);
        const total = featuresCount == null
            ? ""
            : ` / ${(0, db_1.formatCount)(featuresCount)} (${((done / featuresCount) * 100).toFixed(1)}%)`;
        const eta = featuresCount != null && rate > 0
            ? `, eta ${formatDuration((featuresCount - done) / rate)}`
            : "";
        console.error(`feature ${(0, db_1.formatCount)(done)}${total} at ${rate.toFixed(1)}/s, entire ${(0, db_1.formatCount)(store.entireCount)}, open boundary ${(0, db_1.formatCount)(store.openPartials)}, rss ${rss} MB${eta}`);
    };
    const flush = (nextFeature) => {
        for (const contribution of batch)
            store.apply(contribution, options.epsilon);
        batch = [];
        batchCells = 0;
        store.commit(nextFeature);
        log(nextFeature);
    };
    try {
        for await (const feature of (0, readFlatGeobuf_1.readFlatGeobuf)(sourcePath, (header) => {
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
                if (batch.length > 0 && index % options.commitEvery === 0)
                    flush(index);
                continue;
            }
            let contribution;
            try {
                contribution = (0, classify_1.measureGeometry)(geometry, options.resolution, options.epsilon);
            }
            catch (error) {
                flush(index);
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`feature ${(0, db_1.formatCount)(index)} failed and was not committed, so a rerun retries it: ${message}`);
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
                console.error(`  large feature: ${(0, db_1.formatCount)(contribution.entire.size)} entire, ${(0, db_1.formatCount)(contribution.cover.size)} boundary, wrote in ${seconds}s`);
                log(index);
                continue;
            }
            batch.push(contribution);
            batchCells += cells;
            index++;
            if (batch.length >= options.commitEvery || batchCells >= 100_000)
                flush(index);
        }
        flush(index);
        if (!eof) {
            console.error(`stopped after ${(0, db_1.formatCount)(attempted)} features at cursor ${(0, db_1.formatCount)(index)}. Rerun the same command to continue.`);
            return;
        }
        console.error("promoting boundary cells that are covered by more than one land piece...");
        const summary = store.finalize();
        console.error(`finalized. entire ${(0, db_1.formatCount)(summary.entire)}, partial ${(0, db_1.formatCount)(summary.partial)}, covers that exceeded the cell by >1% ${(0, db_1.formatCount)(summary.oversize)}. Cells with no row are water.`);
    }
    finally {
        store.close();
    }
}
function geometryIntersects(geometry, bbox) {
    const box = geometryBBox(geometry);
    if (!box)
        return false;
    return box[0] <= bbox[2] && box[2] >= bbox[0] && box[1] <= bbox[3] && box[3] >= bbox[1];
}
function geometryBBox(geometry) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const visit = (lng, lat) => {
        if (lng < minX)
            minX = lng;
        if (lat < minY)
            minY = lat;
        if (lng > maxX)
            maxX = lng;
        if (lat > maxY)
            maxY = lat;
    };
    walkCoordinates(geometry, visit);
    if (!Number.isFinite(minX))
        return null;
    return [minX, minY, maxX, maxY];
}
function walkCoordinates(geometry, visit) {
    if (geometry.type === "GeometryCollection") {
        for (const child of geometry.geometries)
            walkCoordinates(child, visit);
        return;
    }
    if (geometry.type === "Polygon") {
        for (const ring of geometry.coordinates) {
            for (const point of ring)
                visit(point[0], point[1]);
        }
        return;
    }
    if (geometry.type === "MultiPolygon") {
        for (const polygon of geometry.coordinates) {
            for (const ring of polygon) {
                for (const point of ring)
                    visit(point[0], point[1]);
            }
        }
    }
}
/**
 * Classify every land polygon at resolution 7, then walk the file again and
 * measure resolution-9 children only inside mixed cells.
 */
async function generateHierarchical(options) {
    const sourcePath = await resolveInput(options.input, options.output);
    const params = {
        input: options.input,
        resolution: options.resolution,
        epsilon: options.epsilon,
        bbox: options.bbox ? options.bbox.join(",") : "",
        sourcePath,
        hierarchical: true,
    };
    const store = db_1.LandStore.open(options.output, params, options.restart);
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
            console.error(`classifying land at resolution ${constants_1.BASE_RESOLUTION}`);
            const finished = await scanFeatures(options, sourcePath, store, "coarse");
            if (!finished)
                return;
            console.error("sealing contained cells and keeping the mixed coastline for refinement");
            store.finishCoarse();
        }
        if (store.phase === "refine") {
            console.error(`refining mixed resolution-${constants_1.BASE_RESOLUTION} cells to resolution ${options.resolution}`);
            const finished = await scanFeatures(options, sourcePath, store, "refine");
            if (!finished)
                return;
            console.error("promoting fine boundary cells...");
            const summary = store.finalize();
            console.error(`finalized. sealed resolution-${constants_1.BASE_RESOLUTION} cells ${(0, db_1.formatCount)(summary.entire)}, fine partial ${(0, db_1.formatCount)(summary.partial)}, covers that exceeded the cell by >1% ${(0, db_1.formatCount)(summary.oversize)}.`);
        }
    }
    finally {
        store.close();
    }
}
async function scanFeatures(options, sourcePath, store, phase) {
    let featuresCount = null;
    const started = performance.now();
    let index = 0;
    let attempted = 0;
    let sinceCommit = 0;
    let eof = true;
    const cursor = store.nextFeature;
    if (cursor > 0)
        console.error(`resuming at feature ${(0, db_1.formatCount)(cursor)}`);
    const log = (done) => {
        const elapsed = (performance.now() - started) / 1000;
        const rate = elapsed > 0 ? (done - cursor) / elapsed : 0;
        const rss = Math.round(process.memoryUsage().rss / 1e6);
        const total = featuresCount == null
            ? ""
            : ` / ${(0, db_1.formatCount)(featuresCount)} (${((done / featuresCount) * 100).toFixed(1)}%)`;
        const eta = featuresCount != null && rate > 0
            ? `, eta ${formatDuration((featuresCount - done) / rate)}`
            : "";
        console.error(`${phase} feature ${(0, db_1.formatCount)(done)}${total} at ${rate.toFixed(1)}/s, sealed ${(0, db_1.formatCount)(store.entireCount)}, open ${(0, db_1.formatCount)(store.openPartials)}, rss ${rss} MB${eta}`);
    };
    try {
        for await (const feature of (0, readFlatGeobuf_1.readFlatGeobuf)(sourcePath, (header) => {
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
                    const hit = (0, classify_1.collectCoarse)(geometry, constants_1.BASE_RESOLUTION);
                    weight = hit.sealed.size + hit.overlap.size;
                    if (weight > 100_000 && sinceCommit > 0) {
                        store.commit(index);
                        sinceCommit = 0;
                        log(index);
                    }
                    store.applyCoarse(hit.sealed, hit.overlap);
                }
                else {
                    const covers = (0, classify_1.collectRefine)(geometry, constants_1.BASE_RESOLUTION, options.resolution, (h3) => store.isMixed(h3));
                    weight = covers.size;
                    if (weight > 100_000 && sinceCommit > 0) {
                        store.commit(index);
                        sinceCommit = 0;
                        log(index);
                    }
                    store.applyRefine(covers, options.epsilon);
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`feature ${(0, db_1.formatCount)(index)} failed and was not committed, so a rerun retries it: ${message}`);
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
            console.error(`stopped after ${(0, db_1.formatCount)(attempted)} features at cursor ${(0, db_1.formatCount)(index)}. Rerun the same command to continue.`);
        }
        return eof;
    }
    catch (error) {
        throw error;
    }
}
async function resolveInput(input, output) {
    if (!/^https?:\/\//i.test(input)) {
        (0, node_fs_1.statSync)(input);
        return input;
    }
    const dest = `${output}.source.fgb`;
    console.error(`downloading ${input} to ${dest}`);
    await run("curl", ["-L", "--fail", "--continue-at", "-", "-o", dest, input]);
    return dest;
}
function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(command, args, { stdio: "inherit" });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`${command} exited ${code}`));
        });
    });
}
function formatDuration(seconds) {
    const whole = Math.max(0, Math.round(seconds));
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    if (hours > 0)
        return `${hours}h ${minutes}m`;
    const secs = whole % 60;
    if (minutes > 0)
        return `${minutes}m ${secs}s`;
    return `${secs}s`;
}
function defaultGenerateOptions() {
    return {
        resolution: constants_1.DEFAULT_RESOLUTION,
        epsilon: constants_1.DEFAULT_COVER_EPSILON,
        commitEvery: 100,
    };
}
//# sourceMappingURL=generate.js.map