"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.colorScales = void 0;
exports.compareCategoricalKeys = compareCategoricalKeys;
exports.buildCustomColorScale = buildCustomColorScale;
exports.getColorScale = getColorScale;
exports.buildContinuousColorExpression = buildContinuousColorExpression;
exports.isRasterStepMethod = isRasterStepMethod;
exports.rasterValueStepsToRasterStepMethod = rasterValueStepsToRasterStepMethod;
exports.getColorStopsFromScale = getColorStopsFromScale;
exports.buildRasterStepColorExpression = buildRasterStepColorExpression;
exports.resolveRasterStepBuckets = resolveRasterStepBuckets;
exports.getSingleColorFromCustomPalette = getSingleColorFromCustomPalette;
exports.autoStrokeColorForFillColor = autoStrokeColorForFillColor;
exports.getDefaultFillColor = getDefaultFillColor;
exports.buildMatchExpressionForAttribute = buildMatchExpressionForAttribute;
exports.setPaletteMetadata = setPaletteMetadata;
const d3Chromatic = __importStar(require("d3-scale-chromatic"));
const colord_1 = require("colord");
const names_1 = __importDefault(require("colord/plugins/names"));
(0, colord_1.extend)([names_1.default]);
function defineScaleName(fn, resolvedName) {
    Object.defineProperty(fn, "name", {
        value: resolvedName,
        configurable: true,
    });
    return fn;
}
/** Deterministic ordering for category strings (matches object custom palette key sort). */
function compareCategoricalKeys(a, b) {
    return a.localeCompare(b, undefined, { numeric: true });
}
function sortCategoricalStrings(values) {
    return [...values].sort(compareCategoricalKeys);
}
function defineCategoricalColorScale(fn, resolvedName, keyToColor) {
    const out = fn;
    defineScaleName(out, resolvedName);
    if (keyToColor) {
        Object.defineProperty(out, "categoricalKeyToColor", {
            value: keyToColor,
            configurable: true,
            enumerable: false,
        });
    }
    return out;
}
/** Parse and normalize a single color string; returns null if missing or invalid. */
function parseValidCssColor(raw) {
    if (raw === null || raw === undefined)
        return null;
    if (typeof raw !== "string")
        return null;
    const trimmed = raw.trim();
    if (trimmed === "")
        return null;
    const c = (0, colord_1.colord)(trimmed);
    if (!c.isValid())
        return null;
    if (c.alpha() < 1) {
        return c.toRgbString();
    }
    return c.toHex();
}
/**
 * Build a categorical {@link ColorScaleFn} from LLM/user palette input.
 * Invalid entries are omitted. Arrays keep valid colors in order. Objects are
 * sorted by key (numeric-aware) and treated as an ordered list for bucket indices.
 *
 * @returns A named scale, or `null` if no valid colors remain (use a named d3 scale instead).
 */
function buildCustomColorScale(customPalette) {
    if (Array.isArray(customPalette)) {
        const colors = [];
        for (const item of customPalette) {
            const parsed = parseValidCssColor(item);
            if (parsed !== null) {
                colors.push(parsed);
            }
        }
        if (colors.length === 0) {
            return null;
        }
        const len = colors.length;
        const fn = (value) => {
            const n = typeof value === "number" ? value : Number(value);
            const idx = Number.isFinite(n) ? Math.trunc(n) : 0;
            return colors[((idx % len) + len) % len];
        };
        return defineCategoricalColorScale(fn, "customPalette");
    }
    const pairs = [];
    for (const [key, value] of Object.entries(customPalette)) {
        const parsed = parseValidCssColor(value);
        if (parsed !== null) {
            pairs.push({ key, color: parsed });
        }
    }
    if (pairs.length === 0) {
        return null;
    }
    pairs.sort((a, b) => compareCategoricalKeys(a.key, b.key));
    const colors = pairs.map((p) => p.color);
    const len = colors.length;
    const keyToColor = new Map(pairs.map((p) => [p.key, p.color]));
    const fn = (value) => {
        if (typeof value === "string") {
            const direct = keyToColor.get(value);
            if (direct !== undefined) {
                return direct;
            }
        }
        const n = typeof value === "number" ? value : Number(value);
        const idx = Number.isFinite(n) ? Math.trunc(n) : 0;
        return colors[((idx % len) + len) % len];
    };
    return defineCategoricalColorScale(fn, "customPalette", keyToColor);
}
exports.colorScales = {
    categorical: [
        "schemeCategory10",
        "schemeTableau10",
        "schemeAccent",
        "schemeDark2",
        "schemePaired",
        "schemePastel1",
        "schemePastel2",
        "schemeSet1",
        "schemeSet2",
        "schemeSet3",
    ],
    continuous: {
        diverging: [
            "interpolateBrBG",
            "interpolatePRGn",
            "interpolatePiYG",
            "interpolatePuOr",
            "interpolateRdBu",
            "interpolateRdGy",
            "interpolateRdYlBu",
            "interpolateRdYlGn",
            "interpolateSpectral",
        ],
        sequential: [
            "interpolateBlues",
            "interpolateGreens",
            "interpolateGreys",
            "interpolateOranges",
            "interpolatePurples",
            "interpolateReds",
            "interpolateTurbo",
            "interpolateViridis",
            "interpolateInferno",
            "interpolateMagma",
            "interpolatePlasma",
            "interpolateCividis",
            "interpolateWarm",
            "interpolateCool",
            "interpolateCubehelixDefault",
            "interpolateBuGn",
            "interpolateBuPu",
            "interpolateGnBu",
            "interpolateOrRd",
            "interpolatePuBuGn",
            "interpolatePuBu",
            "interpolatePuRd",
            "interpolateRdPu",
            "interpolateYlGnBu",
            "interpolateYlGn",
            "interpolateYlOrBr",
            "interpolateYlOrRd",
        ],
        cyclical: ["interpolateRainbow", "interpolateSinebow"],
    },
};
/**
 * Given a type of color scale and a name, find and return an instance of
 * d3-scale-chromatic that is the best match. If no match is found, return a
 * default (appropriate for the type).
 * @param type 'categorical' | 'continuous'
 * @param name - The name of the color scale to get. This name may be coming
 * from our llm-based "ai cartographer", so it could be mismatched in case or
 * incomplete.
 * @param customPalette - A custom palette to use instead of the default or the named scale. Only valid for categorical scales. This
 * could also be coming from an llm, so it could have all sorts of invalid
 * values or issues. It will need strict validation. It could be in the form of:
 *   * an array of colors (e.g. ["#000000", "#FFFFFF", "green", "rgb(0, 0, 0)",
 *     rgba(0, 0, 0, 0.5), "inva-lid", null])
 *   * an object keyed by category value, with each value set to a hex color
 *     string (e.g. { "1": "#000000", "2": "#FFFFFF", "3": "green", "4":
 *     "invalid", "5": null })
 *   * null or undefined to use the default palette
 *   * an empty object to use the default palette
 * @returns A callable scale; invoke with a normalized value in [0, 1] for
 * continuous scales, or a bucket index for categorical. `fn.name` is the
 * resolved d3-scale-chromatic export name (e.g. `interpolatePlasma`).
 */
function getColorScale(type, name, customPalette) {
    if (customPalette && type === "categorical") {
        const customScale = buildCustomColorScale(customPalette);
        if (customScale) {
            return customScale;
        }
    }
    const candidates = [];
    if (type === "categorical") {
        candidates.push(...exports.colorScales.categorical);
    }
    else if (type === "continuous") {
        candidates.push(...exports.colorScales.continuous.sequential);
        candidates.push(...exports.colorScales.continuous.diverging);
        candidates.push(...exports.colorScales.continuous.cyclical);
    }
    const bestMatch = candidates.find((candidate) => candidate.toLowerCase().includes(name.toLowerCase()));
    const resolvedName = bestMatch && bestMatch in d3Chromatic
        ? bestMatch
        : type === "categorical"
            ? "schemeCategory10"
            : "interpolatePlasma";
    const scale = d3Chromatic[resolvedName];
    if (type === "categorical") {
        const colors = scale;
        const len = colors.length;
        const fn = (value) => {
            const n = typeof value === "number" ? value : Number(value);
            const idx = Number.isFinite(n) ? Math.trunc(n) : 0;
            return colors[((idx % len) + len) % len];
        };
        return defineCategoricalColorScale(fn, resolvedName);
    }
    const interpolate = scale;
    const fn = (t) => {
        const x = typeof t === "number" ? t : Number(t);
        return interpolate(Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
    };
    return defineScaleName(fn, resolvedName);
}
/**
 * Builds a mapbox-gl-style interpolate expression that can be used for raster
 * or vector layers
 */
function buildContinuousColorExpression(colorScale, reverse, range, arg) {
    const fnName = "interpolate";
    const iType = ["linear"];
    const stops = [];
    const nStops = 10;
    const interval = (range[1] - range[0]) / (nStops - 1);
    if (interval === 0) {
        stops.push(range[0], colorScale(0));
    }
    else {
        for (var i = 0; i < nStops; i++) {
            const fraction = reverse ? 1 - i / (nStops - 1) : i / (nStops - 1);
            stops.push(range[0] + interval * i, colorScale(fraction));
        }
    }
    return [fnName, iType, arg, ...stops];
}
const RASTER_STEP_METHODS = new Set([
    "equalInterval",
    "geometricInterval",
    "naturalBreaks",
    "quantiles",
    "standardDeviations",
]);
function isRasterStepMethod(value) {
    return RASTER_STEP_METHODS.has(value);
}
/** Postgres / GraphQL `value_steps` → geostats `stats` bucket map key. */
function rasterValueStepsToRasterStepMethod(steps) {
    switch (steps) {
        case "CONTINUOUS":
            return null;
        case "EQUAL_INTERVALS":
            return "equalInterval";
        case "NATURAL_BREAKS":
            return "naturalBreaks";
        case "QUANTILES":
            return "quantiles";
    }
}
/**
 * Sample `n` colors along a continuous scale (same fractions as the admin style
 * editor uses for function palettes in `getColorStops`).
 */
function getColorStopsFromScale(colorScale, n, reverse) {
    if (n <= 0) {
        return [];
    }
    if (n === 1) {
        return [colorScale(reverse ? 1 : 0)];
    }
    const stops = [];
    for (let i = 0; i < n; i++) {
        const fraction = reverse ? 1 - i / (n - 1) : i / (n - 1);
        stops.push(colorScale(fraction));
    }
    return stops;
}
/**
 * Mapbox `step` paint expression for raster values, aligned with
 * `buildStepExpression` in the client style editor (continuous palette sampled
 * at each class).
 */
function buildRasterStepColorExpression(buckets, colorScale, reverse, arg) {
    const expression = ["step", arg, "transparent"];
    const nStops = buckets.length - 1;
    const colors = getColorStopsFromScale(colorScale, nStops, reverse);
    for (let i = 0; i < nStops; i++) {
        const bucket = buckets[i];
        if (buckets[1] !== null && (i === 0 || bucket[0] !== buckets[i - 1][0])) {
            expression.push(bucket[0], colors[i]);
        }
    }
    return expression;
}
/**
 * Resolve precomputed break buckets for a histogram method and requested class
 * count.
 *
 * - If the stats map for `method` is missing or empty, or no entry has enough
 *   breaks to build a step expression, returns `null` (caller should use a
 *   continuous ramp).
 * - Otherwise picks the **numeric key** whose bucket list is valid
 *   (`length >= 2`) and is **closest** to `n` (ties → smaller key).
 */
function resolveRasterStepBuckets(stats, method, n) {
    const bucketsByN = stats[method];
    if (!bucketsByN || typeof bucketsByN !== "object") {
        return null;
    }
    const requested = Math.round(n);
    const validKeys = [];
    for (const key of Object.keys(bucketsByN)) {
        const k = parseInt(key, 10);
        if (!Number.isFinite(k)) {
            continue;
        }
        const b = bucketsByN[k];
        if (b && b.length >= 2) {
            validKeys.push(k);
        }
    }
    if (validKeys.length === 0) {
        return null;
    }
    let bestK = validKeys[0];
    let bestDist = Math.abs(bestK - requested);
    for (const k of validKeys) {
        const d = Math.abs(k - requested);
        if (d < bestDist || (d === bestDist && k < bestK)) {
            bestK = k;
            bestDist = d;
        }
    }
    const buckets = bucketsByN[bestK];
    return { n: bestK, buckets };
}
/**
 * Inspects a custom palette and returns a single color if it is valid. Performs
 * extensive validation and normalization of the palette.
 * @param customPalette - LLM-generated custom palette
 */
function getSingleColorFromCustomPalette(customPalette) {
    var _a, _b, _c, _d;
    if (!customPalette) {
        return null;
    }
    if (Array.isArray(customPalette)) {
        return (_a = parseValidCssColor(customPalette[0])) !== null && _a !== void 0 ? _a : null;
    }
    if (typeof customPalette === "string") {
        return (_b = parseValidCssColor(customPalette)) !== null && _b !== void 0 ? _b : null;
    }
    if (typeof customPalette === "object") {
        if ("*" in customPalette) {
            return (_c = parseValidCssColor(customPalette["*"])) !== null && _c !== void 0 ? _c : null;
        }
        if ("default" in customPalette) {
            return (_d = parseValidCssColor(customPalette["default"])) !== null && _d !== void 0 ? _d : null;
        }
        for (const [key, value] of Object.entries(customPalette)) {
            const parsed = parseValidCssColor(value);
            if (parsed !== null) {
                return parsed;
            }
        }
    }
    return null;
}
function autoStrokeColorForFillColor(fillColor) {
    const c = (0, colord_1.colord)(fillColor);
    if (c.alpha() === 0) {
        return "#558";
    }
    if (c.isDark()) {
        return c.lighten(0.3).alpha(1).toRgbString();
    }
    else {
        return c.darken(0.15).alpha(1).toRgbString();
    }
}
// Colors borrowed from https://github.com/mapbox/mbview/blob/master/views/vector.ejs#L75
var lightColors = [
    "#FC49A3", // pink
    "#CC66FF", // purple-ish
    "#1b14e3", // blue
    "#009463", // dark green
    "#0ac90a", // green
    "#FFCC66", // light orange
    "#FF6666", // salmon
    "#FF0000", // red
    "#FF8000", // orange
    "#dede00", // yellow
    "#00FFFF", // turquoise
];
let i = 0;
function getDefaultFillColor() {
    i++;
    if (i >= lightColors.length) {
        i = 0;
    }
    return lightColors[i];
}
/**
 * Build mapbox-gl-style match expression for a categorical attribute, matching
 * colors in the scale to attribute values.
 * @param attribute
 * @param colorScale
 * @param reverse
 */
function buildMatchExpressionForAttribute(attribute, colorScale, reverse) {
    var _a;
    const keyMap = colorScale.categoricalKeyToColor;
    const uniqueValues = sortCategoricalStrings(Object.keys(attribute.values));
    if (reverse) {
        uniqueValues.reverse();
    }
    const expression = ["match", ["get", attribute.attribute]];
    for (let i = 0; i < uniqueValues.length; i++) {
        const value = uniqueValues[i];
        const color = (_a = keyMap === null || keyMap === void 0 ? void 0 : keyMap.get(value)) !== null && _a !== void 0 ? _a : colorScale(i);
        expression.push(value, color);
    }
    expression.push("transparent");
    return expression;
}
function setPaletteMetadata(layer, colorScale) {
    if (layer.metadata == null) {
        layer.metadata = {};
    }
    if (colorScale.name && colorScale.name !== "customPalette") {
        // check if the color scale is a named d3 scale
        if (exports.colorScales.continuous.sequential.includes(colorScale.name) ||
            exports.colorScales.continuous.diverging.includes(colorScale.name) ||
            exports.colorScales.continuous.cyclical.includes(colorScale.name) ||
            exports.colorScales.categorical.includes(colorScale.name)) {
            layer.metadata["s:palette"] = colorScale.name;
        }
    }
}
//# sourceMappingURL=colorScales.js.map