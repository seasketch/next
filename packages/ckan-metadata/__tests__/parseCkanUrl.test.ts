import { describe, expect, it } from "vitest";
import {
  localizedDatasetPageUrl,
  parseCkanUrl,
} from "../src/parseCkanUrl";

describe("parseCkanUrl", () => {
  it("parses an open.canada.ca dataset page with a locale segment", () => {
    const parsed = parseCkanUrl(
      "https://open.canada.ca/data/en/dataset/0bc73892-e41f-41d0-8d8e-828c16139337"
    );
    expect(parsed).toEqual({
      baseUrl: "https://open.canada.ca/data/en",
      datasetId: "0bc73892-e41f-41d0-8d8e-828c16139337",
      apiRoot: "https://open.canada.ca/data/en/api/3/action",
      locale: "en",
      datasetPageUrl:
        "https://open.canada.ca/data/en/dataset/0bc73892-e41f-41d0-8d8e-828c16139337",
    });
  });

  it("parses a package_show API URL", () => {
    const parsed = parseCkanUrl(
      "https://open.canada.ca/data/en/api/3/action/package_show?id=3544ad91-0cf2-4926-a08a-bfe42d9a031d"
    );
    expect(parsed?.datasetId).toBe("3544ad91-0cf2-4926-a08a-bfe42d9a031d");
    expect(parsed?.apiRoot).toBe("https://open.canada.ca/data/en/api/3/action");
    expect(parsed?.baseUrl).toBe("https://open.canada.ca/data/en");
  });

  it("parses a BC catalogue dataset page without a locale segment", () => {
    const parsed = parseCkanUrl(
      "https://catalogue.data.gov.bc.ca/dataset/natural-resource-nr-district/"
    );
    expect(parsed).toEqual({
      baseUrl: "https://catalogue.data.gov.bc.ca",
      datasetId: "natural-resource-nr-district",
      apiRoot: "https://catalogue.data.gov.bc.ca/api/3/action",
      locale: null,
      datasetPageUrl:
        "https://catalogue.data.gov.bc.ca/dataset/natural-resource-nr-district",
    });
  });

  it("returns null for non-CKAN and invalid input", () => {
    expect(parseCkanUrl(null)).toBeNull();
    expect(parseCkanUrl(undefined)).toBeNull();
    expect(parseCkanUrl("")).toBeNull();
    expect(parseCkanUrl("not a url")).toBeNull();
    expect(parseCkanUrl("https://example.com/about")).toBeNull();
    expect(parseCkanUrl("ftp://open.canada.ca/data/en/dataset/abc")).toBeNull();
  });

  it("rewrites a locale path segment for the footer link", () => {
    const parsed = parseCkanUrl(
      "https://open.canada.ca/data/en/dataset/0bc73892-e41f-41d0-8d8e-828c16139337"
    );
    expect(parsed).not.toBeNull();
    expect(localizedDatasetPageUrl(parsed!, "fr")).toBe(
      "https://open.canada.ca/data/fr/dataset/0bc73892-e41f-41d0-8d8e-828c16139337"
    );
    expect(localizedDatasetPageUrl(parsed!, "EN")).toBe(
      parsed!.datasetPageUrl
    );
  });
});
