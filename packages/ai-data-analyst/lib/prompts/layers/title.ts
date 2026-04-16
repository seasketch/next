import { OpenAIParameters } from "..";
import { JSONSchema4 } from "json-schema";
import AJV from "ajv";

const ajv = new AJV();

export const titlePrompt = `
You are a GIS Analyst prepping data for publishing in a map portal. Create a layer title from the provided filename suitable for public consumption.

Requirements:
- Don't stray far. Make the title easy to match to the source file when many files are uploaded at once.
- Remove file extensions.
- Remove unnecessary special characters.
- Normalize casing.
- Fix spelling mistakes, but only if the intent is obvious.
- Remove version numbers generated for duplicate filenames (e.g. "(1)", "(2)" etc on MacOS).
- Capitalize abbreviations and codes.
- Add spaces between words if appropriate.
`;

export const titleParameters: OpenAIParameters = {
  // Cloudflare AI Gateway compat expects `{provider}/{model}` (e.g. openai/gpt-5-mini).
  // Match columnIntelligence model so gateway provider auth applies consistently.
  model: "openai/gpt-5.4-mini",
  effort: "low",
  verbosity: "low",
};

/** Root type must be an object for OpenAI structured outputs / gateway validation. */
export const titleFormattingSchema: JSONSchema4 = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      minLength: 1,
      description:
        "Public-facing layer title derived from the source filename.",
    },
  },
  required: ["title"],
};

export const titleFormattingValidator = ajv.compile(titleFormattingSchema);
