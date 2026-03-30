"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runColumnIntelligenceLlm = runColumnIntelligenceLlm;
const geostatsColumnNames_1 = require("./geostatsColumnNames");
const config_1 = require("./config");
const columnIntelligenceJsonSchema_1 = require("./columnIntelligenceJsonSchema");
const cloudflareAi_1 = require("./cloudflareAi");
const openAi_1 = require("./openAi");
const prompts_1 = require("./prompts");
const trimGeostats_1 = require("./trimGeostats");
const validation_1 = require("./validation");
function resolveCloudflareAccountId() {
    var _a, _b, _c;
    return (((_a = process.env.CLOUDFLARE_ACCOUNT_ID) === null || _a === void 0 ? void 0 : _a.trim()) ||
        ((_b = process.env.CLOUDFLARE_IMAGES_ACCOUNT) === null || _b === void 0 ? void 0 : _b.trim()) ||
        ((_c = process.env.CLOUDFLARE_ACCOUNT_TAG) === null || _c === void 0 ? void 0 : _c.trim()) ||
        undefined);
}
function getCloudflareConfig() {
    var _a;
    const accountId = resolveCloudflareAccountId();
    const apiToken = (_a = process.env.CLOUDFLARE_WORKERS_AI_TOKEN) === null || _a === void 0 ? void 0 : _a.trim();
    if (!accountId || !apiToken) {
        return null;
    }
    return { accountId, apiToken };
}
function getOpenAiConfig() {
    var _a;
    const apiKey = (_a = process.env.OPENAI_API_KEY) === null || _a === void 0 ? void 0 : _a.trim();
    if (!apiKey) {
        return null;
    }
    return { apiKey };
}
/**
 * Run column intelligence LLM from geostats (no database). Used from the upload
 * Lambda to overlap network time with tiling, and from the API worker when loading from DB.
 */
async function runColumnIntelligenceLlm(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const provider = config_1.COLUMN_INTELLIGENCE_PROVIDER;
    const workersAiModelId = config_1.COLUMN_INTELLIGENCE_CLOUDFLARE_MODEL;
    const cloudflareCfg = config_1.COLUMN_INTELLIGENCE_PROVIDER === "cloudflare"
        ? getCloudflareConfig()
        : null;
    const openAiCfg = config_1.COLUMN_INTELLIGENCE_PROVIDER === "openai" ? getOpenAiConfig() : null;
    if (config_1.COLUMN_INTELLIGENCE_PROVIDER === "cloudflare" && !cloudflareCfg) {
        return {
            status: "skipped",
            reason: "cloudflare_env_missing",
            provider,
            workersAiModel: workersAiModelId,
        };
    }
    if (config_1.COLUMN_INTELLIGENCE_PROVIDER === "openai" && !openAiCfg) {
        return {
            status: "skipped",
            reason: "openai_env_missing",
            provider,
        };
    }
    const { geostats, uploadedSourceFilename } = options;
    if (geostats == null) {
        return {
            status: "skipped",
            reason: "null_geostats",
            provider,
            ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
        };
    }
    const { kind, primaryGeometry, trimmed } = (0, trimGeostats_1.trimGeostatsForLlm)(geostats);
    if (!trimmed || kind === "unknown") {
        return {
            status: "skipped",
            reason: "unknown_geostats_shape",
            provider,
            ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
        };
    }
    const isRaster = kind === "raster";
    const allowedAttributes = (0, geostatsColumnNames_1.geostatsAttributeColumnNames)(geostats);
    const userPromptJson = (0, prompts_1.buildUserPrompt)({
        allowedAttributes,
        trimmedGeostats: trimmed,
        isRaster,
        uploadedSourceFilename,
    });
    try {
        const { parsed, usage } = config_1.COLUMN_INTELLIGENCE_PROVIDER === "openai"
            ? await (0, openAi_1.runOpenAiJson)({
                apiKey: openAiCfg.apiKey,
                geostats: userPromptJson,
            })
            : await (0, cloudflareAi_1.runWorkersAiJson)({
                accountId: cloudflareCfg.accountId,
                apiToken: cloudflareCfg.apiToken,
                model: workersAiModelId,
                messages: [
                    { role: "system", content: (0, prompts_1.buildSystemPrompt)() },
                    { role: "user", content: userPromptJson },
                ],
                maxTokens: 896,
                temperature: 0.15,
                responseJsonSchema: columnIntelligenceJsonSchema_1.COLUMN_INTELLIGENCE_RESPONSE_JSON_SCHEMA,
            });
        const schemaCheck = (0, columnIntelligenceJsonSchema_1.validateColumnIntelligenceResponseAgainstJsonSchema)(parsed);
        if (!schemaCheck.ok) {
            return {
                status: "failed",
                provider,
                ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
                error: `json_schema_validation:${schemaCheck.message}`,
            };
        }
        const raw = (0, validation_1.parseColumnIntelligenceResponse)(parsed);
        if (!raw) {
            return {
                status: "failed",
                provider,
                ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
                error: "invalid_llm_response_schema",
            };
        }
        let data = raw;
        if (isRaster) {
            data = {
                ...data,
                best_label_column: null,
                best_category_column: null,
                best_numeric_column: null,
                best_date_column: null,
                best_popup_description_column: null,
                best_id_column: null,
                junk_columns: [],
                chosen_presentation_column: null,
                ai_cartographer_rationale: (_a = data.ai_cartographer_rationale) !== null && _a !== void 0 ? _a : null,
            };
        }
        else {
            data = (0, validation_1.sanitizeColumnFields)(data, allowedAttributes);
        }
        const presentation = (0, validation_1.filterPresentationType)(data.chosen_presentation_type, { isRaster, primaryGeometry });
        const presentationColumn = (0, validation_1.derivePresentationColumnForStorage)(presentation, data, isRaster);
        const rationale = presentation == null ? null : ((_b = data.ai_cartographer_rationale) !== null && _b !== void 0 ? _b : null);
        const row = {
            best_label_column: isRaster ? null : ((_c = data.best_label_column) !== null && _c !== void 0 ? _c : null),
            best_category_column: isRaster
                ? null
                : ((_d = data.best_category_column) !== null && _d !== void 0 ? _d : null),
            best_numeric_column: isRaster ? null : ((_e = data.best_numeric_column) !== null && _e !== void 0 ? _e : null),
            best_date_column: isRaster ? null : ((_f = data.best_date_column) !== null && _f !== void 0 ? _f : null),
            best_popup_description_column: isRaster
                ? null
                : ((_g = data.best_popup_description_column) !== null && _g !== void 0 ? _g : null),
            best_id_column: isRaster ? null : ((_h = data.best_id_column) !== null && _h !== void 0 ? _h : null),
            junk_columns: isRaster ? null : ((_j = data.junk_columns) !== null && _j !== void 0 ? _j : null),
            chosen_presentation_type: presentation,
            chosen_presentation_column: presentationColumn,
            ai_cartographer_rationale: rationale,
            best_layer_title: (_k = data.best_layer_title) !== null && _k !== void 0 ? _k : null,
        };
        return {
            status: "applied",
            provider,
            ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
            usage,
            row,
            bestLayerTitle: row.best_layer_title,
        };
    }
    catch (e) {
        const err = e;
        return {
            status: "failed",
            provider,
            ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
            error: err.message,
        };
    }
}
//# sourceMappingURL=runColumnIntelligenceLlm.js.map