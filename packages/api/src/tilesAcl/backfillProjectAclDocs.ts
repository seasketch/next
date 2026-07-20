import { Pool, PoolClient } from "pg";
import { writeProjectAclDocToR2 } from "./writeProjectAclDoc";
import { resolveTilesAclNamespace } from "./namespace";

const PROJECTS_WITH_PUBLISHED_TOC_SQL = `
  select distinct p.id
  from projects p
  where exists (
    select 1 from table_of_contents_items toc
    where toc.project_id = p.id and toc.is_draft = false
  )
  order by p.id
`;

/** Project ids that have at least one published TOC item (ordered). */
export async function listProjectIdsWithPublishedToc(
  client: Pool | PoolClient,
): Promise<number[]> {
  const { rows } = await client.query<{ id: number }>(
    PROJECTS_WITH_PUBLISHED_TOC_SQL,
  );
  return rows.map((row) => row.id);
}

export type TilesAclBackfillOptions =
  | { projectId: number; all?: false }
  | { all: true; projectId?: undefined };

export type TilesAclBackfillResult = {
  ns: string;
  attempted: number;
  ok: number;
  failed: Array<{ projectId: number; error: string }>;
};

function parseProjectId(value: unknown): number {
  const id =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseInt(value, 10)
        : NaN;
  if (!Number.isFinite(id) || id < 1) {
    throw new Error("projectId must be a positive integer");
  }
  return id;
}

/**
 * Parse a worker / CLI payload into backfill options.
 * Accepts `{ projectId }` or `{ all: true }`.
 */
export function parseTilesAclBackfillPayload(
  payload: unknown
): TilesAclBackfillOptions {
  if (payload == null || typeof payload !== "object") {
    throw new Error(
      'payload must be { "projectId": <n> } or { "all": true }'
    );
  }
  const obj = payload as Record<string, unknown>;
  if (obj.all === true) {
    return { all: true };
  }
  if ("projectId" in obj) {
    return { projectId: parseProjectId(obj.projectId) };
  }
  throw new Error(
    'payload must be { "projectId": <n> } or { "all": true }'
  );
}

/**
 * Write tile ACL document(s) to R2 for one project or every project that has
 * published TOC items. Uses the given DB client (prefer admin / worker pool so
 * RLS does not interfere).
 */
export async function runTilesAclBackfill(
  client: Pool | PoolClient,
  options: TilesAclBackfillOptions,
  log: (message: string) => void = console.log
): Promise<TilesAclBackfillResult> {
  const ns = resolveTilesAclNamespace();
  log(`Using ACL namespace: ${ns}`);

  const ids = options.all
    ? await listProjectIdsWithPublishedToc(client)
    : [options.projectId];

  log(`Writing ACL docs for ${ids.length} project(s)...`);
  const failed: TilesAclBackfillResult["failed"] = [];
  let ok = 0;

  for (const id of ids) {
    try {
      const { key, doc } = await writeProjectAclDocToR2(client, id);
      ok += 1;
      log(
        `OK project=${id} slug=${doc.slug} key=${key} public=${doc.public.length} protected=${Object.keys(doc.protected).length}`
      );
    } catch (e: any) {
      const error = e?.message || String(e);
      failed.push({ projectId: id, error });
      log(`FAIL project=${id}: ${error}`);
    }
  }

  return { ns, attempted: ids.length, ok, failed };
}
