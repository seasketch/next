import { Helpers } from "graphile-worker";
import {
  parseTilesAclBackfillPayload,
  runTilesAclBackfill,
} from "../src/tilesAcl/backfillProjectAclDocs";

/**
 * Write one project's tile ACL document to R2.
 *
 * Payload: `{ "projectId": <n> }`
 *
 * Prefer enqueueing many of these via `scheduleTilesAclBackfill` (bastion:
 * `npm run tiles-acl:backfill`) so each project retries independently on queue
 * `tiles_acl_backfill`.
 *
 * Single project:
 *
 * ```sql
 * SELECT graphile_worker.add_job(
 *   'backfillTilesAclDocs',
 *   json_build_object('projectId', 123),
 *   queue_name := 'tiles_acl_backfill',
 *   max_attempts := 2,
 *   job_key := 'backfillTilesAclDocs:123'
 * );
 * ```
 *
 * Job status (pending / running / failed only — successes are deleted):
 *
 * ```sql
 * SELECT
 *   count(*) FILTER (
 *     WHERE locked_at IS NULL AND attempts < max_attempts
 *   ) AS queued,
 *   count(*) FILTER (WHERE locked_at IS NOT NULL) AS running,
 *   count(*) FILTER (
 *     WHERE last_error IS NOT NULL AND attempts < max_attempts
 *   ) AS retrying,
 *   count(*) FILTER (WHERE attempts >= max_attempts) AS permanently_failed
 * FROM graphile_worker.jobs
 * WHERE task_identifier = 'backfillTilesAclDocs'
 *   AND queue_name = 'tiles_acl_backfill';
 * ```
 */
export default async function backfillTilesAclDocs(
  payload: unknown,
  helpers: Helpers,
) {
  const options = parseTilesAclBackfillPayload(payload);
  if (options.all) {
    throw new Error(
      'backfillTilesAclDocs no longer accepts { "all": true }. ' +
        "Enqueue scheduleTilesAclBackfill (npm run tiles-acl:backfill) to fan out per project.",
    );
  }

  await helpers.withPgClient(async (client) => {
    const result = await runTilesAclBackfill(client, options, (message) => {
      helpers.logger.info(message);
    });

    if (result.failed.length > 0) {
      throw new Error(
        `backfillTilesAclDocs: project ${result.failed[0].projectId}: ${result.failed[0].error}`,
      );
    }
  });
}
