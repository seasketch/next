"use strict";
/**
 * Types describing a pruned GeostatsLayer whose high-risk string columns have
 * been redacted by pruneGeostats before being sent to OpenAI.
 *
 * Redaction is triggered when an attribute's `piiRisk` (assigned by the
 * geostats-pii-risk-classifier Lambda) meets or exceeds PII_REDACTION_THRESHOLD
 * in shrinkGeostats.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPIIRedactedAttribute = isPIIRedactedAttribute;
/** Type-guard: returns true when the attribute has been PII-redacted. */
function isPIIRedactedAttribute(attr) {
    return attr.piiRedacted === true;
}
//# sourceMappingURL=piiTypes.js.map