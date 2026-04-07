"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attributionFormattingValidator = exports.attributionFormattingSchema = exports.attributionParameters = exports.attributionPrompt = void 0;
const ajv_1 = __importDefault(require("ajv"));
const ajv = new ajv_1.default();
exports.attributionPrompt = `
Given the following metadata document, return an attribution string suitable for public consumption.

Requirements:
  - It should be short enough to fit in a mapbox-gl attribution control. < 48 characters.
  - If you are at all unsure about the attribution, return nothing.
  - It should usually be an organization name, less preferably an individual.
`;
exports.attributionParameters = {
    // Cloudflare AI Gateway compat expects `{provider}/{model}` (e.g. openai/gpt-5-mini).
    model: "openai/gpt-5.4-nano",
    effort: "low",
    verbosity: "low",
};
exports.attributionFormattingSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        attribution: {
            type: ["string", "null"],
            maxLength: 48,
            description: "Public-facing attribution string (< 48 chars for mapbox-gl). If unsure, return null.",
        },
    },
    required: ["attribution"],
};
exports.attributionFormattingValidator = ajv.compile(exports.attributionFormattingSchema);
//# sourceMappingURL=attribution.js.map