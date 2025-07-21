"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rasterInfoForBands = rasterInfoForBands;
const gdal_async_1 = __importDefault(require("gdal-async"));
const stats_1 = require("./stats");
const geostats_types_1 = require("@seasketch/geostats-types");
/**
 * Given the path to a raster file, this function will calculate metadata useful
 * for data handling and cartography.
 *
 * @param filepath
 * @returns A promise that resolves to a RasterInfo object
 */
async function rasterInfoForBands(filepath) {
    const dataset = await gdal_async_1.default.openAsync(filepath);
    const info = {
        byteEncoding: false,
        bands: [],
        metadata: dataset.getMetadata(),
        presentation: geostats_types_1.SuggestedRasterPresentation.rgb,
    };
    const samples = {};
    const categories = {};
    let categoryCount = 0;
    let isByteEncoding = false;
    const colorInterpretations = dataset.bands.map((band) => band.colorInterpretation);
    if (process.env.DEBUG) {
        console.log(colorInterpretations);
    }
    const isRGB = colorInterpretations.includes("Red") &&
        colorInterpretations.includes("Green") &&
        colorInterpretations.includes("Blue");
    dataset.bands.forEach((band) => {
        var _a, _b, _c;
        const dataType = band.dataType;
        if (dataType === "Byte") {
            isByteEncoding = true;
        }
        const isFloat = /float/i.test(dataType || "");
        const stats = band.getStatistics(false, true);
        const metadata = band.getMetadata();
        const size = band.size;
        const noDataValue = band.noDataValue;
        if (noDataValue !== null && !isNaN(noDataValue)) {
            if (noDataValue === stats.min) {
                stats.min = null;
            }
            if (noDataValue === stats.max) {
                stats.max = null;
            }
        }
        let count = band.size.x * band.size.y;
        let sampledCount = 0;
        const sampledPixelValues = [];
        const samplingInterval = Math.max(1, Math.floor(count / 500000));
        let num = 0;
        let sum = 0;
        for (var y = 0; y < size.y; y++) {
            const values = band.pixels.read(0, y, size.x, 1);
            for (var i = 0; i < size.x; i++) {
                const value = values[i];
                num++;
                if (isRGB || (!isNaN(value) && value !== noDataValue)) {
                    if (stats.min === null || value < stats.min) {
                        stats.min = value;
                    }
                    if (stats.max === null || value > stats.max) {
                        stats.max = value;
                    }
                    sum += value;
                    if (num % samplingInterval === 0) {
                        sampledPixelValues.push(value);
                        sampledCount++;
                        if (categories[value]) {
                            categories[value]++;
                        }
                        else if (categoryCount < 256) {
                            categories[value] = 1;
                            categoryCount++;
                        }
                    }
                }
            }
        }
        // Check if this dataset can be represented using simple byte encoding
        if (Object.keys(categories).length <= 255 &&
            stats.max !== null &&
            stats.min !== null &&
            stats.max - stats.min <= 255) {
            for (const key in categories) {
                if (key.indexOf(".") !== -1) {
                    break;
                }
            }
            isByteEncoding = true;
            if (process.env.DEBUG) {
                console.log("Byte encoding detected");
            }
        }
        if (!isRGB) {
            if (sampledPixelValues.indexOf(stats.min) === -1) {
                sampledPixelValues.push(stats.min);
            }
            if (sampledPixelValues.indexOf(stats.max) === -1) {
                sampledPixelValues.push(stats.max);
            }
        }
        stats.mean = sum / num;
        if (((_a = band.colorInterpretation) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === "red") {
            samples[0] = sampledPixelValues.slice();
        }
        else if (((_b = band.colorInterpretation) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === "green") {
            samples[1] = sampledPixelValues.slice();
        }
        else if (((_c = band.colorInterpretation) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === "blue") {
            samples[2] = sampledPixelValues.slice();
        }
        sampledPixelValues.sort((a, b) => a - b);
        if (stats.min === null) {
            throw new Error("No data values found in raster");
        }
        if (stats.max === null) {
            throw new Error("No data values found in raster");
        }
        const categoryBuckets = Object.keys(categories)
            .reduce((acc, key) => {
            acc.push([
                parseInt(key),
                categories[/\./.test(key) ? parseFloat(key) : parseInt(key)] /
                    sampledCount,
            ]);
            return acc;
        }, [])
            .sort((a, b) => a[0] - b[0]);
        // Calculate base and interval
        // rgb-encoded tiles can represent 16,777,216 positive values
        // If the full range of the dataset cannot be represented in this range,
        // the client may apply a scale and offset to the data.
        // This should be adequate for int16 or uint16 data, but may not be for
        // 32-bit values. float values should stretch to the full range for more
        // precision.
        let base = stats.min >= 0 ? 0 : stats.min;
        const range = stats.max - base;
        let interval = 1;
        let scale = 1;
        if (!isByteEncoding &&
            (band.colorInterpretation === "Gray" ||
                (isFloat && categoryBuckets.length > 12) ||
                range > 16777216)) {
            // find a scaling factor that will represent the range of data values with
            // the full range of the encoding scheme.
            // This is useful for float values which may just be 0-1
            if (range < 500) {
                scale = 1;
                // stretch values to fit full encoding scheme
                // Use factors of 10, e.g. 10, 100, 1000, etc.
                // TODO: fix this in the future when you have a 0-1 float dataset to
                // test
                while (range * (scale * 10) < 16777216) {
                    scale *= 10;
                    // break;
                }
                if (process.env.DEBUG) {
                    console.log("Stretching values to fit full encoding scheme. Scale:", scale);
                }
            }
            else if (range > 16777216) {
                // compress values to fit full encoding scheme
                // Use factors of 10, e.g. 0.1, 0.01, 0.001, etc.
                while (range * (scale / 10) > 16777216) {
                    scale = scale / 10;
                }
                if (process.env.DEBUG) {
                    console.log("Compressing values to fit full encoding scheme. Scale:", scale);
                }
            }
            interval = 1 / scale;
        }
        const b = {
            name: metadata.standard_name ||
                metadata.long_name ||
                metadata.units ||
                `band ${band.id}`,
            metadata,
            colorInterpretation: band.colorInterpretation || null,
            minimum: stats.min,
            stats: {
                mean: stats.mean,
                stdev: stats.std_dev,
                equalInterval: {},
                naturalBreaks: {},
                quantiles: {},
                standardDeviations: {},
                geometricInterval: {},
                histogram: (0, stats_1.equalIntervalBuckets)(sampledPixelValues, 49, stats.max, true),
                categories: categoryBuckets,
            },
            maximum: stats.max,
            noDataValue: band.noDataValue && isNaN(band.noDataValue)
                ? null
                : band.noDataValue,
            offset: band.offset,
            scale: band.scale,
            count,
            base,
            interval,
        };
        const numBreaks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        for (const n of numBreaks) {
            addBuckets(b.stats.equalInterval, n, (0, stats_1.equalIntervalBuckets)(sampledPixelValues, n, b.maximum, true));
            addBuckets(b.stats.geometricInterval, n, (0, stats_1.geometricIntervalBuckets)(sampledPixelValues, n, b.minimum, b.maximum, true));
            addBuckets(b.stats.quantiles, n, (0, stats_1.quantileBuckets)(sampledPixelValues, n, b.minimum, b.maximum, true, true));
            if (sampledPixelValues.length > n) {
                addBuckets(b.stats.naturalBreaks, n, (0, stats_1.naturalBreaksBuckets)(sampledPixelValues, n, b.stats.histogram.length, b.minimum, b.maximum, 10000, true));
            }
            // Seems to be a quirk in the library where it returns -9999 for stdev when it can't be calculated
            if (b.stats.stdev !== -9999) {
                addBuckets(b.stats.standardDeviations, n, (0, stats_1.stdDevBuckets)(sampledPixelValues, n, b.stats.mean, b.stats.stdev, b.minimum, b.maximum, true));
            }
            samples[n] = sampledPixelValues;
        }
        if (b.colorInterpretation === "Palette") {
            const colorTable = band.colorTable;
            if (colorTable) {
                b.colorTable = [];
                for (var i = 0; i < colorTable.count(); i++) {
                    const entry = colorTable.get(i);
                    if (entry && b.stats.categories.find((c) => c[0] === i)) {
                        b.colorTable.push([
                            i,
                            entry.c4 !== undefined && entry.c4 !== 255
                                ? `rgba(${entry.c1},${entry.c2},${entry.c3},${entry.c4})`
                                : `rgb(${entry.c1},${entry.c2},${entry.c3})`,
                        ]);
                    }
                }
                b.colorTable.sort((a, b) => a[0] - b[0]);
            }
        }
        info.bands.push(b);
    });
    if (!isRGB &&
        info.bands[0].colorInterpretation === "Palette" &&
        info.bands[0].colorTable &&
        info.bands[0].colorTable.length <= 255 &&
        info.bands[0].minimum >= 0 &&
        info.bands[0].maximum <= 255) {
        info.presentation = geostats_types_1.SuggestedRasterPresentation.categorical;
        isByteEncoding = true;
    }
    else if (!isRGB &&
        info.bands[0].stats.categories.length < 4 &&
        info.bands.length === 1 &&
        info.bands[0].colorInterpretation !== "Gray") {
        info.presentation = geostats_types_1.SuggestedRasterPresentation.categorical;
        isByteEncoding = true;
    }
    else if (!isRGB && info.bands[0].colorInterpretation === "Gray") {
        info.presentation = geostats_types_1.SuggestedRasterPresentation.continuous;
    }
    if (info.presentation === geostats_types_1.SuggestedRasterPresentation.rgb) {
        const pixels = [];
        if (samples[0] && samples[1] && samples[2]) {
            if (samples[0].length !== samples[1].length ||
                samples[0].length !== samples[2].length) {
                throw new Error("RGB bands have different lengths");
            }
            for (let i = 0; i < samples[0].length; i++) {
                pixels.push([samples[0][i], samples[1][i], samples[2][i]]);
            }
        }
        if (pixels.length > 0) {
            info.representativeColorsForRGB = (0, stats_1.getRepresentativeColors)(pixels, 9, 10000);
        }
    }
    info.byteEncoding = isByteEncoding;
    if (info.byteEncoding &&
        info.bands[0].stats.categories.length > 0 &&
        !isRGB) {
        if (info.bands[0].stats.categories.length <= 128) {
            info.presentation = geostats_types_1.SuggestedRasterPresentation.categorical;
        }
        else {
            info.presentation = geostats_types_1.SuggestedRasterPresentation.continuous;
        }
    }
    return info;
}
function addBuckets(subject, numBuckets, value) {
    if (value) {
        subject[numBuckets] = value;
    }
}
//# sourceMappingURL=rasterInfoForBands.js.map