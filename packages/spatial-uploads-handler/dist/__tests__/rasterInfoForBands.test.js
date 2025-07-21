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
Object.defineProperty(exports, "__esModule", { value: true });
var geostats_types_1 = require("@seasketch/geostats-types");
var rasterInfoForBands_1 = require("../rasterInfoForBands");
describe("rasterInfoForBands", function () {
    jest.setTimeout(100000);
    test("Natural Earth 50M", function () { return __awaiter(void 0, void 0, void 0, function () {
        var info;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, rasterInfoForBands_1.rasterInfoForBands(__dirname + "/NE2_50M_SR.tif")];
                case 1:
                    info = _a.sent();
                    // console.timeEnd("ne2");
                    expect(info.bands.length).toBe(3);
                    expect(info.bands[0].base).toBe(0);
                    expect(info.bands
                        .map(function (b) { return b.colorInterpretation; })
                        .sort()
                        .reverse()).toEqual(["Red", "Green", "Blue"]);
                    expect(info.representativeColorsForRGB).toBeTruthy();
                    expect(info.representativeColorsForRGB.length).toBe(9);
                    return [2 /*return*/];
            }
        });
    }); });
    test("SST", function () { return __awaiter(void 0, void 0, void 0, function () {
        var info, band;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, rasterInfoForBands_1.rasterInfoForBands(__dirname + "/sst.tif")];
                case 1:
                    info = _b.sent();
                    // console.timeEnd("sst");
                    expect(info.bands.length).toBe(1);
                    band = info.bands[0];
                    expect(band.base).toBe(-3011);
                    expect(band.name).toBe("sea_surface_temperature");
                    expect((_a = band.colorInterpretation) === null || _a === void 0 ? void 0 : _a.toLowerCase()).toBe("gray");
                    expect(band.noDataValue).toBe(-32768);
                    expect(band.minimum).toBe(-3011);
                    expect(band.maximum).toBe(3858);
                    expect(band.stats.mean).toBeCloseTo(847.473561154241);
                    expect(band.stats.stdev).toBeCloseTo(1171.371851768451);
                    expect(band.count).toBe(48846121);
                    expect(band.offset).toBe(0);
                    expect(band.scale).toBe(0.01);
                    expect(band.interval).toBe(1);
                    expect(band.stats.equalInterval[5].map(roundRasterBucket)).toEqual([
                        [-3011, 0],
                        [-1637.2, 0],
                        [-263.4, 0.6445],
                        [1110.4, 0.1907],
                        [2484.2, 0.1649],
                        [3858, null],
                    ].map(roundRasterBucket));
                    expect(band.stats.equalInterval[10].map(roundRasterBucket)).toEqual([
                        [-3011, 0],
                        [-2324.1, 0],
                        [-1637.2, 0],
                        [-950.3, 0],
                        [-263.4, 0.5353],
                        [423.5, 0.1093],
                        [1110.4, 0.0851],
                        [1797.3, 0.1057],
                        [2484.2, 0.1643],
                        [3171.1, 0.0006],
                        [3858, null],
                    ].map(roundRasterBucket));
                    expect(band.stats.histogram.map(roundRasterBucket)).toEqual(sstHist.map(roundRasterBucket));
                    // TODO: how does Felt discard unusable geometric intervals?
                    // expect(Object.keys(band.stats.geometricInterval).length).toBe(0);
                    expect(band.stats.quantiles[5].map(roundRasterBucket)).toEqual([
                        [-3011, 0.0162],
                        [-180, 0.3839],
                        [-91, 0.2],
                        [783, 0.2],
                        [2251, 0.2002],
                        [3858, null],
                    ].map(roundRasterBucket));
                    expect(band.stats.quantiles[3].map(roundRasterBucket)).toEqual([
                        [-3011, 0.3281],
                        [-179, 0.3386],
                        [1294, 0.3335],
                        [3858, null],
                    ].map(roundRasterBucket));
                    expect(band.stats.quantiles[11].map(roundRasterBucket)).toEqual([
                        [-3011, 0.0162],
                        [-180, 0],
                        [-180, 0],
                        [-180, 0],
                        [-162, 0.0914],
                        [75, 0.091],
                        [474, 0.091],
                        [1043, 0.0909],
                        [1782, 0.091],
                        [2375, 0.0907],
                        [2843, 0.0912],
                        [3858, null],
                    ].map(roundRasterBucket));
                    expect(band.stats.naturalBreaks[3].map(roundRasterBucket)).toEqual([
                        [-3011, 0.5676],
                        [606, 0.1883],
                        [1958, 0.2443],
                        [3858, null],
                    ].map(roundRasterBucket));
                    expect(band.stats.naturalBreaks[6].map(roundRasterBucket)).toEqual([
                        [-3011, 0.4652],
                        [115, 0.115],
                        [689, 0.0917],
                        [1347, 0.0914],
                        [2002, 0.0948],
                        [2595, 0.15],
                        [3858, null],
                    ].map(roundRasterBucket));
                    expect(band.stats.naturalBreaks[12].map(roundRasterBucket)).toEqual([
                        [-3011, 0.4052],
                        [-61, 0.07],
                        [175, 0.0561],
                        [439, 0.05],
                        [730, 0.0485],
                        [1047, 0.0387],
                        [1382, 0.0416],
                        [1720, 0.0526],
                        [2043, 0.047],
                        [2358, 0.0479],
                        [2663, 0.066],
                        [2915, 0.06],
                        [3858, null],
                    ].map(roundRasterBucket));
                    expect(band.stats.standardDeviations[5].map(roundRasterBucket)).toEqual([
                        [-3011, 0],
                        [-909.5842, 0.5021],
                        [261.7876, 0.1813],
                        [1433.1595, 0.1723],
                        [2604.5313, 0.1446],
                        [3858, null],
                    ].map(roundRasterBucket));
                    expect(band.stats.categories.length).toBe(256);
                    return [2 /*return*/];
            }
        });
    }); });
    test("SST Float", function () { return __awaiter(void 0, void 0, void 0, function () {
        var info, band;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, rasterInfoForBands_1.rasterInfoForBands(__dirname + "/sst-float.tiff")];
                case 1:
                    info = _b.sent();
                    // console.timeEnd("sstf");
                    expect(info.bands.length).toBe(1);
                    band = info.bands[0];
                    expect(band.base).toBeCloseTo(-1.85);
                    expect(band.interval).toBe(0.01);
                    expect(band.name).toBe("band 1");
                    expect((_a = band.colorInterpretation) === null || _a === void 0 ? void 0 : _a.toLowerCase()).toBe("gray");
                    expect(band.noDataValue).toBe(null);
                    expect(band.minimum).toBeCloseTo(-1.850000023841858);
                    expect(band.maximum).toBe(99999);
                    expect(band.stats.mean).toBeCloseTo(45673.07731024881);
                    expect(band.stats.stdev).toBeCloseTo(49802.0741471116);
                    expect(band.count).toBe(1036800);
                    bucketsToBeCloseTo(band.stats.equalInterval[5], [
                        [-1.85, 0.5438],
                        [19998.32, 0],
                        [39998.49, 0],
                        [59998.66, 0],
                        [79998.83, 0.4563],
                        [99999, null],
                    ]);
                    bucketsToBeCloseTo(band.stats.equalInterval[10], [
                        [-1.85, 0.5438],
                        [9998.235, 0],
                        [19998.32, 0],
                        [29998.405, 0],
                        [39998.49, 0],
                        [49998.575, 0],
                        [59998.66, 0],
                        [69998.745, 0],
                        [79998.83, 0],
                        [89998.915, 0.4563],
                        [99999, null],
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("Palleted color interpretation", function () { return __awaiter(void 0, void 0, void 0, function () {
        var info, band, sumCategoryFraction;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, rasterInfoForBands_1.rasterInfoForBands(__dirname + "/landcover.tiff")];
                case 1:
                    info = _a.sent();
                    // console.timeEnd("landcover.tiff");
                    expect(info.presentation).toBe(geostats_types_1.SuggestedRasterPresentation.categorical);
                    expect(info.bands[0].colorTable).toBeDefined();
                    expect(info.bands[0].colorInterpretation).toBe("Palette");
                    expect(info.bands[0].colorTable.length).toBe(info.bands[0].stats.categories.length);
                    band = info.bands[0];
                    expect(band.minimum).toBe(0);
                    expect(band.maximum).toBe(95);
                    expect(band.stats.mean).toBeCloseTo(23.347842106912356);
                    sumCategoryFraction = band.stats.categories.reduce(function (acc, _a) {
                        var _ = _a[0], fraction = _a[1];
                        return acc + fraction;
                    }, 0);
                    expect(sumCategoryFraction).toBeCloseTo(1);
                    expect(band.count).toBe(26328575);
                    return [2 /*return*/];
            }
        });
    }); });
    test("Maldives float", function () { return __awaiter(void 0, void 0, void 0, function () {
        var info;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, rasterInfoForBands_1.rasterInfoForBands(__dirname + "/maldives.tif")];
                case 1:
                    info = _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test.todo("base and interval, RGB encoding");
});
function bucketsToBeCloseTo(a, b) {
    expect(a.length).toBe(b.length);
    for (var i = 0; i < a.length; i++) {
        expect(a[i][0]).toBeCloseTo(b[i][0]);
        if (a[i][1] === null) {
            expect(b[i][1]).toBeNull();
            continue;
        }
        else if (b[i][1] === null) {
            expect(a[i][1]).toBeNull();
            continue;
        }
        else {
            expect(a[i][1]).toBeCloseTo(b[i][1]);
        }
    }
}
function roundRasterBucket(b) {
    return [
        Math.round(b[0] * 100) / 100,
        b[1] === null ? null : Math.round(b[1] * 100) / 100,
    ];
}
var sstHist = [
    [-3011, 0],
    [-2870.8163, 0],
    [-2730.6327, 0],
    [-2590.449, 0],
    [-2450.2653, 0],
    [-2310.0816, 0],
    [-2169.898, 0],
    [-2029.7143, 0],
    [-1889.5306, 0],
    [-1749.3469, 0],
    [-1609.1633, 0],
    [-1468.9796, 0],
    [-1328.7959, 0],
    [-1188.6122, 0],
    [-1048.4286, 0],
    [-908.2449, 0],
    [-768.0612, 0],
    [-627.8776, 0],
    [-487.6939, 0],
    [-347.5102, 0],
    [-207.3265, 0.4098],
    [-67.1429, 0.0442],
    [73.0408, 0.0364],
    [213.2245, 0.0308],
    [353.4082, 0.028],
    [493.5918, 0.0259],
    [633.7755, 0.0237],
    [773.9592, 0.0203],
    [914.1429, 0.019],
    [1054.3265, 0.0171],
    [1194.5102, 0.0166],
    [1334.6939, 0.017],
    [1474.8776, 0.0182],
    [1615.0612, 0.0177],
    [1755.2449, 0.0211],
    [1895.4286, 0.0227],
    [2035.6122, 0.021],
    [2175.7959, 0.0206],
    [2315.9796, 0.0214],
    [2456.1633, 0.0234],
    [2596.3469, 0.0271],
    [2736.5306, 0.0401],
    [2876.7143, 0.0475],
    [3016.898, 0.03],
    [3157.0816, 0.0014],
    [3297.2653, 0],
    [3437.449, 0],
    [3577.6327, 0],
    [3717.8163, 0],
    [3858, null],
];
