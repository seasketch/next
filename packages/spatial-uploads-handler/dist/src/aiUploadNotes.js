"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAiDataAnalystEnabled = isAiDataAnalystEnabled;
exports.classifyGeostatsPii = classifyGeostatsPii;
exports.asNeverReject = asNeverReject;
exports.composeAiDataAnalystNotesFromPromises = composeAiDataAnalystNotesFromPromises;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AWS = require("aws-sdk");
function isAiDataAnalystEnabled() {
    return Boolean(process.env.CF_AIG_TOKEN && process.env.CF_AIG_URL);
}
let _lambdaClient = null;
function getLambdaClient() {
    if (!_lambdaClient) {
        _lambdaClient = new AWS.Lambda({
            region: process.env.AWS_REGION || "us-west-2",
            httpOptions: { timeout: 30000 },
        });
    }
    return _lambdaClient;
}
/**
 * Invoke the geostats-pii-risk-classifier Lambda synchronously.
 *
 * On success, returns the full annotated {@link GeostatsLayer} from the
 * Lambda payload (`{ geostats: ... }`). That object is the input layer spread
 * with updated `attributes` (each analysed string column has `piiRisk` and
 * optionally `piiRiskCategories`; high-cardinality columns may have shuffled
 * `values` key order) and `piiRiskWasAssessed: true`.
 *
 * Returns `null` on any failure (fail-open: caller proceeds without changes).
 *
 * GEOSTATS_PII_CLASSIFIER_ARN must be set before calling this function.
 */
async function classifyGeostatsPii(geostats) {
    const arn = process.env.GEOSTATS_PII_CLASSIFIER_ARN;
    let rawData;
    try {
        rawData = await getLambdaClient()
            .invoke({
            FunctionName: arn,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify({ geostats }),
        })
            .promise();
    }
    catch (e) {
        console.warn("[pii-classifier] Lambda invocation error — proceeding without annotation:", e);
        return null;
    }
    if (rawData.FunctionError) {
        const errBody = rawData.Payload
            ? JSON.parse(rawData.Payload.toString())
            : null;
        console.warn("[pii-classifier] Lambda function error — proceeding without annotation:", errBody);
        return null;
    }
    if (!rawData.Payload) {
        console.warn("[pii-classifier] Empty payload — proceeding without annotation");
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(rawData.Payload.toString());
    }
    catch (e) {
        console.warn("[pii-classifier] Failed to parse response — proceeding without annotation:", e);
        return null;
    }
    if (parsed.error || !parsed.geostats) {
        console.warn("[pii-classifier] Response error or missing geostats:", parsed.error);
        return null;
    }
    return parsed.geostats;
}
function asNeverReject(p, label) {
    return p.catch((e) => ({
        error: `${label}: ${e instanceof Error ? e.message : String(e)}`,
    }));
}
/**
 * Await in-flight AI tasks and merge into {@link AiDataAnalystNotes} when column
 * intelligence succeeds. Title and attribution are best-effort overlays.
 */
async function composeAiDataAnalystNotesFromPromises(options) {
    const { uploadFilename, titleP, attributionP, columnP } = options;
    const errors = [];
    const [titleRaw, attributionRaw, columnRaw] = await Promise.all([
        titleP !== null && titleP !== void 0 ? titleP : Promise.resolve(null),
        attributionP !== null && attributionP !== void 0 ? attributionP : Promise.resolve(null),
        columnP !== null && columnP !== void 0 ? columnP : Promise.resolve(null),
    ]);
    let best_layer_title;
    if (titleRaw && "title" in titleRaw && titleRaw.title) {
        best_layer_title = titleRaw.title;
    }
    else if (titleRaw && "error" in titleRaw && titleRaw.error) {
        errors.push(`title: ${titleRaw.error}`);
    }
    let attribution;
    if (attributionRaw &&
        "attribution" in attributionRaw &&
        !("error" in attributionRaw)) {
        attribution = attributionRaw.attribution;
    }
    else if (attributionRaw &&
        "error" in attributionRaw &&
        attributionRaw.error) {
        errors.push(`attribution: ${attributionRaw.error}`);
    }
    if (!columnRaw || !("result" in columnRaw)) {
        if (columnRaw && "error" in columnRaw) {
            errors.push(`columnIntelligence: ${columnRaw.error}`);
        }
        if (errors.length) {
            console.warn(`[ai data analyst] Notes skipped for ${uploadFilename}: column intelligence did not succeed. ${errors.join("; ")}`);
        }
        return undefined;
    }
    const merged = {
        ...columnRaw.result,
        ...(best_layer_title !== undefined ? { best_layer_title } : {}),
        ...(attribution !== undefined ? { attribution } : {}),
        ...(errors.length ? { errors: errors.join("; ") } : {}),
    };
    return merged;
}
//# sourceMappingURL=aiUploadNotes.js.map