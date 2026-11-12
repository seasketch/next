import {
  contactEmailProblem,
  mailtoHref,
  normalizeContactEmail,
} from "./contactEmail";

describe("contact email", () => {
  test("trims surrounding space", () => {
    expect(normalizeContactEmail("  planning@example.org  ")).toBe(
      "planning@example.org"
    );
  });

  test("requires an address", () => {
    expect(contactEmailProblem("")).toBe("required");
    expect(contactEmailProblem("   ")).toBe("required");
  });

  test("rejects values that are not email addresses", () => {
    expect(contactEmailProblem("not-an-email")).toBe("invalid");
    expect(contactEmailProblem("missing-domain@")).toBe("invalid");
    expect(contactEmailProblem("spaces in@example.org")).toBe("invalid");
  });

  test("accepts a normal address", () => {
    expect(contactEmailProblem("planning@example.org")).toBeUndefined();
    expect(contactEmailProblem("  Admin@Example.Test ")).toBeUndefined();
  });

  test("adds a subject when one is provided", () => {
    expect(mailtoHref("planning@example.org")).toBe(
      "mailto:planning@example.org"
    );
    expect(mailtoHref("planning@example.org", "Access request")).toBe(
      "mailto:planning@example.org?subject=Access%20request"
    );
  });
});
