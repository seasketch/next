"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAiDataAnalystEnabled = isAiDataAnalystEnabled;
exports.asNeverReject = asNeverReject;
exports.composeAiDataAnalystNotesFromPromises = composeAiDataAnalystNotesFromPromises;
function isAiDataAnalystEnabled() {
    return Boolean(process.env.CF_AIG_TOKEN && process.env.CF_AIG_URL);
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