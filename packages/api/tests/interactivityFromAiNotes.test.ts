import {
  deriveInteractivitySettingsFromAiNotes,
  pickColumnForInteractivityTemplate,
} from "../src/spatialUploads/interactivityFromAiNotes";

const baseNotes = {
  junk_columns: [] as string[],
  chosen_presentation_type: "SIMPLE_POLYGON" as const,
  show_labels: false,
  interactivity_type: "NONE" as const,
  notes: "",
};

describe("pickColumnForInteractivityTemplate", () => {
  test("prefers chosen_presentation_column over label/category", () => {
    const col = pickColumnForInteractivityTemplate(
      {
        ...baseNotes,
        chosen_presentation_column: "A",
        best_label_column: "B",
        best_category_column: "C",
      },
      null,
    );
    expect(col).toBe("A");
  });

  test("falls back to best_category when earlier are empty", () => {
    const col = pickColumnForInteractivityTemplate(
      {
        ...baseNotes,
        best_label_column: "  ",
        best_category_column: "Cat",
      },
      null,
    );
    expect(col).toBe("Cat");
  });

  test("when geostats has attributes, rejects unknown column names", () => {
    const col = pickColumnForInteractivityTemplate(
      {
        ...baseNotes,
        chosen_presentation_column: "Missing",
        best_label_column: "OK",
      },
      {
        layer: "x",
        count: 1,
        geometry: "Polygon",
        attributeCount: 1,
        attributes: [{ attribute: "OK", type: "string", count: 1, values: [] }],
      } as any,
    );
    expect(col).toBe("OK");
  });
});

describe("deriveInteractivitySettingsFromAiNotes", () => {
  test("POPUP maps to ALL_PROPERTIES_POPUP with no template", () => {
    expect(
      deriveInteractivitySettingsFromAiNotes(
        { ...baseNotes, interactivity_type: "POPUP" },
        null,
      ),
    ).toEqual({
      type: "ALL_PROPERTIES_POPUP",
      short_template: null,
    });
  });

  test("BANNER without a column becomes NONE", () => {
    expect(
      deriveInteractivitySettingsFromAiNotes(
        { ...baseNotes, interactivity_type: "BANNER" },
        null,
      ),
    ).toEqual({ type: "NONE", short_template: null });
  });

  test("TOOLTIP with presentation column gets mustache short_template", () => {
    expect(
      deriveInteractivitySettingsFromAiNotes(
        {
          ...baseNotes,
          interactivity_type: "TOOLTIP",
          chosen_presentation_column: "MapClass",
        },
        null,
      ),
    ).toEqual({ type: "TOOLTIP", short_template: "{{MapClass}}" });
  });
});
