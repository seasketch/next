import {
  Bucket,
  GeostatsAttribute,
  NumericGeostatsAttribute,
} from "@seasketch/geostats-types";
import { geostatsForVectorLayers } from "../src/geostatsForVectorLayer";

describe("geostatsForVectorLayers", () => {
  jest.setTimeout(100000);
  test("Nature Earth Countries", async () => {
    const layers = await geostatsForVectorLayers(
      `${__dirname}/ne_10m_admin_0_countries/ne_10m_admin_0_countries.shp`
    );
    const layer = layers[0];
    expect(layer.layer).toBe("ne_10m_admin_0_countries");
    expect(layer.count).toBe(258);
    expect(layer.geometry).toBe("Polygon");
    expect(layer.attributeCount).toBe(168);
    expect(layer.attributes.length).toBe(168);
    const attributeNames = layer.attributes.map((a) => a.attribute);
    expect(attributeNames).toContain("ADMIN");
    expect(attributeNames).toContain("ISO_A3");
    expect(attributeNames).toContain("ISO_A2");
    expect(attributeNames).toContain("ISO_A3_EH");
    const ISO_A3 = layer.attributes.find(
      (a) => a.attribute === "ISO_A3"
    ) as NumericGeostatsAttribute;
    expect(ISO_A3).toBeTruthy();
    expect(ISO_A3.type).toBe("string");
    const labelRank = layer.attributes.find(
      (a) => a.attribute === "LABELRANK"
    ) as NumericGeostatsAttribute;
    expect(labelRank).toBeTruthy();

    const scalerank = layer.attributes.find(
      (a) => a.attribute === "scalerank"
    ) as NumericGeostatsAttribute;
    expect(scalerank).toBeTruthy();
    expect(scalerank.type).toBe("number");
    expect(scalerank.min).toBe(0);
    expect(scalerank.max).toBe(6);
    expect(scalerank.stats?.histogram).toEqual([
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
    expect(Math.round(scalerank.stats!.avg * 1000)).toEqual(
      Math.round(1.1705426356589144 * 1000)
    );
    expect(scalerank.count).toBe(258);
    const poprank = layer.attributes.find(
      (a) => a.attribute === "POP_RANK"
    ) as NumericGeostatsAttribute;
    expect(poprank).toBeTruthy();
    expect(poprank.type).toBe("number");
    expect(poprank.min).toBe(1);
    expect(poprank.max).toBe(18);
    expect(poprank.stats?.stdev).toBe(4.188021713152829);
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
    const popEst = layer.attributes.find(
      (a) => a.attribute === "POP_EST"
    ) as NumericGeostatsAttribute;
    expect(popEst.stats?.stdev).toEqual(126590277.89107136);
    expect(popEst.stats?.geometricInterval).toBeTruthy();
    const breaks = popEst.stats?.geometricInterval[4].map((b) => [
      Math.round(b[0]),
      b[1],
    ]);
    expect(breaks).toEqual([
      [0, 14],
      [193, 28],
      [37386, 113],
      [7228763, 103],
      [1397715000, null],
    ]);
    expect(Math.round(popEst.stats?.stdev || 0)).toEqual(Math.round(126590278));
    expect(popEst.stats?.quantiles).toBeTruthy();
    expect(popEst.stats?.quantiles[5]).toBeTruthy();
    expect(Math.round(popEst.stats?.avg!)).toBe(Math.round(29756045.4352713));
    const quantiles = popEst.stats?.quantiles[5].map((q) => [
      Math.round(q[0]),
      q[1],
    ]);
    expect(quantiles).toEqual([
      [0, 51],
      [57216, 52],
      [1394973, 51],
      [7169455, 52],
      [25876380, 52],
      [1397715000, null],
    ]);
    expect(Object.keys(labelRank.stats?.quantiles || {})).toEqual([
      "3",
      "4",
      "5",
    ]);
    const stdDevations = popEst.stats?.standardDeviations[4].map((b) => [
      Math.round(b[0]),
      b[1],
    ]);
    expect(Object.keys(popEst.stats?.standardDeviations || {})).toEqual([
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

    expect(Object.keys(labelRank.stats?.standardDeviations || {})).toEqual([
      "3",
      "4",
      "5",
      "6",
    ]);
    const stddevs = labelRank.stats?.standardDeviations[3].map(roundBucket);
    expect(stddevs).toEqual(
      (
        [
          [2, 96],
          [3.503692216057039, 90],
          [5.07770313278017, 72],
          [10, null],
        ] as Bucket[]
      ).map(roundBucket)
    );
    const eqIntervals = popEst.stats?.equalInterval[5].map((b) => [
      Math.round(b[0]),
      b[1],
    ]);
    expect(eqIntervals).toEqual([
      [0, 255],
      [279543000, 1],
      [559086000, 0],
      [838629000, 0],
      [1118172000, 2],
      [1397715000, null],
    ]);
    const labelEqIntervals = labelRank.stats?.equalInterval[5].map((b) => [
      Math.round(b[0]),
      b[1],
    ]);
    expect(labelEqIntervals).toEqual(
      [
        [2, 96],
        [3.6, 90],
        [5.2, 65],
        [6.800000000000001, 3],
        [8.4, 4],
        [10, null],
      ].map(([a, b]) => [Math.round(a as number), b])
    );
    const naturalBreaks = popEst.stats?.naturalBreaks[5].map((b) => [
      Math.round(b[0]),
      b[1],
    ]);
    expect(naturalBreaks).toEqual(
      [
        [0, 200],
        [21803000, 38],
        [69625582, 12],
        [163046161, 5],
        [328239523, 3],
        [1397715000, null],
      ].map(([a, b]) => [Math.round(a as number), b])
    );
    const labelNaturalBreaks = labelRank.stats?.naturalBreaks[5].map((b) => [
      Math.round(b[0]),
      b[1],
    ]);

    expect(labelNaturalBreaks).toEqual(
      [
        [2, 36],
        [3, 60],
        [4, 45],
        [5, 110],
        [7, 7],
        [10, null],
      ].map(([a, b]) => [Math.round(a as number), b])
    );
    expect(Object.keys(scalerank.stats?.naturalBreaks || {})).toEqual([
      "3",
      "4",
    ]);
    const scaleRankNaturalBreaks = scalerank.stats?.naturalBreaks[3];
    expect(scaleRankNaturalBreaks).toEqual([
      [0, 178],
      [1, 11],
      [3, 69],
      [6, null],
    ]);
    const scaleRankNaturalBreaks4 = scalerank.stats?.naturalBreaks[4];
    expect(scaleRankNaturalBreaks4).toEqual([
      [0, 178],
      [1, 11],
      [3, 32],
      [5, 37],
      [6, null],
    ]);
    // TODO: figure out how to handle "values"
    // TODO: expand to support strings, booleans, etc
  });

  test("Natural Resource Areas", async () => {
    const layers = await geostatsForVectorLayers(
      `${__dirname}/natural-resource-areas.geojson.json`
    );
    const layer = layers[0];
    expect(layer.layer).toBe("natural-resource-areas.geojson");
    expect(layer.count).toBe(3);
    expect(layer.geometry).toBe("Polygon");
    expect(layer.attributeCount).toBe(9);
    expect(layer.attributes.length).toBe(9);
    const attributeNames = layer.attributes.map((a) => a.attribute);
    expect(attributeNames).toContain("OBJECTID");
    expect(attributeNames).toContain("ORG_UNIT");
    expect(attributeNames).toContain("ORG_UNIT_NAME");
    const FEATURE_LENGTH_M = layer.attributes.find(
      (a) => a.attribute === "FEATURE_LENGTH_M"
    ) as NumericGeostatsAttribute;
    expect(FEATURE_LENGTH_M).toBeTruthy();
    expect(FEATURE_LENGTH_M.type).toBe("number");
    expect(FEATURE_LENGTH_M.max).toBe(5481022.0144);
    expect(FEATURE_LENGTH_M.min).toBe(3544514.6868);
    const geometricBreaks = FEATURE_LENGTH_M.stats?.geometricInterval[4].map(
      (b) => [Math.round(b[0]), b[1]]
    );
    expect(geometricBreaks).toEqual([
      [3544515, 2],
      [3952601, 0],
      [4407671, 0],
      [4915134, 1],
      [5481022, null],
    ]);
    const featureArea = layer.attributes.find(
      (a) => a.attribute === "FEATURE_AREA_SQM"
    ) as NumericGeostatsAttribute;
    expect(featureArea!.min).toBe(202936262216.518);
    expect(featureArea!.max).toBe(596897192764.658);
    expect(featureArea.stats?.avg).toEqual(346587975105.9687);
    expect(featureArea.stats?.stdev).toEqual(177638530340.4814);
    expect(
      featureArea.stats?.histogram.map(([val, count]) => [
        Math.round(val),
        count,
      ])
    ).toEqual(
      [
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
      ].map(([val, count]) => [Math.round(val!), count])
    );

    const areaName = layer.attributes.find(
      (a) => a.attribute === "AREA_NAME"
    ) as NumericGeostatsAttribute;
    expect(areaName).toBeTruthy();
    expect(areaName.type).toBe("string");
    expect(areaName.count).toBe(3);
    expect(areaName.countDistinct).toBe(3);
    expect(areaName.values).toEqual({
      "Coast Natural Resource Area": 1,
      "North Natural Resource Area": 1,
      "South Natural Resource Area": 1,
    });
    const area = layer.attributes.find(
      (a) => a.attribute === "FEATURE_AREA_SQM"
    ) as NumericGeostatsAttribute;
    expect(Object.keys(area.stats.quantiles)).toEqual([]);
  });

  test("Populated Places", async () => {
    const layers = await geostatsForVectorLayers(
      `${__dirname}/ne_10m_populated_places_simple/ne_10m_populated_places_simple.shp`
    );
    const layer = layers[0];
    const rank_max = layer.attributes.find(
      (a) => a.attribute === "rank_max"
    ) as NumericGeostatsAttribute;
    expect(rank_max).toBeTruthy();
    expect(rank_max.type).toBe("number");
    const naturalBreaks = rank_max.stats?.naturalBreaks!;
    expect(naturalBreaks).toBeTruthy();
    expect(Object.keys(naturalBreaks)).toEqual(Object.keys(rankMaxBreaks));
    expect(naturalBreaks[7]).toEqual(rankMaxBreaks[7]);
    expect(naturalBreaks[4]).toEqual(rankMaxBreaks[4]);
  });

  test.todo("Test a dataset with negatives values");
  // test("Shore-Clean", async () => {
  //   const layers = await geostatsForVectorLayers(
  //     `${__dirname}/shore-clean.fgb`
  //   );
  //   const layer = layers[0];
  //   expect(layer.layer).toBe("shore-clean");
  // });

  test("Dataset with unknown geometry type", async () => {
    const layers = await geostatsForVectorLayers(
      `${__dirname}/b71b7a4a-e7f6-450e-a1f8-f1a139ca321c.fgb`
    );
    const layer = layers[0];
    expect(layer.geometry).toBe("MultiPolygon");
  });

  test("MultiPolygon with Z values recognized as multipolygon", async () => {
    const layers = await geostatsForVectorLayers(`${__dirname}/birds.geojson`);
    const layer = layers[0];
    expect(layer.geometry).toBe("MultiPolygon");
  });
});

describe("BBoxes", () => {
  test("coastline", async () => {
    const layers = await geostatsForVectorLayers(`${__dirname}/coastline.fgb`);
    const layer = layers[0];
    expect(layer.bounds).toEqual([
      169.5207977294923012, -17.8521137237548828, 216.9337005615234943,
      4.6994919776916504,
    ]);
  });
  test("bioregions", async () => {
    const layers = await geostatsForVectorLayers(`${__dirname}/bioregions.fgb`);
    const layer = layers[0];
    expect(layer.bounds).toEqual([
      -175.0017260343726377, -11.4603951662395041, 176.8568064025060949,
      4.7492252777669046,
    ]);
  });
});

const rankMaxBreaks = {
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

function roundBucket(b: Bucket) {
  return [
    Math.round(b[0] * 100) / 100,
    b[1] === null ? null : Math.round(b[1] * 100) / 100,
  ];
}
