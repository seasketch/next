import { OpenAIParameters } from "..";
import { JSONSchema4 } from "json-schema";
export declare const attributionPrompt = "\nGiven the following metadata document, return an attribution string suitable for public consumption.\n\nRequirements:\n  - It should be short enough to fit in a mapbox-gl attribution control. < 48 characters.\n  - If you are at all unsure about the attribution, return nothing.\n  - It should usually be an organization name, less preferably an individual.\n";
export declare const attributionParameters: OpenAIParameters;
export declare const attributionFormattingSchema: JSONSchema4;
export declare const attributionFormattingValidator: import("ajv").ValidateFunction<unknown>;
//# sourceMappingURL=attribution.d.ts.map