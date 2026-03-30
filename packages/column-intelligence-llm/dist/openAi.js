"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOpenAiJson = runOpenAiJson;
const openai_1 = __importDefault(require("openai"));
/** Dashboard “geostats analyzer” stored prompt (default version). */
const COLUMN_INTELLIGENCE_OPENAI_STORED_PROMPT_ID = "pmpt_69580f3787408194b62cc9a882890b600f72cf9bb906b8cf";
function parseJsonLoose(text) {
    let t = text.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(t);
    if (fence) {
        t = fence[1].trim();
    }
    return JSON.parse(t);
}
function normalizeResponsesUsage(usage) {
    if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
        return undefined;
    }
    const u = usage;
    const input = u.input_tokens;
    const output = u.output_tokens;
    const total = u.total_tokens;
    const out = {};
    if (typeof input === "number") {
        out.prompt_tokens = input;
    }
    if (typeof output === "number") {
        out.completion_tokens = output;
    }
    if (typeof total === "number") {
        out.total_tokens = total;
    }
    else if (typeof input === "number" && typeof output === "number") {
        out.total_tokens = input + output;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
function responseOutputText(response) {
    if (response.output_text.trim().length > 0) {
        return response.output_text;
    }
    const parts = [];
    for (const item of response.output) {
        if (item.type !== "message") {
            continue;
        }
        for (const c of item.content) {
            if (c.type === "output_text" &&
                "text" in c &&
                typeof c.text === "string") {
                parts.push(c.text);
            }
        }
    }
    return parts.join("");
}
/**
 * Runs the configured stored prompt (Responses API). The template variable
 * `geostats` should receive the same JSON string as {@link buildUserPrompt}.
 */
async function runOpenAiJson(options) {
    var _a;
    const client = new openai_1.default({ apiKey: options.apiKey });
    console.log("running openai json", options.geostats);
    console.time("openai json");
    const response = (await client.responses.create({
        stream: false,
        prompt: {
            id: COLUMN_INTELLIGENCE_OPENAI_STORED_PROMPT_ID,
            // version: COLUMN_INTELLIGENCE_OPENAI_STORED_PROMPT_VERSION,
            variables: {
                geostats: options.geostats,
            },
        },
    }));
    console.timeEnd("openai json");
    if (response.error) {
        throw new Error((_a = response.error.message) !== null && _a !== void 0 ? _a : "OpenAI response error");
    }
    const rawText = responseOutputText(response);
    if (!rawText) {
        throw new Error("OpenAI returned no text content");
    }
    return {
        parsed: parseJsonLoose(rawText),
        rawText,
        usage: normalizeResponsesUsage(response.usage),
    };
}
//# sourceMappingURL=openAi.js.map