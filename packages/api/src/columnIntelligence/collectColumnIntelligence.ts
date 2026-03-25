import { Client, PoolClient } from "pg";
import { runWorkersAiJson, WorkersAiUsage } from "./cloudflareAi";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { trimGeostatsForLlm } from "./trimGeostats";
import { COLUMN_INTELLIGENCE_MODEL_PRESETS } from "./modelPresets";
import {
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
    best_presentation_type: VisualizationTypeId | null;
    ai_cartographer_rationale: string | null;
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
      best_presentation_type = $9::visualization_type,
      ai_cartographer_rationale = $10,
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
      row.best_presentation_type,
      row.ai_cartographer_rationale,
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
      { dataSourceId }
    );
    return {
      status: "skipped",
      dataSourceId,
      reason: "cloudflare_env_missing",
    };
  }

  const accountId = cfg.accountId;
  const apiToken = cfg.apiToken;

  const q = await client.query<{
    geostats: unknown;
    columns: string[] | null;
    type: string;
  }>(
    `
    select geostats, "columns" as columns, type
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

  const { geostats, columns: attrColumns, type: sourceType } = q.rows[0]!;
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
          }),
        },
      ],
      maxTokens: 768,
      temperature: 0.15,
    });

    const raw = parseColumnIntelligenceResponse(parsed);
    if (!raw) {
      log.warn("columnIntelligence: invalid LLM JSON shape", {
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
        ai_cartographer_rationale: data.ai_cartographer_rationale ?? null,
      };
    } else {
      data = sanitizeColumnFields(data, allowedAttributes);
    }

    const presentation = filterPresentationType(
      data.best_presentation_type as VisualizationTypeId | null,
      { isRaster, primaryGeometry },
    );

    const rationale =
      presentation == null ? null : (data.ai_cartographer_rationale ?? null);

    await applyIntelligenceRow(client, dataSourceId, {
      best_label_column: isRaster ? null : data.best_label_column ?? null,
      best_category_column: isRaster ? null : data.best_category_column ?? null,
      best_numeric_column: isRaster ? null : data.best_numeric_column ?? null,
      best_date_column: isRaster ? null : data.best_date_column ?? null,
      best_popup_description_column: isRaster
        ? null
        : data.best_popup_description_column ?? null,
      best_id_column: isRaster ? null : data.best_id_column ?? null,
      junk_columns: isRaster ? null : data.junk_columns ?? null,
      best_presentation_type: presentation,
      ai_cartographer_rationale: rationale,
    });

    log.info("columnIntelligence applied", {
      dataSourceId,
      model,
      sourceType,
      usage,
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
