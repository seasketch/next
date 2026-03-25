import { Helpers } from "graphile-worker";
import { collectColumnIntelligenceForDataSource } from "../src/columnIntelligence";

/**
 * Backfill or retry column intelligence (LLM) for a single data source.
 *
 * Queue examples:
 * ```sql
 * select graphile_worker.add_job(
 *   'collectDataSourceColumnIntelligence',
 *   json_build_object('dataSourceId', id)
 * )
 * from data_sources
 * where column_intelligence_collected = false
 *   and geostats is not null
 * limit 100;
 * ```
 */
export default async function collectDataSourceColumnIntelligence(
  payload: { dataSourceId: number; modelOverride?: string },
  helpers: Helpers
) {
  const { dataSourceId, modelOverride } = payload;
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
        modelOverride,
        logger: {
          info: (msg, meta) => {
            helpers.logger.info(meta ? `${msg} ${JSON.stringify(meta)}` : msg);
          },
          warn: (msg, meta) => {
            helpers.logger.info(meta ? `${msg} ${JSON.stringify(meta)}` : msg);
          },
          error: (msg, meta) => {
            helpers.logger.error(
              meta ? `${msg} ${JSON.stringify(meta)}` : msg
            );
          },
        },
      }
    );

    if (result.status === "applied") {
      const u = result.usage;
      helpers.logger.info(
        JSON.stringify({
          task: "collectDataSourceColumnIntelligence",
          dataSourceId: result.dataSourceId,
          model: result.model,
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
