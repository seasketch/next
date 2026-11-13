import { DBClient } from "../dbClient";
import { CatalogOutput } from "./columns";
import {
  AccessListRecord,
  LayerCatalogStore,
  LayerResourceRecord,
  RawTocItem,
} from "./types";

type QueryRow = Record<string, unknown>;

export class PgLayerCatalogStore implements LayerCatalogStore {
  constructor(private readonly db: DBClient) {}

  async projectBySlug(slug: string): Promise<{ id: number } | null> {
    const result = await this.db.query(
      `select id from projects where slug = $1`,
      [slug]
    );
    const id = result.rows[0]?.id;
    return typeof id === "number" ? { id } : null;
  }

  async draftItems(projectId: number): Promise<RawTocItem[]> {
    const result = await this.db.query(
      `
      select
        toc.stable_id as "stableId",
        toc.parent_stable_id as "parentStableId",
        toc.title,
        toc.is_folder as "isFolder",
        toc.sort_index as "sortIndex",
        acl.type::text as "accessType",
        (
          select coalesce(array_agg(pg.name order by pg.name), '{}')
          from access_control_list_groups aclg
          join project_groups pg on pg.id = aclg.group_id
          where aclg.access_control_list_id = acl.id
        ) as "accessGroupNames",
        ds.type as "sourceType",
        dl.sublayer_type::text as "sublayerType",
        dl.sublayer,
        ds.url as "sourceUrl",
        dl.source_layer as "sourceLayer",
        ds.created_at as "createdAt",
        up.fullname as "authorName",
        u.canonical_email as "authorEmail",
        ds.geostats,
        ds.attribution,
        toc.enable_download as "enableDownload",
        (toc.metadata is not null) as "hasMetadata",
        ds.uploaded_source_filename as "uploadedSourceFilename",
        (
          select coalesce(
            json_agg(
              json_build_object(
                'type', o.type,
                'url', o.url,
                'isOriginal', o.is_original,
                'originalFilename', o.original_filename,
                'epsg', o.epsg
              )
              order by o.id desc
            ),
            '[]'::json
          )
          from data_upload_outputs o
          where o.data_source_id = ds.id
        ) as outputs
      from table_of_contents_items toc
      left join access_control_lists acl
        on acl.table_of_contents_item_id = toc.id
      left join data_layers dl on dl.id = toc.data_layer_id
      left join data_sources ds on ds.id = dl.data_source_id
      left join users u on u.id = coalesce(ds.created_by, ds.uploaded_by)
      left join user_profiles up on up.user_id = u.id
      where toc.project_id = $1 and toc.is_draft = true
      `,
      [projectId]
    );
    return result.rows.map(mapTocItem);
  }

  async layerResource(
    projectId: number,
    stableId: string,
    isDraft: boolean
  ): Promise<LayerResourceRecord | null> {
    const result = await this.db.query(
      `
      select
        toc.stable_id as "stableId",
        toc.path::text as path,
        toc.metadata,
        dl.sublayer,
        dl.mapbox_gl_styles as style,
        ds.geostats,
        ds.type as "sourceType",
        ds.url as "sourceUrl"
      from table_of_contents_items toc
      left join data_layers dl on dl.id = toc.data_layer_id
      left join data_sources ds on ds.id = dl.data_source_id
      where toc.project_id = $1
        and toc.stable_id = $2
        and toc.is_draft = $3
        and toc.is_folder = false
      `,
      [projectId, stableId, isDraft]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      stableId: stringValue(row.stableId),
      path: stringValue(row.path),
      metadata: row.metadata ?? null,
      sublayer: row.sublayer == null ? null : String(row.sublayer),
      style: row.style ?? null,
      geostats: row.geostats ?? null,
      sourceType: row.sourceType == null ? null : String(row.sourceType),
      sourceUrl: row.sourceUrl == null ? null : String(row.sourceUrl),
    };
  }

  async accessLists(
    projectId: number,
    isDraft: boolean,
    path: string
  ): Promise<AccessListRecord[]> {
    const result = await this.db.query(
      `
      select acl.id, acl.type::text as type
      from table_of_contents_items ancestor
      join access_control_lists acl
        on acl.table_of_contents_item_id = ancestor.id
      where ancestor.project_id = $1
        and ancestor.is_draft = $2
        and ancestor.path @> $3::ltree
      `,
      [projectId, isDraft, path]
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      type: stringValue(row.type),
    }));
  }

  async isProjectAdmin(projectId: number, userId: number): Promise<boolean> {
    const result = await this.db.query(
      `select is_admin($1, $2) as "isAdmin"`,
      [projectId, userId]
    );
    return result.rows[0]?.isAdmin === true;
  }

  async memberAclIds(aclIds: number[], userId: number): Promise<number[]> {
    if (aclIds.length === 0) {
      return [];
    }
    const result = await this.db.query(
      `
      select distinct aclg.access_control_list_id as id
      from access_control_list_groups aclg
      join project_group_members pgm on pgm.group_id = aclg.group_id
      where aclg.access_control_list_id = any($1::int[])
        and pgm.user_id = $2
      `,
      [aclIds, userId]
    );
    return result.rows.map((row) => Number(row.id));
  }
}

function mapTocItem(row: QueryRow): RawTocItem {
  return {
    stableId: stringValue(row.stableId),
    parentStableId:
      row.parentStableId == null ? null : stringValue(row.parentStableId),
    title: stringValue(row.title),
    isFolder: row.isFolder === true,
    sortIndex: typeof row.sortIndex === "number" ? row.sortIndex : Number(row.sortIndex) || 0,
    accessType: row.accessType == null ? null : stringValue(row.accessType),
    accessGroupNames: stringList(row.accessGroupNames),
    sourceType: row.sourceType == null ? null : stringValue(row.sourceType),
    sublayerType: row.sublayerType == null ? null : stringValue(row.sublayerType),
    sublayer: row.sublayer == null ? null : stringValue(row.sublayer),
    sourceUrl: row.sourceUrl == null ? null : stringValue(row.sourceUrl),
    sourceLayer: row.sourceLayer == null ? null : stringValue(row.sourceLayer),
    createdAt: (row.createdAt as Date | string | null) ?? null,
    authorName: row.authorName == null ? null : stringValue(row.authorName),
    authorEmail: row.authorEmail == null ? null : stringValue(row.authorEmail),
    geostats: row.geostats ?? null,
    attribution: row.attribution == null ? null : stringValue(row.attribution),
    enableDownload: row.enableDownload === true,
    hasMetadata: row.hasMetadata === true,
    uploadedSourceFilename:
      row.uploadedSourceFilename == null
        ? null
        : stringValue(row.uploadedSourceFilename),
    outputs: outputList(row.outputs),
  };
}

function outputList(value: unknown): CatalogOutput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isOutput);
}

function isOutput(value: unknown): value is CatalogOutput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  if (!("type" in value) || !("url" in value) || !("isOriginal" in value)) {
    return false;
  }
  return (
    typeof value.type === "string" &&
    typeof value.url === "string" &&
    typeof value.isOriginal === "boolean"
  );
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}
