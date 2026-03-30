import { Client, PoolClient } from "pg";
import {
  COLUMN_INTELLIGENCE_PROVIDER,
  runColumnIntelligenceLlm,
  type ColumnIntelligenceAppliedRow,
  type ColumnIntelligenceProvider,
  type PrefetchedColumnIntelligence,
  type WorkersAiUsage,
} from "@seasketch/column-intelligence-llm";

export interface CollectColumnIntelligenceOptions {
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
      provider: ColumnIntelligenceProvider;
      /** Present when inference used Workers AI (known model id). */
      workersAiModel?: string;
      usage?: WorkersAiUsage;
    }
  | {
      status: "skipped";
      dataSourceId: number;
      provider: ColumnIntelligenceProvider;
      workersAiModel?: string;
      reason: string;
    }
  | {
      status: "failed";
      dataSourceId: number;
      provider: ColumnIntelligenceProvider;
      workersAiModel?: string;
      error: string;
    };

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

async function applyIntelligenceRow(
  client: PoolClient | Client,
  dataSourceId: number,
  row: ColumnIntelligenceAppliedRow,
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

function prefetchToCollectResult(
  dataSourceId: number,
  p: PrefetchedColumnIntelligence,
): CollectColumnIntelligenceResult {
  if (p.status === "applied") {
    return {
      status: "applied",
      dataSourceId,
      provider: p.provider,
      ...(p.workersAiModel != null ? { workersAiModel: p.workersAiModel } : {}),
      usage: p.usage,
    };
  }
  if (p.status === "skipped") {
    return {
      status: "skipped",
      dataSourceId,
      provider: p.provider,
      ...(p.workersAiModel != null ? { workersAiModel: p.workersAiModel } : {}),
      reason: p.reason,
    };
  }
  return {
    status: "failed",
    dataSourceId,
    provider: p.provider,
    ...(p.workersAiModel != null ? { workersAiModel: p.workersAiModel } : {}),
    error: p.error,
  };
}

/**
 * Writes column intelligence produced during spatial upload (Lambda) onto `data_sources`
 * when the worker returned `status === "applied"`. Does not call the LLM.
 */
export async function persistUploadColumnIntelligence(
  client: PoolClient | Client,
  dataSourceId: number,
  uploadResult: PrefetchedColumnIntelligence | null | undefined,
): Promise<CollectColumnIntelligenceResult> {
  const provider = COLUMN_INTELLIGENCE_PROVIDER;

  if (uploadResult == null) {
    return {
      status: "skipped",
      dataSourceId,
      provider,
      reason: "no_column_intelligence_from_upload",
    };
  }

  if (uploadResult.status === "applied") {
    await applyIntelligenceRow(client, dataSourceId, uploadResult.row);
    return prefetchToCollectResult(dataSourceId, uploadResult);
  }

  return prefetchToCollectResult(dataSourceId, uploadResult);
}

/**
 * Runs column intelligence (LLM) from geostats and updates `data_sources`.
 */
export async function collectColumnIntelligenceForDataSource(
  client: PoolClient | Client,
  dataSourceId: number,
  options: CollectColumnIntelligenceOptions = {},
): Promise<CollectColumnIntelligenceResult> {
  const q = await client.query<{
    geostats: unknown;
    type: string;
    uploaded_source_filename: string | null;
  }>(
    `
    select geostats, type, uploaded_source_filename
    from data_sources
    where id = $1
    `,
    [dataSourceId],
  );

  if (q.rows.length === 0) {
    const provider = COLUMN_INTELLIGENCE_PROVIDER;
    return {
      status: "failed",
      dataSourceId,
      provider,
      error: "data_source_not_found",
    };
  }

  const {
    geostats,
    uploaded_source_filename: uploadedSourceFilenameFromDb,
  } = q.rows[0]!;
  const uploadedSourceFilename = resolveUploadedSourceFilename(
    options,
    uploadedSourceFilenameFromDb,
  );

  const llmResult = await runColumnIntelligenceLlm({
    geostats,
    uploadedSourceFilename,
  });

  if (llmResult.status !== "applied") {
    return prefetchToCollectResult(dataSourceId, llmResult);
  }

  await applyIntelligenceRow(client, dataSourceId, llmResult.row);
  return prefetchToCollectResult(dataSourceId, llmResult);
}
