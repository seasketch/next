import { Helpers } from "graphile-worker";
import {
  parseTilesAclBackfillPayload,
  runTilesAclBackfill,
} from "../src/tilesAcl/backfillProjectAclDocs";

/**
 * Write project tile ACL document(s) to R2. Not on cron — enqueue manually
 * (e.g. from the production bastion `psql` shell).
 *
 * Payload: `{ "projectId": <n> }` or `{ "all": true }`
 *
 * ## From `psql` on the bastion
 *
 * Workers already have R2 + `TILES_ACL_NAMESPACE` / production env. Prefer
 * one job per project so failures retry independently.
 *
 * **Task identifier:** `backfillTilesAclDocs`
 *
 * Use **`queue_name := 'tiles_acl_backfill'`** so jobs run serially.
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
 * All projects with a published TOC:
 *
 * ```sql
 * SELECT graphile_worker.add_job(
 *   'backfillTilesAclDocs',
 *   json_build_object('projectId', p.id),
 *   queue_name := 'tiles_acl_backfill',
 *   max_attempts := 2,
 *   job_key := 'backfillTilesAclDocs:' || p.id
 * )
 * FROM projects p
 * WHERE EXISTS (
 *   SELECT 1 FROM table_of_contents_items toc
 *   WHERE toc.project_id = p.id AND toc.is_draft = false
 * );
 * ```
 *
 * Or one long-running job for everything:
 *
 * ```sql
 * SELECT graphile_worker.add_job(
 *   'backfillTilesAclDocs',
 *   '{"all": true}'::json,
 *   queue_name := 'tiles_acl_backfill',
 *   max_attempts := 1,
 *   job_key := 'backfillTilesAclDocs:all'
 * );
 * ```
 *
 * ## Job status
 *
 * Graphile Worker **deletes jobs on success**, so `graphile_worker.jobs` only
 * shows pending / running / retrying / permanently-failed rows.
 *
 * Summary of what's still in the queue:
 *
 * ```sql
 * SELECT
 *   count(*) FILTER (
 *     WHERE locked_at IS NULL AND attempts < max_attempts
 *   ) AS queued,
 *   count(*) FILTER (
 *     WHERE locked_at IS NOT NULL
 *   ) AS running,
 *   count(*) FILTER (
 *     WHERE last_error IS NOT NULL AND attempts < max_attempts
 *   ) AS retrying,
 *   count(*) FILTER (
 *     WHERE attempts >= max_attempts
 *   ) AS permanently_failed
 * FROM graphile_worker.jobs
 * WHERE task_identifier = 'backfillTilesAclDocs'
 *   AND queue_name = 'tiles_acl_backfill';
 * ```
 *
 * Failures / in-flight detail (incl. project id from payload):
 *
 * ```sql
 * SELECT
 *   id,
 *   key,
 *   payload->>'projectId' AS project_id,
 *   attempts,
 *   max_attempts,
 *   locked_at,
 *   locked_by,
 *   last_error,
 *   run_at,
 *   updated_at
 * FROM graphile_worker.jobs
 * WHERE task_identifier = 'backfillTilesAclDocs'
 * ORDER BY updated_at DESC;
 * ```
 *
 * When that returns **0 rows**, every enqueued job has completed successfully
 * (or was removed). Cross-check against how many you enqueued if needed.
 *
 * Local CLI (same shared logic): `npm run tiles-acl:backfill -- --project-id=123`
 */
export default async function backfillTilesAclDocs(
  payload: unknown,
  helpers: Helpers
) {
  const options = parseTilesAclBackfillPayload(payload);

  await helpers.withPgClient(async (client) => {
    const result = await runTilesAclBackfill(client, options, (message) => {
      helpers.logger.info(message);
    });

    if (result.failed.length > 0) {
      throw new Error(
        `backfillTilesAclDocs: ${result.failed.length}/${result.attempted} failed` +
          (result.failed.length === 1
            ? ` (project ${result.failed[0].projectId}: ${result.failed[0].error})`
            : "")
      );
    }
  });
}
