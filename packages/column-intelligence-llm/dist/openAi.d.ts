import { WorkersAiUsage } from "./cloudflareAi";
export interface RunOpenAiJsonResult {
    parsed: unknown;
    rawText: string;
    usage?: WorkersAiUsage;
}
/**
 * Runs the configured stored prompt (Responses API). The template variable
 * `geostats` should receive the same JSON string as {@link buildUserPrompt}.
 */
export declare function runOpenAiJson(options: {
    apiKey: string;
    geostats: string;
}): Promise<RunOpenAiJsonResult>;
//# sourceMappingURL=openAi.d.ts.map