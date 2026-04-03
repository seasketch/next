/**
 * Tests for PII-aware geostats pruning and related types/type-guards.
 *
 * Covers:
 *  - isPIIRedactedAttribute type-guard
 *  - pruneGeostats PII-aware redaction (piiRisk >= PII_REDACTION_THRESHOLD)
 *  - generateColumnIntelligence sends a PII-redacted payload to the LLM
 *
 * The OpenAI client is mocked so these tests run without network access.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type {
  PIIRedactedGeostatsLayer,
  PIIRedactedGeostatsAttribute,
  PrunedGeostatsAttribute,
} from "../lib/geostats/piiTypes";
import { isPIIRedactedAttribute } from "../lib/geostats/piiTypes";
import { pruneGeostats, PII_REDACTION_THRESHOLD } from "../lib/geostats/shrinkGeostats";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const normalAttr: PrunedGeostatsAttribute = {
  attribute: "habitat_class",
  type: "string",
  count: 100,
  countDistinct: 5,
  values: { Forest: 40, Grassland: 30, Wetland: 20, Urban: 8, Unknown: 2 },
};

const redactedAttr: PIIRedactedGeostatsAttribute = {
  attribute: "respondent_email",
  type: "string",
  count: 100,
  countDistinct: 95,
  piiRedacted: true,
  redactionReason: "email",
};

const redactedNameAttr: PIIRedactedGeostatsAttribute = {
  attribute: "full_name",
  type: "string",
  count: 100,
  countDistinct: 98,
  piiRedacted: true,
  redactionReason: "name",
};

const mixedLayer: PIIRedactedGeostatsLayer = {
  layer: "survey_responses",
  count: 100,
  geometry: "Point",
  attributeCount: 3,
  attributes: [normalAttr, redactedAttr, redactedNameAttr],
};

// ---------------------------------------------------------------------------
// Type-guard tests
// ---------------------------------------------------------------------------

describe("isPIIRedactedAttribute", () => {
  it("returns true for redacted attributes", () => {
    expect(isPIIRedactedAttribute(redactedAttr)).toBe(true);
    expect(isPIIRedactedAttribute(redactedNameAttr)).toBe(true);
  });

  it("returns false for normal attributes", () => {
    expect(isPIIRedactedAttribute(normalAttr)).toBe(false);
  });

  it("normal attributes have a values map, redacted ones do not", () => {
    const attrs = mixedLayer.attributes;
    const normal = attrs.filter((a) => !isPIIRedactedAttribute(a));
    const redacted = attrs.filter((a) => isPIIRedactedAttribute(a));
    expect(normal).toHaveLength(1);
    expect(redacted).toHaveLength(2);
    expect((normal[0] as PrunedGeostatsAttribute).values).toBeDefined();
    expect((redacted[0] as PIIRedactedGeostatsAttribute).redactionReason).toBe(
      "email",
    );
    expect((redacted[1] as PIIRedactedGeostatsAttribute).redactionReason).toBe(
      "name",
    );
  });
});

// ---------------------------------------------------------------------------
// pruneGeostats PII-aware redaction tests
// ---------------------------------------------------------------------------

describe("pruneGeostats — PII-aware redaction", () => {
  const emailValues = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`u${i}@example.com`, 1]),
  );

  it("strips values and adds piiRedacted marker when piiRisk >= PII_REDACTION_THRESHOLD", () => {
    const layer = {
      layer: "survey",
      count: 100,
      geometry: "Point",
      attributeCount: 1,
      attributes: [
        {
          attribute: "respondent_email",
          type: "string",
          count: 100,
          countDistinct: 20,
          values: emailValues,
          piiRisk: PII_REDACTION_THRESHOLD, // exactly at threshold
          piiRiskCategories: ["email"],
        },
      ],
    };

    const pruned = pruneGeostats(layer) as { attributes: unknown[] };
    const attr = pruned.attributes[0] as Record<string, unknown>;

    expect(attr.piiRedacted).toBe(true);
    expect(attr.redactionReason).toBe("email");
    expect(attr.values).toBeUndefined();
    // Count metadata preserved for LLM context
    expect(attr.attribute).toBe("respondent_email");
    expect(attr.type).toBe("string");
    expect(attr.count).toBe(100);
    expect(attr.countDistinct).toBe(20);
  });

  it("preserves values when piiRisk is below PII_REDACTION_THRESHOLD", () => {
    const layer = {
      layer: "survey",
      count: 50,
      geometry: "Point",
      attributeCount: 1,
      attributes: [
        {
          attribute: "notes",
          type: "string",
          count: 50,
          countDistinct: 3,
          values: { "Coral reef": 20, "Seagrass bed": 20, "Sandy bottom": 10 },
          piiRisk: PII_REDACTION_THRESHOLD - 0.01, // just below threshold
          piiRiskCategories: ["other"],
        },
      ],
    };

    const pruned = pruneGeostats(layer) as { attributes: unknown[] };
    const attr = pruned.attributes[0] as Record<string, unknown>;

    expect(attr.piiRedacted).toBeUndefined();
    expect(attr.values).toBeDefined();
  });

  it("preserves values when piiRisk is absent (Lambda not invoked)", () => {
    const layer = {
      layer: "habitat",
      count: 50,
      geometry: "Polygon",
      attributeCount: 1,
      attributes: [
        {
          attribute: "type",
          type: "string",
          count: 50,
          countDistinct: 4,
          values: { Forest: 20, Grassland: 15, Wetland: 10, Urban: 5 },
        },
      ],
    };

    const pruned = pruneGeostats(layer) as { attributes: unknown[] };
    const attr = pruned.attributes[0] as Record<string, unknown>;

    expect(attr.piiRedacted).toBeUndefined();
    expect(attr.values).toBeDefined();
  });

  it("uses 'other' as redactionReason when piiRiskCategories is empty", () => {
    const layer = {
      layer: "survey",
      count: 10,
      geometry: "Point",
      attributeCount: 1,
      attributes: [
        {
          attribute: "sensitive",
          type: "string",
          count: 10,
          countDistinct: 10,
          values: { a: 1, b: 1, c: 1 },
          piiRisk: 0.9,
          piiRiskCategories: [],
        },
      ],
    };

    const pruned = pruneGeostats(layer) as { attributes: unknown[] };
    const attr = pruned.attributes[0] as Record<string, unknown>;
    expect(attr.piiRedacted).toBe(true);
    expect(attr.redactionReason).toBe("other");
  });
});

// ---------------------------------------------------------------------------
// generateColumnIntelligence — PII-aware LLM payload
// ---------------------------------------------------------------------------

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

describe("generateColumnIntelligence — PII-redacted LLM payload", () => {
  let capturedUserContent: string | null = null;

  beforeEach(async () => {
    capturedUserContent = null;
    const openaiMod = await import("openai");
    const MockOpenAI = openaiMod.default as unknown as ReturnType<typeof vi.fn>;
    MockOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockImplementation(
            async (params: { messages: { role: string; content: string }[] }) => {
              const userMsg = params.messages.find(
                (m: { role: string; content: string }) => m.role === "user",
              );
              capturedUserContent = userMsg?.content ?? null;
              return {
                usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
                choices: [
                  {
                    message: {
                      refusal: null,
                      content: JSON.stringify({
                        best_label_column: null,
                        best_category_column: "habitat_class",
                        best_numeric_column: null,
                        best_date_column: null,
                        best_popup_description_column: null,
                        best_id_column: null,
                        junk_columns: ["respondent_email"],
                        chosen_presentation_type: "CATEGORICAL_POINT",
                        chosen_presentation_column: "habitat_class",
                        best_group_by_column: null,
                        palette: null,
                        custom_palette: null,
                        reverse_palette: false,
                        show_labels: false,
                        interactivity_type: "TOOLTIP",
                        notes: "Email column is PII-redacted.",
                      }),
                    },
                  },
                ],
              };
            },
          ),
        },
      },
    }));
  });

  it("sends piiRedacted marker to the model for high-piiRisk attributes", async () => {
    process.env.CF_AIG_TOKEN = "test-token";
    process.env.CF_AIG_URL = "https://mock.gateway/";

    const { generateColumnIntelligence } = await import("../lib/client");

    const rawGeostats = {
      layer: "survey_responses",
      count: 100,
      geometry: "Point",
      attributeCount: 2,
      attributes: [
        {
          attribute: "habitat_class",
          type: "string",
          count: 100,
          countDistinct: 5,
          values: { Forest: 40, Grassland: 30, Wetland: 20, Urban: 8, Unknown: 2 },
          // No piiRisk — should pass through with values
        },
        {
          attribute: "respondent_email",
          type: "string",
          count: 100,
          countDistinct: 95,
          values: Object.fromEntries(
            Array.from({ length: 30 }, (_, i) => [`u${i}@example.com`, 1]),
          ),
          piiRisk: 1.0,
          piiRiskCategories: ["email"],
        },
      ],
    };

    await generateColumnIntelligence("survey.fgb", rawGeostats);

    expect(capturedUserContent).not.toBeNull();
    const payload = JSON.parse(capturedUserContent!);

    const emailAttr = payload.geostats.attributes.find(
      (a: { attribute: string }) => a.attribute === "respondent_email",
    );
    expect(emailAttr.piiRedacted).toBe(true);
    expect(emailAttr.redactionReason).toBe("email");
    expect(emailAttr.values).toBeUndefined();

    const habitatAttr = payload.geostats.attributes.find(
      (a: { attribute: string }) => a.attribute === "habitat_class",
    );
    expect(habitatAttr.piiRedacted).toBeUndefined();
    expect(habitatAttr.values).toBeDefined();
  });

  it("sends unredacted payload when no piiRisk scores are present", async () => {
    process.env.CF_AIG_TOKEN = "test-token";
    process.env.CF_AIG_URL = "https://mock.gateway/";

    const { generateColumnIntelligence } = await import("../lib/client");

    const rawGeostats = {
      layer: "habitat",
      count: 50,
      geometry: "Polygon",
      attributeCount: 1,
      attributes: [
        {
          attribute: "type",
          type: "string",
          count: 50,
          countDistinct: 4,
          values: { Forest: 20, Grassland: 15, Wetland: 10, Urban: 5 },
        },
      ],
    };

    await generateColumnIntelligence("habitat.fgb", rawGeostats);

    expect(capturedUserContent).not.toBeNull();
    const payload = JSON.parse(capturedUserContent!);
    expect(payload.geostats.attributes[0].values).toBeDefined();
    expect(payload.geostats.attributes[0].piiRedacted).toBeUndefined();
  });
});
