import { describe, expect, it } from "@jest/globals";
import {
  ORG_QUERY_MAX_TABLES,
  buildOverlayOrgQueryUrls,
  collectEnrichedDataTables,
  highlightQueryTerms,
  matchHitToEntry,
  mergeOrganismFilter,
  taxonHitIsActive,
  EnrichedDataTableEntry,
  OverlayTaxonTocItem,
} from "./overlayTaxonSearch";
import { OrgQueryHit } from "./orgQueryApi";

const organism = {
  version: 1 as const,
  column: "classcode",
  valueKind: "code" as const,
  roles: { classcode: "code" as const },
};

function prefixFor(n: number): string {
  return (
    "projects/ca/public/11111111-1111-1111-1111-" +
    String(n).padStart(12, "0") +
    "/dataTables/u1"
  );
}

function queryUrlFor(n: number): string {
  return "https://uploads.seasketch.org/" + prefixFor(n) + "/query";
}

function layer(
  overrides: Partial<OverlayTaxonTocItem> &
    Pick<OverlayTaxonTocItem, "id" | "stableId">
): OverlayTaxonTocItem {
  return {
    title: "Layer",
    overlayDataTables: [
      {
        id: overrides.id,
        stableId: "table-" + overrides.stableId,
        name: "Fish transects",
        description: "Density by site",
        rowCount: 1200,
        queryUrl: queryUrlFor(overrides.id),
        organism,
      },
    ],
    ...overrides,
  };
}

const hit = (table: string, value = "SPUL"): OrgQueryHit => ({
  table,
  column: "classcode",
  value,
  scientificName: "Bodianus pulcher",
  commonName: "California Sheephead",
  description: null,
  inatTaxonId: 1,
  wormsAphiaId: null,
  score: 1,
  matchedFields: ["common_name"],
});

describe("collectEnrichedDataTables", () => {
  it("returns nothing when there are no tables", () => {
    expect(collectEnrichedDataTables([])).toEqual([]);
    expect(
      collectEnrichedDataTables([
        { id: 1, stableId: "layer", title: "Kelp", overlayDataTables: [] },
      ])
    ).toEqual([]);
  });

  it("skips tables that are not enriched or cannot be queried", () => {
    const items: OverlayTaxonTocItem[] = [
      layer({
        id: 1,
        stableId: "ok",
        title: "Fish",
        parentStableId: "folder",
      }),
      {
        id: 2,
        stableId: "folder",
        title: "Kelp Forest",
        parentStableId: "program",
      },
      {
        id: 3,
        stableId: "program",
        title: "Monitoring",
      },
      layer({
        id: 4,
        stableId: "plain",
        overlayDataTables: [
          {
            id: 4,
            stableId: "plain-table",
            queryUrl: queryUrlFor(4),
            organism: null,
          },
        ],
      }),
      layer({
        id: 5,
        stableId: "bad-prefix",
        overlayDataTables: [
          {
            id: 5,
            stableId: "bad-table",
            queryUrl: "https://uploads.seasketch.org/draft/not-a-table/query",
            organism,
          },
        ],
      }),
      layer({
        id: 6,
        stableId: "gone",
        overlayDataTables: [
          {
            id: 6,
            stableId: "gone-table",
            queryUrl: queryUrlFor(6),
            organism,
            deletedAt: "2020-01-01",
          },
        ],
      }),
    ];
    const entries = collectEnrichedDataTables(items);
    expect(entries.map((entry) => entry.tocStableId)).toEqual(["ok"]);
    expect(entries[0].prefix).toBe(prefixFor(1));
    expect(entries[0].origin).toBe("https://uploads.seasketch.org");
    expect(entries[0].organismColumn).toBe("classcode");
    expect(entries[0].folderPath).toEqual(["Monitoring", "Kelp Forest"]);
    expect(entries[0].layerTitle).toBe("Fish");
  });
});

describe("buildOverlayOrgQueryUrls", () => {
  it("chunks prefixes at the worker table limit", () => {
    const entries = collectEnrichedDataTables(
      Array.from({ length: ORG_QUERY_MAX_TABLES + 1 }, (_, index) =>
        layer({ id: index + 1, stableId: "l" + index, title: "L" + index })
      )
    );
    const urls = buildOverlayOrgQueryUrls(entries, 300);
    expect(urls).toHaveLength(2);
    const first = new URL(urls[0]);
    expect(first.pathname).toBe("/orgQuery");
    expect(first.searchParams.get("tables")!.split(",")).toHaveLength(
      ORG_QUERY_MAX_TABLES
    );
    expect(first.searchParams.get("limit")).toBe("300");
    expect(new URL(urls[1]).searchParams.get("tables")!.split(",")).toHaveLength(
      1
    );
  });
});

describe("matchHitToEntry", () => {
  it("matches table prefixes case-insensitively", () => {
    const [entry] = collectEnrichedDataTables([
      layer({ id: 1, stableId: "ok" }),
    ]);
    expect(matchHitToEntry(hit(entry.prefix.toUpperCase()), [entry])?.tocStableId).toBe(
      "ok"
    );
    expect(matchHitToEntry(hit("projects/other"), [entry])).toBeUndefined();
  });
});

describe("mergeOrganismFilter", () => {
  it("keeps column, aggregation, and other filters", () => {
    expect(
      mergeOrganismFilter(
        {
          column: "count",
          op: "mean",
          filters: [
            { column: "site", op: "eq", value: "A" },
            { column: "classcode", op: "in", values: ["OLD"] },
          ],
        },
        "classcode",
        "SPUL"
      )
    ).toEqual({
      column: "count",
      op: "mean",
      filters: [
        { column: "site", op: "eq", value: "A" },
        { column: "classcode", op: "eq", value: "SPUL" },
      ],
    });
  });

  it("works with no remembered settings", () => {
    expect(mergeOrganismFilter(undefined, "classcode", "SPUL")).toEqual({
      column: undefined,
      op: undefined,
      filters: [{ column: "classcode", op: "eq", value: "SPUL" }],
    });
  });
});

describe("taxonHitIsActive", () => {
  const entry = {
    table: { id: 1, stableId: "table-1" },
    organismColumn: "classcode",
  } as Pick<EnrichedDataTableEntry, "table" | "organismColumn">;

  it("matches eq and in filters on the organism column", () => {
    expect(
      taxonHitIsActive(
        {
          visible: true,
          dataTable: {
            stableId: "table-1",
            filters: [{ column: "classcode", op: "eq", value: "SPUL" }],
          },
        },
        entry,
        { value: "SPUL" }
      )
    ).toBe(true);
    expect(
      taxonHitIsActive(
        {
          visible: true,
          dataTable: {
            stableId: "table-1",
            filters: [{ column: "classcode", op: "in", values: ["AA", "SPUL"] }],
          },
        },
        entry,
        { value: "SPUL" }
      )
    ).toBe(true);
    expect(
      taxonHitIsActive(
        {
          visible: false,
          dataTable: {
            stableId: "table-1",
            filters: [{ column: "classcode", op: "eq", value: "SPUL" }],
          },
        },
        entry,
        { value: "SPUL" }
      )
    ).toBe(false);
    expect(
      taxonHitIsActive(
        {
          visible: true,
          hidden: true,
          dataTable: {
            stableId: "table-1",
            filters: [{ column: "classcode", op: "eq", value: "SPUL" }],
          },
        },
        entry,
        { value: "SPUL" }
      )
    ).toBe(false);
    expect(
      taxonHitIsActive(
        {
          visible: true,
          dataTable: {
            stableId: "other",
            filters: [{ column: "classcode", op: "eq", value: "SPUL" }],
          },
        },
        entry,
        { value: "SPUL" }
      )
    ).toBe(false);
    expect(
      taxonHitIsActive(
        {
          visible: true,
          dataTable: {
            stableId: "table-1",
            filters: [{ column: "classcode", op: "eq", value: "OTHER" }],
          },
        },
        entry,
        { value: "SPUL" }
      )
    ).toBe(false);
  });
});

describe("highlightQueryTerms", () => {
  it("highlights word-boundary prefixes and class codes", () => {
    expect(highlightQueryTerms("Kelp Bass", "kelp")).toBe("<<<Kelp>>> Bass");
    expect(highlightQueryTerms("Kelp Bass", "kelp bass")).toBe(
      "<<<Kelp>>> <<<Bass>>>"
    );
    expect(highlightQueryTerms("SPUL", "spu")).toBe("<<<SPU>>>L");
    expect(highlightQueryTerms("sheephead", "head")).toBe("sheephead");
    expect(highlightQueryTerms("Bodianus pulcher", "pul")).toBe(
      "Bodianus <<<pul>>>cher"
    );
  });
});
