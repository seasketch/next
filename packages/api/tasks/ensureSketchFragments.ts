import { Helpers } from "graphile-worker";
import { ensureSketchFragments } from "../src/sketches";

/**
 * Graphile-worker task that ensures a sketch (or collection) has fragment
 * records for reporting. No-op if the sketch already has fragments.
 *
 * @param payload.sketchId - Sketch or collection id to ensure fragments for.
 * @param payload.projectId - Project id (used to resolve geography settings).
 */
export default async function ensureSketchFragmentsTask(
  payload: { sketchId: number; projectId: number },
  helpers: Helpers,
) {
  await helpers.withPgClient(async (client) => {
    try {
      await ensureSketchFragments(payload.sketchId, payload.projectId, client);
    } catch (e) {
      // log out client role
      const { rows } = await client.query("select current_role as role");
      console.error(
        `Error ensuring sketch fragments for sketch ${payload.sketchId} in project ${payload.projectId} as role ${rows[0].role}`,
        {
          error: e instanceof Error ? e.message : String(e),
        },
      );
      console.error(e);
      throw e;
    }
  });
}
