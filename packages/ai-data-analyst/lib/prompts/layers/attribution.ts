import { OpenAIParameters } from "..";

export const attributionPrompt = `
Given the following metadata document, return an attribution string suitable for public consumption.

Requirements:
  - It should be short enough to fit in a mapbox-gl attribution control. < 48 characters.
  - If you are at all unsure about the attribution, return nothing.
  - It should usually be an organization name, less preferably an individual.
`;

export const attributionParameters: OpenAIParameters = {
  // Cloudflare AI Gateway compat expects `{provider}/{model}` (e.g. openai/gpt-5-mini).
  model: "openai/gpt-5.4-nano",
  effort: "low",
  verbosity: "low",
};
