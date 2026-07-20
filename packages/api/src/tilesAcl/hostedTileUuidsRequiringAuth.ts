import { Pool, PoolClient } from "pg";
import {
  buildProjectAclDoc,
  extractHostedTilesPath,
} from "./writeProjectAclDoc";

/**
 * Given the published ACL public UUID list and candidate hosted URLs,
 * return UUIDs that require a map-access token.
 */
export function hostedTileUuidsRequiringAuthFromUrls(
  publicUuids: string[],
  urls: Array<string | null | undefined>
): string[] {
  const publicSet = new Set(
    publicUuids.map((uuid) => uuid.toLowerCase())
  );
  const needing = new Set<string>();
  for (const url of urls) {
    const path = extractHostedTilesPath(url);
    if (!path) continue;
    if (path.storageSlug.toLowerCase() === "superuser") continue;
    if (!publicSet.has(path.uuid)) {
      needing.add(path.uuid);
    }
  }
  return Array.from(needing).sort();
}

/**
 * Hosted tile UUIDs that should attach a map-access token for /v2 requests.
 *
 * Logic:
 * 1. `public` UUIDs = same as the published ACL document (`buildProjectAclDoc`).
 * 2. Collect hosted UUIDs from TOC items the session may know about:
 *    - always published layers
 *    - draft layers when `includeDraft` (admins)
 * 3. Return hosted UUIDs that are **not** in that published public list.
 *
 * Effects:
 * - Draft-only layers → require token (not yet published into ACL public[]).
 * - Published-public UUID still public in draft while ACL change is unpublished
 *   → no token (matches what the worker will allow).
 * - `/projects/superuser/` data-library paths are never included.
 */
export async function getHostedTileUuidsRequiringAuth(
  client: Pool | PoolClient,
  projectId: number,
  options?: { includeDraft?: boolean }
): Promise<string[]> {
  const includeDraft = options?.includeDraft === true;
  const doc = await buildProjectAclDoc(client, projectId);

  const { rows } = await client.query<{ url: string }>(
    `
    select distinct ds.url
    from table_of_contents_items toc
    join data_layers dl on dl.id = toc.data_layer_id
    join data_sources ds on ds.id = dl.data_source_id
    where toc.project_id = $1
      and toc.is_folder = false
      and ds.url is not null
      and (
        toc.is_draft = false
        or ($2::boolean and toc.is_draft = true)
      )
    `,
    [projectId, includeDraft]
  );

  return hostedTileUuidsRequiringAuthFromUrls(
    doc.public,
    rows.map((row) => row.url)
  );
}
