import { describe, expect, it } from "@jest/globals";
import { OrganismCatalogRow } from "@seasketch/geostats-types";
import {
  classTableJoinColumnName,
  configFromForm,
  emptyOrganismForm,
  filterOrganismPreviewRows,
  formStateFromOrganism,
  isOrganismPreviewPayload,
  parseCsvHeaderLine,
  rolesForEnrichment,
  suggestValueKindForColumn,
  toggleOrganismRole,
} from "./dataTableOrganismForm";

const row = (overrides: Partial<OrganismCatalogRow> = {}): OrganismCatalogRow => ({
  value: "SPUL",
  scientific_name: "Bodianus pulcher",
  common_name: "California Sheephead",
  common_names: ["Sheephead"],
  genus: "Bodianus",
  family: "Labridae",
  ancestor_names: ["Rockfishes", "Wrasses"],
  description: "Size cutoff 10 cm",
  inat_taxon_id: 1439813,
  worms_aphia_id: 1702292,
  search_text: "SPUL Bodianus pulcher California Sheephead",
  occurrence_count: 12,
  confidence: "high",
  ...overrides,
});

describe("formStateFromOrganism / configFromForm", () => {
  it("returns an empty form for null and junk", () => {
    expect(formStateFromOrganism(null)).toEqual(emptyOrganismForm());
    expect(formStateFromOrganism(undefined)).toEqual(emptyOrganismForm());
    expect(formStateFromOrganism(42)).toEqual(emptyOrganismForm());
  });

  it("round-trips a valid OrganismInfo", () => {
    const form = formStateFromOrganism({
      version: 1,
      column: "classcode",
      valueKind: "code",
      roles: { classcode: "code" },
      authoredBy: "admin",
      includeLowConfidenceMatches: true,
    });
    expect(form.column).toBe("classcode");
    expect(form.includeLowConfidenceMatches).toBe(true);
    expect(configFromForm(form)).toEqual({
      column: "classcode",
      valueKind: "code",
      roles: { classcode: "code" },
      includeLowConfidenceMatches: true,
    });
  });

  it("omits the low-confidence flag when false", () => {
    expect(
      configFromForm({
        column: "scientificname",
        valueKind: "scientificName",
        roles: {},
        includeLowConfidenceMatches: false,
      })
    ).toEqual({
      column: "scientificname",
      valueKind: "scientificName",
      roles: {},
    });
  });

  it("returns null without an identity column", () => {
    expect(configFromForm(emptyOrganismForm())).toBeNull();
  });
});

describe("suggestValueKindForColumn / rolesForEnrichment", () => {
  it("guesses classcode as a code column", () => {
    expect(suggestValueKindForColumn("classcode")).toBe("code");
    expect(suggestValueKindForColumn("notes")).toBe("mixed");
  });

  it("suggests roles and fills the identity column", () => {
    const roles = rolesForEnrichment(
      ["classcode", "scientific_name", "count"],
      "classcode",
      "code"
    );
    expect(roles.classcode).toBe("code");
    expect(roles.scientific_name).toBe("scientificName");
    expect(roles.count).toBeUndefined();
  });

  it("keeps existing role assignments", () => {
    const roles = rolesForEnrichment(
      ["classcode", "notes"],
      "classcode",
      "code",
      { notes: "description" }
    );
    expect(roles.notes).toBe("description");
  });
});

describe("toggleOrganismRole / classTableJoinColumnName", () => {
  it("adds, stacks, and removes roles", () => {
    let roles = toggleOrganismRole({}, "classcode", "code");
    expect(roles.classcode).toBe("code");
    roles = toggleOrganismRole(roles, "classcode", "description");
    expect(roles.classcode).toEqual(["code", "description"]);
    roles = toggleOrganismRole(roles, "classcode", "code");
    expect(roles.classcode).toBe("description");
    roles = toggleOrganismRole(roles, "classcode", "description");
    expect(roles.classcode).toBeUndefined();
  });

  it("prefers a code role for the class-table join", () => {
    expect(
      classTableJoinColumnName(
        "classcode",
        { Species_Code: "code", Common_Name: "commonName" },
        ["Species_Code", "Common_Name"]
      )
    ).toBe("Species_Code");
    expect(
      classTableJoinColumnName("classcode", {}, ["classcode", "notes"])
    ).toBe("classcode");
    expect(classTableJoinColumnName("classcode", {}, ["notes"])).toBeNull();
  });
});

describe("parseCsvHeaderLine", () => {
  it("rejects null, undefined, and non-strings", () => {
    expect(parseCsvHeaderLine(null)).toEqual([]);
    expect(parseCsvHeaderLine(undefined)).toEqual([]);
    expect(parseCsvHeaderLine(12)).toEqual([]);
  });

  it("parses commas, quotes, BOM, and tabs", () => {
    expect(parseCsvHeaderLine("classcode,scientific_name,notes")).toEqual([
      "classcode",
      "scientific_name",
      "notes",
    ]);
    expect(parseCsvHeaderLine('\uFEFF"Common, Name",code')).toEqual([
      "Common, Name",
      "code",
    ]);
    expect(parseCsvHeaderLine("classcode\tscientific_name")).toEqual([
      "classcode",
      "scientific_name",
    ]);
  });
});

describe("isOrganismPreviewPayload / filterOrganismPreviewRows", () => {
  const payload = {
    column: "classcode",
    includeLowConfidenceMatches: false,
    valueCount: 2,
    classifiedCount: 1,
    rows: [
      row(),
      row({
        value: "boulder",
        scientific_name: null,
        common_name: null,
        common_names: [],
        genus: null,
        family: null,
        ancestor_names: [],
        description: null,
        inat_taxon_id: null,
        worms_aphia_id: null,
        search_text: "boulder",
        occurrence_count: 8,
        confidence: "unresolved",
      }),
    ],
  };

  it("guards null, undefined, and a valid payload", () => {
    expect(isOrganismPreviewPayload(null)).toBe(false);
    expect(isOrganismPreviewPayload(undefined)).toBe(false);
    expect(isOrganismPreviewPayload({})).toBe(false);
    expect(isOrganismPreviewPayload(payload)).toBe(true);
  });

  it("filters by local text and confidence", () => {
    expect(filterOrganismPreviewRows(payload.rows, "sheephead")).toEqual([
      payload.rows[0],
    ]);
    expect(filterOrganismPreviewRows(payload.rows, "boulder")).toEqual([
      payload.rows[1],
    ]);
    expect(
      filterOrganismPreviewRows(payload.rows, "", "unresolved")
    ).toEqual([payload.rows[1]]);
    expect(filterOrganismPreviewRows(payload.rows, "nope")).toEqual([]);
  });
});
