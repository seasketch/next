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

/**
 * Build the compact document consumed by pmtiles-server. Each UUID references
 * every non-public ACL on its published TOC item and ancestor folders.
 */
export function buildProjectAclDocFromRows(
  rows: LayerAclRow[],
  slug: string,
  version = Date.now()
): ProjectAclDoc {
  const rules: ProtectedAclEntry[] = [];
  const ruleIndexes = new Map<string, number>();
  const uuidPolicies = new Map<
    string,
    { hasProtectedPath: boolean; ruleIndexes: Set<number> }
  >();

  for (const row of rows) {
    const uuid = extractHostedTilesUuid(row.url);
    if (!uuid) continue;
    const policy = uuidPolicies.get(uuid) || {
      hasProtectedPath: false,
      ruleIndexes: new Set<number>(),
    };
    const ancestorAcls = Array.isArray(row.ancestor_acls)
      ? row.ancestor_acls
      : [];

    if (ancestorAcls.length > 0) {
      policy.hasProtectedPath = true;
      for (const value of ancestorAcls) {
        const rule = normalizeRule(value);
        const key = ruleKey(rule);
        let index = ruleIndexes.get(key);
        if (index === undefined) {
          index = rules.length;
          rules.push(rule);
          ruleIndexes.set(key, index);
        }
        policy.ruleIndexes.add(index);
      }
    }
    uuidPolicies.set(uuid, policy);
  }

  const publicUuids: string[] = [];
  const protectedMap: ProjectAclDoc["protected"] = {};
  for (const uuid of Array.from(uuidPolicies.keys()).sort()) {
    const policy = uuidPolicies.get(uuid)!;
    if (policy.hasProtectedPath) {
      protectedMap[uuid] = Array.from(policy.ruleIndexes).sort(
        (a, b) => a - b
      );
    } else {
      publicUuids.push(uuid);
    }
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
