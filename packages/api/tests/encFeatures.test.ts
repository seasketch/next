import {
  bandFromCellName,
  extendBounds,
  rewriteEncFeature,
  zoomForScaleDenominator,
  zoomRangeForFeature,
} from "../src/enc/layers";

describe("ENC feature normalization", () => {
  test("reads the usage band from a NOAA cell name", () => {
    expect(bandFromCellName("US5CA2HS")).toBe(5);
    expect(bandFromCellName("US4CA1HO.000")).toBe(4);
    expect(bandFromCellName("not-a-cell")).toBeNull();
    expect(bandFromCellName("")).toBeNull();
  });

  test("maps SCAMIN to a web zoom", () => {
    expect(zoomForScaleDenominator(0)).toBe(0);
    expect(zoomForScaleDenominator(Number.NaN)).toBe(0);
    const harbor = zoomForScaleDenominator(12000);
    expect(harbor).toBeGreaterThan(10);
    expect(harbor).toBeLessThanOrEqual(16);
  });

  test("keeps chart attributes and drops record ids", () => {
    const feature = rewriteEncFeature(
      {
        type: "Feature",
        properties: {
          RCID: 1,
          LNAM: "abc",
          DRVAL1: 3.5,
          DRVAL2: 5,
          OBJNAM: "Santa Barbara",
          SCAMIN: 17999,
        },
        geometry: { type: "Point", coordinates: [-119.7, 34.4] },
      },
      { cell: "US5CA2HS", band: 5, layer: "depth_area" }
    );
    expect(feature).not.toBeNull();
    const properties = feature!.properties as Record<string, unknown>;
    expect(properties.DRVAL1).toBe(3.5);
    expect(properties.OBJNAM).toBe("Santa Barbara");
    expect(properties.cell).toBe("US5CA2HS");
    expect(properties.RCID).toBeUndefined();
    expect(properties.LNAM).toBeUndefined();
    const tippecanoe = feature!.tippecanoe as { layer: string; minzoom: number; maxzoom: number };
    expect(tippecanoe.layer).toBe("depth_area");
    expect(tippecanoe.minzoom).toBeGreaterThanOrEqual(10);
    expect(tippecanoe.maxzoom).toBeGreaterThanOrEqual(tippecanoe.minzoom);
  });

  test("rejects null, non-objects, and features without geometry", () => {
    const meta = { cell: "US5CA2HS", band: 5, layer: "land" };
    expect(rewriteEncFeature(null, meta)).toBeNull();
    expect(rewriteEncFeature(undefined, meta)).toBeNull();
    expect(rewriteEncFeature("DEPARE", meta)).toBeNull();
    expect(rewriteEncFeature({ type: "Feature", properties: {} }, meta)).toBeNull();
  });

  test("a harbour cell with a large SCAMIN still has a zoom range", () => {
    const range = zoomRangeForFeature(5, 17999);
    expect(range.maxzoom).toBeGreaterThanOrEqual(range.minzoom);
    expect(range.minzoom).toBeLessThanOrEqual(16);
  });

  test("bounds grow around coordinates and ignore junk", () => {
    expect(extendBounds(null, null)).toBeNull();
    expect(extendBounds(null, { coordinates: "nope" })).toBeNull();
    const bounds = extendBounds(null, {
      type: "Point",
      coordinates: [-119.7, 34.4],
    });
    expect(bounds).toEqual([-119.7, 34.4, -119.7, 34.4]);
    expect(
      extendBounds(bounds, {
        coordinates: [
          [
            [-120, 34],
            [-119, 35],
          ],
        ],
      })
    ).toEqual([-120, 34, -119, 35]);
  });
});
