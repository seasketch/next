import { Client, PoolClient } from "pg";
import {
  COLUMN_INTELLIGENCE_RESPONSE_JSON_SCHEMA,
  validateColumnIntelligenceResponseAgainstJsonSchema,
} from "./columnIntelligenceJsonSchema";
import {
  extractPromptCacheSignalsFromUsage,
  getWorkersAiPromptCacheRequestLogFields,
  runWorkersAiJson,
  WorkersAiUsage,
} from "./cloudflareAi";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { trimGeostatsForLlm } from "./trimGeostats";
import {
  COLUMN_INTELLIGENCE_MODEL_PRESETS,
  isWorkersAiJsonModeModel,
} from "./modelPresets";
import {
  derivePresentationColumnForStorage,
  filterPresentationType,
  parseColumnIntelligenceResponse,
  sanitizeColumnFields,
  VisualizationTypeId,
} from "./validation";

export interface ColumnIntelligenceLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

const defaultLogger: ColumnIntelligenceLogger = {
  info: (msg, meta) => {
    if (meta) {
      console.log(msg, meta);
    } else {
      console.log(msg);
    }
  },
  warn: (msg, meta) => console.warn(msg, meta ?? ""),
  error: (msg, meta) => console.error(msg, meta ?? ""),
};

export interface CollectColumnIntelligenceOptions {
  modelOverride?: string;
  logger?: Partial<ColumnIntelligenceLogger>;
  /**
   * Original upload filename (e.g. shapefile or GeoTIFF name). When set, used
   * for the LLM prompt; otherwise `data_sources.uploaded_source_filename` is used.
   */
  uploadedSourceFilename?: string | null;
}

export type CollectColumnIntelligenceResult =
  | {
      status: "applied";
      dataSourceId: number;
      model: string;
      usage?: WorkersAiUsage;
    }
  | { status: "skipped"; dataSourceId: number; reason: string }
  | { status: "failed"; dataSourceId: number; error: string };

/**
 * Account ID for `.../client/v4/accounts/{id}/ai/run/...`.
 * Same 32-char id as the dashboard “Account ID” (also used as GraphQL `accountTag`
 * and as CLOUDFLARE_IMAGES_ACCOUNT for Images API URLs).
 */
function resolveCloudflareAccountId(): string | undefined {
  return (
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
    process.env.CLOUDFLARE_IMAGES_ACCOUNT?.trim() ||
    process.env.CLOUDFLARE_ACCOUNT_TAG?.trim() ||
    undefined
  );
}

function getConfig(): {
  accountId: string;
  apiToken: string;
  model: string;
} | null {
  const accountId = resolveCloudflareAccountId();
  const apiToken = process.env.CLOUDFLARE_WORKERS_AI_TOKEN?.trim();
  const model =
    process.env.COLUMN_INTELLIGENCE_MODEL?.trim() ||
    COLUMN_INTELLIGENCE_MODEL_PRESETS.LLAMA_3_1_8B;
  if (!accountId || !apiToken) {
    return null;
  }
  return { accountId, apiToken, model };
}

function resolveUploadedSourceFilename(
  options: CollectColumnIntelligenceOptions,
  fromDb: string | null | undefined,
): string | null {
  if (options.uploadedSourceFilename !== undefined) {
    const t = options.uploadedSourceFilename?.trim();
    return t && t.length > 0 ? t : null;
  }
  const t = fromDb?.trim();
  return t && t.length > 0 ? t : null;
}

function mergeLogger(
  partial?: Partial<ColumnIntelligenceLogger>,
): ColumnIntelligenceLogger {
  return {
    info: partial?.info ?? defaultLogger.info,
    warn: partial?.warn ?? defaultLogger.warn,
    error: partial?.error ?? defaultLogger.error,
  };
}

async function applyIntelligenceRow(
  client: PoolClient | Client,
  dataSourceId: number,
  row: {
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
  },
): Promise<void> {
  await client.query(
    `
    update data_sources set
      best_label_column = $2,
      best_category_column = $3,
      best_numeric_column = $4,
      best_date_column = $5,
      best_popup_description_column = $6,
      best_id_column = $7,
      junk_columns = $8,
      chosen_presentation_type = $9::visualization_type,
      chosen_presentation_column = $10,
      ai_cartographer_rationale = $11,
      best_layer_title = $12,
      column_intelligence_collected = true
    where id = $1
    `,
    [
      dataSourceId,
      row.best_label_column,
      row.best_category_column,
      row.best_numeric_column,
      row.best_date_column,
      row.best_popup_description_column,
      row.best_id_column,
      row.junk_columns,
      row.chosen_presentation_type,
      row.chosen_presentation_column,
      row.ai_cartographer_rationale,
      row.best_layer_title,
    ],
  );
}

/**
 * Loads geostats from DB, calls Workers AI, and updates intelligence columns.
 */
export async function collectColumnIntelligenceForDataSource(
  client: PoolClient | Client,
  dataSourceId: number,
  options: CollectColumnIntelligenceOptions = {},
): Promise<CollectColumnIntelligenceResult> {
  const log = mergeLogger(options.logger);
  const cfg = getConfig();
  const model = options.modelOverride?.trim() || cfg?.model;
  if (!cfg || !model) {
    log.info(
      "columnIntelligence skipped: set CLOUDFLARE_WORKERS_AI_TOKEN and an account id (CLOUDFLARE_ACCOUNT_ID, or reuse CLOUDFLARE_IMAGES_ACCOUNT / CLOUDFLARE_ACCOUNT_TAG)",
      { dataSourceId },
    );
    return {
      status: "skipped",
      dataSourceId,
      reason: "cloudflare_env_missing",
    };
  }

  const accountId = cfg.accountId;
  const apiToken = cfg.apiToken;

  if (!isWorkersAiJsonModeModel(model)) {
    log.error(
      "columnIntelligence: model does not support Workers AI JSON mode",
      {
        dataSourceId,
        model,
      },
    );
    return {
      status: "failed",
      dataSourceId,
      error: `model_not_json_mode_supported:${model}`,
    };
  }

  const q = await client.query<{
    geostats: unknown;
    columns: string[] | null;
    type: string;
    uploaded_source_filename: string | null;
  }>(
    `
    select geostats, "columns" as columns, type, uploaded_source_filename
    from data_sources
    where id = $1
    `,
    [dataSourceId],
  );

  if (q.rows.length === 0) {
    return {
      status: "failed",
      dataSourceId,
      error: "data_source_not_found",
    };
  }

  const {
    geostats,
    columns: attrColumns,
    type: sourceType,
    uploaded_source_filename: uploadedSourceFilenameFromDb,
  } = q.rows[0]!;
  const uploadedSourceFilename = resolveUploadedSourceFilename(
    options,
    uploadedSourceFilenameFromDb,
  );
  if (geostats == null) {
    log.info("columnIntelligence skipped: null geostats", { dataSourceId });
    return {
      status: "skipped",
      dataSourceId,
      reason: "null_geostats",
    };
  }

  const { kind, primaryGeometry, trimmed } = trimGeostatsForLlm(geostats);
  if (!trimmed || kind === "unknown") {
    log.warn("columnIntelligence skipped: unknown geostats shape", {
      dataSourceId,
      kind,
    });
    return {
      status: "skipped",
      dataSourceId,
      reason: "unknown_geostats_shape",
    };
  }

  const isRaster = kind === "raster";
  const allowedAttributes = (attrColumns || []).filter(Boolean);

  try {
    console.log("columnIntelligence running", {
      dataSourceId,
      model,
      sourceType,
      uploadedSourceFilename,
    });
    const { parsed, usage } = await runWorkersAiJson({
      accountId,
      apiToken,
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: buildUserPrompt({
            allowedAttributes,
            trimmedGeostats: trimmed,
            isRaster,
            uploadedSourceFilename,
          }),
        },
      ],
      // maxTokens: 896,
      // temperature: 0.15,
      responseJsonSchema: COLUMN_INTELLIGENCE_RESPONSE_JSON_SCHEMA as Record<
        string,
        unknown
      >,
    });

    const schemaCheck =
      validateColumnIntelligenceResponseAgainstJsonSchema(parsed);
    if (!schemaCheck.ok) {
      log.warn("columnIntelligence: JSON Schema validation failed", {
        dataSourceId,
        message: schemaCheck.message,
      });
      return {
        status: "failed",
        dataSourceId,
        error: `json_schema_validation:${schemaCheck.message}`,
      };
    }

    const raw = parseColumnIntelligenceResponse(parsed);
    if (!raw) {
      log.warn("columnIntelligence: invalid LLM JSON shape after schema pass", {
        dataSourceId,
      });
      return {
        status: "failed",
        dataSourceId,
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

    await applyIntelligenceRow(client, dataSourceId, {
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
    });

    const cacheSignals = extractPromptCacheSignalsFromUsage(usage);
    log.info("columnIntelligence applied", {
      dataSourceId,
      model,
      sourceType,
      usage,
      workersAiPromptCache: {
        ...getWorkersAiPromptCacheRequestLogFields(),
        usageCacheSignals: cacheSignals,
        usageCacheSignalsPositive: Object.values(cacheSignals).some(
          (n) => n > 0,
        ),
      },
    });

    return {
      status: "applied",
      dataSourceId,
      model,
      usage,
    };
  } catch (e) {
    const err = e as Error;
    log.error("columnIntelligence failed", {
      dataSourceId,
      message: err.message,
    });
    return {
      status: "failed",
      dataSourceId,
      error: err.message,
    };
  }
}
