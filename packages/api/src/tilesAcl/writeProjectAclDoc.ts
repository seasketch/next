import S3 from "aws-sdk/clients/s3";
import { Pool, PoolClient } from "pg";
import {
  assertMayWriteTilesAclNamespace,
  resolveTilesAclNamespace,
} from "./namespace";

export type ProtectedAclEntry =
  | { t: "admins_only" }
  | { t: "group"; g: number[] };

export type ProjectAclDoc = {
  v: number;
  slug: string;
  public: string[];
  rules: ProtectedAclEntry[];
  protected: Record<string, number[]>;
};

// Hosted tiles: /projects/{storageSlug}/public/{uuid}[.json|/z/x/y…]
const HOSTED_TILES_PATH =
  /\/projects\/([^/]+)\/public\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\.|$|\/)/i;

function getR2(): S3 {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2_ENDPOINT / R2 credentials must be set to write ACL docs");
  }
  return new S3({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export function extractHostedTilesPath(
  url: string | null | undefined
): { storageSlug: string; uuid: string } | null {
  if (!url) return null;
  const m = url.match(HOSTED_TILES_PATH);
  if (!m) return null;
  return { storageSlug: m[1], uuid: m[2].toLowerCase() };
}

export function extractHostedTilesUuid(url: string | null | undefined): string | null {
  return extractHostedTilesPath(url)?.uuid ?? null;
}

export type LayerAclRow = {
  slug: string;
  url: string | null;
  ancestor_acls: Array<{
    t: "admins_only" | "group";
    g: number[] | null;
  }>;
};

function normalizeRule(
  value: LayerAclRow["ancestor_acls"][number]
): ProtectedAclEntry {
  if (value.t !== "group") return { t: "admins_only" };
  return {
    t: "group",
    g: Array.from(
      new Set(
        (Array.isArray(value.g) ? value.g : []).filter((groupId) =>
          Number.isInteger(groupId)
        )
      )
    ).sort((a, b) => a - b),
  };
}

function ruleKey(rule: ProtectedAclEntry): string {
  return rule.t === "admins_only" ? "admins_only" : `group:${rule.g.join(",")}`;
}

type PlacementClass = "public" | "group" | "admins_only";

/** Lower rank = more permissive. */
const PLACEMENT_CLASS_RANK: Record<PlacementClass, number> = {
  public: 0,
  group: 1,
  admins_only: 2,
};

function placementClass(rules: ProtectedAclEntry[]): PlacementClass {
  if (rules.length === 0) return "public";
  if (rules.some((rule) => rule.t === "admins_only")) return "admins_only";
  return "group";
}

function unionGroupIds(placements: ProtectedAclEntry[][]): number[] {
  const groups = new Set<number>();
  for (const rules of placements) {
    for (const rule of rules) {
      if (rule.t === "group") {
        for (const groupId of rule.g) groups.add(groupId);
      }
    }
  }
  return Array.from(groups).sort((a, b) => a - b);
}

/**
 * When the same hosted UUID appears in multiple TOC placements, keep the most
 * permissive policy (public > group > admins_only).
 *
 * - Any public placement → public.
 * - Multiple group-only placements → one group rule with the union of all
 *   group ids (OR across placements).
 * - A single group placement keeps its ancestor rules intact (AND within that
 *   path at authorize time).
 * - Otherwise admins_only (pick the fewest-rule placement for the payload).
 */
function selectMostPermissivePlacement(
  placements: ProtectedAclEntry[][]
): ProtectedAclEntry[] {
  if (placements.length === 0) return [];

  let bestRank = PLACEMENT_CLASS_RANK.admins_only;
  for (const rules of placements) {
    bestRank = Math.min(bestRank, PLACEMENT_CLASS_RANK[placementClass(rules)]);
  }

  if (bestRank === PLACEMENT_CLASS_RANK.public) {
    return [];
  }

  const candidates = placements.filter(
    (rules) => PLACEMENT_CLASS_RANK[placementClass(rules)] === bestRank
  );

  if (bestRank === PLACEMENT_CLASS_RANK.group) {
    if (candidates.length === 1) {
      return candidates[0];
    }
    return [{ t: "group", g: unionGroupIds(candidates) }];
  }

  // admins_only: keep one placement's rules (extra group ancestors are inert
  // once classify marks the UUID admins_only, but preserve the path for clarity).
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].length < best.length) {
      best = candidates[i];
    }
  }
  return best;
}

/**
 * Build the compact document consumed by pmtiles-server.
 *
 * Each published TOC layer contributes the non-public ACLs on itself and its
 * ancestor folders. When the same hosted UUID appears more than once, the most
 * permissive policy wins: public beats everything; otherwise group placements
 * OR their group ids together so a shared tile URL stays as open as any copy.
 */
export function buildProjectAclDocFromRows(
  rows: LayerAclRow[],
  slug: string,
  version = Date.now()
): ProjectAclDoc {
  const rules: ProtectedAclEntry[] = [];
  const ruleIndexes = new Map<string, number>();
  const uuidPlacements = new Map<string, ProtectedAclEntry[][]>();

  for (const row of rows) {
    const uuid = extractHostedTilesUuid(row.url);
    if (!uuid) continue;
    const ancestorAcls = Array.isArray(row.ancestor_acls)
      ? row.ancestor_acls
      : [];
    const placement = ancestorAcls.map((value) => normalizeRule(value));
    const placements = uuidPlacements.get(uuid) || [];
    placements.push(placement);
    uuidPlacements.set(uuid, placements);
  }

  const publicUuids: string[] = [];
  const protectedMap: ProjectAclDoc["protected"] = {};
  for (const uuid of Array.from(uuidPlacements.keys()).sort()) {
    const selected = selectMostPermissivePlacement(uuidPlacements.get(uuid)!);
    if (selected.length === 0) {
      publicUuids.push(uuid);
      continue;
    }
    const indexes = new Set<number>();
    for (const rule of selected) {
      const key = ruleKey(rule);
      let index = ruleIndexes.get(key);
      if (index === undefined) {
        index = rules.length;
        rules.push(rule);
        ruleIndexes.set(key, index);
      }
      indexes.add(index);
    }
    protectedMap[uuid] = Array.from(indexes).sort((a, b) => a - b);
  }

  return {
    v: version,
    slug,
    public: publicUuids,
    rules,
    protected: protectedMap,
  };
}

export async function buildProjectAclDoc(
  client: Pool | PoolClient,
  projectId: number
): Promise<ProjectAclDoc> {
  const { rows } = await client.query<LayerAclRow>(
    `
    select
      p.slug,
      ds.url,
      coalesce(
        json_agg(
          json_build_object(
            't', ancestor_acl.type,
            'g', ancestor_acl.group_ids
          )
          -- Prefer ancestor.id over nlevel(path): session roles lack EXECUTE on
          -- public.nlevel. Aggregation order does not affect ACL rule sets.
          order by ancestor.id
        ) filter (
          where ancestor_acl.id is not null
            and ancestor_acl.type != 'public'
        ),
        '[]'::json
      ) as ancestor_acls
    from table_of_contents_items toc
    join projects p on p.id = toc.project_id
    left join data_layers dl on dl.id = toc.data_layer_id
    left join data_sources ds on ds.id = dl.data_source_id
    join table_of_contents_items ancestor
      on ancestor.project_id = toc.project_id
      and ancestor.is_draft = false
      and ancestor.path @> toc.path
    left join lateral (
      select
        acl.id,
        acl.type,
        coalesce(
          array_agg(aclg.group_id order by aclg.group_id)
            filter (where aclg.group_id is not null),
          '{}'::int[]
        ) as group_ids
      from access_control_lists acl
      left join access_control_list_groups aclg
        on aclg.access_control_list_id = acl.id
      where acl.table_of_contents_item_id = ancestor.id
      group by acl.id, acl.type
    ) ancestor_acl on true
    where toc.project_id = $1
      and toc.is_draft = false
      and toc.is_folder = false
      and ds.url is not null
    group by p.slug, toc.id, ds.url
    order by toc.id
    `,
    [projectId]
  );

  if (rows.length === 0) {
    const slugRow = await client.query<{ slug: string }>(
      `select slug from projects where id = $1`,
      [projectId]
    );
    if (slugRow.rows.length === 0) {
      throw new Error(`Project ${projectId} not found`);
    }
    return {
      v: Date.now(),
      slug: slugRow.rows[0].slug,
      public: [],
      rules: [],
      protected: {},
    };
  }

  return buildProjectAclDocFromRows(rows, rows[0].slug);
}

/**
 * Build the ACL doc from `client` and put it to R2.
 *
 * When called from publishTableOfContents (or any in-transaction publish),
 * pass that mutation's `pgClient` so the query sees newly published TOC rows.
 * Passing `adminPool` instead reads a different connection and will persist
 * the pre-publish document until something like backfill rewrites it.
 */
export async function writeProjectAclDocToR2(
  client: Pool | PoolClient,
  projectId: number,
  options?: { namespace?: string }
): Promise<{ ns: string; key: string; doc: ProjectAclDoc }> {
  const ns = options?.namespace ?? resolveTilesAclNamespace();
  assertMayWriteTilesAclNamespace(ns);

  const doc = await buildProjectAclDoc(client, projectId);
  const key = `acl/${ns}/projects/${doc.slug}.json`;
  const bucket = process.env.R2_TILES_BUCKET;
  if (!bucket) {
    throw new Error("R2_TILES_BUCKET must be set to write ACL docs");
  }

  const r2 = getR2();
  await r2
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(doc),
      ContentType: "application/json",
    })
    .promise();

  return { ns, key, doc };
}
