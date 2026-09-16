import { describe, expect, it } from "@jest/globals";
import { OrganismCatalogRow } from "@seasketch/geostats-types";
import {
  classTableJoinColumnName,
  configFromForm,
  distinctValuesFromColumnStats,
  emptyOrganismForm,
  filterOrganismPreviewRows,
  formStateFromOrganism,
  isOrganismPreviewPayload,
  joinOrganismCatalogRows,
  organismFormIsDirty,
  parseCsvHeaderLine,
  parseCsvRecords,
  parseDistinctOrganismGroups,
  rolesForEnrichment,
  rolesForSourceAndJoinTables,
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
      classJoinColumn: "orig_classcode",
      authoredBy: "admin",
      includeLowConfidenceMatches: true,
    });
    expect(form.column).toBe("classcode");
    expect(form.includeLowConfidenceMatches).toBe(true);
    expect(form.classJoinColumn).toBe("orig_classcode");
    expect(configFromForm(form)).toEqual({
      column: "classcode",
      valueKind: "code",
      roles: { classcode: "code" },
      includeLowConfidenceMatches: true,
    });
    expect(
      configFromForm(form, { classHeaders: ["orig_classcode"] })
    ).toEqual({
      column: "classcode",
      valueKind: "code",
      roles: { classcode: "code" },
      classJoinColumn: "orig_classcode",
      includeLowConfidenceMatches: true,
    });
  });

  it("omits the low-confidence flag when false", () => {
    expect(
      configFromForm({
        column: "scientificname",
        valueKind: "scientificName",
        roles: {},
        classJoinColumn: "",
        includeLowConfidenceMatches: false,
      })
    ).toEqual({
      column: "scientificname",
      valueKind: "scientificName",
      roles: {},
    });
  });

  it("requires an explicit class-table join column when a CSV is attached", () => {
    const form = {
      column: "classcode",
      valueKind: "code" as const,
      roles: { classcode: "code" as const },
      classJoinColumn: "",
      includeLowConfidenceMatches: false,
    };
    expect(
      configFromForm(form, { classHeaders: ["classcode", "orig_classcode"] })
    ).toBeNull();
    expect(
      configFromForm(
        { ...form, classJoinColumn: "orig_classcode" },
        { classHeaders: ["classcode", "orig_classcode"] }
      )
    ).toEqual({
      column: "classcode",
      valueKind: "code",
      roles: { classcode: "code" },
      classJoinColumn: "orig_classcode",
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

  it("maps observation-table columns when there is no class CSV", () => {
    const roles = rolesForEnrichment(
      ["classcode", "genus", "species", "count"],
      "classcode",
      "code"
    );
    expect(roles.classcode).toBe("code");
    expect(roles.genus).toBe("genus");
    expect(roles.species).toBe("species");
    expect(roles.count).toBeUndefined();
  });

  it("keeps source and join roles together", () => {
    const roles = rolesForSourceAndJoinTables(
      ["classcode", "genus"],
      ["Species_Code", "scientific_name"],
      "classcode",
      "code",
      { genus: "genus" }
    );
    expect(roles.classcode).toBe("code");
    expect(roles.genus).toBe("genus");
    expect(roles.Species_Code).toBe("code");
    expect(roles.scientific_name).toBe("scientificName");
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

  it("parses records after the header", () => {
    expect(parseCsvRecords(null)).toEqual({ headers: [], rows: [] });
    expect(
      parseCsvRecords("classcode,scientific_name\nSPUL,Bodianus pulcher\n")
    ).toEqual({
      headers: ["classcode", "scientific_name"],
      rows: [{ classcode: "SPUL", scientific_name: "Bodianus pulcher" }],
    });
  });
});

describe("joinOrganismCatalogRows", () => {
  it("fills names from the class table and leaves taxa unresolved", () => {
    const rows = joinOrganismCatalogRows({
      values: [
        { value: "SPUL", occurrenceCount: 12 },
        { value: "boulder", occurrenceCount: 4 },
      ],
      classRows: [
        {
          classcode: "SPUL",
          Scientific_Name: "Bodianus pulcher",
          Common_Name: "California Sheephead",
          taxanomic_id: "1702292",
          species_definition: "Size cutoff 10 cm",
        },
        { classcode: "boulder", species_definition: "Substrate" },
      ],
      config: {
        column: "classcode",
        valueKind: "code",
        classJoinColumn: "classcode",
        roles: {
          classcode: "code",
          Scientific_Name: "scientificName",
          Common_Name: "commonName",
          taxanomic_id: "wormsAphiaId",
          species_definition: "description",
        },
      },
    });
    expect(rows[0]).toMatchObject({
      value: "SPUL",
      scientific_name: "Bodianus pulcher",
      common_name: "California Sheephead",
      worms_aphia_id: 1702292,
      inat_taxon_id: null,
      confidence: "unresolved",
      occurrence_count: 12,
    });
    expect(rows[1]).toMatchObject({
      value: "boulder",
      description: "Substrate",
      scientific_name: null,
      confidence: "unresolved",
    });
  });

  it("uses the identity value when it is already a scientific name", () => {
    const rows = joinOrganismCatalogRows({
      values: [{ value: "Bodianus pulcher", occurrenceCount: 1 }],
      config: {
        column: "scientificname",
        valueKind: "scientificName",
        roles: {},
      },
    });
    expect(rows[0].scientific_name).toBe("Bodianus pulcher");
    expect(rows[0].genus).toBe("Bodianus");
  });
});

describe("organismFormIsDirty / distinct values", () => {
  it("treats a new class file or role change as dirty", () => {
    const existing = {
      version: 1 as const,
      column: "classcode",
      valueKind: "code" as const,
      roles: { classcode: "code" as const },
    };
    expect(
      organismFormIsDirty(
        {
          column: "classcode",
          valueKind: "code",
          roles: { classcode: "code" },
          classJoinColumn: "",
          includeLowConfidenceMatches: false,
        },
        existing,
        false
      )
    ).toBe(false);
    expect(
      organismFormIsDirty(
        {
          column: "classcode",
          valueKind: "code",
          roles: { classcode: "code" },
          classJoinColumn: "",
          includeLowConfidenceMatches: false,
        },
        existing,
        true
      )
    ).toBe(true);
    expect(
      organismFormIsDirty(
        {
          column: "classcode",
          valueKind: "code",
          roles: { Common_Name: "commonName" },
          classJoinColumn: "",
          includeLowConfidenceMatches: false,
        },
        existing,
        false
      )
    ).toBe(true);
  });

  it("uses a complete histogram and rejects a truncated one", () => {
    expect(distinctValuesFromColumnStats(undefined, "classcode")).toBeNull();
    expect(
      distinctValuesFromColumnStats(
        {
          rowCount: 3,
          columns: [
            {
              attribute: "classcode",
              type: "string",
              countDistinct: 2,
              values: { SPUL: 12, boulder: 4 },
            },
          ],
        },
        "classcode"
      )
    ).toEqual([
      { value: "boulder", occurrenceCount: 4 },
      { value: "SPUL", occurrenceCount: 12 },
    ]);
    expect(
      distinctValuesFromColumnStats(
        {
          rowCount: 3,
          columns: [
            {
              attribute: "classcode",
              type: "string",
              countDistinct: 700,
              values: { SPUL: 12 },
            },
          ],
        },
        "classcode"
      )
    ).toBeNull();
  });

  it("reads grouped /query counts", () => {
    expect(parseDistinctOrganismGroups(null, "classcode")).toEqual([]);
    expect(
      parseDistinctOrganismGroups(
        { groups: [{ classcode: "SPUL", count: 12 }, { classcode: "", count: 1 }] },
        "classcode"
      )
    ).toEqual([{ value: "SPUL", occurrenceCount: 12 }]);
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
