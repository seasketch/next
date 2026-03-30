"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressHistogram = compressHistogram;
exports.trimGeostatsForLlm = trimGeostatsForLlm;
const TOP_N_VALUES = 20;
const MAX_KEY_LEN = 80;
const MAX_HIST_BINS = 32;
function topValuesRecord(values) {
    if (!values || typeof values !== "object") {
        return undefined;
    }
    const entries = Object.entries(values)
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_N_VALUES)
        .map(([k, v]) => {
        const key = k.length > MAX_KEY_LEN ? `${k.slice(0, MAX_KEY_LEN)}…` : k;
        return [key, v];
    });
    return Object.fromEntries(entries);
}
function trimNumericStats(stats) {
    if (!stats || typeof stats !== "object") {
        return undefined;
    }
    const s = stats;
    const out = {};
    if (typeof s.avg === "number") {
        out.avg = s.avg;
    }
    if (typeof s.stdev === "number") {
        out.stdev = s.stdev;
    }
    return Object.keys(out).length ? out : undefined;
}
function trimVectorAttribute(attr) {
    const out = {
        attribute: attr.attribute,
        type: attr.type,
        count: attr.count,
    };
    if (attr.countDistinct != null) {
        out.countDistinct = attr.countDistinct;
    }
    if (attr.min != null) {
        out.min = attr.min;
    }
    if (attr.max != null) {
        out.max = attr.max;
    }
    if (attr.type === "number" && attr.stats && typeof attr.stats === "object") {
        const ts = trimNumericStats(attr.stats);
        if (ts) {
            out.stats = ts;
        }
    }
    const values = topValuesRecord(attr.values);
    if (values && Object.keys(values).length > 0) {
        out.values = values;
    }
    return out;
}
/**
 * Reduce a long histogram to at most maxBins buckets by uniform index sampling.
 */
function compressHistogram(histogram, maxBins = MAX_HIST_BINS) {
    if (!Array.isArray(histogram) || histogram.length === 0) {
        return undefined;
    }
    const h = histogram;
    if (h.length <= maxBins) {
        return h;
    }
    const step = h.length / maxBins;
    const out = [];
    for (let i = 0; i < maxBins; i++) {
        const idx = Math.min(h.length - 1, Math.floor(i * step));
        out.push(h[idx]);
    }
    return out;
}
function trimRasterBand(band) {
    const stats = band.stats || {};
    const out = {
        name: band.name,
        colorInterpretation: band.colorInterpretation,
        minimum: band.minimum,
        maximum: band.maximum,
        base: band.base,
        interval: band.interval,
        noDataValue: band.noDataValue,
        byteEncoding: band.byteEncoding,
    };
    if (typeof stats.mean === "number") {
        out.mean = stats.mean;
    }
    if (typeof stats.stdev === "number") {
        out.stdev = stats.stdev;
    }
    const categories = stats.categories;
    if (Array.isArray(categories)) {
        out.categoryValueCount = Math.min(categories.length, 500);
    }
    const hist = compressHistogram(stats.histogram, MAX_HIST_BINS);
    if (hist) {
        out.histogramSample = hist;
    }
    if (band.colorTable && Array.isArray(band.colorTable)) {
        out.hasColorTable = true;
        out.colorTableLength = band.colorTable.length;
    }
    if (band.metadata && typeof band.metadata === "object") {
        const m = band.metadata;
        const pick = ["RepresentationType", "STATISTICS_MEAN", "STATISTICS_STDDEV"];
        const meta = {};
        for (const k of pick) {
            if (m[k] != null) {
                meta[k] = m[k];
            }
        }
        if (Object.keys(meta).length) {
            out.metadata = meta;
        }
    }
    return out;
}
/**
 * Produce a small JSON-safe summary of geostats for LLM context.
 */
function trimGeostatsForLlm(geostats) {
    var _a;
    if (!geostats || typeof geostats !== "object") {
        return { kind: "unknown", trimmed: null };
    }
    const g = geostats;
    const bands = g.bands;
    if (Array.isArray(bands) && bands.length > 0) {
        const trimmedBands = bands.map((b) => trimRasterBand(b));
        const out = {
            kind: "raster",
            bands: trimmedBands,
            presentation: g.presentation,
            byteEncoding: g.byteEncoding,
        };
        if (g.metadata && typeof g.metadata === "object") {
            out.metadata = g.metadata;
        }
        return { kind: "raster", trimmed: out };
    }
    const layers = g.layers;
    if (Array.isArray(layers) && layers.length > 0) {
        const trimmedLayers = [];
        let primaryGeometry;
        for (const layer of layers) {
            if (!layer || typeof layer !== "object") {
                continue;
            }
            const L = layer;
            if (!primaryGeometry && typeof L.geometry === "string") {
                primaryGeometry = L.geometry;
            }
            const attrs = Array.isArray(L.attributes) ? L.attributes : [];
            const trimmedAttrs = attrs.map((a) => trimVectorAttribute(a));
            trimmedLayers.push({
                layer: L.layer,
                geometry: L.geometry,
                count: L.count,
                bounds: L.bounds,
                attributeCount: L.attributeCount,
                attributes: trimmedAttrs,
            });
        }
        const out = {
            kind: "vector",
            layers: trimmedLayers,
            layerCount: (_a = g.layerCount) !== null && _a !== void 0 ? _a : trimmedLayers.length,
        };
        return {
            kind: "vector",
            primaryGeometry,
            trimmed: out,
        };
    }
    return { kind: "unknown", trimmed: null };
}
//# sourceMappingURL=trimGeostats.js.map