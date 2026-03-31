"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.titleParameters = exports.titlePrompt = void 0;
exports.titlePrompt = `
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
exports.titleParameters = {
    // Cloudflare AI Gateway compat expects `{provider}/{model}` (e.g. openai/gpt-5-mini).
    model: "openai/gpt-5.4-nano",
    effort: "low",
    verbosity: "low",
};
//# sourceMappingURL=title.js.map