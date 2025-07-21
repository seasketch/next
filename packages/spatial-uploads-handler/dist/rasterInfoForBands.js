"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rasterInfoForBands = void 0;
var gdal_async_1 = __importDefault(require("gdal-async"));
var stats_1 = require("./src/stats");
var geostats_types_1 = require("@seasketch/geostats-types");
/**
 * Given the path to a raster file, this function will calculate metadata useful
 * for data handling and cartography.
 *
 * @param filepath
 * @returns A promise that resolves to a RasterInfo object
 */
function rasterInfoForBands(filepath) {
    return __awaiter(this, void 0, void 0, function () {
        var dataset, info, samples, categories, categoryCount, pixels, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, gdal_async_1.default.openAsync(filepath)];
                case 1:
                    dataset = _a.sent();
                    info = {
                        bands: [],
                        metadata: dataset.getMetadata(),
                        presentation: geostats_types_1.SuggestedRasterPresentation.rgb,
                    };
                    samples = {};
                    categories = {};
                    categoryCount = 0;
                    dataset.bands.forEach(function (band) {
                        var _a, _b, _c;
                        var dataType = band.dataType;
                        var isFloat = /float/i.test(dataType || "");
                        var stats = band.getStatistics(false, true);
                        var metadata = band.getMetadata();
                        var size = band.size;
                        var noDataValue = band.noDataValue;
                        if (noDataValue !== null) {
                            if (noDataValue === stats.min) {
                                stats.min = null;
                            }
                            if (noDataValue === stats.max) {
                                stats.max = null;
                            }
                        }
                        var count = band.size.x * band.size.y;
                        var sampledCount = 0;
                        var sampledPixelValues = [];
                        var samplingInterval = Math.max(1, Math.floor(count / 500000));
                        var num = 0;
                        var sum = 0;
                        // TODO: Can this be sped up by reading a block at a time?
                        for (var y = 0; y < size.y; y++) {
                            var values = band.pixels.read(0, y, size.x, 1);
                            for (var i = 0; i < size.x; i++) {
                                var value = values[i];
                                if (value !== noDataValue) {
                                    if (stats.min === null || value < stats.min) {
                                        stats.min = value;
                                    }
                                    if (stats.max === null || value > stats.max) {
                                        stats.max = value;
                                    }
                                    sum += value;
                                    num++;
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
                        if (sampledPixelValues.indexOf(stats.min) === -1) {
                            sampledPixelValues.push(stats.min);
                        }
                        if (sampledPixelValues.indexOf(stats.max) === -1) {
                            sampledPixelValues.push(stats.max);
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
                        sampledPixelValues.sort(function (a, b) { return a - b; });
                        if (stats.min === null) {
                            throw new Error("No data values found in raster");
                        }
                        if (stats.max === null) {
                            throw new Error("No data values found in raster");
                        }
                        var categoryBuckets = Object.keys(categories)
                            .reduce(function (acc, key) {
                            acc.push([
                                parseInt(key),
                                categories[/\./.test(key) ? parseFloat(key) : parseInt(key)] /
                                    sampledCount,
                            ]);
                            return acc;
                        }, [])
                            .sort(function (a, b) { return a[0] - b[0]; });
                        // Calculate base and interval
                        // rgb-encoded tiles can represent 16,777,216 positive values
                        // If the full range of the dataset cannot be represented in this range,
                        // the client may apply a scale and offset to the data.
                        // This should be adequate for int16 or uint16 data, but may not be for
                        // 32-bit values. float values should stretch to the full range for more
                        // precision.
                        var base = stats.min >= 0 ? 0 : stats.min;
                        var range = stats.max - base;
                        var interval = 1;
                        var scale = 1;
                        if ((isFloat && categoryBuckets.length > 12) || range > 16777216) {
                            // find a scaling factor that will represent the range of data values with
                            // the full range of the encoding scheme.
                            if (range < 16777216) {
                                // stretch values to fit full encoding scheme
                                // Use factors of 10, e.g. 10, 100, 1000, etc.
                                while (range * (scale * 10) < 16777216) {
                                    scale *= 10;
                                }
                            }
                            else if (range > 16777216) {
                                // compress values to fit full encoding scheme
                                // Use factors of 10, e.g. 0.1, 0.01, 0.001, etc.
                                while (range * (scale / 10) > 16777216) {
                                    scale = scale / 10;
                                }
                            }
                            interval = 1 / scale;
                        }
                        var b = {
                            name: metadata.standard_name ||
                                metadata.long_name ||
                                metadata.units ||
                                "band " + band.id,
                            metadata: metadata,
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
                                histogram: stats_1.equalIntervalBuckets(sampledPixelValues, 49, stats.max, true),
                                categories: categoryBuckets,
                            },
                            maximum: stats.max,
                            noDataValue: band.noDataValue,
                            offset: band.offset,
                            scale: band.scale,
                            count: count,
                            base: base,
                            interval: interval,
                        };
                        var numBreaks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
                        for (var _i = 0, numBreaks_1 = numBreaks; _i < numBreaks_1.length; _i++) {
                            var n = numBreaks_1[_i];
                            addBuckets(b.stats.equalInterval, n, stats_1.equalIntervalBuckets(sampledPixelValues, n, b.maximum, true));
                            addBuckets(b.stats.geometricInterval, n, stats_1.geometricIntervalBuckets(sampledPixelValues, n, b.minimum, b.maximum, true));
                            addBuckets(b.stats.quantiles, n, stats_1.quantileBuckets(sampledPixelValues, n, b.minimum, b.maximum, true, true));
                            addBuckets(b.stats.naturalBreaks, n, stats_1.naturalBreaksBuckets(sampledPixelValues, n, b.stats.histogram.length, b.minimum, b.maximum, 10000, true));
                            addBuckets(b.stats.standardDeviations, n, stats_1.stdDevBuckets(sampledPixelValues, n, b.stats.mean, b.stats.stdev, b.minimum, b.maximum, true));
                            samples[n] = sampledPixelValues;
                        }
                        if (b.colorInterpretation === "Palette") {
                            var colorTable = band.colorTable;
                            if (colorTable) {
                                b.colorTable = [];
                                for (var i = 0; i < colorTable.count(); i++) {
                                    var entry = colorTable.get(i);
                                    if (entry && b.stats.categories.find(function (c) { return c[0] === i; })) {
                                        b.colorTable.push([
                                            i,
                                            entry.c4 !== undefined && entry.c4 !== 255
                                                ? "rgba(" + entry.c1 + "," + entry.c2 + "," + entry.c3 + "," + entry.c4 + ")"
                                                : "rgb(" + entry.c1 + "," + entry.c2 + "," + entry.c3 + ")",
                                        ]);
                                    }
                                }
                                b.colorTable.sort(function (a, b) { return a[0] - b[0]; });
                            }
                        }
                        info.bands.push(b);
                    });
                    if (info.bands[0].colorInterpretation === "Palette" &&
                        info.bands[0].colorTable &&
                        info.bands[0].colorTable.length <= 255 &&
                        info.bands[0].minimum >= 0 &&
                        info.bands[0].maximum <= 255) {
                        info.presentation = geostats_types_1.SuggestedRasterPresentation.categorical;
                    }
                    else if (info.bands[0].stats.categories.length < 12 &&
                        info.bands.length === 1) {
                        info.presentation = geostats_types_1.SuggestedRasterPresentation.categorical;
                    }
                    else if (info.bands[0].colorInterpretation === "Gray") {
                        info.presentation = geostats_types_1.SuggestedRasterPresentation.continuous;
                    }
                    if (info.presentation === geostats_types_1.SuggestedRasterPresentation.rgb) {
                        pixels = [];
                        if (samples[0] && samples[1] && samples[2]) {
                            if (samples[0].length !== samples[1].length ||
                                samples[0].length !== samples[2].length) {
                                throw new Error("RGB bands have different lengths");
                            }
                            for (i = 0; i < samples[0].length; i++) {
                                pixels.push([samples[0][i], samples[1][i], samples[2][i]]);
                            }
                        }
                        if (pixels.length > 0) {
                            info.representativeColorsForRGB = stats_1.getRepresentativeColors(pixels, 9, 10000);
                        }
                    }
                    return [2 /*return*/, info];
            }
        });
    });
}
exports.rasterInfoForBands = rasterInfoForBands;
function addBuckets(subject, numBuckets, value) {
    if (value) {
        subject[numBuckets] = value;
    }
}
