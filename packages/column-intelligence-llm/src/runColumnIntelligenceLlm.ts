import { geostatsAttributeColumnNames } from "./geostatsColumnNames";
import {
  COLUMN_INTELLIGENCE_CLOUDFLARE_MODEL,
  COLUMN_INTELLIGENCE_PROVIDER,
  type ColumnIntelligenceProvider,
} from "./config";
import {
  COLUMN_INTELLIGENCE_RESPONSE_JSON_SCHEMA,
  validateColumnIntelligenceResponseAgainstJsonSchema,
} from "./columnIntelligenceJsonSchema";
import { runWorkersAiJson, type WorkersAiUsage } from "./cloudflareAi";
import { runOpenAiJson } from "./openAi";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { trimGeostatsForLlm } from "./trimGeostats";
import {
  derivePresentationColumnForStorage,
  filterPresentationType,
  parseColumnIntelligenceResponse,
  sanitizeColumnFields,
  type VisualizationTypeId,
} from "./validation";

export interface ColumnIntelligenceAppliedRow {
  best_label_column: string | null;
  best_category_column: string | null;
  best_numeric_column: string | null;
  best_date_column: string | null;
  best_popup_description_column: string | null;
  best_id_column: string | null;
  junk_columns: string[] | null;
  chosen_presentation_type: VisualizationTypeId | null;
  chosen_presentation_column: string | null;
  ai_cartographer_rationale: string | null;
  best_layer_title: string | null;
}

export type PrefetchedColumnIntelligence =
  | {
      status: "applied";
      row: ColumnIntelligenceAppliedRow;
      provider: ColumnIntelligenceProvider;
      /** Set when {@link provider} is `"cloudflare"` — Workers AI model id used for the call. */
      workersAiModel?: string;
      usage?: WorkersAiUsage;
      /** Convenience for TOC title (same as row.best_layer_title when applied). */
      bestLayerTitle: string | null;
    }
  | {
      status: "skipped";
      reason: string;
      provider: ColumnIntelligenceProvider;
      workersAiModel?: string;
    }
  | {
      status: "failed";
      error: string;
      provider: ColumnIntelligenceProvider;
      workersAiModel?: string;
    };

function resolveCloudflareAccountId(): string | undefined {
  return (
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
    process.env.CLOUDFLARE_IMAGES_ACCOUNT?.trim() ||
    process.env.CLOUDFLARE_ACCOUNT_TAG?.trim() ||
    undefined
  );
}

function getCloudflareConfig(): {
  accountId: string;
  apiToken: string;
} | null {
  const accountId = resolveCloudflareAccountId();
  const apiToken = process.env.CLOUDFLARE_WORKERS_AI_TOKEN?.trim();
  if (!accountId || !apiToken) {
    return null;
  }
  return { accountId, apiToken };
}

function getOpenAiConfig(): { apiKey: string } | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return { apiKey };
}

/**
 * Run column intelligence LLM from geostats (no database). Used from the upload
 * Lambda to overlap network time with tiling, and from the API worker when loading from DB.
 */
export async function runColumnIntelligenceLlm(options: {
  geostats: unknown;
  uploadedSourceFilename: string | null;
}): Promise<PrefetchedColumnIntelligence> {
  const provider = COLUMN_INTELLIGENCE_PROVIDER;
  const workersAiModelId = COLUMN_INTELLIGENCE_CLOUDFLARE_MODEL;
  const cloudflareCfg =
    COLUMN_INTELLIGENCE_PROVIDER === "cloudflare"
      ? getCloudflareConfig()
      : null;
  const openAiCfg =
    COLUMN_INTELLIGENCE_PROVIDER === "openai" ? getOpenAiConfig() : null;
  if (COLUMN_INTELLIGENCE_PROVIDER === "cloudflare" && !cloudflareCfg) {
    return {
      status: "skipped",
      reason: "cloudflare_env_missing",
      provider,
      workersAiModel: workersAiModelId,
    };
  }
  if (COLUMN_INTELLIGENCE_PROVIDER === "openai" && !openAiCfg) {
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

  const { kind, primaryGeometry, trimmed } = trimGeostatsForLlm(geostats);
  if (!trimmed || kind === "unknown") {
    return {
      status: "skipped",
      reason: "unknown_geostats_shape",
      provider,
      ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
    };
  }

  const isRaster = kind === "raster";
  const allowedAttributes = geostatsAttributeColumnNames(geostats);

  const userPromptJson = buildUserPrompt({
    allowedAttributes,
    trimmedGeostats: trimmed,
    isRaster,
    uploadedSourceFilename,
  });

  try {
    const { parsed, usage } =
      COLUMN_INTELLIGENCE_PROVIDER === "openai"
        ? await runOpenAiJson({
            apiKey: openAiCfg!.apiKey,
            geostats: userPromptJson,
          })
        : await runWorkersAiJson({
            accountId: cloudflareCfg!.accountId,
            apiToken: cloudflareCfg!.apiToken,
            model: workersAiModelId,
            messages: [
              { role: "system" as const, content: buildSystemPrompt() },
              { role: "user" as const, content: userPromptJson },
            ],
            maxTokens: 896,
            temperature: 0.15,
            responseJsonSchema:
              COLUMN_INTELLIGENCE_RESPONSE_JSON_SCHEMA as Record<
                string,
                unknown
              >,
          });

    const schemaCheck =
      validateColumnIntelligenceResponseAgainstJsonSchema(parsed);
    if (!schemaCheck.ok) {
      return {
        status: "failed",
        provider,
        ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
        error: `json_schema_validation:${schemaCheck.message}`,
      };
    }

    const raw = parseColumnIntelligenceResponse(parsed);
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
        ai_cartographer_rationale: data.ai_cartographer_rationale ?? null,
      };
    } else {
      data = sanitizeColumnFields(data, allowedAttributes);
    }

    const presentation = filterPresentationType(
      data.chosen_presentation_type as VisualizationTypeId | null,
      { isRaster, primaryGeometry },
    );

    const presentationColumn = derivePresentationColumnForStorage(
      presentation,
      data,
      isRaster,
    );

    const rationale =
      presentation == null ? null : (data.ai_cartographer_rationale ?? null);

    const row: ColumnIntelligenceAppliedRow = {
      best_label_column: isRaster ? null : (data.best_label_column ?? null),
      best_category_column: isRaster
        ? null
        : (data.best_category_column ?? null),
      best_numeric_column: isRaster ? null : (data.best_numeric_column ?? null),
      best_date_column: isRaster ? null : (data.best_date_column ?? null),
      best_popup_description_column: isRaster
        ? null
        : (data.best_popup_description_column ?? null),
      best_id_column: isRaster ? null : (data.best_id_column ?? null),
      junk_columns: isRaster ? null : (data.junk_columns ?? null),
      chosen_presentation_type: presentation,
      chosen_presentation_column: presentationColumn,
      ai_cartographer_rationale: rationale,
      best_layer_title: data.best_layer_title ?? null,
    };

    return {
      status: "applied",
      provider,
      ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
      usage,
      row,
      bestLayerTitle: row.best_layer_title,
    };
  } catch (e) {
    const err = e as Error;
    return {
      status: "failed",
      provider,
      ...(provider === "cloudflare" ? { workersAiModel: workersAiModelId } : {}),
      error: err.message,
    };
  }
}
