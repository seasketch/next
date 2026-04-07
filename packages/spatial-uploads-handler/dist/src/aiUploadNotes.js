"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAiDataAnalystEnabled = isAiDataAnalystEnabled;
exports.assertAiDataAnalystEnvVarsPresent = assertAiDataAnalystEnvVarsPresent;
exports.classifyGeostatsPii = classifyGeostatsPii;
exports.asNeverReject = asNeverReject;
exports.composeAiDataAnalystNotesFromPromises = composeAiDataAnalystNotesFromPromises;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AWS = require("aws-sdk");
/**
 * @deprecated Prefer gating on the upload request's `enableAiDataAnalyst` flag plus
 * {@link assertAiDataAnalystEnvVarsPresent}. Kept for callers that only need to know whether
 * Cloudflare AI Gateway env is present.
 */
function isAiDataAnalystEnabled() {
    return Boolean(process.env.CF_AIG_TOKEN && process.env.CF_AIG_URL);
}
/** Throws if AI Data Analyst LLM features were requested but Cloudflare AI Gateway env is incomplete. */
function assertAiDataAnalystEnvVarsPresent() {
    const missing = [];
    if (!process.env.CF_AIG_TOKEN) {
        missing.push("CF_AIG_TOKEN");
    }
    if (!process.env.CF_AIG_URL) {
        missing.push("CF_AIG_URL");
    }
    if (missing.length > 0) {
        throw new Error(`enableAiDataAnalyst is true but required environment variables are not set: ${missing.join(", ")}`);
    }
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
 * Throws on any failure (missing env, Lambda error, invalid payload).
 *
 * GEOSTATS_PII_CLASSIFIER_ARN must be set.
 */
async function classifyGeostatsPii(geostats) {
    const arn = process.env.GEOSTATS_PII_CLASSIFIER_ARN;
    if (!arn) {
        throw new Error("GEOSTATS_PII_CLASSIFIER_ARN is not set; it is required for vector PII classification.");
    }
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
        throw new Error(`PII classifier Lambda invocation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (rawData.FunctionError) {
        let errBody;
        if (rawData.Payload) {
            try {
                errBody = JSON.parse(rawData.Payload.toString());
            }
            catch {
                errBody = rawData.Payload.toString();
            }
        }
        else {
            errBody = null;
        }
        throw new Error(`PII classifier Lambda returned an error: ${JSON.stringify(errBody)}`);
    }
    if (!rawData.Payload) {
        throw new Error("PII classifier Lambda returned an empty payload.");
    }
    let parsed;
    try {
        parsed = JSON.parse(rawData.Payload.toString());
    }
    catch (e) {
        throw new Error(`PII classifier response was not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (parsed.error || !parsed.geostats) {
        throw new Error(parsed.error
            ? `PII classifier reported an error: ${parsed.error}`
            : "PII classifier response did not include geostats.");
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