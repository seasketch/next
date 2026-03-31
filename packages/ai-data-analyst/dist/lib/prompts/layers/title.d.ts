import { OpenAIParameters } from "..";
import { JSONSchema4 } from "json-schema";
export declare const titlePrompt = "\nYou are a GIS Analyst prepping data for publishing in a map portal. Create a layer title from the provided filename suitable for public consumption.\n\nRequirements:\n- Don't stray far. Make the title easy to match to the source file when many files are uploaded at once.\n- Remove file extensions.\n- Remove unnecessary special characters.\n- Normalize casing.\n- Fix spelling mistakes, but only if the intent is obvious.\n- Remove version numbers generated for duplicate filenames (e.g. \"(1)\", \"(2)\" etc on MacOS).\n- Capitalize abbreviations and codes.\n- Add spaces between words if appropriate.\n";
export declare const titleParameters: OpenAIParameters;
/** Root type must be an object for OpenAI structured outputs / gateway validation. */
export declare const titleFormattingSchema: JSONSchema4;
export declare const titleFormattingValidator: import("ajv").ValidateFunction<unknown>;
//# sourceMappingURL=title.d.ts.map