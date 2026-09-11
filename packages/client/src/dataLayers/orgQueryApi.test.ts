import { describe, expect, it } from "@jest/globals";
import {
  buildOrgQueryUrl,
  isOrgQueryHit,
  isOrgQueryResponse,
  orgQueryHitMatchedAncestor,
  orgQueryUrlForTable,
  organismColumnFromTable,
} from "./orgQueryApi";

const hit = {
  table: "projects/ca/public/11111111-1111-1111-1111-111111111111/dataTables/u1",
  column: "classcode",
  value: "SPUL",
  scientificName: "Bodianus pulcher",
  commonName: "California Sheephead",
  description: null,
  inatTaxonId: 1439813,
  wormsAphiaId: 1702292,
  score: 8,
  matchedFields: ["common_name"],
};

describe("isOrgQueryHit", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(isOrgQueryHit(null)).toBe(false);
    expect(isOrgQueryHit(undefined)).toBe(false);
    expect(isOrgQueryHit("SPUL")).toBe(false);
  });

  it("accepts a stored display hit", () => {
    expect(isOrgQueryHit(hit)).toBe(true);
  });
});

describe("isOrgQueryResponse", () => {
  it("rejects incomplete payloads", () => {
    expect(isOrgQueryResponse(null)).toBe(false);
    expect(isOrgQueryResponse({ q: "x", hits: [] })).toBe(false);
  });

  it("accepts a ranked response", () => {
    expect(
      isOrgQueryResponse({ q: "sheephead", tablesScanned: 1, hits: [hit] })
    ).toBe(true);
  });
});

describe("orgQueryUrlForTable", () => {
  it("prefers the GraphQL field and otherwise rewrites queryUrl", () => {
    expect(
      orgQueryUrlForTable({
        orgQueryUrl: "https://uploads.seasketch.org/orgQuery?tables=a",
        queryUrl: "https://uploads.seasketch.org/ignored/query",
      })
    ).toBe("https://uploads.seasketch.org/orgQuery?tables=a");
    expect(
      orgQueryUrlForTable({
        queryUrl:
          "https://uploads.seasketch.org/projects/ca/public/11111111-1111-1111-1111-111111111111/dataTables/u1/query",
      })
    ).toBe(
      "https://uploads.seasketch.org/orgQuery?tables=projects%2Fca%2Fpublic%2F11111111-1111-1111-1111-111111111111%2FdataTables%2Fu1"
    );
  });
});

describe("buildOrgQueryUrl", () => {
  it("sets q and limit on the GraphQL URL", () => {
    expect(
      buildOrgQueryUrl(
        "https://uploads.seasketch.org/orgQuery?tables=a",
        "sheephead",
        20
      )
    ).toBe(
      "https://uploads.seasketch.org/orgQuery?tables=a&q=sheephead&limit=20"
    );
    expect(
      buildOrgQueryUrl(
        "https://uploads.seasketch.org/orgQuery?tables=a",
        ""
      )
    ).toBe(
      "https://uploads.seasketch.org/orgQuery?tables=a&q=&limit=2000"
    );
  });
});

describe("organismColumnFromTable", () => {
  it("rejects null and a missing document", () => {
    expect(organismColumnFromTable(null)).toBeNull();
    expect(organismColumnFromTable(undefined)).toBeNull();
    expect(organismColumnFromTable({})).toBeNull();
  });

  it("reads the identity column from a valid document", () => {
    expect(
      organismColumnFromTable({
        organism: {
          version: 1,
          column: "classcode",
          valueKind: "code",
          roles: {},
        },
      })
    ).toBe("classcode");
  });
});

describe("orgQueryHitMatchedAncestor", () => {
  it("detects hierarchical recall", () => {
    expect(orgQueryHitMatchedAncestor(hit)).toBe(false);
    expect(
      orgQueryHitMatchedAncestor({
        ...hit,
        matchedFields: ["ancestor_names"],
      })
    ).toBe(true);
  });
});
