/**
 * Manually backfill tile ACL documents to R2 (local / operator CLI).
 *
 * Usage (from packages/api):
 *   NODE_ENV=development TILES_ACL_NAMESPACE=dev-cburt \
 *     npm run tiles-acl:backfill -- --project-id=123
 *   npm run tiles-acl:backfill -- --all
 *
 * On production, prefer enqueueing the graphile-worker task instead (app
 * servers already have R2 + ADMIN DB). See tasks/backfillTilesAclDocs.ts.
 *
 * Prefer ADMIN_DATABASE_URL (bypasses RLS). Publish-time writes correctly use
 * the mutation's pgClient so they see uncommitted TOC rows; this script runs
 * after the fact so a plain admin pool is appropriate.
 */
import { Pool } from "pg";
import {
  parseTilesAclBackfillPayload,
  runTilesAclBackfill,
} from "../src/tilesAcl/backfillProjectAclDocs";

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const projectIdArg = args.find((a) => a.startsWith("--project-id="));
  const projectId = projectIdArg
    ? parseInt(projectIdArg.split("=")[1], 10)
    : NaN;

  if (!all && !Number.isFinite(projectId)) {
    console.error(
      "Usage: npm run tiles-acl:backfill -- --project-id=<id> | --all"
    );
    process.exit(1);
  }

  const options = parseTilesAclBackfillPayload(
    all ? { all: true } : { projectId }
  );

  const pool = new Pool({
    // Must bypass RLS: data_sources_select uses a scalar subquery on toc.path that
    // errors when a source is shared by multiple published TOC items.
    connectionString:
      process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL,
  });
  if (!process.env.ADMIN_DATABASE_URL) {
    console.warn(
      "Warning: ADMIN_DATABASE_URL unset; using DATABASE_URL (may fail under RLS)"
    );
  }

  try {
    const result = await runTilesAclBackfill(pool, options);
    if (result.failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
