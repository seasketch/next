import { composeAiDataAnalystNotesFromPromises } from "../src/aiUploadNotes";

const baseColumn = {
  junk_columns: [] as string[],
  chosen_presentation_type: "SIMPLE_POLYGON" as const,
  show_labels: false,
  interactivity_type: "NONE" as const,
  notes: "ok",
};

describe("composeAiDataAnalystNotesFromPromises", () => {
  test("returns merged notes when column intelligence succeeds", async () => {
    const out = await composeAiDataAnalystNotesFromPromises({
      uploadFilename: "cities.zip",
      titleP: Promise.resolve({ title: "Cities", usage: {} as any }),
      attributionP: Promise.resolve({
        attribution: "CC-BY",
        usage: {} as any,
      }),
      columnP: Promise.resolve({
        result: { ...baseColumn },
        usage: {} as any,
      }),
    });
    expect(out).toMatchObject({
      notes: "ok",
      best_layer_title: "Cities",
      attribution: "CC-BY",
    });
    expect(out?.errors).toBeUndefined();
  });

  test("returns undefined when column intelligence fails; records errors", async () => {
    const out = await composeAiDataAnalystNotesFromPromises({
      uploadFilename: "x.geojson",
      titleP: Promise.resolve({ title: "X", usage: {} as any }),
      attributionP: Promise.resolve({ error: "attr failed", usage: {} as any }),
      columnP: Promise.resolve({ error: "timeout" }),
    });
    expect(out).toBeUndefined();
  });

  test("keeps column result when title or attribution fail", async () => {
    const out = await composeAiDataAnalystNotesFromPromises({
      uploadFilename: "y.geojson",
      titleP: Promise.resolve({ error: "bad title", usage: {} as any }),
      attributionP: Promise.resolve({ error: "bad attr", usage: {} as any }),
      columnP: Promise.resolve({
        result: { ...baseColumn },
        usage: {} as any,
      }),
    });
    expect(out?.notes).toBe("ok");
    expect(out?.errors).toContain("title:");
    expect(out?.errors).toContain("attribution:");
    expect(out?.best_layer_title).toBeUndefined();
    expect(out?.attribution).toBeUndefined();
  });

  test("preserves null attribution from model", async () => {
    const out = await composeAiDataAnalystNotesFromPromises({
      uploadFilename: "z.zip",
      titleP: null,
      attributionP: Promise.resolve({
        attribution: null,
        usage: {} as any,
      }),
      columnP: Promise.resolve({
        result: { ...baseColumn },
        usage: {} as any,
      }),
    });
    expect(out?.attribution).toBeNull();
  });
});
