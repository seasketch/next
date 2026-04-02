"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRGBRasterLayer = buildRGBRasterLayer;
exports.buildContinuousRasterLayer = buildContinuousRasterLayer;
exports.buildCategoricalRasterLayer = buildCategoricalRasterLayer;
const geostats_types_1 = require("@seasketch/geostats-types");
const ai_data_analyst_1 = require("ai-data-analyst");
const colorScales_1 = require("../colorScales");
function buildRGBRasterLayer(geostats, aiDataAnalystNotes) {
    return [
        {
            type: "raster",
            paint: {
                "raster-resampling": "nearest",
                "raster-opacity": 1,
            },
            layout: {
                visibility: "visible",
            },
            metadata: {
                "s:type": "Raster Image",
            },
        },
    ];
}
function buildContinuousRasterLayer(geostats, aiDataAnalystNotes) {
    if (!(0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a raster info");
    }
    const band = geostats.bands[0];
    let rasterColorMix = [
        ["*", 258, 65536],
        ["*", 258, 256],
        258,
        ["+", -32768, band.base],
    ];
    if (band.interval && band.interval !== 1) {
        rasterColorMix = rasterColorMix.map((channel) => [
            "*",
            band.interval,
            channel,
        ]);
    }
    if (geostats.presentation === geostats_types_1.SuggestedRasterPresentation.categorical ||
        geostats.byteEncoding) {
        rasterColorMix = [0, 0, 258, band.base];
    }
    const colorScale = (0, colorScales_1.getColorScale)("continuous", (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.palette) || "interpolatePlasma");
    const reversePalette = (0, ai_data_analyst_1.effectiveReverseNamedPalette)(aiDataAnalystNotes);
    const range = [
        geostats.bands[0].minimum,
        geostats.bands[0].maximum,
    ];
    let rasterColor;
    const stepsMeta = {};
    const vs = aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.value_steps;
    const vsn = aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.value_steps_n;
    if (vs && typeof vsn === "number" && Number.isFinite(vsn)) {
        const method = (0, colorScales_1.rasterValueStepsToRasterStepMethod)(vs);
        if (method) {
            const resolved = (0, colorScales_1.resolveRasterStepBuckets)(band.stats, method, vsn);
            if (resolved) {
                rasterColor = (0, colorScales_1.buildRasterStepColorExpression)(resolved.buckets, colorScale, reversePalette, ["raster-value"]);
                stepsMeta["s:steps"] = `${method}:${resolved.n}`;
            }
        }
    }
    if (!rasterColor) {
        rasterColor = (0, colorScales_1.buildContinuousColorExpression)(colorScale, reversePalette, range, ["raster-value"]);
        stepsMeta["s:steps"] = `continuous:10`;
    }
    const layer = {
        type: "raster",
        paint: {
            "raster-opacity": 1,
            "raster-resampling": "nearest",
            "raster-color-mix": rasterColorMix,
            "raster-color-range": geostats.byteEncoding
                ? [band.minimum, band.minimum + 255]
                : [geostats.bands[0].minimum, geostats.bands[0].maximum],
            "raster-fade-duration": 0,
            "raster-color": rasterColor,
        },
        layout: {
            visibility: "visible",
        },
        metadata: Object.assign(Object.assign(Object.assign({}, stepsMeta), (geostats.bands[0].offset || geostats.bands[0].scale
            ? { "s:respect-scale-and-offset": true }
            : {})), { "s:type": "Continuous Raster" }),
    };
    (0, colorScales_1.setPaletteMetadata)(layer, colorScale);
    return [layer];
}
function buildCategoricalRasterLayer(geostats, aiDataAnalystNotes) {
    if (!(0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a raster info");
    }
    let colors = [];
    let colorScaleName;
    let paletteReverse;
    if (geostats.bands[0].colorTable) {
        colors = geostats.bands[0].colorTable;
    }
    else if (geostats.bands[0].stats.categories) {
        const categories = geostats.bands[0].stats.categories;
        const colorScale = (0, colorScales_1.getColorScale)("categorical", (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.palette) || "schemeTableau10");
        colorScaleName = colorScale.name;
        const reversePalette = (0, ai_data_analyst_1.effectiveReverseNamedPalette)(aiDataAnalystNotes);
        paletteReverse = reversePalette;
        if (reversePalette) {
            categories.reverse();
        }
        for (const category of categories) {
            colors.push([category[0], colorScale(categories.indexOf(category))]);
        }
    }
    const layer = {
        type: "raster",
        paint: {
            "raster-color": [
                "step",
                ["round", ["raster-value"]],
                "transparent",
                ...colors.flat(),
            ],
            "raster-color-mix": [0, 0, 258, geostats.bands[0].base],
            "raster-resampling": "nearest",
            "raster-color-range": [
                geostats.bands[0].minimum,
                geostats.bands[0].minimum + 255,
            ],
            "raster-fade-duration": 0,
        },
        layout: {
            visibility: "visible",
        },
        metadata: Object.assign(Object.assign({}, (colorScaleName ? { "s:palette": colorScaleName } : {})), { "s:type": "Categorical Raster" }),
    };
    if (colorScaleName && colorScaleName !== "customPalette") {
        layer.metadata["s:palette"] = colorScaleName;
    }
    return [layer];
}
//# sourceMappingURL=rasters.js.map