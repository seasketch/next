import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validate } from "../../client/node_modules/mapbox-gl/dist/style-spec/index.es.js";
import { fitToSource, sourceForBand } from "../src/layers.js";
import { FADE_ZOOM, fadeStart, prepareReveal, revealFactor } from "../src/reveal.js";
import { buildS57Style } from "../src/style.js";

type Layer = {
  id: string;
  type: string;
  minzoom?: number;
  "source-layer"?: string;
  paint?: Record<string, unknown>;
};

function layer(id: string): Layer {
  const style = buildS57Style("/tiles.json");
  const found = (style.layers as Layer[]).find((candidate) => candidate.id === id);
  assert.ok(found, id);
  return found;
}

/** Evaluate the opacity expressions this style builds. Enough of the spec to check the fade. */
function evaluate(expr: unknown, zoom: number, props: Record<string, unknown>): number {
  if (typeof expr === "number") return expr;
  if (!Array.isArray(expr)) throw new Error(`not an expression: ${JSON.stringify(expr)}`);
  const op = expr[0];
  if (op === "interpolate") {
    const stops: Array<[number, unknown]> = [];
    for (let index = 3; index < expr.length; index += 2) {
      stops.push([expr[index] as number, expr[index + 1]]);
    }
    if (zoom <= stops[0][0]) return evaluate(stops[0][1], zoom, props);
    const last = stops[stops.length - 1];
    if (zoom >= last[0]) return evaluate(last[1], zoom, props);
    for (let index = 0; index < stops.length - 1; index += 1) {
      const [z0, v0] = stops[index];
      const [z1, v1] = stops[index + 1];
      if (zoom < z0 || zoom > z1) continue;
      const t = (zoom - z0) / (z1 - z0);
      return evaluate(v0, zoom, props) * (1 - t) + evaluate(v1, zoom, props) * t;
    }
  }
  if (op === "case") {
    for (let index = 1; index < expr.length - 1; index += 2) {
      if (evaluate(expr[index], zoom, props)) return evaluate(expr[index + 1], zoom, props);
    }
    return evaluate(expr[expr.length - 1], zoom, props);
  }
  if (op === "all") return expr.slice(1).every((item) => evaluate(item, zoom, props)) ? 1 : 0;
  if (op === "any") return expr.slice(1).some((item) => evaluate(item, zoom, props)) ? 1 : 0;
  if (op === "==") return evaluate(expr[1], zoom, props) === evaluate(expr[2], zoom, props) ? 1 : 0;
  if (op === "<=") return evaluate(expr[1], zoom, props) <= evaluate(expr[2], zoom, props) ? 1 : 0;
  if (op === ">") return evaluate(expr[1], zoom, props) > evaluate(expr[2], zoom, props) ? 1 : 0;
  if (op === "to-number") return Number(evaluate(expr[1], zoom, props));
  if (op === "coalesce") {
    for (const item of expr.slice(1)) {
      const value = evaluate(item, zoom, props);
      if (value != null && value === value) return value as number;
    }
    return 0;
  }
  if (op === "get") {
    const value = props[expr[1] as string];
    return (value == null ? null : value) as number;
  }
  throw new Error(`unhandled ${String(op)}`);
}

describe("feature fade", () => {
  it("holds a feature solid except across the short span where it appears or leaves", () => {
    const near = (zoom: number, appear: number, retire: number, expected: number) => {
      const got = revealFactor(zoom, appear, retire);
      assert.ok(Math.abs(got - expected) < 1e-9, `${zoom} appear ${appear} retire ${retire} → ${got}`);
    };
    assert.equal(FADE_ZOOM, 0.4);
    near(4, 0, 0, 1);
    near(7.6, 8, 0, 0);
    near(7.8, 8, 0, 0.5);
    near(8, 8, 0, 1);
    near(10, 8, 0, 1);
    near(11.6, 8, 12, 1);
    near(11.8, 8, 12, 0.5);
    near(12, 8, 12, 0);
    near(13, 8, 12, 0);
    near(5, 0, 8, 1);
    near(8, 0, 8, 0);
  });

  it("matches that curve in the depth and separation paint", () => {
    const depth = layer("s57-depth").paint?.["fill-opacity"];
    const samples: Array<[number, Record<string, unknown>, number]> = [
      [5, {}, 1],
      [7.6, { appear: 8 }, 0],
      [7.8, { appear: 8 }, 0.5],
      [8, { appear: 8 }, 1],
      // A depth area stays solid while its replacement fades in over it.
      [11.6, { appear: 8, retire: 12 }, 1],
      [12, { appear: 8, retire: 12 }, 1],
    ];
    for (const [zoom, props, expected] of samples) {
      const got = evaluate(depth, zoom, props);
      assert.ok(Math.abs(got - expected) < 1e-9, `${zoom} ${JSON.stringify(props)} → ${got}`);
    }
    const zone = layer("s57-separation-fill").paint?.["fill-opacity"];
    assert.ok(Math.abs(evaluate(zone, 12, {}) - 0.25) < 1e-9);
    assert.ok(Math.abs(evaluate(zone, 9.8, { appear: 10 }) - 0.125) < 1e-9);
    assert.ok(Math.abs(evaluate(zone, 12, { appear: 8, retire: 12 }) - 0.25) < 1e-9);

    const buoy = layer("s57-aid").paint?.["icon-opacity"];
    assert.ok(Math.abs(evaluate(buoy, 11.8, { appear: 8, retire: 12 }) - 0.5) < 1e-9);
    assert.equal(evaluate(buoy, 12, { appear: 8, retire: 12 }), 0);
    assert.equal(evaluate(buoy, 8, { appear: 8 }), 1);
  });

  it("fades a layer's own threshold and leaves soundings and sectors crisp", () => {
    const kelp = layer("s57-kelp");
    assert.equal(kelp.minzoom, fadeStart(8));
    const kelpOpacity = kelp.paint?.["line-opacity"];
    assert.equal(evaluate(kelpOpacity, 7.6, {}), 0);
    assert.ok(Math.abs(evaluate(kelpOpacity, 7.8, {}) - 0.5) < 1e-9);
    assert.equal(evaluate(kelpOpacity, 8, {}), 1);

    const contour = layer("s57-land-contour");
    assert.equal(contour.minzoom, fadeStart(11));
    const contourOpacity = contour.paint?.["line-opacity"];
    assert.ok(Math.abs(evaluate(contourOpacity, 11, {}) - 0.8) < 1e-9);
    assert.equal(evaluate(contourOpacity, fadeStart(11), {}), 0);

    const sounding = layer("s57-sounding");
    assert.equal(sounding.minzoom, 11);
    assert.equal(sounding.paint?.["text-opacity"], undefined);

    const sector = layer("s57-light-sector");
    assert.equal(sector.paint?.["line-opacity"], undefined);
    const background = (buildS57Style("/tiles.json").layers as Layer[]).find((item) => item.id === "s57-background");
    assert.equal(background?.type, "background");
    assert.equal((background?.paint as { "background-opacity"?: unknown } | undefined)?.["background-opacity"], undefined);
  });

  it("includes a fading feature one zoom early and leaves soundings on their zoom", () => {
    const depth = {
      properties: {} as Record<string, unknown>,
      tippecanoe: { layer: "depth_area", minzoom: 8, maxzoom: 16 },
    };
    prepareReveal(depth);
    fitToSource(depth, sourceForBand(3));
    assert.equal(depth.properties.appear, 8);
    assert.equal(depth.tippecanoe.minzoom, 7);
    assert.equal(depth.tippecanoe.maxzoom, 12);

    const late = {
      properties: {} as Record<string, unknown>,
      tippecanoe: { layer: "hazard", minzoom: 15, maxzoom: 16 },
    };
    prepareReveal(late);
    fitToSource(late, sourceForBand(3));
    assert.equal(late.properties.appear, 15);
    assert.equal(late.properties.zmin, 14);
    assert.equal(late.tippecanoe.minzoom, 12);

    const skin = {
      properties: {} as Record<string, unknown>,
      tippecanoe: { layer: "land", minzoom: 0, maxzoom: 16 },
    };
    prepareReveal(skin);
    assert.equal(skin.properties.appear, undefined);
    assert.equal(skin.tippecanoe.minzoom, 0);

    const sounding = {
      properties: {} as Record<string, unknown>,
      tippecanoe: { layer: "sounding", minzoom: 11, maxzoom: 16 },
    };
    prepareReveal(sounding);
    assert.equal(sounding.properties.appear, undefined);
    assert.equal(sounding.tippecanoe.minzoom, 11);
  });

  it("keeps the fade inside a zoom curve Mapbox will accept", () => {
    const style = buildS57Style("/tiles.json", {
      glyphs: "https://example.com/font/{fontstack}/{range}.pbf",
      sprite: "https://example.com/s57/sprite",
    });
    const errors = validate(style) as Array<{ message: string }>;
    const messages = errors.map((error) => error.message);
    assert.deepEqual(
      messages.filter((message) => /zoom|expression|opacity/i.test(message)),
      []
    );
  });
});
