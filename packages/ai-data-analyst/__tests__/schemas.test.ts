import { describe, expect, it } from "vitest";
import {
  attributionFormattingSchema,
  attributionFormattingValidator,
  columnIntelligenceSchema,
  columnIntelligenceValidator,
  titleFormattingSchema,
  titleFormattingValidator,
} from "../lib/schemas";

function minimalColumnIntelligence(overrides: Record<string, unknown> = {}) {
  return {
    chosen_presentation_type: "SIMPLE_POLYGON",
    notes: "Suitable for general polygon display.",
    junk_columns: ["OBJECTID", "Shape_Length"],
    interactivity_type: "NONE",
    show_labels: false,
    ...overrides,
  };
}

describe("titleFormattingValidator", () => {
  it("accepts objects with a non-empty title", () => {
    expect(titleFormattingValidator({ title: "My Layer" })).toBe(true);
  });

  it("rejects empty, missing, or invalid title", () => {
    expect(titleFormattingValidator({ title: "" })).toBe(false);
    expect(titleFormattingValidator({})).toBe(false);
    expect(titleFormattingValidator({ title: "x", extra: 1 })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(titleFormattingValidator("My Layer")).toBe(false);
    expect(titleFormattingValidator(123)).toBe(false);
    expect(titleFormattingValidator(null)).toBe(false);
  });
});

describe("titleFormattingSchema", () => {
  it("uses an object root with a title field", () => {
    expect(titleFormattingSchema.type).toBe("object");
    expect(titleFormattingSchema.required).toContain("title");
  });
});

describe("attributionFormattingValidator", () => {
  it("accepts null attribution", () => {
    expect(attributionFormattingValidator({ attribution: null })).toBe(true);
  });

  it("accepts a non-empty string up to 48 characters", () => {
    expect(attributionFormattingValidator({ attribution: "IUCN Oceania" })).toBe(
      true,
    );
    expect(
      attributionFormattingValidator({ attribution: "x".repeat(48) }),
    ).toBe(true);
  });

  it("rejects strings over 48 characters", () => {
    expect(
      attributionFormattingValidator({ attribution: "x".repeat(49) }),
    ).toBe(false);
  });

  it("rejects missing attribution or extra properties", () => {
    expect(attributionFormattingValidator({})).toBe(false);
    expect(
      attributionFormattingValidator({
        attribution: "ok",
        extra: 1,
      }),
    ).toBe(false);
  });
});

describe("attributionFormattingSchema", () => {
  it("requires attribution key", () => {
    expect(attributionFormattingSchema.required).toContain("attribution");
  });
});

describe("columnIntelligenceValidator", () => {
  it("accepts a minimal valid payload", () => {
    const data = minimalColumnIntelligence();
    expect(columnIntelligenceValidator(data)).toBe(true);
  });

  it("rejects when required fields are missing", () => {
    const { notes: _n, ...rest } = minimalColumnIntelligence();
    expect(columnIntelligenceValidator(rest)).toBe(false);
  });

  it("rejects unknown properties (additionalProperties: false)", () => {
    const data = minimalColumnIntelligence({ extra_field: "nope" });
    expect(columnIntelligenceValidator(data)).toBe(false);
  });

  it("rejects invalid enum for chosen_presentation_type", () => {
    const data = minimalColumnIntelligence({
      chosen_presentation_type: "NOT_A_REAL_TYPE",
    });
    expect(columnIntelligenceValidator(data)).toBe(false);
  });

  it("rejects invalid enum for interactivity_type", () => {
    const data = minimalColumnIntelligence({
      interactivity_type: "INVALID",
    });
    expect(columnIntelligenceValidator(data)).toBe(false);
  });
});
