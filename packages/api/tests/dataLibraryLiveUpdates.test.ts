/// <reference types="jest" />
import { sql, DatabaseTransactionConnectionType } from "slonik";
import { createPool } from "./pool";
import {
  clearSession,
  createProject,
  createSession,
  projectTransaction,
} from "./helpers";
// @ts-ignore
import nanoid from "nanoid";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const id = nanoid.customAlphabet(alphabet, 9);

const pool = createPool("test");

/**
 * Run fn with the postgres role (bypassing RLS), then restore the previous
 * session (if any).
 */
async function asPostgres<T>(
  conn: DatabaseTransactionConnectionType,
  fn: () => Promise<T>
) {
  const userId = (await conn.oneFirst(
    sql`select nullif(current_setting('session.user_id', true), '')::int`
  )) as number | null;
  const projectId = (await conn.oneFirst(
    sql`select nullif(current_setting('session.project_id', true), '')::int`
  )) as number | null;

  await conn.any(sql`set role postgres`);
  try {
    return await fn();
  } finally {
    if (userId) {
      await createSession(conn, userId, true, false, projectId || undefined);
    }
  }
}

type Template = {
  templateProjectId: number;
  templateId: string;
  sourceId: number;
  layerId: number;
  itemId: number;
  stableId: string;
};

/**
 * Creates a data library template: a project holding a draft TOC item with
 * data_library_template_id set, whose data_source is stamped with the same id.
 * Mirrors the state created by createDataLibraryLayers.ts.
 */
async function createTemplate(
  conn: DatabaseTransactionConnectionType,
  adminId: number
): Promise<Template> {
  const templateProjectId = await createProject(conn, adminId, "public");
  const templateId = `TEMPLATE_${id()}`;
  const stableId = id();
  return asPostgres(conn, async () => {
    const sourceId = (await conn.oneFirst(
      sql`insert into data_sources (project_id, type, import_type, original_source_url, byte_length) values (${templateProjectId}, 'seasketch-vector', 'arcgis', 'https://example.com/arcgis/rest/services/library/MapServer', 12) returning id`
    )) as number;
    const layerId = (await conn.oneFirst(
      sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${templateProjectId}, ${sourceId}, '[{"type": "fill"}]'::jsonb) returning id`
    )) as number;
    const itemId = (await conn.oneFirst(
      sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id) values (${templateProjectId}, 'Library Template', false, ${layerId}, ${stableId}) returning id`
    )) as number;
    await conn.any(
      sql`update table_of_contents_items set data_library_template_id = ${templateId} where id = ${itemId}`
    );
    await conn.any(
      sql`update data_sources set data_library_template_id = ${templateId} where id = ${sourceId}`
    );
    return {
      templateProjectId,
      templateId,
      sourceId,
      layerId,
      itemId,
      stableId,
    };
  });
}

/**
 * Creates a copy of a library template in the given project, sharing the
 * template's data_source (as copy_data_library_template_item does).
 */
async function createLibraryCopy(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  template: Template
) {
  const stableId = id();
  return asPostgres(conn, async () => {
    const layerId = (await conn.oneFirst(
      sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${template.sourceId}, '[{"type": "fill"}]'::jsonb) returning id`
    )) as number;
    const itemId = (await conn.oneFirst(
      sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id, copied_from_data_library_template_id) values (${projectId}, 'Library Copy', false, ${layerId}, ${stableId}, ${template.templateId}) returning id`
    )) as number;
    return { layerId, itemId, stableId };
  });
}

/**
 * Creates a replacement data_source of the kind produced by an automated
 * library update (uploaded_by + uploaded_source_filename set, so the
 * layer:uploaded changelog trigger would fire if not suppressed).
 */
async function createReplacementSource(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  uploadedBy: number,
  filename = "library_update.fgb"
) {
  return asPostgres(
    conn,
    async () =>
      (await conn.oneFirst(
        sql`insert into data_sources (project_id, type, import_type, original_source_url, byte_length, uploaded_by, uploaded_source_filename, changelog) values (${projectId}, 'seasketch-vector', 'arcgis', 'https://example.com/arcgis/rest/services/library/MapServer', 12, ${uploadedBy}, ${filename}, 'Automated update') returning id`
      )) as number
  );
}

async function replaceDataSource(
  conn: DatabaseTransactionConnectionType,
  layerId: number,
  sourceId: number,
  stableId: string,
  bounds: [number, number, number, number] = [-10, -10, 10, 10]
) {
  return asPostgres(conn, () =>
    conn.any(
      sql`select replace_data_source(${layerId}, ${sourceId}, null, array[${bounds[0]}, ${bounds[1]}, ${bounds[2]}, ${bounds[3]}]::numeric[], null, ${stableId})`
    )
  );
}

async function publish(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  adminId: number
) {
  await createSession(conn, adminId, true, false, projectId);
  await conn.any(sql`select publish_table_of_contents(${projectId})`);
  await clearSession(conn);
}

async function publishedLayerId(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  stableId: string
) {
  return asPostgres(
    conn,
    async () =>
      (await conn.oneFirst(
        sql`select data_layer_id from table_of_contents_items where project_id = ${projectId} and stable_id = ${stableId} and is_draft = false`
      )) as number
  );
}

async function layerSourceId(
  conn: DatabaseTransactionConnectionType,
  layerId: number
) {
  return asPostgres(
    conn,
    async () =>
      (await conn.oneFirst(
        sql`select data_source_id from data_layers where id = ${layerId}`
      )) as number
  );
}

async function draftHasChanges(
  conn: DatabaseTransactionConnectionType,
  projectId: number
) {
  return asPostgres(
    conn,
    async () =>
      (await conn.oneFirst(
        sql`select draft_table_of_contents_has_changes from projects where id = ${projectId}`
      )) as boolean
  );
}

async function resetProjectState(
  conn: DatabaseTransactionConnectionType,
  projectIds: number[]
) {
  await asPostgres(conn, async () => {
    await conn.any(
      sql`update projects set draft_table_of_contents_has_changes = false where id = any(${sql.array(
        projectIds,
        "int4"
      )})`
    );
    await conn.any(
      sql`delete from change_logs where project_id = any(${sql.array(
        projectIds,
        "int4"
      )})`
    );
  });
}

async function changeLogCount(
  conn: DatabaseTransactionConnectionType,
  projectId: number
) {
  return asPostgres(conn, async () =>
    Number(
      await conn.oneFirst(
        sql`select count(*)::int from change_logs where project_id = ${projectId}`
      )
    )
  );
}

describe("Live data library updates", () => {
  test("publish_table_of_contents shares library sources instead of cloning, and tags published items", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      const template = await createTemplate(conn, adminId);
      const copy = await createLibraryCopy(conn, projectId, template);

      await publish(conn, projectId, adminId);

      const pubLayerId = await publishedLayerId(conn, projectId, copy.stableId);
      // published layer references the shared library source (no clone)
      expect(await layerSourceId(conn, pubLayerId)).toBe(template.sourceId);
      // published TOC item carries copied_from_data_library_template_id
      const publishedItem = await asPostgres(conn, () =>
        conn.one(
          sql`select copied_from_data_library_template_id, data_library_template_id from table_of_contents_items where project_id = ${projectId} and stable_id = ${copy.stableId} and is_draft = false`
        )
      );
      expect(publishedItem.copied_from_data_library_template_id).toBe(
        template.templateId
      );
      // ...but never data_library_template_id itself (unique to the draft template)
      expect(publishedItem.data_library_template_id).toBeNull();
      // only one data_sources row exists for this template version
      const sourceCount = await asPostgres(conn, () =>
        conn.oneFirst(
          sql`select count(*)::int from data_sources where data_library_template_id = ${template.templateId}`
        )
      );
      expect(Number(sourceCount)).toBe(1);

      // publishing the template's own project also shares the source
      await publish(conn, template.templateProjectId, adminId);
      const pubTemplateLayerId = await publishedLayerId(
        conn,
        template.templateProjectId,
        template.stableId
      );
      expect(await layerSourceId(conn, pubTemplateLayerId)).toBe(
        template.sourceId
      );
    });
  });

  test("republishing does not delete shared library sources", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      const template = await createTemplate(conn, adminId);
      const copy = await createLibraryCopy(conn, projectId, template);

      await publish(conn, projectId, adminId);
      await publish(conn, projectId, adminId);

      const sourceExists = await asPostgres(conn, () =>
        conn.oneFirst(
          sql`select exists(select 1 from data_sources where id = ${template.sourceId})`
        )
      );
      expect(sourceExists).toBe(true);
      const pubLayerId = await publishedLayerId(conn, projectId, copy.stableId);
      expect(await layerSourceId(conn, pubLayerId)).toBe(template.sourceId);
      // draft copy untouched
      expect(await layerSourceId(conn, copy.layerId)).toBe(template.sourceId);
    });
  });

  test("replace_data_source fans out to draft and published copies without publish or changelog side effects", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      const template = await createTemplate(conn, adminId);
      const copy = await createLibraryCopy(conn, projectId, template);
      await publish(conn, projectId, adminId);
      const pubLayerId = await publishedLayerId(conn, projectId, copy.stableId);

      await resetProjectState(conn, [projectId, template.templateProjectId]);

      const newSourceId = await createReplacementSource(
        conn,
        template.templateProjectId,
        adminId
      );
      await replaceDataSource(
        conn,
        template.layerId,
        newSourceId,
        template.stableId,
        [1, 2, 3, 4]
      );

      // template layer, draft copy, and published copy all point at the new source
      expect(await layerSourceId(conn, template.layerId)).toBe(newSourceId);
      expect(await layerSourceId(conn, copy.layerId)).toBe(newSourceId);
      expect(await layerSourceId(conn, pubLayerId)).toBe(newSourceId);

      // bounds updated on draft and published TOC items
      const boundsOk = await asPostgres(conn, () =>
        conn.oneFirst(
          sql`select bool_and(bounds = array[1,2,3,4]::numeric[]) from table_of_contents_items where project_id = ${projectId} and stable_id = ${copy.stableId}`
        )
      );
      expect(boundsOk).toBe(true);

      // no publish flag flipped, no changelog entries written
      expect(await draftHasChanges(conn, projectId)).toBe(false);
      expect(await draftHasChanges(conn, template.templateProjectId)).toBe(
        false
      );
      expect(await changeLogCount(conn, projectId)).toBe(0);
      expect(await changeLogCount(conn, template.templateProjectId)).toBe(0);

      // the new source is stamped with the template id, and the old source
      // remains stamped (so stranded layers can be found later)
      const stamped = await asPostgres(conn, () =>
        conn.oneFirst(
          sql`select count(*)::int from data_sources where data_library_template_id = ${template.templateId} and id in (${template.sourceId}, ${newSourceId})`
        )
      );
      expect(Number(stamped)).toBe(2);

      // version history is preserved
      const archived = await asPostgres(conn, () =>
        conn.oneFirst(
          sql`select count(*)::int from archived_data_sources where data_layer_id = ${template.layerId} and data_source_id = ${template.sourceId}`
        )
      );
      expect(Number(archived)).toBe(1);

      // the suppression GUC does not leak past the function call
      const guc = await asPostgres(conn, () =>
        conn.oneFirst(
          sql`select coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '')`
        )
      );
      expect(guc).not.toBe("true");
    });
  });

  test("copies stranded on an older library source version are updated by the next replace", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      const template = await createTemplate(conn, adminId);
      const copy = await createLibraryCopy(conn, projectId, template);
      const v1 = template.sourceId;

      const v2 = await createReplacementSource(
        conn,
        template.templateProjectId,
        adminId,
        "v2.fgb"
      );
      await replaceDataSource(conn, template.layerId, v2, template.stableId);
      expect(await layerSourceId(conn, copy.layerId)).toBe(v2);

      // strand the copy on v1 (still stamped with the template id)
      await asPostgres(conn, () =>
        conn.any(
          sql`update data_layers set data_source_id = ${v1} where id = ${copy.layerId}`
        )
      );

      const v3 = await createReplacementSource(
        conn,
        template.templateProjectId,
        adminId,
        "v3.fgb"
      );
      await replaceDataSource(conn, template.layerId, v3, template.stableId);
      expect(await layerSourceId(conn, copy.layerId)).toBe(v3);
    });
  });

  test("layers with custom (non-library) sources are not touched by fan-out", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      const template = await createTemplate(conn, adminId);
      // a layer in the same project pointing at an unrelated source
      const customSourceId = await asPostgres(
        conn,
        async () =>
          (await conn.oneFirst(
            sql`insert into data_sources (project_id, type, import_type, original_source_url, byte_length) values (${projectId}, 'seasketch-vector', 'arcgis', 'https://example.com/custom', 12) returning id`
          )) as number
      );
      const customLayerId = await asPostgres(
        conn,
        async () =>
          (await conn.oneFirst(
            sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${customSourceId}, '[{"type": "fill"}]'::jsonb) returning id`
          )) as number
      );

      const newSourceId = await createReplacementSource(
        conn,
        template.templateProjectId,
        adminId
      );
      await replaceDataSource(
        conn,
        template.layerId,
        newSourceId,
        template.stableId
      );
      expect(await layerSourceId(conn, customLayerId)).toBe(customSourceId);
    });
  });

  test("non-library replace_data_source still records changelog and flags draft changes", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      const stableId = id();
      const { sourceId, layerId } = await asPostgres(conn, async () => {
        const sourceId = (await conn.oneFirst(
          sql`insert into data_sources (project_id, type, import_type, original_source_url, byte_length) values (${projectId}, 'seasketch-vector', 'arcgis', 'https://example.com/normal', 12) returning id`
        )) as number;
        const layerId = (await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${sourceId}, '[{"type": "fill"}]'::jsonb) returning id`
        )) as number;
        await conn.any(
          sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'Normal Layer', false, ${layerId}, ${stableId})`
        );
        return { sourceId, layerId };
      });
      await resetProjectState(conn, [projectId]);

      const newSourceId = await createReplacementSource(
        conn,
        projectId,
        adminId,
        "manual_upload.fgb"
      );
      await replaceDataSource(conn, layerId, newSourceId, stableId);

      expect(await layerSourceId(conn, layerId)).toBe(newSourceId);
      expect(await draftHasChanges(conn, projectId)).toBe(true);
      const uploadLogs = await asPostgres(conn, () =>
        conn.oneFirst(
          sql`select count(*)::int from change_logs where project_id = ${projectId} and field_group = 'layer:uploaded'`
        )
      );
      expect(Number(uploadLogs)).toBe(1);
    });
  });

  test("normal sources are still cloned on publish, and published items remain immutable", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      const stableId = id();
      const { sourceId } = await asPostgres(conn, async () => {
        const sourceId = (await conn.oneFirst(
          sql`insert into data_sources (project_id, type, import_type, original_source_url, byte_length) values (${projectId}, 'seasketch-vector', 'arcgis', 'https://example.com/normal', 12) returning id`
        )) as number;
        const layerId = (await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${sourceId}, '[{"type": "fill"}]'::jsonb) returning id`
        )) as number;
        await conn.any(
          sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'Normal Layer', false, ${layerId}, ${stableId})`
        );
        return { sourceId };
      });

      await publish(conn, projectId, adminId);
      const pubLayerId = await publishedLayerId(conn, projectId, stableId);
      const pubSourceId = await layerSourceId(conn, pubLayerId);
      expect(pubSourceId).not.toBe(sourceId);

      // republish creates a fresh clone; the old one is orphaned (no layers
      // reference it) and left for the cleanup worker
      await publish(conn, projectId, adminId);
      const newPubLayerId = await publishedLayerId(conn, projectId, stableId);
      const newPubSourceId = await layerSourceId(conn, newPubLayerId);
      expect(newPubSourceId).not.toBe(sourceId);
      expect(newPubSourceId).not.toBe(pubSourceId);
      const oldCloneRefs = await asPostgres(conn, () =>
        conn.oneFirst(
          sql`select count(*)::int from data_layers where data_source_id = ${pubSourceId}`
        )
      );
      expect(Number(oldCloneRefs)).toBe(0);

      // published TOC items are still immutable outside library fan-out
      await asPostgres(conn, async () => {
        await conn.any(sql`savepoint before_immutable_check`);
        await expect(
          conn.any(
            sql`update table_of_contents_items set title = 'nope' where project_id = ${projectId} and stable_id = ${stableId} and is_draft = false`
          )
        ).rejects.toThrow(/Cannot alter table of contents items/);
        await conn.any(sql`rollback to before_immutable_check`);
      });
    });
  });

  test("cartography edits to library copies still flag draft changes", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      const template = await createTemplate(conn, adminId);
      const copy = await createLibraryCopy(conn, projectId, template);
      await resetProjectState(conn, [projectId]);

      await asPostgres(conn, () =>
        conn.any(
          sql`update data_layers set mapbox_gl_styles = '[{"type": "fill", "paint": {"fill-color": "red"}}]'::jsonb where id = ${copy.layerId}`
        )
      );
      expect(await draftHasChanges(conn, projectId)).toBe(true);
    });
  });

  describe("backfill (mirrors statements in migrations/current.sql)", () => {
    // Runs the backfill SQL against a simulated pre-migration state:
    // published library items with cloned sources, changelog noise from the
    // automated updater, and a falsely-lit publish flag.
    test("tags published copies, re-points layers, deletes noise, clears flags", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId) => {
          const template = await createTemplate(conn, adminId);
          const copy = await createLibraryCopy(conn, projectId, template);
          // a second project with the same library copy plus real admin activity
          const projectBId = await createProject(conn, adminId, "public");
          const copyB = await createLibraryCopy(conn, projectBId, template);

          await asPostgres(conn, async () => {
            const dlUserId = (await conn.oneFirst(
              sql`select get_or_create_user_by_sub('data-library-template-updater', 'do-not-reply@seasketch.org')`
            )) as number;

            // simulate old-style publish for the copy in project A: cloned
            // source + published TOC without copied_from tag
            const cloneSourceId = (await conn.oneFirst(
              sql`insert into data_sources (project_id, type, import_type, original_source_url, byte_length) values (${projectId}, 'seasketch-vector', 'arcgis', 'https://example.com/clone', 12) returning id`
            )) as number;
            const pubLayerId = (await conn.oneFirst(
              sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${cloneSourceId}, '[{"type": "fill"}]'::jsonb) returning id`
            )) as number;
            await conn.any(
              sql`insert into table_of_contents_items (is_draft, project_id, path, title, is_folder, data_layer_id, stable_id) values (false, ${projectId}, ${copy.stableId}, 'Library Copy', false, ${pubLayerId}, ${copy.stableId})`
            );

            // changelog noise from the automated updater in both projects
            for (const [pid, itemId] of [
              [projectId, copy.itemId],
              [projectBId, copyB.itemId],
            ]) {
              await conn.any(
                sql`insert into change_logs (project_id, editor_id, entity_id, entity_type, field_group, from_summary, to_summary) values (${pid}, ${dlUserId}, ${itemId}, 'table_of_contents_items', 'layer:uploaded', '{}'::jsonb, '{"filename": "crw.nc", "replacement": true}'::jsonb)`
              );
            }
            // real admin activity in project B only
            await conn.any(
              sql`insert into change_logs (project_id, editor_id, entity_id, entity_type, field_group, from_summary, to_summary) values (${projectBId}, ${adminId}, ${copyB.itemId}, 'table_of_contents_items', 'layer:uploaded', '{}'::jsonb, '{"filename": "admin_upload.fgb", "replacement": true}'::jsonb)`
            );

            // both projects published an hour ago, both flags falsely lit
            await conn.any(
              sql`update projects set table_of_contents_last_published = now() - interval '1 hour', draft_table_of_contents_has_changes = true where id in (${projectId}, ${projectBId})`
            );

            // ---- backfill statements (keep in sync with current.sql) ----
            await conn.any(
              sql`select set_config('seasketch.skip_library_source_side_effects', 'true', true)`
            );
            await conn.any(sql`
              update table_of_contents_items pub
              set copied_from_data_library_template_id = draft.copied_from_data_library_template_id
              from table_of_contents_items draft
              where
                pub.is_draft = false and
                pub.copied_from_data_library_template_id is null and
                draft.is_draft = true and
                draft.project_id = pub.project_id and
                draft.stable_id = pub.stable_id and
                draft.copied_from_data_library_template_id is not null
            `);
            await conn.any(sql`
              update data_layers dl
              set
                data_source_id = draft_dl.data_source_id,
                source_layer = draft_dl.source_layer
              from
                table_of_contents_items pub,
                table_of_contents_items draft,
                data_layers draft_dl
              where
                pub.is_draft = false and
                pub.copied_from_data_library_template_id is not null and
                pub.data_layer_id = dl.id and
                draft.is_draft = true and
                draft.project_id = pub.project_id and
                draft.stable_id = pub.stable_id and
                draft.copied_from_data_library_template_id = pub.copied_from_data_library_template_id and
                draft_dl.id = draft.data_layer_id and
                dl.data_source_id is distinct from draft_dl.data_source_id
            `);
            await conn.any(
              sql`select set_config('seasketch.skip_library_source_side_effects', 'false', true)`
            );
            await conn.any(sql`
              delete from change_logs
              where field_group = 'layer:uploaded'
                and editor_id in (select id from users where sub = 'data-library-template-updater')
            `);
            await conn.any(sql`
              update projects p
              set draft_table_of_contents_has_changes = false
              where
                p.draft_table_of_contents_has_changes = true and
                p.table_of_contents_last_published is not null and
                exists (
                  select 1 from table_of_contents_items t
                  where t.project_id = p.id
                    and (
                      t.copied_from_data_library_template_id is not null or
                      t.data_library_template_id is not null
                    )
                ) and
                not exists (
                  select 1 from change_logs cl
                  where cl.project_id = p.id
                    and cl.last_at > p.table_of_contents_last_published
                    and cl.field_group != 'layers:published'
                    and cl.net_zero_changes = false
                )
            `);
            // ---- end backfill statements ----

            // published TOC item is now tagged
            const tagged = await conn.oneFirst(
              sql`select copied_from_data_library_template_id from table_of_contents_items where project_id = ${projectId} and stable_id = ${copy.stableId} and is_draft = false`
            );
            expect(tagged).toBe(template.templateId);
            // published layer re-pointed at the shared source
            const repointed = await conn.oneFirst(
              sql`select data_source_id from data_layers where id = ${pubLayerId}`
            );
            expect(repointed).toBe(template.sourceId);
            // updater noise deleted, admin history retained
            const remaining = await conn.any(
              sql`select project_id, editor_id from change_logs where field_group = 'layer:uploaded' and project_id in (${projectId}, ${projectBId})`
            );
            expect(remaining.length).toBe(1);
            expect(remaining[0].project_id).toBe(projectBId);
            expect(remaining[0].editor_id).toBe(adminId);
            // flag cleared for noise-only project A, kept for project B
            expect(
              await conn.oneFirst(
                sql`select draft_table_of_contents_has_changes from projects where id = ${projectId}`
              )
            ).toBe(false);
            expect(
              await conn.oneFirst(
                sql`select draft_table_of_contents_has_changes from projects where id = ${projectBId}`
              )
            ).toBe(true);
          });
        }
      );
    });

    test("backfill fan-out then live replace reaches previously published clones", async () => {
      // End-to-end: after the backfill re-points a published clone to the
      // shared source, a subsequent library update reaches it.
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId) => {
          const template = await createTemplate(conn, adminId);
          const copy = await createLibraryCopy(conn, projectId, template);
          await publish(conn, projectId, adminId);
          const pubLayerId = await publishedLayerId(
            conn,
            projectId,
            copy.stableId
          );
          await resetProjectState(conn, [projectId, template.templateProjectId]);

          const newSourceId = await createReplacementSource(
            conn,
            template.templateProjectId,
            adminId
          );
          await replaceDataSource(
            conn,
            template.layerId,
            newSourceId,
            template.stableId
          );
          expect(await layerSourceId(conn, pubLayerId)).toBe(newSourceId);
          expect(await draftHasChanges(conn, projectId)).toBe(false);
          expect(await changeLogCount(conn, projectId)).toBe(0);
        }
      );
    });
  });

  describe("deleting library copies", () => {
    // The admin UI deletes layers via delete_table_of_contents_branch, which
    // calls _delete_table_of_contents_item. That function refcounts
    // data_layers globally before deleting a source, so a shared library
    // source must survive as long as the template (or any other copy, draft
    // or published) still references it.

    async function addUploadOutput(
      conn: DatabaseTransactionConnectionType,
      sourceId: number,
      projectId: number
    ) {
      const remote = `r2://test-bucket/${id()}.fgb`;
      await asPostgres(conn, () =>
        conn.any(
          sql`insert into data_upload_outputs (data_source_id, project_id, type, url, remote, is_original, size, filename) values (${sourceId}, ${projectId}, 'FlatGeobuf', ${
            "https://uploads.example.com/" + id() + ".fgb"
          }, ${remote}, true, 1234, 'library.fgb')`
        )
      );
      return remote;
    }

    async function deleteBranch(
      conn: DatabaseTransactionConnectionType,
      projectId: number,
      adminId: number,
      itemId: number
    ) {
      await createSession(conn, adminId, true, false, projectId);
      await conn.any(sql`select delete_table_of_contents_branch(${itemId})`);
      await clearSession(conn);
    }

    async function sourceExists(
      conn: DatabaseTransactionConnectionType,
      sourceId: number
    ) {
      return asPostgres(
        conn,
        async () =>
          (await conn.oneFirst(
            sql`select exists(select 1 from data_sources where id = ${sourceId})`
          )) as boolean
      );
    }

    async function outputCount(
      conn: DatabaseTransactionConnectionType,
      sourceId: number
    ) {
      return asPostgres(conn, async () =>
        Number(
          await conn.oneFirst(
            sql`select count(*)::int from data_upload_outputs where data_source_id = ${sourceId}`
          )
        )
      );
    }

    async function remoteQueuedForDeletion(
      conn: DatabaseTransactionConnectionType,
      remote: string
    ) {
      return asPostgres(
        conn,
        async () =>
          (await conn.oneFirst(
            sql`select exists(select 1 from deleted_data_upload_outputs where remote = ${remote})`
          )) as boolean
      );
    }

    // The cleanup graphile-worker task (cleanupDeletedOverlayRecords) runs
    // these two statements to GC orphaned layers/sources. Keep in sync with
    // packages/api/tasks/cleanupDeletedOverlayRecords.ts.
    async function runCleanupWorkerSql(
      conn: DatabaseTransactionConnectionType
    ) {
      await asPostgres(conn, async () => {
        await conn.any(sql`
          delete from data_layers where not exists (
            select id from table_of_contents_items where table_of_contents_items.data_layer_id = data_layers.id
          )
        `);
        await conn.any(sql`
          delete from data_sources where not exists (
            select id from data_layers where data_source_id = data_sources.id
          ) and not exists (
            select data_source_id from archived_data_sources where data_source_id = data_sources.id
          )
        `);
      });
    }

    test("deleting a draft library copy preserves the shared source, outputs, and other projects' copies", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId) => {
          const template = await createTemplate(conn, adminId);
          const remote = await addUploadOutput(
            conn,
            template.sourceId,
            template.templateProjectId
          );
          const copy = await createLibraryCopy(conn, projectId, template);
          // a second consuming project with its own draft copy
          const projectBId = await createProject(conn, adminId, "public");
          const copyB = await createLibraryCopy(conn, projectBId, template);

          await publish(conn, projectId, adminId);
          const pubLayerId = await publishedLayerId(
            conn,
            projectId,
            copy.stableId
          );

          await deleteBranch(conn, projectId, adminId, copy.itemId);

          // the draft copy and its layer are gone
          const draftGone = await asPostgres(conn, () =>
            conn.oneFirst(
              sql`select not exists(select 1 from table_of_contents_items where id = ${copy.itemId}) and not exists(select 1 from data_layers where id = ${copy.layerId})`
            )
          );
          expect(draftGone).toBe(true);

          // the shared source, its outputs, and the remote object are untouched
          expect(await sourceExists(conn, template.sourceId)).toBe(true);
          expect(await outputCount(conn, template.sourceId)).toBe(1);
          expect(await remoteQueuedForDeletion(conn, remote)).toBe(false);

          // the template, project B's copy, and this project's published copy
          // still reference the shared source
          expect(await layerSourceId(conn, template.layerId)).toBe(
            template.sourceId
          );
          expect(await layerSourceId(conn, copyB.layerId)).toBe(
            template.sourceId
          );
          expect(await layerSourceId(conn, pubLayerId)).toBe(template.sourceId);

          // the cleanup worker leaves the shared source alone too
          await runCleanupWorkerSql(conn);
          expect(await sourceExists(conn, template.sourceId)).toBe(true);

          // republishing removes the published copy but not the shared source
          await publish(conn, projectId, adminId);
          const publishedCount = await asPostgres(conn, () =>
            conn.oneFirst(
              sql`select count(*)::int from table_of_contents_items where project_id = ${projectId} and stable_id = ${copy.stableId}`
            )
          );
          expect(Number(publishedCount)).toBe(0);
          expect(await sourceExists(conn, template.sourceId)).toBe(true);
          expect(await outputCount(conn, template.sourceId)).toBe(1);
          expect(await remoteQueuedForDeletion(conn, remote)).toBe(false);
          await runCleanupWorkerSql(conn);
          expect(await sourceExists(conn, template.sourceId)).toBe(true);
        }
      );
    });

    test("deleting the template item while copies exist preserves the shared source", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId) => {
          const template = await createTemplate(conn, adminId);
          const remote = await addUploadOutput(
            conn,
            template.sourceId,
            template.templateProjectId
          );
          const copy = await createLibraryCopy(conn, projectId, template);

          await deleteBranch(
            conn,
            template.templateProjectId,
            adminId,
            template.itemId
          );

          // template TOC item and layer are gone, but the copy still holds a
          // reference so the source and outputs survive
          expect(await sourceExists(conn, template.sourceId)).toBe(true);
          expect(await outputCount(conn, template.sourceId)).toBe(1);
          expect(await remoteQueuedForDeletion(conn, remote)).toBe(false);
          expect(await layerSourceId(conn, copy.layerId)).toBe(
            template.sourceId
          );
          await runCleanupWorkerSql(conn);
          expect(await sourceExists(conn, template.sourceId)).toBe(true);
        }
      );
    });

    test("shared sources are garbage collected only after every reference is gone", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId) => {
          const template = await createTemplate(conn, adminId);
          const remote = await addUploadOutput(
            conn,
            template.sourceId,
            template.templateProjectId
          );
          const copy = await createLibraryCopy(conn, projectId, template);
          await publish(conn, projectId, adminId);

          // remove the draft copy; the published copy still references the source
          await deleteBranch(conn, projectId, adminId, copy.itemId);
          expect(await sourceExists(conn, template.sourceId)).toBe(true);

          // republish removes the published copy; template still references it
          await publish(conn, projectId, adminId);
          expect(await sourceExists(conn, template.sourceId)).toBe(true);

          // deleting the template removes the last reference; the source is
          // deleted, outputs cascade, and the remote is queued for cleanup
          await deleteBranch(
            conn,
            template.templateProjectId,
            adminId,
            template.itemId
          );
          expect(await sourceExists(conn, template.sourceId)).toBe(false);
          expect(await outputCount(conn, template.sourceId)).toBe(0);
          expect(await remoteQueuedForDeletion(conn, remote)).toBe(true);
        }
      );
    });
  });
});
