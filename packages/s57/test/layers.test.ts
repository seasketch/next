import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ENC_LAYER_BY_CLASS,
  ENC_MAX_ZOOM,
  aidMark,
  bandFromCellName,
  bandMinZoom,
  extendBounds,
  firstColour,
  rewriteEncFeature,
  zoomForScaleDenominator,
  zoomRangeForFeature,
} from "../src/layers.js";

describe("S-57 feature normalization", () => {
  it("reads the usage band from a NOAA cell name", () => {
    assert.equal(bandFromCellName("US5CA2HS"), 5);
    assert.equal(bandFromCellName("US4CA1HO.000"), 4);
    assert.equal(bandFromCellName("not-a-cell"), null);
    assert.equal(bandFromCellName(""), null);
  });

  it("maps SCAMIN to a web zoom", () => {
    assert.equal(zoomForScaleDenominator(0), 0);
    assert.equal(zoomForScaleDenominator(Number.NaN), 0);
    const harbor = zoomForScaleDenominator(12000);
    assert.ok(harbor > 10);
    assert.ok(harbor <= 16);
    // 1:18,000 harbour soundings are readable when the harbour fills the view.
    assert.equal(zoomForScaleDenominator(17999), 14);
  });

  it("keeps chart attributes and drops record ids", () => {
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
      { cell: "US5CA2HS", band: 5, layer: "depth_area", objectClass: "DEPARE" }
    );
    assert.ok(feature);
    const properties = feature.properties as Record<string, unknown>;
    assert.equal(properties.DRVAL1, 3.5);
    assert.equal(properties.OBJNAM, "Santa Barbara");
    assert.equal(properties.cell, "US5CA2HS");
    assert.equal(properties.obj, "DEPARE");
    assert.equal(properties.RCID, undefined);
    assert.equal(properties.LNAM, undefined);
    const tippecanoe = feature.tippecanoe as { layer: string; minzoom: number; maxzoom: number };
    assert.equal(tippecanoe.layer, "depth_area");
    assert.ok(tippecanoe.minzoom >= 10);
    assert.ok(tippecanoe.maxzoom >= tippecanoe.minzoom);
  });

  it("rejects null, non-objects, and features without geometry", () => {
    const meta = { cell: "US5CA2HS", band: 5, layer: "land" };
    assert.equal(rewriteEncFeature(null, meta), null);
    assert.equal(rewriteEncFeature(undefined, meta), null);
    assert.equal(rewriteEncFeature("DEPARE", meta), null);
    assert.equal(rewriteEncFeature({ type: "Feature", properties: {} }, meta), null);
  });

  it("a harbour cell with a large SCAMIN still has a zoom range", () => {
    const range = zoomRangeForFeature(5, 17999);
    assert.equal(range.maxzoom, ENC_MAX_ZOOM);
    assert.ok(range.maxzoom >= range.minzoom);
  });

  it("larger-scale charts start at a higher zoom than the chart under them", () => {
    assert.equal(bandMinZoom(1), 0);
    assert.ok(bandMinZoom(4) < bandMinZoom(5));
    assert.ok(bandMinZoom(5) < ENC_MAX_ZOOM);
  });

  it("skin-of-the-earth features ignore SCAMIN so the cell does not develop holes", () => {
    const feature = rewriteEncFeature(
      {
        type: "Feature",
        properties: { SCAMIN: 17999, DRVAL1: 3 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-119.7, 34.4],
              [-119.6, 34.4],
              [-119.6, 34.5],
              [-119.7, 34.4],
            ],
          ],
        },
      },
      {
        cell: "US5CA2HS",
        band: 5,
        layer: "depth_area",
        objectClass: "DEPARE",
        ignoreScaleMinimum: true,
      }
    );
    const tippecanoe = feature!.tippecanoe as { minzoom: number; maxzoom: number };
    assert.equal(tippecanoe.minzoom, bandMinZoom(5));
    assert.equal(tippecanoe.maxzoom, ENC_MAX_ZOOM);
  });

  it("colours lateral buoys from the IALA category and keeps the first light colour", () => {
    assert.equal(aidMark("BOYLAT", { CATLAM: 1 }), "port");
    assert.equal(aidMark("BOYLAT", { CATLAM: "2" }), "starboard");
    assert.equal(aidMark("BOYSPP", {}), "special");
    assert.equal(aidMark("LIGHTS", {}), "light");
    assert.equal(aidMark("FOGSIG", {}), "fog");
    assert.equal(firstColour("3,1"), 3);
    assert.equal(firstColour(4), 4);
    assert.equal(firstColour("nope"), null);
    assert.equal(ENC_LAYER_BY_CLASS.OFSPLF, "platform");
    assert.equal(ENC_LAYER_BY_CLASS.MORFAC, "mooring");
  });

  it("bounds grow around coordinates and ignore junk", () => {
    assert.equal(extendBounds(null, null), null);
    assert.equal(extendBounds(null, { coordinates: "nope" }), null);
    const bounds = extendBounds(null, {
      type: "Point",
      coordinates: [-119.7, 34.4],
    });
    assert.deepEqual(bounds, [-119.7, 34.4, -119.7, 34.4]);
    assert.deepEqual(
      extendBounds(bounds, {
        coordinates: [
          [
            [-120, 34],
            [-119, 35],
          ],
        ],
      }),
      [-120, 34, -119, 35]
    );
  });
});
