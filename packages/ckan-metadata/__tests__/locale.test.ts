import { describe, expect, it } from "vitest";
import { negotiateCkanLocale, resolveFluent } from "../src/locale";

const CANADA_KEYS = ["en", "fr", "fr-t-en"];
const SCHEMA = { form_languages: ["en", "fr"] };

describe("negotiateCkanLocale", () => {
  it("maps EN to en", () => {
    expect(negotiateCkanLocale("EN", CANADA_KEYS, SCHEMA)).toBe("en");
  });

  it("maps pt-br to pt when pt is available", () => {
    expect(negotiateCkanLocale("pt-br", ["pt", "en"], SCHEMA)).toBe("pt");
  });

  it("maps fr-be to a human fr before a machine-translation variant", () => {
    expect(negotiateCkanLocale("fr-be", CANADA_KEYS, SCHEMA)).toBe("fr");
    expect(negotiateCkanLocale("fr", CANADA_KEYS, SCHEMA)).toBe("fr");
  });

  it("accepts a machine-translation variant only after human translations are exhausted", () => {
    expect(negotiateCkanLocale("fr", ["en", "fr-t-en"], SCHEMA)).toBe(
      "fr-t-en"
    );
  });

  it("falls through unsupported codes like CHK to form_languages[0]", () => {
    expect(negotiateCkanLocale("CHK", CANADA_KEYS, SCHEMA)).toBe("en");
  });

  it("falls back to en then the first key", () => {
    expect(negotiateCkanLocale(undefined, ["de", "en"])).toBe("en");
    expect(negotiateCkanLocale(undefined, ["de", "it"])).toBe("de");
  });

  it("returns undefined for empty keys", () => {
    expect(negotiateCkanLocale("en", [])).toBeUndefined();
  });
});

describe("resolveFluent", () => {
  it("picks the requested locale and ignores machine-translation variants for EN", () => {
    const value = {
      en: "Natural Resource Districts",
      "fr-t-en": "Districts de ressources naturelles (NR)",
    };
    expect(resolveFluent(value, "EN", SCHEMA)).toBe(
      "Natural Resource Districts"
    );
    expect(resolveFluent(value, "fr", SCHEMA)).toBe(
      "Districts de ressources naturelles (NR)"
    );
  });

  it("returns non-objects unchanged", () => {
    expect(resolveFluent("plain", "en")).toBe("plain");
    expect(resolveFluent(null, "en")).toBeNull();
    expect(resolveFluent(["a"], "en")).toEqual(["a"]);
  });
});
