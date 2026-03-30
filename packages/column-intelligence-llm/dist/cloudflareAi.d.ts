export interface WorkersAiUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}
/**
 * Whether `COLUMN_INTELLIGENCE_SESSION_AFFINITY` is set (we send `x-session-affinity`).
 * Does not prove Cloudflare cached anything — see {@link extractPromptCacheSignalsFromUsage}.
 */
export declare function getWorkersAiPromptCacheRequestLogFields(): {
    workersAiPromptCacheAffinity: "off" | "on";
    /** Truncated preview when affinity is on */
    workersAiPromptCacheAffinityKeyPreview?: string;
};
/**
 * Collect numeric fields under `usage` whose names suggest prefix-cache reporting.
 * Cloudflare documents cache stats on `usage` but does not publish a stable schema here;
 * this is best-effort for logging. Non-empty with a positive value ⇒ likely a cache hit/report.
 */
export declare function extractPromptCacheSignalsFromUsage(usage: unknown): Record<string, number>;
export interface RunWorkersAiJsonResult {
    /** Parsed JSON from the model response */
    parsed: unknown;
    rawText: string;
    usage?: WorkersAiUsage;
}
export declare function workersAiRunModelUrl(accountId: string, model: string): string;
/**
 * Call Cloudflare Workers AI REST API with chat messages.
 * Use `responseJsonSchema` for JSON mode (`type: "json_schema"`); unsupported
 * models return API errors — use models from the JSON mode list only.
 */
export declare function runWorkersAiJson(options: {
    accountId: string;
    apiToken: string;
    model: string;
    messages: {
        role: "system" | "user" | "assistant";
        content: string;
    }[];
    maxTokens?: number;
    temperature?: number;
    /** Draft-07–style object passed as `response_format.json_schema`. */
    responseJsonSchema?: Record<string, unknown>;
}): Promise<RunWorkersAiJsonResult>;
//# sourceMappingURL=cloudflareAi.d.ts.map