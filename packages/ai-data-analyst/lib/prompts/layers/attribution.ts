import { OpenAIParameters } from "..";
import { JSONSchema4 } from "json-schema";
import AJV from "ajv";

const ajv = new AJV();

export const attributionPrompt = `
Given the following metadata document, return an attribution string suitable for public consumption.

Requirements:
  - It should be short enough to fit in a mapbox-gl attribution control. < 48 characters.
  - If you are at all unsure about the attribution, return nothing.
  - It should usually be an organization name, less preferably an individual.
`;

export const attributionParameters: OpenAIParameters = {
  // Cloudflare AI Gateway compat expects `{provider}/{model}` (e.g. openai/gpt-5-mini).
  // Match columnIntelligence model so gateway provider auth applies consistently.
  model: "openai/gpt-5.4-mini",
  effort: "low",
  verbosity: "low",
};

export const attributionFormattingSchema: JSONSchema4 = {
  type: "object",
  additionalProperties: false,
  properties: {
    attribution: {
      type: ["string", "null"],
      maxLength: 48,
      description:
        "Public-facing attribution string (< 48 chars for mapbox-gl). If unsure, return null.",
    },
  },
  required: ["attribution"],
};

export const attributionFormattingValidator = ajv.compile(
  attributionFormattingSchema,
);
