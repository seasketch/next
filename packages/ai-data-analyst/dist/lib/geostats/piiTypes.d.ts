/**
 * Types describing a pruned GeostatsLayer whose high-risk string columns have
 * been redacted by pruneGeostats before being sent to OpenAI.
 *
 * Redaction is triggered when an attribute's `piiRisk` (assigned by the
 * geostats-pii-risk-classifier Lambda) meets or exceeds PII_REDACTION_THRESHOLD
 * in shrinkGeostats.ts.
 */
/**
 * Reason why an attribute's values were redacted before being sent to the LLM.
 *
 * Must stay in sync with PiiRiskCategory in @seasketch/geostats-types and with
 * ENTITY_TO_REASON in packages/geostats-pii-risk-classifier/handler.py.
 */
export type GeostatsRedactionReason = "email" | "phone" | "government_id" | "financial" | "name" | "other";
/** A pruned attribute whose values have NOT been redacted. */
export interface PrunedGeostatsAttribute {
    attribute: string;
    type: string;
    count?: number;
    countDistinct?: number;
    min?: number;
    max?: number;
    typeArrayOf?: string;
    valuesTruncated?: boolean;
    stats?: unknown;
    values: Record<string, number>;
    piiRedacted?: false;
}
/**
 * A pruned attribute where the `values` map has been removed by pruneGeostats
 * because the column's piiRisk exceeded PII_REDACTION_THRESHOLD.  The LLM
 * should use the column name, type, and count metadata for its recommendations
 * but will not see sample data values.
 */
export interface PIIRedactedGeostatsAttribute {
    attribute: string;
    type: string;
    count?: number;
    countDistinct?: number;
    min?: number;
    max?: number;
    typeArrayOf?: string;
    valuesTruncated?: boolean;
    stats?: unknown;
    /** `values` is intentionally absent — it has been redacted. */
    piiRedacted: true;
    redactionReason: GeostatsRedactionReason;
}
/**
 * A pruned GeostatsLayer whose attributes may be a mix of normal
 * (PrunedGeostatsAttribute) and redacted (PIIRedactedGeostatsAttribute)
 * entries.  This is the payload shape sent to the LLM by generateColumnIntelligence.
 */
export interface PIIRedactedGeostatsLayer {
    layer?: string;
    count?: number;
    geometry?: string;
    hasZ?: boolean;
    attributeCount?: number;
    bounds?: number[];
    metadata?: unknown;
    valuesTruncated?: boolean;
    attributes: (PrunedGeostatsAttribute | PIIRedactedGeostatsAttribute)[];
}
/** Type-guard: returns true when the attribute has been PII-redacted. */
export declare function isPIIRedactedAttribute(attr: PrunedGeostatsAttribute | PIIRedactedGeostatsAttribute): attr is PIIRedactedGeostatsAttribute;
//# sourceMappingURL=piiTypes.d.ts.map