import { Helpers } from "graphile-worker";
import { startMetricCalculationsForSketch } from "../src/plugins/reportsPlugin";

export default async function startMetricCalculationsForSketchTask(
  payload: { sketchId: number; draft?: boolean },
  helpers: Helpers
) {
  const { sketchId, draft } = payload;

  helpers.logger.info(`Starting metric calculations for sketch ${sketchId}`, {
    sketchId,
    draft,
  });

  try {
    await helpers.withPgClient(async (client) => {
      await startMetricCalculationsForSketch(client, sketchId, draft);
    });
    helpers.logger.info(`Completed metric calculations for sketch ${sketchId}`);
  } catch (e) {
    helpers.logger.error(
      `Error starting metric calculations for sketch ${sketchId}`,
      { error: e instanceof Error ? e.message : String(e) }
    );
    throw e;
  }
}
