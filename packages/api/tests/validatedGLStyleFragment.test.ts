import { validateGLStyleFragment } from "../src/validatedGLStyleFragment";

describe("validateGLStyleFragment", () => {
  test("accepts a valid vector fragment", () => {
    const errors = validateGLStyleFragment([
      {
        type: "fill",
        paint: { "fill-color": "#ff0000", "fill-opacity": 0.5 },
        layout: { visibility: "visible" },
      },
      {
        type: "line",
        paint: { "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 10, 4] },
      },
    ]);
    expect(errors).toEqual([]);
  });

  test("accepts a valid raster fragment", () => {
    const errors = validateGLStyleFragment(
      [{ type: "raster", paint: { "raster-opacity": 0.8 } }],
      "raster"
    );
    expect(errors).toEqual([]);
  });

  test("reports style-spec violations", () => {
    const errors = validateGLStyleFragment([
      { type: "fill", paint: { "fill-color": "not-a-color" } },
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/fill-color/);
  });

  test("rejects a raster layer on a vector source", () => {
    const errors = validateGLStyleFragment([
      { type: "raster", paint: { "raster-opacity": 1 } },
    ]);
    expect(errors.length).toBeGreaterThan(0);
  });

  test("rejects unknown layer types and properties", () => {
    const errors = validateGLStyleFragment([
      { type: "hologram", paint: {} },
      { type: "fill", paint: { "fill-sparkle": 1 } },
    ]);
    expect(errors.map((e) => e.message).join("\n")).toMatch(/hologram/);
    expect(errors.map((e) => e.message).join("\n")).toMatch(/fill-sparkle/);
  });

  test("rejects an empty or non-array fragment", () => {
    expect(validateGLStyleFragment([])[0].message).toMatch(/array of 1/);
    expect(validateGLStyleFragment({ type: "fill" })[0].message).toMatch(
      /array of 1/
    );
  });

  test("flags properties SeaSketch populates itself", () => {
    const errors = validateGLStyleFragment([
      { id: "mine", type: "fill", source: "x", paint: {} },
    ]);
    const messages = errors.map((e) => e.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/layers\[0\]\.id: id property is not allowed/),
        expect.stringMatching(/layers\[0\]\.source: source property/),
      ])
    );
  });

  test("requires seasketch sprite ids for image properties", () => {
    const bad = validateGLStyleFragment([
      { type: "fill", paint: { "fill-pattern": "pattern-1" } },
    ]);
    expect(bad.map((e) => e.message)).toEqual([
      expect.stringMatching(
        /layers\[0\]\.paint\.fill-pattern: Sprite properties must be/
      ),
    ]);
    const good = validateGLStyleFragment([
      { type: "fill", paint: { "fill-pattern": "seasketch://sprites/12" } },
    ]);
    expect(good).toEqual([]);
  });
});
