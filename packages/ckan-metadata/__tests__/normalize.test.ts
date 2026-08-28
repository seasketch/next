import { describe, expect, it } from "vitest";
import {
  isCkanDisplayConfig,
  isCkanPackage,
  isCkanSchema,
  normalizeCkanPackage,
} from "../src/normalize";
import { loadCkanResult } from "./helpers";

const canadaSchema = loadCkanResult("canada-scheming-dataset.json");
const nrd = loadCkanResult("canada-natural-resource-districts.json");
const crown = loadCkanResult("canada-crown-tenures.json");
const regional = loadCkanResult("canada-regional-districts.json");
const bc = loadCkanResult("bc-natural-resource-districts.json");
const bcSchema = loadCkanResult("bc-scheming-bcdc-dataset.json");
const hdx = loadCkanResult("hdx-tunisia-healthsites.json");

function field(fields: ReturnType<typeof normalizeCkanPackage>, id: string) {
  return fields.find((item) => item.id === id);
}

describe("type guards", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(isCkanPackage(null)).toBe(false);
    expect(isCkanPackage(undefined)).toBe(false);
    expect(isCkanPackage("pkg")).toBe(false);
    expect(isCkanPackage(12)).toBe(false);
    expect(isCkanSchema(null)).toBe(false);
    expect(isCkanSchema({})).toBe(false);
    expect(isCkanDisplayConfig(null)).toBe(true);
    expect(isCkanDisplayConfig({ fields: [{ id: "notes", included: true }] })).toBe(
      true
    );
    expect(isCkanDisplayConfig({ fields: [{ included: true }] })).toBe(false);
  });

  it("accepts a valid package and schema", () => {
    expect(isCkanPackage(nrd)).toBe(true);
    expect(isCkanSchema(canadaSchema)).toBe(true);
  });
});

describe("normalizeCkanPackage", () => {
  it("returns an empty list for invalid input", () => {
    expect(normalizeCkanPackage(null)).toEqual([]);
    expect(normalizeCkanPackage(undefined)).toEqual([]);
    expect(normalizeCkanPackage("nope")).toEqual([]);
  });

  it("localizes Canada frequency and topic labels with the schema", () => {
    const en = normalizeCkanPackage(nrd, canadaSchema, { lang: "EN" });
    const fr = normalizeCkanPackage(nrd, canadaSchema, { lang: "fr" });
    expect(field(en, "frequency")?.displayValue).toBe("As Needed");
    expect(field(en, "frequency")?.label).toBe(
      "Maintenance and Update Frequency"
    );
    expect(field(fr, "frequency")?.displayValue).toBe("Au besoin");
    expect(field(fr, "frequency")?.label).toBe(
      "Fréquence d'entretien et de mise à jour"
    );
    expect(field(en, "topic_category")?.displayValue).toEqual(["Boundaries"]);
  });

  it("drops the 0001-01-01 sentinel temporal start", () => {
    const fields = normalizeCkanPackage(crown, canadaSchema, { lang: "EN" });
    expect(field(fields, "time_period_coverage_start")).toBeUndefined();
    expect(field(fields, "temporal_coverage")).toBeUndefined();
  });

  it("parses JSON-encoded contact_information", () => {
    const fields = normalizeCkanPackage(nrd, canadaSchema, { lang: "EN" });
    const contact = field(fields, "contact_information");
    expect(contact).toBeDefined();
    expect(typeof contact?.value).toBe("object");
    expect(JSON.stringify(contact?.value)).toContain("GeoBC Inquiries");
  });

  it("does not choose fr-t-en for an EN viewer", () => {
    const fields = normalizeCkanPackage(nrd, canadaSchema, { lang: "EN" });
    const notes = field(fields, "notes");
    expect(typeof notes?.value).toBe("string");
    expect(String(notes?.value)).toContain("Natural Resource");
    expect(String(notes?.value)).not.toContain("ressources naturelles");
  });

  it("uses markdown notes from Regional Districts", () => {
    const fields = normalizeCkanPackage(regional, canadaSchema, { lang: "EN" });
    const notes = field(fields, "notes");
    expect(notes?.type).toBe("markdown");
    expect(String(notes?.value)).toContain("__Regional District__");
  });

  it("still produces useful fields without a schema", () => {
    const fields = normalizeCkanPackage(nrd, undefined, { lang: "EN" });
    expect(field(fields, "notes")).toBeDefined();
    expect(field(fields, "organization")?.displayValue).toMatch(
      /British Columbia/
    );
    expect(field(fields, "frequency")?.displayValue).toBe("as_needed");
    expect(field(fields, "frequency")?.label).toBe("Frequency");
  });

  it("normalizes a BC catalogue record with plain-string labels", () => {
    const fields = normalizeCkanPackage(bc, bcSchema, { lang: "EN" });
    expect(field(fields, "notes")).toBeDefined();
    expect(field(fields, "organization") || field(fields, "notes")).toBeDefined();
  });

  it("normalizes a non-scheming HDX record", () => {
    const fields = normalizeCkanPackage(hdx, undefined, { lang: "EN" });
    expect(field(fields, "notes") || field(fields, "organization")).toBeDefined();
    expect(fields.length).toBeGreaterThan(3);
  });

  it("snapshots Canada records in EN and fr", () => {
    for (const [name, pkg] of [
      ["nrd", nrd],
      ["crown", crown],
    ] as const) {
      expect(
        normalizeCkanPackage(pkg, canadaSchema, { lang: "EN" }).map((item) => ({
          id: item.id,
          label: item.label,
          displayValue: item.displayValue,
          type: item.type,
          recommended: item.recommended,
        }))
      ).toMatchSnapshot(`${name}-en`);
      expect(
        normalizeCkanPackage(pkg, canadaSchema, { lang: "fr" }).map((item) => ({
          id: item.id,
          label: item.label,
          displayValue: item.displayValue,
          type: item.type,
        }))
      ).toMatchSnapshot(`${name}-fr`);
    }
  });
});
