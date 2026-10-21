import { Helpers } from "graphile-worker";

const QUEUE = "bookmark_screenshot_backfill";

/**
 * Enqueue a `createBookmarkScreenshot` job for every bookmark that has no
 * full-screen image (`image_id`). The client thumbnail does not count.
 *
 * Jobs share queue `bookmark_screenshot_backfill`, so Graphile runs one
 * capture at a time. Each bookmark is its own job because a single job
 * locked for the whole backfill would be treated as abandoned after four
 * hours. `run_at` is the bookmark's `created_at`, so older bookmarks go
 * first, and each capture gets two attempts. New bookmarks stay on the
 * default queue and can still run alongside this backfill.
 *
 * From the bastion:
 *
 * ```sql
 * SELECT graphile_worker.add_job(
 *   'backfillBookmarkScreenshots',
 *   '{}'::json,
 *   job_key := 'backfillBookmarkScreenshots',
 *   max_attempts := 1
 * );
 * ```
 *
 * Progress:
 *
 * ```sql
 * SELECT
 *   count(*) FILTER (WHERE locked_at IS NULL AND attempts < max_attempts) AS queued,
 *   count(*) FILTER (WHERE locked_at IS NOT NULL) AS running,
 *   count(*) FILTER (WHERE attempts >= max_attempts) AS failed
 * FROM graphile_worker.jobs
 * WHERE queue_name = 'bookmark_screenshot_backfill';
 * ```
 *
 * Stop work that has not started:
 *
 * ```sql
 * DELETE FROM graphile_worker.jobs
 * WHERE queue_name = 'bookmark_screenshot_backfill'
 *   AND locked_at IS NULL;
 * ```
 */
export default async function backfillBookmarkScreenshots(
  _payload: unknown,
  helpers: Helpers,
) {
  await helpers.withPgClient(async (client) => {
    const { rows } = await client.query<{ enqueued: number }>(
      `
      with missing as (
        select id, created_at
        from map_bookmarks
        where image_id is null or btrim(image_id) = ''
      ),
      enqueued as (
        select graphile_worker.add_job(
          'createBookmarkScreenshot',
          json_build_object('id', id),
          queue_name := $1::text,
          run_at := created_at,
          max_attempts := 2,
          job_key := 'createBookmarkScreenshot:' || id::text,
          priority := 10
        )
        from missing
      )
      select count(*)::int as enqueued from enqueued
      `,
      [QUEUE],
    );
    const enqueued = rows[0]?.enqueued ?? 0;
    helpers.logger.info(
      `backfillBookmarkScreenshots: enqueued ${enqueued} capture(s) on queue ${QUEUE}`,
    );
  });
}
