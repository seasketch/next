"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkersAiPromptCacheRequestLogFields = getWorkersAiPromptCacheRequestLogFields;
exports.extractPromptCacheSignalsFromUsage = extractPromptCacheSignalsFromUsage;
exports.workersAiRunModelUrl = workersAiRunModelUrl;
exports.runWorkersAiJson = runWorkersAiJson;
/**
 * Whether `COLUMN_INTELLIGENCE_SESSION_AFFINITY` is set (we send `x-session-affinity`).
 * Does not prove Cloudflare cached anything — see {@link extractPromptCacheSignalsFromUsage}.
 */
function getWorkersAiPromptCacheRequestLogFields() {
    var _a;
    const v = (_a = process.env.COLUMN_INTELLIGENCE_SESSION_AFFINITY) === null || _a === void 0 ? void 0 : _a.trim();
    if (!v) {
        return { workersAiPromptCacheAffinity: "off" };
    }
    const preview = v.length > 20 ? `${v.slice(0, 20)}…` : v;
    return {
        workersAiPromptCacheAffinity: "on",
        workersAiPromptCacheAffinityKeyPreview: preview,
    };
}
/**
 * Collect numeric fields under `usage` whose names suggest prefix-cache reporting.
 * Cloudflare documents cache stats on `usage` but does not publish a stable schema here;
 * this is best-effort for logging. Non-empty with a positive value ⇒ likely a cache hit/report.
 */
function extractPromptCacheSignalsFromUsage(usage) {
    const out = {};
    if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
        return out;
    }
    const walk = (obj, prefix, depth) => {
        if (depth > 5) {
            return;
        }
        for (const [k, v] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${k}` : k;
            if (typeof v === "number" && Number.isFinite(v) && /cache/i.test(k)) {
                out[path] = v;
            }
            else if (v && typeof v === "object" && !Array.isArray(v)) {
                walk(v, path, depth + 1);
            }
        }
    };
    walk(usage, "", 0);
    return out;
}
/** Strip optional ```json fences and trim before JSON.parse */
function parseJsonLoose(text) {
    let t = text.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(t);
    if (fence) {
        t = fence[1].trim();
    }
    return JSON.parse(t);
}
function workersAiRunModelUrl(accountId, model) {
    const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId.trim())}/ai/run`;
    const m = model.trim();
    const tail = m
        .split("/")
        .filter((s) => s.length > 0)
        .map((s) => encodeURIComponent(s))
        .join("/");
    return `${base}/${tail}`;
}
function workersAiResultToParsed(result) {
    if (result == null || typeof result !== "object") {
        throw new Error("Workers AI returned empty result");
    }
    const r = result;
    const resp = r.response;
    if (resp === undefined || resp === null) {
        throw new Error("Workers AI returned no response");
    }
    if (typeof resp === "string") {
        return parseJsonLoose(resp);
    }
    if (typeof resp === "object") {
        return resp;
    }
    throw new Error("Workers AI response has unexpected shape");
}
/**
 * Call Cloudflare Workers AI REST API with chat messages.
 * Use `responseJsonSchema` for JSON mode (`type: "json_schema"`); unsupported
 * models return API errors — use models from the JSON mode list only.
 */
async function runWorkersAiJson(options) {
    var _a, _b, _c, _d, _e, _f;
    const url = workersAiRunModelUrl(options.accountId, options.model);
    const maxTok = Math.max(1, Math.floor((_a = options.maxTokens) !== null && _a !== void 0 ? _a : 512));
    const requestBody = {
        messages: options.messages,
        max_tokens: maxTok,
        max_new_tokens: maxTok,
        temperature: (_b = options.temperature) !== null && _b !== void 0 ? _b : 0.2,
    };
    if (options.responseJsonSchema) {
        requestBody.response_format = {
            type: "json_schema",
            json_schema: options.responseJsonSchema,
        };
    }
    const headers = {
        Authorization: `Bearer ${options.apiToken}`,
        "Content-Type": "application/json",
    };
    const affinity = (_c = process.env.COLUMN_INTELLIGENCE_SESSION_AFFINITY) === null || _c === void 0 ? void 0 : _c.trim();
    if (affinity) {
        headers["x-session-affinity"] = affinity;
    }
    const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
    });
    const responseJson = (await res.json());
    if (!res.ok || responseJson.success === false) {
        throw new Error(`Workers AI HTTP ${res.status}: ${JSON.stringify((_d = responseJson.errors) !== null && _d !== void 0 ? _d : responseJson)}`);
    }
    const result = responseJson.result;
    let parsed;
    try {
        parsed = workersAiResultToParsed(result);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(msg);
    }
    const rawText = typeof (result === null || result === void 0 ? void 0 : result.response) === "string"
        ? result.response
        : JSON.stringify((_f = (_e = result === null || result === void 0 ? void 0 : result.response) !== null && _e !== void 0 ? _e : result) !== null && _f !== void 0 ? _f : {});
    return {
        parsed,
        rawText,
        usage: result === null || result === void 0 ? void 0 : result.usage,
    };
}
//# sourceMappingURL=cloudflareAi.js.map