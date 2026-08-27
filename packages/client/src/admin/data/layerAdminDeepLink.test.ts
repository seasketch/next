import { describe, expect, it } from "@jest/globals";
import {
  LAYER_ADMIN_TOC_ITEM_QUERY_PARAM,
  layerAdminUrl,
  parseTocItemIdFromSearch,
} from "./layerAdminDeepLink";

describe("layerAdminDeepLink", () => {
  it("builds a data admin URL with tocItemId", () => {
    expect(layerAdminUrl("demo", 42)).toBe("/demo/admin/data?tocItemId=42");
  });

  it("parses a valid tocItemId from search", () => {
    expect(parseTocItemIdFromSearch("?tocItemId=123")).toBe(123);
    expect(parseTocItemIdFromSearch("tocItemId=123")).toBe(123);
  });

  it("returns null for missing or invalid ids", () => {
    expect(parseTocItemIdFromSearch("")).toBeNull();
    expect(parseTocItemIdFromSearch("?foo=1")).toBeNull();
    expect(parseTocItemIdFromSearch("?tocItemId=abc")).toBeNull();
    expect(parseTocItemIdFromSearch("?tocItemId=0")).toBeNull();
    expect(parseTocItemIdFromSearch("?tocItemId=-3")).toBeNull();
  });

  it("exports the query param name used in URLs", () => {
    expect(LAYER_ADMIN_TOC_ITEM_QUERY_PARAM).toBe("tocItemId");
  });
});
