import { Schema } from "prosemirror-model";
import { addListNodes } from "prosemirror-schema-list";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { describe, expect, it } from "vitest";
import { ckanFieldsToProseMirror, packageTitle } from "../src/toProseMirror";
import { normalizeCkanPackage } from "../src/normalize";
import { loadCkanResult } from "./helpers";

const metadataSchema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
  marks: basicSchema.spec.marks,
});

const canadaSchema = loadCkanResult("canada-scheming-dataset.json");
const fixtures = {
  nrd: loadCkanResult("canada-natural-resource-districts.json") as Record<
    string,
    unknown
  >,
  crown: loadCkanResult("canada-crown-tenures.json") as Record<string, unknown>,
  parcels: loadCkanResult("canada-surveyed-parcels.json") as Record<
    string,
    unknown
  >,
  regional: loadCkanResult("canada-regional-districts.json") as Record<
    string,
    unknown
  >,
  municipalities: loadCkanResult("canada-municipalities.json") as Record<
    string,
    unknown
  >,
};

describe("ckanFieldsToProseMirror", () => {
  it("builds a heading, description, and labeled scalars", () => {
    const fields = normalizeCkanPackage(fixtures.nrd, canadaSchema, {
      lang: "EN",
    });
    const doc = ckanFieldsToProseMirror(fields, undefined, {
      title: packageTitle(fixtures.nrd, "EN"),
      lang: "EN",
    });
    expect(doc.type).toBe("doc");
    expect(doc.content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    });
    const serialized = JSON.stringify(doc);
    expect(serialized).toContain("Natural Resource");
    expect(serialized).toContain("As Needed");
    expect(serialized).not.toContain("View original record");
    metadataSchema.nodeFromJSON(doc);
  });

  it("round-trips every Canada fixture in EN and fr", () => {
    for (const [name, pkg] of Object.entries(fixtures)) {
      for (const lang of ["EN", "fr"]) {
        const fields = normalizeCkanPackage(pkg, canadaSchema, { lang });
        const doc = ckanFieldsToProseMirror(fields, undefined, {
          title: packageTitle(pkg, lang),
          lang,
          resources: pkg.resources,
        });
        expect(() => metadataSchema.nodeFromJSON(doc)).not.toThrow();
        expect(doc).toMatchSnapshot(`${name}-${lang}`);
      }
    }
  });

  it("honors display config field order and labels", () => {
    const fields = normalizeCkanPackage(fixtures.nrd, canadaSchema, {
      lang: "EN",
    });
    const doc = ckanFieldsToProseMirror(
      fields,
      {
        fields: [
          { id: "frequency", included: true, label: "Update cadence" },
          { id: "notes", included: true },
        ],
      },
      { title: "NRD", lang: "EN" }
    );
    const serialized = JSON.stringify(doc);
    expect(serialized).toContain("Update cadence");
    expect(serialized).not.toContain("Organization");
  });

  it("uses a machine-translation title when no human fr key exists", () => {
    expect(packageTitle(fixtures.nrd, "fr")).toBe(
      "Districts de ressources naturelles (NR)"
    );
    expect(packageTitle(fixtures.nrd, "EN")).toBe(
      "Natural Resource (NR) Districts"
    );
  });
});
