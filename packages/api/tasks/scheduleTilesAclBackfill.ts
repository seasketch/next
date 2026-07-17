import { Helpers } from "graphile-worker";
import { listProjectIdsWithPublishedToc } from "../src/tilesAcl/backfillProjectAclDocs";

const QUEUE = "tiles_acl_backfill";
const PER_PROJECT_TASK = "backfillTilesAclDocs";

/**
 * Fan-out orchestrator: enqueue one `backfillTilesAclDocs` job per project that
 * has a published TOC. Does not write ACL docs itself.
 *
 * Bastion / local:
 *   npm run tiles-acl:backfill
 *
 * Or directly:
 *
 * ```sql
 * SELECT graphile_worker.add_job(
 *   'scheduleTilesAclBackfill',
 *   '{}'::json,
 *   job_key := 'scheduleTilesAclBackfill:manual',
 *   max_attempts := 1
 * );
 * ```
 *
 * Per-project jobs use queue `tiles_acl_backfill` (serial) and job keys
 * `backfillTilesAclDocs:<id>` so re-runs replace pending work.
 */
export default async function scheduleTilesAclBackfill(
  _payload: unknown,
  helpers: Helpers,
) {
  await helpers.withPgClient(async (client) => {
    const ids = await listProjectIdsWithPublishedToc(client);
    helpers.logger.info(
      `scheduleTilesAclBackfill: enqueueing ${ids.length} project job(s)`,
    );

    for (const projectId of ids) {
      await client.query(
        `select graphile_worker.add_job(
           $1::text,
           json_build_object('projectId', $2::int),
           queue_name := $3::text,
           max_attempts := 2,
           job_key := $4::text
         )`,
        [
          PER_PROJECT_TASK,
          projectId,
          QUEUE,
          `${PER_PROJECT_TASK}:${projectId}`,
        ],
      );
    }

    helpers.logger.info(
      `scheduleTilesAclBackfill: enqueued ${ids.length} ${PER_PROJECT_TASK} job(s) on queue ${QUEUE}`,
    );
  });
}
