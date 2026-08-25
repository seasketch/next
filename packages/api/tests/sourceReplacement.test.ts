import {
  adminAuthoredSourceFieldsFrom,
  attributionForNewSource,
  layerHasMapboxGlStyles,
} from "../src/spatialUploads/sourceReplacement";

describe("attributionForNewSource", () => {
  test("keeps admin attribution, including an empty string, over AI copy", () => {
    expect(
      attributionForNewSource({
        oldAttribution: "Admin attribution",
        aiAttribution: "AI attribution",
      }),
    ).toBe("Admin attribution");
    expect(
      attributionForNewSource({
        oldAttribution: "",
        aiAttribution: "AI attribution",
      }),
    ).toBe("");
  });

  test("uses ingest attribution only when the old source had none", () => {
    expect(
      attributionForNewSource({
        oldAttribution: null,
        aiAttribution: "AI attribution",
      }),
    ).toBe("AI attribution");
    expect(
      attributionForNewSource({
        oldAttribution: undefined,
        conversionAttribution: "Converted",
        aiAttribution: "AI attribution",
      }),
    ).toBe("Converted");
  });
});

describe("adminAuthoredSourceFieldsFrom", () => {
  test("copies temporal and translated_props, defaulting empty translations", () => {
    const temporal = { version: 1 };
    expect(
      adminAuthoredSourceFieldsFrom({
        attribution: "A",
        temporal,
        translated_props: { attribution: { es: "A" } },
      }),
    ).toEqual({
      attribution: "A",
      temporal,
      translated_props: { attribution: { es: "A" } },
    });
    expect(adminAuthoredSourceFieldsFrom(null)).toEqual({
      attribution: null,
      temporal: null,
      translated_props: {},
    });
  });
});

describe("layerHasMapboxGlStyles", () => {
  test("treats null and empty fragments as no cartography", () => {
    expect(layerHasMapboxGlStyles(null)).toBe(false);
    expect(layerHasMapboxGlStyles(undefined)).toBe(false);
    expect(layerHasMapboxGlStyles([])).toBe(false);
    expect(layerHasMapboxGlStyles("[]")).toBe(false);
  });

  test("treats a style fragment as existing cartography", () => {
    expect(
      layerHasMapboxGlStyles([{ type: "fill", paint: { "fill-color": "red" } }]),
    ).toBe(true);
  });
});
