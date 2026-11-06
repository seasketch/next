import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { wantsAreaLabel } from "../src/areaLabels.js";
import { ENC_LAYER_BY_CLASS, rewriteEncFeature } from "../src/layers.js";
import { CHANNEL_CLASSES, PORTRAYAL, S52_LOOKUP_CLASSES, areaCenterSymbol, isCellSizedMeta } from "../src/portrayal.js";
import { buildS57Style } from "../src/style.js";

describe("S-52 portrayal coverage", () => {
  it("accounts for every class in the Channel cells", () => {
    for (const objectClass of CHANNEL_CLASSES) {
      const portrayal = PORTRAYAL[objectClass];
      assert.ok(portrayal, objectClass);
      assert.ok(portrayal.layer || portrayal.omit, objectClass);
    }
  });

  it("accounts for every name in the S-52 lookup", () => {
    const portrayed = new Set(Object.keys(PORTRAYAL));
    assert.equal(portrayed.size, S52_LOOKUP_CLASSES.length);
    for (const name of S52_LOOKUP_CLASSES) {
      const portrayal = PORTRAYAL[name];
      assert.ok(portrayal, name);
      assert.ok(portrayal.layer || portrayal.omit, name);
    }
    for (const name of portrayed) assert.ok(S52_LOOKUP_CLASSES.includes(name), name);
    assert.equal(PORTRAYAL.M_COVR.omit?.includes("metadata"), true);
    assert.equal(PORTRAYAL.ownshp.omit?.includes("Mariner"), true);
    assert.equal(PORTRAYAL.ICEARE.layer, "depth_area");
    assert.equal(PORTRAYAL.PYLONS.layer, "land");
    assert.equal(PORTRAYAL.NEWOBJ.layer, "regulated");
    assert.equal(ENC_LAYER_BY_CLASS.M_COVR, undefined);
    assert.equal(ENC_LAYER_BY_CLASS.ICEARE, "depth_area");
  });

  it("drops a cell-sized variation and keeps a local anomaly", () => {
    assert.equal(isCellSizedMeta(null), false);
    assert.equal(isCellSizedMeta(undefined), false);
    assert.equal(isCellSizedMeta({}), false);
    assert.equal(isCellSizedMeta({ properties: null }), false);
    assert.equal(isCellSizedMeta({ properties: { obj: "DEPARE" }, geometry: null }), false);
    assert.equal(
      isCellSizedMeta({
        properties: { obj: "MAGVAR" },
        geometry: { type: "Polygon", coordinates: [[[0, 0], [3, 0], [3, 1], [0, 0]]] },
      }),
      true
    );
    assert.equal(
      isCellSizedMeta({
        properties: { obj: "LOCMAG" },
        geometry: { type: "Polygon", coordinates: [[[0, 0], [0.2, 0], [0.2, 0.2], [0, 0]]] },
      }),
      false
    );
    assert.equal(isCellSizedMeta({ properties: { obj: "MAGVAR" }, geometry: null }), true);
    assert.equal(isCellSizedMeta({ properties: { obj: "MAGVAR" }, geometry: { type: "Point", coordinates: [Number.NaN, 1] } }), true);
  });

  it("gives every tiled class the layer the style reads, and no others", () => {
    for (const [objectClass, layer] of Object.entries(ENC_LAYER_BY_CLASS)) {
      assert.equal(PORTRAYAL[objectClass]?.layer, layer, objectClass);
    }
    for (const [objectClass, portrayal] of Object.entries(PORTRAYAL)) {
      if (!portrayal.layer) {
        assert.equal(typeof portrayal.omit, "string", objectClass);
        assert.equal(ENC_LAYER_BY_CLASS[objectClass], undefined, objectClass);
        continue;
      }
      assert.equal(ENC_LAYER_BY_CLASS[objectClass], portrayal.layer, objectClass);
    }
  });

  it("picks a centred symbol only for classes the lookup marks that way", () => {
    assert.equal(areaCenterSymbol("CTNARE"), "caution");
    assert.equal(areaCenterSymbol("WEDKLP"), "kelp");
    assert.equal(areaCenterSymbol("ACHARE"), null);
    assert.equal(areaCenterSymbol("NEWOBJ"), "question");
    assert.equal(areaCenterSymbol("CURENT"), "current");
    assert.equal(areaCenterSymbol("ownshp"), null);
    assert.equal(areaCenterSymbol("M_COVR"), null);
    assert.equal(areaCenterSymbol("DEPARE"), null);
    assert.equal(areaCenterSymbol(""), null);
    assert.equal(areaCenterSymbol(null), null);
    assert.equal(areaCenterSymbol(undefined), null);
    assert.equal(areaCenterSymbol(1), null);
    assert.equal(areaCenterSymbol({ obj: "CTNARE" }), null);
  });

  it("stamps that symbol onto the feature, including one with no attributes", () => {
    const meta = { cell: "US4CA1GQ", band: 4, layer: "regulated", objectClass: "CTNARE" };
    const feature = rewriteEncFeature(
      {
        type: "Feature",
        properties: null,
        geometry: { type: "Point", coordinates: [-119.3, 34.1] },
      },
      meta
    );
    assert.equal((feature?.properties as { symbol?: string }).symbol, "caution");
    const depth = rewriteEncFeature(
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [-119.3, 34.1] },
      },
      { ...meta, layer: "depth_area", objectClass: "DEPARE" }
    );
    assert.equal((depth?.properties as { symbol?: string }).symbol, undefined);
    const created = rewriteEncFeature(
      { type: "Feature", properties: null, geometry: { type: "Point", coordinates: [0, 0] } },
      { cell: "XX", band: 3, layer: "regulated", objectClass: "NEWOBJ" }
    );
    assert.equal((created?.properties as { symbol?: string }).symbol, "question");
    const generic = rewriteEncFeature(
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } },
      { cell: "XX", band: 3, layer: "aid", objectClass: "GENNAV" }
    );
    assert.equal((generic?.properties as { mark?: string }).mark, "special");
  });

  it("labels an area for its symbol even when the area is unnamed", () => {
    assert.equal(wantsAreaLabel(null), false);
    assert.equal(wantsAreaLabel(undefined), false);
    assert.equal(wantsAreaLabel({}), false);
    assert.equal(wantsAreaLabel({ obj: 1 }), false);
    assert.equal(wantsAreaLabel({ obj: "CTNARE" }), true);
    assert.equal(wantsAreaLabel({ obj: "WEDKLP" }), true);
    assert.equal(wantsAreaLabel({ obj: "RESARE" }), false);
    assert.equal(wantsAreaLabel({ obj: "RESARE", OBJNAM: "Sanctuary" }), true);
    assert.equal(wantsAreaLabel({ obj: "SBDARE" }), false);
    assert.equal(wantsAreaLabel({ obj: "SBDARE", seabed: "R" }), true);
    assert.equal(wantsAreaLabel({ obj: "NOTACLASS", OBJNAM: "X" }), false);
  });
});

describe("stylesheet matches the lookup", () => {
  const style = buildS57Style("/tiles.json");
  const layers = style.layers as Array<{ id: string; type: string; paint?: Record<string, unknown> }>;
  const paint = (id: string) => {
    const layer = layers.find((candidate) => candidate.id === id);
    assert.ok(layer, id);
    return layer;
  };

  it("tints only the separation zone, at the S-52 transparency", () => {
    const zone = paint("s57-separation-fill");
    assert.equal(zone.paint?.["fill-color"], "#d3a6e9");
    assert.equal(zone.paint?.["fill-opacity"], 0.25);
  });

  it("draws kelp as a dashed limit and fairways in chart grey", () => {
    assert.equal(paint("s57-kelp").type, "line");
    assert.equal(paint("s57-kelp").paint?.["line-color"], "#a3b4b7");
    assert.equal(paint("s57-route").paint?.["line-color"], "#7d898c");
    assert.equal(paint("s57-cable").paint?.["line-pattern"], "cable-wave");
    assert.equal(paint("s57-inshore-zone").paint?.["line-width"], 2.4);
    assert.ok(layers.some((layer) => layer.id === "s57-limit"));
    assert.ok(layers.some((layer) => layer.id === "s57-mark-regulated"));
  });

  it("paints classes that are not in the Channel cells", () => {
    const text = JSON.stringify(style.layers);
    for (const objectClass of ["ICEARE", "RAPIDS", "DWRTCL", "RCRTCL", "RAILWY", "ROADWY", "VEGATN", "TUNNEL", "OILBAR", "CHNWIR", "AIRARE", "PYLONS", "ANNOTA", "TIDEWY"]) {
      assert.equal(text.includes(`"${objectClass}"`), true, objectClass);
    }
    // A pipeline area is the magenta cable dash: every cable stroke that is not a named line.
    assert.equal(PORTRAYAL.PIPARE.layer, "cable");
    assert.equal(text.includes('"s57-cable-area"'), true);
    for (const sourceLayer of ["route", "limit", "inland_water", "structure", "aid"]) {
      assert.ok(layers.some((layer) => layer.id === `s57-mark-${sourceLayer}`), sourceLayer);
    }
    assert.equal(paint("s57-ice").paint?.["line-color"], "#7d898c");
    assert.equal(paint("s57-rapids").paint?.["fill-color"], "#7d898c");
    assert.equal(paint("s57-works").paint?.["fill-color"], "#b19139");
  });
});
