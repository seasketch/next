/// <reference types="jest" />
import fs from "fs";
import { sql, DatabaseTransactionConnectionType } from "slonik";
import { createPool } from "./pool";
import {
  createProject,
  createSession,
  createUser,
  projectTransaction,
} from "./helpers";
// @ts-ignore
import nanoid from "nanoid";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const id = nanoid.customAlphabet(alphabet, 9);

const pool = createPool("test");

function polygonGeostats() {
  return {
    layers: [
      {
        layer: "layer",
        count: 4,
        geometry: "Polygon",
        hasZ: false,
        attributeCount: 0,
        attributes: [],
      },
    ],
  };
}

/**
 * A data-library source shared by the template project and a consumer project,
 * with a FlatGeobuf output owned by the library project. Publishing both
 * projects leaves several layers, and more than one published table-of-contents
 * row, on that single source.
 */
async function shareLibraryPolygon(
  conn: DatabaseTransactionConnectionType,
  consumerProjectId: number,
  consumerAdminId: number,
  libraryAccess: "admins_only" | "public"
) {
  const libraryOwnerId = await createUser(conn);
  const libraryProjectId = await createProject(
    conn,
    libraryOwnerId,
    "admins_only"
  );
  const templateId = `TEMPLATE_${id()}`;

  await conn.any(sql`set role postgres`);
  if (libraryAccess === "public") {
    await conn.any(sql`
      update projects
      set access_control = 'public', is_listed = true
      where id = ${libraryProjectId}
    `);
  }

  const sourceId = Number(
    await conn.oneFirst(sql`
      insert into data_sources (
        project_id, type, url, import_type, byte_length, geostats, data_library_template_id
      ) values (
        ${libraryProjectId},
        'seasketch-vector',
        'https://example.com/library.json',
        'upload',
        20,
        ${sql.json(polygonGeostats())},
        ${templateId}
      )
      returning id
    `)
  );

  async function addLayer(projectId: number, title: string, template: boolean) {
    const layerId = Number(
      await conn.oneFirst(sql`
        insert into data_layers (project_id, data_source_id, mapbox_gl_styles)
        values (
          ${projectId},
          ${sourceId},
          ${sql.json([{ type: "fill", paint: { "fill-color": "#00ff00" } }])}
        )
        returning id
      `)
    );
    await conn.any(sql`
      insert into table_of_contents_items (
        project_id,
        title,
        is_folder,
        data_layer_id,
        stable_id,
        data_library_template_id,
        copied_from_data_library_template_id
      ) values (
        ${projectId},
        ${title},
        false,
        ${layerId},
        ${id()},
        ${template ? templateId : null},
        ${template ? null : templateId}
      )
    `);
  }

  await addLayer(libraryProjectId, "Library template", true);
  await addLayer(consumerProjectId, "Library copy", false);

  await conn.any(sql`
    insert into data_upload_outputs (
      data_source_id, project_id, type, url, remote, is_original, size, filename
    ) values (
      ${sourceId},
      ${libraryProjectId},
      'FlatGeobuf',
      ${"https://uploads.example.com/" + id() + ".fgb"},
      ${"r2://test-bucket/" + id() + ".fgb"},
      false,
      100,
      'library.fgb'
    )
  `);

  await createSession(conn, libraryOwnerId, true, false, libraryProjectId);
  await conn.any(sql`select publish_table_of_contents(${libraryProjectId})`);
  await createSession(conn, consumerAdminId, true, false, consumerProjectId);
  await conn.any(sql`select publish_table_of_contents(${consumerProjectId})`);

  return { libraryOwnerId, libraryProjectId, sourceId, templateId };
}

async function outputCount(
  conn: DatabaseTransactionConnectionType,
  sourceId: number
) {
  return Number(
    await conn.oneFirst(sql`
      select count(*)::int
      from data_upload_outputs
      where data_source_id = ${sourceId}
    `)
  );
}

async function polygonTitles(
  conn: DatabaseTransactionConnectionType,
  projectId: number
) {
  const rows = await conn.any(sql`
    select toc.title
    from projects p,
    lateral projects_polygon_overlays_for_geography(p) toc
    where p.id = ${projectId}
  `);
  return rows.map((row) => String(row.title));
}

describe("shared data-library sources under admin RLS", () => {
  test("a project admin can read library outputs and build a geography when several projects have published the source", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        const shared = await shareLibraryPolygon(
          conn,
          projectId,
          adminId,
          "public"
        );
        await createSession(conn, adminId, true, false, projectId);

        // The library project is public, so the end-user branch of the output
        // policy runs. It used to be a scalar subquery and raised
        // "more than one row returned by a subquery used as an expression".
        expect(await outputCount(conn, shared.sourceId)).toBeGreaterThan(0);
        expect(await polygonTitles(conn, projectId)).toContain("Library copy");

        // Publishing both projects leaves no unpublished edits. The query must
        // still return, rather than raise, for an admin who is not a superuser.
        const logs = await conn.any(sql`
          select cl.id
          from projects p,
          lateral projects_change_logs_since_last_publish(p) cl
          where p.id = ${projectId}
        `);
        expect(Array.isArray(logs)).toBe(true);

        const draftSources = await conn.any(sql`
          select ds.data_library_template_id
          from projects p
          join lateral projects_draft_table_of_contents_items(p) toc on true
          join data_layers dl on dl.id = toc.data_layer_id
          join data_sources ds on ds.id = dl.data_source_id
          where p.id = ${projectId}
        `);
        expect(
          draftSources.map((row) => row.data_library_template_id)
        ).toContain(shared.templateId);

        await conn.any(sql`select publish_table_of_contents(${projectId})`);
      }
    );
  });

  test("a project admin can read library outputs when the library project is private", async () => {
    await projectTransaction(
      pool,
      "admins_only",
      async (conn, projectId, adminId) => {
        const shared = await shareLibraryPolygon(
          conn,
          projectId,
          adminId,
          "admins_only"
        );
        await createSession(conn, adminId, true, false, projectId);

        expect(await outputCount(conn, shared.sourceId)).toBeGreaterThan(0);
        expect(await polygonTitles(conn, projectId)).toEqual(["Library copy"]);

        // Same rows for a superuser, who short-circuits session_is_admin.
        await createSession(conn, adminId, true, true, projectId);
        expect(await outputCount(conn, shared.sourceId)).toBeGreaterThan(0);
        expect(await polygonTitles(conn, projectId)).toEqual(["Library copy"]);
      }
    );
  });

  test("an admin lookup of a widely shared source is an index probe", async () => {
    await projectTransaction(
      pool,
      "admins_only",
      async (conn, projectId, adminId) => {
        const shared = await shareLibraryPolygon(
          conn,
          projectId,
          adminId,
          "admins_only"
        );
        await conn.any(sql`set role postgres`);
        await conn.any(sql`
          insert into data_layers (project_id, data_source_id, mapbox_gl_styles)
          select ${shared.libraryProjectId}, ${shared.sourceId}, '[]'::json
          from generate_series(1, 5000)
        `);
        const probe = await conn.any(sql`
          explain (analyze, buffers, format text)
          select exists (
            select 1
            from data_layers dl
            where dl.project_id = ${projectId}
              and dl.data_source_id = ${shared.sourceId}
          )
        `);
        const probePlan = probe.map((row) => String(row["QUERY PLAN"])).join("\n");

        await createSession(conn, adminId, true, false, projectId);
        const adminRead = await conn.any(sql`
          explain (analyze, format text)
          select id
          from data_upload_outputs
          where data_source_id = ${shared.sourceId}
        `);
        const adminPlan = adminRead
          .map((row) => String(row["QUERY PLAN"]))
          .join("\n");

        await createSession(conn, adminId, true, true, projectId);
        const superuserRead = await conn.any(sql`
          explain (analyze, format text)
          select id
          from data_upload_outputs
          where data_source_id = ${shared.sourceId}
        `);
        const superuserPlan = superuserRead
          .map((row) => String(row["QUERY PLAN"]))
          .join("\n");

        fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
        fs.writeFileSync(
          "/opt/cursor/artifacts/admin-vs-superuser-plans.txt",
          [
            "Admin fast-path probe (the lookup session_admin_uses_data_source runs):",
            probePlan,
            "",
            "Admin read of data_upload_outputs:",
            adminPlan,
            "",
            "Superuser read of data_upload_outputs:",
            superuserPlan,
            "",
          ].join("\n")
        );

        expect(probePlan).toMatch(
          /Index (Only )?Scan using data_layers_project_id_data_source_id_idx/
        );
        expect(probePlan).not.toMatch(/Seq Scan on data_layers/);
        const adminMs = Number(
          /Execution Time: ([0-9.]+) ms/.exec(adminPlan)?.[1]
        );
        const superuserMs = Number(
          /Execution Time: ([0-9.]+) ms/.exec(superuserPlan)?.[1]
        );
        // 5,000 other layers share the source. The admin read stays an index
        // probe on the current project, in the same range as the superuser
        // read that never leaves session_is_admin().
        expect(adminMs).toBeLessThan(50);
        expect(superuserMs).toBeLessThan(50);
        // The end-user ACL walk is planned, then skipped. Admin access was
        // decided by session_admin_uses_data_source.
        expect(adminPlan).toMatch(/SubPlan 3[\s\S]*\(never executed\)/);
      }
    );
  });

  test("an admin of an unrelated project cannot read those outputs", async () => {
    await projectTransaction(
      pool,
      "admins_only",
      async (conn, projectId, adminId, [otherUserId]) => {
        const shared = await shareLibraryPolygon(
          conn,
          projectId,
          adminId,
          "admins_only"
        );
        const otherProjectId = await createProject(conn, otherUserId, "public");
        await createSession(conn, otherUserId, true, false, otherProjectId);
        expect(await outputCount(conn, shared.sourceId)).toBe(0);
      }
    );
  });

  test("updating a source used by several published layers does not raise", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const sourceId = Number(
          await conn.oneFirst(sql`
            insert into data_sources (
              project_id, type, url, import_type, byte_length
            ) values (
              ${projectId},
              'seasketch-vector',
              'https://example.com/sublayers.json',
              'upload',
              10
            )
            returning id
          `)
        );
        for (const title of ["Sublayer A", "Sublayer B"]) {
          const layerId = Number(
            await conn.oneFirst(sql`
              insert into data_layers (project_id, data_source_id, mapbox_gl_styles)
              values (
                ${projectId},
                ${sourceId},
                ${sql.json([{ type: "fill" }])}
              )
              returning id
            `)
          );
          await conn.any(sql`
            insert into table_of_contents_items (
              project_id, title, is_folder, data_layer_id, stable_id
            ) values (
              ${projectId}, ${title}, false, ${layerId}, ${id()}
            )
          `);
        }
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        await createSession(conn, adminId, true, false, projectId);

        // Publish copies the shared source once and points every published
        // layer at that copy. The copy now has two published rows.
        const publishedSourceId = Number(
          await conn.oneFirst(sql`
            select pl.data_source_id
            from table_of_contents_items toc
            join data_layers pl on pl.id = toc.data_layer_id
            where toc.project_id = ${projectId}
              and toc.is_draft = false
              and toc.title = 'Sublayer A'
          `)
        );
        const updated = await conn.any(sql`
          update data_sources
          set attribution = 'shared'
          where id = ${publishedSourceId}
          returning id
        `);
        // Published layers lock the source. The update is refused without the
        // scalar-subquery error that multiple published rows used to raise.
        expect(updated).toHaveLength(0);
        await conn.any(sql`set role postgres`);
        const attribution = await conn.oneFirst(sql`
          select attribution from data_sources where id = ${publishedSourceId}
        `);
        expect(attribution).toBeNull();
      }
    );
  });
});
