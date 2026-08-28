import { describe, expect, it } from "vitest";
import { discoverCkanFields } from "../src/discoverFields";
import { loadCkanResult } from "./helpers";

const canadaSchema = loadCkanResult("canada-scheming-dataset.json");
const nrd = loadCkanResult("canada-natural-resource-districts.json");
const hdx = loadCkanResult("hdx-tunisia-healthsites.json");

describe("discoverCkanFields", () => {
  it("returns the scheming dataset_fields universe for Canada", () => {
    const fields = discoverCkanFields(canadaSchema, nrd, { lang: "EN" });
    const ids = fields.map((field) => field.id);
    expect(ids).toContain("notes");
    expect(ids).toContain("organization");
    expect(ids).toContain("license");
    expect(ids).toContain("frequency");
    expect(ids).toContain("temporal_coverage");
    expect(ids).toContain("resources");
    expect(ids).not.toContain("id");
    expect(ids).not.toContain("title");
    expect(fields.length).toBeGreaterThan(20);
    expect(fields.find((field) => field.id === "frequency")?.label).toBe(
      "Maintenance and Update Frequency"
    );
  });

  it("falls back to sampled record keys without a schema", () => {
    const fields = discoverCkanFields(undefined, hdx, { lang: "EN" });
    expect(fields.some((field) => field.id === "notes")).toBe(true);
    expect(fields.length).toBeGreaterThan(5);
  });
});
