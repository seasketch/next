/**
 * JSON Schema sent to Workers AI `response_format` (must stay aligned with
 * {@link parseColumnIntelligenceResponse} and DB columns).
 */
export declare function buildColumnIntelligenceResponseJsonSchema(): Record<string, unknown>;
/** Single schema instance shared with Workers AI `response_format` and Ajv. */
export declare const COLUMN_INTELLIGENCE_RESPONSE_JSON_SCHEMA: Record<string, unknown>;
export declare function validateColumnIntelligenceResponseAgainstJsonSchema(data: unknown): {
    ok: true;
} | {
    ok: false;
    message: string;
};
//# sourceMappingURL=columnIntelligenceJsonSchema.d.ts.map