"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTitle = generateTitle;
exports.generateAttribution = generateAttribution;
exports.generateColumnIntelligence = generateColumnIntelligence;
const openai_1 = __importDefault(require("openai"));
const attribution_1 = require("./prompts/layers/attribution");
const columnIntelligence_1 = require("./prompts/layers/columnIntelligence");
const title_1 = require("./prompts/layers/title");
const shrinkGeostats_1 = require("./geostats/shrinkGeostats");
const valueSteps_1 = require("./geostats/valueSteps");
let client = null;
const TITLE_TIMEOUT_MS = 10000;
const ATTRIBUTION_TIMEOUT_MS = 10000;
const COLUMN_INTELLIGENCE_TIMEOUT_MS = 30000;
function getClient() {
    if (!client) {
        if (!process.env.CF_AIG_TOKEN || !process.env.CF_AIG_URL) {
            throw new Error("CF_AIG_TOKEN and CF_AIG_URL must be set");
        }
        client = new openai_1.default({
            apiKey: process.env.CF_AIG_TOKEN,
            baseURL: process.env.CF_AIG_URL,
            maxRetries: 0,
        });
    }
    return client;
}
function formatAjvErrors(errors, fallback) {
    if (!(errors === null || errors === void 0 ? void 0 : errors.length)) {
        return fallback;
    }
    return errors
        .map((e) => {
        var _a, _b;
        const path = ((_a = e.instancePath) === null || _a === void 0 ? void 0 : _a.length) ? e.instancePath : "(root)";
        return `${path} ${(_b = e.message) !== null && _b !== void 0 ? _b : ""}`.trim();
    })
        .join("; ");
}
function parseAssistantJson(message, validator, responseLabel) {
    const raw = message === null || message === void 0 ? void 0 : message.content;
    if (message === null || message === void 0 ? void 0 : message.refusal) {
        return {
            ok: false,
            error: `Model refused to generate ${responseLabel}`,
        };
    }
    if (typeof raw !== "string" || !raw.trim()) {
        return { ok: false, error: "Empty or missing assistant message content" };
    }
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch (_a) {
        return { ok: false, error: "Assistant response was not valid JSON" };
    }
    if (!validator(data)) {
        const errors = typeof validator === "function" &&
            "errors" in validator &&
            Array.isArray(validator.errors)
            ? validator.errors
            : undefined;
        return {
            ok: false,
            error: `Invalid ${responseLabel} response: ${formatAjvErrors(errors, "does not match schema")}`,
        };
    }
    return { ok: true, data };
}
function chatCompletionWithJsonSchema(systemPrompt, userContent, params, responseName, schema, timeoutMs) {
    return __awaiter(this, void 0, void 0, function* () {
        const openai = getClient();
        return openai.chat.completions.create({
            model: params.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent },
            ],
            reasoning_effort: params.effort,
            verbosity: params.verbosity,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: responseName,
                    strict: true,
                    schema,
                },
            },
        }, { timeout: timeoutMs });
    });
}
function parsedTitleFromAssistantMessage(message) {
    const parsed = parseAssistantJson(message, title_1.titleFormattingValidator, "title");
    if (parsed.ok === false) {
        return parsed;
    }
    const title = parsed.data.title.trim();
    if (title.length === 0) {
        return { ok: false, error: "Title was empty after trimming whitespace" };
    }
    return { ok: true, title };
}
function parsedAttributionFromAssistantMessage(message) {
    const parsed = parseAssistantJson(message, attribution_1.attributionFormattingValidator, "attribution");
    if (parsed.ok === false) {
        return parsed;
    }
    const raw = parsed.data.attribution;
    if (raw === null) {
        return { ok: true, attribution: null };
    }
    const s = raw.trim();
    return { ok: true, attribution: s.length === 0 ? null : s };
}
function parsedColumnIntelligenceFromAssistantMessage(message) {
    const parsed = parseAssistantJson(message, columnIntelligence_1.columnIntelligenceValidator, "column intelligence");
    if (parsed.ok === false) {
        return parsed;
    }
    return { ok: true, result: parsed.data };
}
function generateTitle(filename) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const response = yield chatCompletionWithJsonSchema(title_1.titlePrompt, filename, title_1.titleParameters, "title", title_1.titleFormattingSchema, TITLE_TIMEOUT_MS);
        const usage = response.usage;
        const parsed = parsedTitleFromAssistantMessage((_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message);
        if (parsed.ok === false) {
            const errMsg = parsed.error;
            return usage === undefined ? { error: errMsg } : { error: errMsg, usage };
        }
        if (usage === undefined) {
            return { error: "No usage in response" };
        }
        return { title: parsed.title, usage };
    });
}
function generateAttribution(metadata) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const response = yield chatCompletionWithJsonSchema(attribution_1.attributionPrompt, metadata.join("\n"), attribution_1.attributionParameters, "attribution", attribution_1.attributionFormattingSchema, ATTRIBUTION_TIMEOUT_MS);
        const usage = response.usage;
        const parsed = parsedAttributionFromAssistantMessage((_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message);
        if (parsed.ok === false) {
            const errMsg = parsed.error;
            return usage === undefined ? { error: errMsg } : { error: errMsg, usage };
        }
        if (usage === undefined) {
            return { error: "No usage in response" };
        }
        return { attribution: parsed.attribution, usage };
    });
}
function generateColumnIntelligence(filename, geostats) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const layerForLlm = (0, shrinkGeostats_1.pruneGeostats)(geostats);
        const response = yield chatCompletionWithJsonSchema(columnIntelligence_1.columnIntelligencePrompt, JSON.stringify({ filename, geostats: layerForLlm }), columnIntelligence_1.columnIntelligenceParameters, "column_intelligence", columnIntelligence_1.columnIntelligenceSchema, COLUMN_INTELLIGENCE_TIMEOUT_MS);
        const usage = response.usage;
        const parsed = parsedColumnIntelligenceFromAssistantMessage((_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message);
        if (parsed.ok === false) {
            const errMsg = parsed.error;
            return usage === undefined ? { error: errMsg } : { error: errMsg, usage };
        }
        if (usage === undefined) {
            return { error: "No usage in response" };
        }
        const continuousTypes = new Set([
            "CONTINUOUS_RASTER",
            "CONTINUOUS_POINT",
            "CONTINUOUS_POLYGON",
        ]);
        const valueSteps = continuousTypes.has(parsed.result.chosen_presentation_type)
            ? (0, valueSteps_1.deriveValueSteps)(geostats, (_b = parsed.result.chosen_presentation_column) !== null && _b !== void 0 ? _b : undefined)
            : undefined;
        return {
            result: Object.assign(Object.assign(Object.assign({}, parsed.result), { pii_redacted_columns: (0, shrinkGeostats_1.getPiiRedactedColumnNames)(geostats) }), (valueSteps
                ? {
                    value_steps: valueSteps.value_steps,
                    value_steps_n: valueSteps.value_steps_n,
                }
                : {})),
            usage,
        };
    });
}
//# sourceMappingURL=client.js.map