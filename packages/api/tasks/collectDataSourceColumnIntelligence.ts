import { Helpers } from "graphile-worker";
import { collectColumnIntelligenceForDataSource } from "../src/columnIntelligence";

/**
 * Backfill or retry column intelligence (LLM) for a single data source.
 *
 * Enqueue examples:
 * ```sql
 * -- Parallel (default): omit queue_name or pass null
 * select graphile_worker.add_job(
 *   'collectDataSourceColumnIntelligence',
 *   json_build_object('dataSourceId', id, 'uploadedSourceFilename', uploaded_source_filename)
 * )
 * from data_sources
 * where column_intelligence_collected = false
 *   and geostats is not null
 * limit 100;
 *
 * -- Serial: same non-null queue_name => only one such job runs at a time (globally)
 * select graphile_worker.add_job(
 *   'collectDataSourceColumnIntelligence',
 *   json_build_object('dataSourceId', id),
 *   queue_name := 'column-intelligence',
 *   max_attempts := 1
 * )
 * from data_sources
 * where id = any(array[1, 2, 3]);
 * ```
 */
export default async function collectDataSourceColumnIntelligence(
  payload: {
    dataSourceId: number;
    uploadedSourceFilename?: string | null;
  },
  helpers: Helpers
) {
  const { dataSourceId, uploadedSourceFilename } = payload;
  if (dataSourceId == null || Number.isNaN(Number(dataSourceId))) {
    helpers.logger.error(
      "collectDataSourceColumnIntelligence: missing dataSourceId"
    );
    return;
  }

  await helpers.withPgClient(async (client) => {
    const result = await collectColumnIntelligenceForDataSource(
      client,
      dataSourceId,
      {
        uploadedSourceFilename,
      }
    );

    if (result.status === "applied") {
      const u = result.usage;
      helpers.logger.info(
        JSON.stringify({
          task: "collectDataSourceColumnIntelligence",
          dataSourceId: result.dataSourceId,
          provider: result.provider,
          workers_ai_model: result.workersAiModel ?? null,
          prompt_tokens: u?.prompt_tokens ?? null,
          completion_tokens: u?.completion_tokens ?? null,
          total_tokens: u?.total_tokens ?? null,
        })
      );
      if (!u) {
        helpers.logger.info(
          "collectDataSourceColumnIntelligence: Workers AI response had no usage block"
        );
      }
    } else if (result.status === "skipped") {
      helpers.logger.info(
        `collectDataSourceColumnIntelligence skipped ds=${result.dataSourceId} reason=${result.reason}`
      );
    } else {
      helpers.logger.error(
        `collectDataSourceColumnIntelligence failed ds=${result.dataSourceId} error=${result.error}`
      );
    }
  });
}
