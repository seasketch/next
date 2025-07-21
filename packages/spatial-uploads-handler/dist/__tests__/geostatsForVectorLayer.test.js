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
var geostatsForVectorLayer_1 = require("../src/geostatsForVectorLayer");
describe("geostatsForVectorLayers", function () {
    jest.setTimeout(100000);
    test("Nature Earth Countries", function () { return __awaiter(void 0, void 0, void 0, function () {
        var layers, layer, attributeNames, ISO_A3, labelRank, scalerank, poprank, popEst, breaks, quantiles, stdDevations, stddevs, eqIntervals, labelEqIntervals, naturalBreaks, labelNaturalBreaks, scaleRankNaturalBreaks, scaleRankNaturalBreaks4;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        return __generator(this, function (_y) {
            switch (_y.label) {
                case 0: return [4 /*yield*/, geostatsForVectorLayer_1.geostatsForVectorLayers(__dirname + "/ne_10m_admin_0_countries/ne_10m_admin_0_countries.shp")];
                case 1:
                    layers = _y.sent();
                    layer = layers[0];
                    expect(layer.layer).toBe("ne_10m_admin_0_countries");
                    expect(layer.count).toBe(258);
                    expect(layer.geometry).toBe("Polygon");
                    expect(layer.attributeCount).toBe(168);
                    expect(layer.attributes.length).toBe(168);
                    attributeNames = layer.attributes.map(function (a) { return a.attribute; });
                    expect(attributeNames).toContain("ADMIN");
                    expect(attributeNames).toContain("ISO_A3");
                    expect(attributeNames).toContain("ISO_A2");
                    expect(attributeNames).toContain("ISO_A3_EH");
                    ISO_A3 = layer.attributes.find(function (a) { return a.attribute === "ISO_A3"; });
                    expect(ISO_A3).toBeTruthy();
                    expect(ISO_A3.type).toBe("string");
                    labelRank = layer.attributes.find(function (a) { return a.attribute === "LABELRANK"; });
                    expect(labelRank).toBeTruthy();
                    scalerank = layer.attributes.find(function (a) { return a.attribute === "scalerank"; });
                    expect(scalerank).toBeTruthy();
                    expect(scalerank.type).toBe("number");
                    expect(scalerank.min).toBe(0);
                    expect(scalerank.max).toBe(6);
                    expect((_a = scalerank.stats) === null || _a === void 0 ? void 0 : _a.histogram).toEqual([
                        [0, 178],
                        [0.12244897959183673, 0],
                        [0.24489795918367346, 0],
                        [0.36734693877551017, 0],
                        [0.4897959183673469, 0],
                        [0.6122448979591837, 0],
                        [0.7346938775510203, 0],
                        [0.8571428571428571, 0],
                        [0.9795918367346939, 11],
                        [1.1020408163265305, 0],
                        [1.2244897959183674, 0],
                        [1.346938775510204, 0],
                        [1.4693877551020407, 0],
                        [1.5918367346938775, 0],
                        [1.7142857142857142, 0],
                        [1.836734693877551, 0],
                        [1.9591836734693877, 0],
                        [2.0816326530612246, 0],
                        [2.204081632653061, 0],
                        [2.326530612244898, 0],
                        [2.4489795918367347, 0],
                        [2.571428571428571, 0],
                        [2.693877551020408, 0],
                        [2.816326530612245, 0],
                        [2.9387755102040813, 32],
                        [3.061224489795918, 0],
                        [3.183673469387755, 0],
                        [3.306122448979592, 0],
                        [3.4285714285714284, 0],
                        [3.5510204081632653, 0],
                        [3.673469387755102, 0],
                        [3.7959183673469385, 0],
                        [3.9183673469387754, 0],
                        [4.040816326530612, 0],
                        [4.163265306122449, 0],
                        [4.285714285714286, 0],
                        [4.408163265306122, 0],
                        [4.530612244897959, 0],
                        [4.653061224489796, 0],
                        [4.775510204081632, 0],
                        [4.8979591836734695, 27],
                        [5.020408163265306, 0],
                        [5.142857142857142, 0],
                        [5.26530612244898, 0],
                        [5.387755102040816, 0],
                        [5.5102040816326525, 0],
                        [5.63265306122449, 0],
                        [5.755102040816326, 0],
                        [5.877551020408163, 10],
                        [6, null],
                    ]);
                    expect(Math.round(scalerank.stats.avg * 1000)).toEqual(Math.round(1.1705426356589144 * 1000));
                    expect(scalerank.count).toBe(258);
                    poprank = layer.attributes.find(function (a) { return a.attribute === "POP_RANK"; });
                    expect(poprank).toBeTruthy();
                    expect(poprank.type).toBe("number");
                    expect(poprank.min).toBe(1);
                    expect(poprank.max).toBe(18);
                    expect((_b = poprank.stats) === null || _b === void 0 ? void 0 : _b.stdev).toBe(4.188021713152829);
                    expect(poprank.values).toEqual({
                        "1": 14,
                        "2": 2,
                        "3": 1,
                        "4": 7,
                        "5": 6,
                        "6": 7,
                        "7": 11,
                        "8": 13,
                        "9": 12,
                        "10": 10,
                        "11": 14,
                        "12": 39,
                        "13": 31,
                        "14": 32,
                        "15": 30,
                        "16": 15,
                        "17": 12,
                        "18": 2,
                    });
                    expect(poprank.countDistinct).toBe(18);
                    popEst = layer.attributes.find(function (a) { return a.attribute === "POP_EST"; });
                    expect((_c = popEst.stats) === null || _c === void 0 ? void 0 : _c.stdev).toEqual(126590277.89107136);
                    expect((_d = popEst.stats) === null || _d === void 0 ? void 0 : _d.geometricInterval).toBeTruthy();
                    breaks = (_e = popEst.stats) === null || _e === void 0 ? void 0 : _e.geometricInterval[4].map(function (b) { return [
                        Math.round(b[0]),
                        b[1],
                    ]; });
                    expect(breaks).toEqual([
                        [0, 14],
                        [193, 28],
                        [37386, 113],
                        [7228763, 103],
                        [1397715000, null],
                    ]);
                    expect(Math.round(((_f = popEst.stats) === null || _f === void 0 ? void 0 : _f.stdev) || 0)).toEqual(Math.round(126590278));
                    expect((_g = popEst.stats) === null || _g === void 0 ? void 0 : _g.quantiles).toBeTruthy();
                    expect((_h = popEst.stats) === null || _h === void 0 ? void 0 : _h.quantiles[5]).toBeTruthy();
                    expect(Math.round((_j = popEst.stats) === null || _j === void 0 ? void 0 : _j.avg)).toBe(Math.round(29756045.4352713));
                    quantiles = (_k = popEst.stats) === null || _k === void 0 ? void 0 : _k.quantiles[5].map(function (q) { return [
                        Math.round(q[0]),
                        q[1],
                    ]; });
                    expect(quantiles).toEqual([
                        [0, 51],
                        [57216, 52],
                        [1394973, 51],
                        [7169455, 52],
                        [25876380, 52],
                        [1397715000, null],
                    ]);
                    expect(Object.keys(((_l = labelRank.stats) === null || _l === void 0 ? void 0 : _l.quantiles) || {})).toEqual([
                        "3",
                        "4",
                        "5",
                    ]);
                    stdDevations = (_m = popEst.stats) === null || _m === void 0 ? void 0 : _m.standardDeviations[4].map(function (b) { return [
                        Math.round(b[0]),
                        b[1],
                    ]; });
                    expect(Object.keys(((_o = popEst.stats) === null || _o === void 0 ? void 0 : _o.standardDeviations) || {})).toEqual([
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "10",
                        "11",
                        "12",
                    ]);
                    expect(stdDevations).toEqual([
                        [0, 243],
                        [93051184, 11],
                        [219641462, 2],
                        [346231740, 2],
                        [1397715000, null],
                    ]);
                    expect(Object.keys(((_p = labelRank.stats) === null || _p === void 0 ? void 0 : _p.standardDeviations) || {})).toEqual([
                        "3",
                        "4",
                        "5",
                        "6",
                    ]);
                    stddevs = (_q = labelRank.stats) === null || _q === void 0 ? void 0 : _q.standardDeviations[3].map(roundBucket);
                    expect(stddevs).toEqual([
                        [2, 96],
                        [3.503692216057039, 90],
                        [5.07770313278017, 72],
                        [10, null],
                    ].map(roundBucket));
                    eqIntervals = (_r = popEst.stats) === null || _r === void 0 ? void 0 : _r.equalInterval[5].map(function (b) { return [
                        Math.round(b[0]),
                        b[1],
                    ]; });
                    expect(eqIntervals).toEqual([
                        [0, 255],
                        [279543000, 1],
                        [559086000, 0],
                        [838629000, 0],
                        [1118172000, 2],
                        [1397715000, null],
                    ]);
                    labelEqIntervals = (_s = labelRank.stats) === null || _s === void 0 ? void 0 : _s.equalInterval[5].map(function (b) { return [
                        Math.round(b[0]),
                        b[1],
                    ]; });
                    expect(labelEqIntervals).toEqual([
                        [2, 96],
                        [3.6, 90],
                        [5.2, 65],
                        [6.800000000000001, 3],
                        [8.4, 4],
                        [10, null],
                    ].map(function (_a) {
                        var a = _a[0], b = _a[1];
                        return [Math.round(a), b];
                    }));
                    naturalBreaks = (_t = popEst.stats) === null || _t === void 0 ? void 0 : _t.naturalBreaks[5].map(function (b) { return [
                        Math.round(b[0]),
                        b[1],
                    ]; });
                    expect(naturalBreaks).toEqual([
                        [0, 200],
                        [21803000, 38],
                        [69625582, 12],
                        [163046161, 5],
                        [328239523, 3],
                        [1397715000, null],
                    ].map(function (_a) {
                        var a = _a[0], b = _a[1];
                        return [Math.round(a), b];
                    }));
                    labelNaturalBreaks = (_u = labelRank.stats) === null || _u === void 0 ? void 0 : _u.naturalBreaks[5].map(function (b) { return [
                        Math.round(b[0]),
                        b[1],
                    ]; });
                    expect(labelNaturalBreaks).toEqual([
                        [2, 36],
                        [3, 60],
                        [4, 45],
                        [5, 110],
                        [7, 7],
                        [10, null],
                    ].map(function (_a) {
                        var a = _a[0], b = _a[1];
                        return [Math.round(a), b];
                    }));
                    expect(Object.keys(((_v = scalerank.stats) === null || _v === void 0 ? void 0 : _v.naturalBreaks) || {})).toEqual([
                        "3",
                        "4",
                    ]);
                    scaleRankNaturalBreaks = (_w = scalerank.stats) === null || _w === void 0 ? void 0 : _w.naturalBreaks[3];
                    expect(scaleRankNaturalBreaks).toEqual([
                        [0, 178],
                        [1, 11],
                        [3, 69],
                        [6, null],
                    ]);
                    scaleRankNaturalBreaks4 = (_x = scalerank.stats) === null || _x === void 0 ? void 0 : _x.naturalBreaks[4];
                    expect(scaleRankNaturalBreaks4).toEqual([
                        [0, 178],
                        [1, 11],
                        [3, 32],
                        [5, 37],
                        [6, null],
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("Natural Resource Areas", function () { return __awaiter(void 0, void 0, void 0, function () {
        var layers, layer, attributeNames, FEATURE_LENGTH_M, geometricBreaks, featureArea, areaName, area;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, geostatsForVectorLayer_1.geostatsForVectorLayers(__dirname + "/natural-resource-areas.geojson.json")];
                case 1:
                    layers = _e.sent();
                    layer = layers[0];
                    expect(layer.layer).toBe("natural-resource-areas.geojson");
                    expect(layer.count).toBe(3);
                    expect(layer.geometry).toBe("Polygon");
                    expect(layer.attributeCount).toBe(9);
                    expect(layer.attributes.length).toBe(9);
                    attributeNames = layer.attributes.map(function (a) { return a.attribute; });
                    expect(attributeNames).toContain("OBJECTID");
                    expect(attributeNames).toContain("ORG_UNIT");
                    expect(attributeNames).toContain("ORG_UNIT_NAME");
                    FEATURE_LENGTH_M = layer.attributes.find(function (a) { return a.attribute === "FEATURE_LENGTH_M"; });
                    expect(FEATURE_LENGTH_M).toBeTruthy();
                    expect(FEATURE_LENGTH_M.type).toBe("number");
                    expect(FEATURE_LENGTH_M.max).toBe(5481022.0144);
                    expect(FEATURE_LENGTH_M.min).toBe(3544514.6868);
                    geometricBreaks = (_a = FEATURE_LENGTH_M.stats) === null || _a === void 0 ? void 0 : _a.geometricInterval[4].map(function (b) { return [Math.round(b[0]), b[1]]; });
                    expect(geometricBreaks).toEqual([
                        [3544515, 2],
                        [3952601, 0],
                        [4407671, 0],
                        [4915134, 1],
                        [5481022, null],
                    ]);
                    featureArea = layer.attributes.find(function (a) { return a.attribute === "FEATURE_AREA_SQM"; });
                    expect(featureArea.min).toBe(202936262216.518);
                    expect(featureArea.max).toBe(596897192764.658);
                    expect((_b = featureArea.stats) === null || _b === void 0 ? void 0 : _b.avg).toEqual(346587975105.9687);
                    expect((_c = featureArea.stats) === null || _c === void 0 ? void 0 : _c.stdev).toEqual(177638530340.4814);
                    expect((_d = featureArea.stats) === null || _d === void 0 ? void 0 : _d.histogram.map(function (_a) {
                        var val = _a[0], count = _a[1];
                        return [
                            Math.round(val),
                            count,
                        ];
                    })).toEqual([
                        [202936262216.518, 1],
                        [210976281207.2964, 0],
                        [219016300198.07474, 0],
                        [227056319188.8531, 0],
                        [235096338179.63147, 1],
                        [243136357170.40985, 0],
                        [251176376161.1882, 0],
                        [259216395151.96655, 0],
                        [267256414142.74493, 0],
                        [275296433133.5233, 0],
                        [283336452124.30164, 0],
                        [291376471115.08, 0],
                        [299416490105.8584, 0],
                        [307456509096.6368, 0],
                        [315496528087.41516, 0],
                        [323536547078.1935, 0],
                        [331576566068.97186, 0],
                        [339616585059.75024, 0],
                        [347656604050.52856, 0],
                        [355696623041.30695, 0],
                        [363736642032.0853, 0],
                        [371776661022.8637, 0],
                        [379816680013.6421, 0],
                        [387856699004.4204, 0],
                        [395896717995.1988, 0],
                        [403936736985.9772, 0],
                        [411976755976.7555, 0],
                        [420016774967.5339, 0],
                        [428056793958.31226, 0],
                        [436096812949.09064, 0],
                        [444136831939.869, 0],
                        [452176850930.64734, 0],
                        [460216869921.4257, 0],
                        [468256888912.2041, 0],
                        [476296907902.9824, 0],
                        [484336926893.7608, 0],
                        [492376945884.5392, 0],
                        [500416964875.31757, 0],
                        [508456983866.0959, 0],
                        [516497002856.87427, 0],
                        [524537021847.65265, 0],
                        [532577040838.431, 0],
                        [540617059829.2094, 0],
                        [548657078819.98773, 0],
                        [556697097810.7661, 0],
                        [564737116801.5444, 0],
                        [572777135792.3228, 0],
                        [580817154783.1012, 0],
                        [588857173773.8796, 1],
                        [596897192764.658, null],
                    ].map(function (_a) {
                        var val = _a[0], count = _a[1];
                        return [Math.round(val), count];
                    }));
                    areaName = layer.attributes.find(function (a) { return a.attribute === "AREA_NAME"; });
                    expect(areaName).toBeTruthy();
                    expect(areaName.type).toBe("string");
                    expect(areaName.count).toBe(3);
                    expect(areaName.countDistinct).toBe(3);
                    expect(areaName.values).toEqual({
                        "Coast Natural Resource Area": 1,
                        "North Natural Resource Area": 1,
                        "South Natural Resource Area": 1,
                    });
                    area = layer.attributes.find(function (a) { return a.attribute === "FEATURE_AREA_SQM"; });
                    expect(Object.keys(area.stats.quantiles)).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("Populated Places", function () { return __awaiter(void 0, void 0, void 0, function () {
        var layers, layer, rank_max, naturalBreaks;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, geostatsForVectorLayer_1.geostatsForVectorLayers(__dirname + "/ne_10m_populated_places_simple/ne_10m_populated_places_simple.shp")];
                case 1:
                    layers = _b.sent();
                    layer = layers[0];
                    rank_max = layer.attributes.find(function (a) { return a.attribute === "rank_max"; });
                    expect(rank_max).toBeTruthy();
                    expect(rank_max.type).toBe("number");
                    naturalBreaks = (_a = rank_max.stats) === null || _a === void 0 ? void 0 : _a.naturalBreaks;
                    expect(naturalBreaks).toBeTruthy();
                    expect(Object.keys(naturalBreaks)).toEqual(Object.keys(rankMaxBreaks));
                    expect(naturalBreaks[7]).toEqual(rankMaxBreaks[7]);
                    expect(naturalBreaks[4]).toEqual(rankMaxBreaks[4]);
                    return [2 /*return*/];
            }
        });
    }); });
    test.todo("Test a dataset with negatives values");
    // test("Shore-Clean", async () => {
    //   const layers = await geostatsForVectorLayers(
    //     `${__dirname}/shore-clean.fgb`
    //   );
    //   const layer = layers[0];
    //   expect(layer.layer).toBe("shore-clean");
    // });
    test("Dataset with unknown geometry type", function () { return __awaiter(void 0, void 0, void 0, function () {
        var layers, layer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, geostatsForVectorLayer_1.geostatsForVectorLayers(__dirname + "/b71b7a4a-e7f6-450e-a1f8-f1a139ca321c.fgb")];
                case 1:
                    layers = _a.sent();
                    layer = layers[0];
                    expect(layer.geometry).toBe("MultiPolygon");
                    return [2 /*return*/];
            }
        });
    }); });
});
var rankMaxBreaks = {
    "3": [
        [0, 858],
        [5, 2274],
        [8, 4210],
        [14, null],
    ],
    "4": [
        [0, 565],
        [4, 1303],
        [7, 2389],
        [9, 3085],
        [14, null],
    ],
    "5": [
        [0, 416],
        [3, 836],
        [6, 1880],
        [8, 2192],
        [10, 2018],
        [14, null],
    ],
    "6": [
        [0, 416],
        [3, 442],
        [5, 1010],
        [7, 1264],
        [8, 2192],
        [10, 2018],
        [14, null],
    ],
    "7": [
        [0, 416],
        [3, 442],
        [5, 1010],
        [7, 1264],
        [8, 1125],
        [9, 1067],
        [10, 2018],
        [14, null],
    ],
    "8": [
        [0, 212],
        [2, 353],
        [4, 687],
        [6, 616],
        [7, 1264],
        [8, 1125],
        [9, 1067],
        [10, 2018],
        [14, null],
    ],
    "9": [
        [0, 212],
        [2, 353],
        [4, 687],
        [6, 616],
        [7, 1264],
        [8, 1125],
        [9, 1067],
        [10, 1024],
        [11, 994],
        [14, null],
    ],
    "10": [
        [0, 212],
        [2, 353],
        [4, 293],
        [5, 394],
        [6, 616],
        [7, 1264],
        [8, 1125],
        [9, 1067],
        [10, 1024],
        [11, 994],
        [14, null],
    ],
    "11": [
        [0, 10],
        [1, 406],
        [3, 149],
        [4, 293],
        [5, 394],
        [6, 616],
        [7, 1264],
        [8, 1125],
        [9, 1067],
        [10, 1024],
        [11, 994],
        [14, null],
    ],
    "12": [
        [0, 10],
        [1, 202],
        [2, 204],
        [3, 149],
        [4, 293],
        [5, 394],
        [6, 616],
        [7, 1264],
        [8, 1125],
        [9, 1067],
        [10, 1024],
        [11, 994],
        [14, null],
    ],
    "13": [
        [0, 10],
        [1, 202],
        [2, 204],
        [3, 149],
        [4, 293],
        [5, 394],
        [6, 616],
        [7, 1264],
        [8, 1125],
        [9, 1067],
        [10, 1024],
        [11, 494],
        [12, 500],
        [14, null],
    ],
};
function roundBucket(b) {
    return [
        Math.round(b[0] * 100) / 100,
        b[1] === null ? null : Math.round(b[1] * 100) / 100,
    ];
}
