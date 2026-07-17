import { sql } from "slonik";
import { createPool } from "./pool";
import {
  asPg,
  clearSession,
  createGroup,
  createSession,
  limitToGroup,
  projectTransaction,
} from "./helpers";
import {
  buildProjectAclDoc,
  buildProjectAclDocFromRows,
  extractHostedTilesPath,
  LayerAclRow,
} from "../src/tilesAcl/writeProjectAclDoc";
import { hostedTileUuidsRequiringAuthFromUrls } from "../src/tilesAcl/hostedTileUuidsRequiringAuth";
import { customAlphabet } from "nanoid";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const id = customAlphabet(alphabet, 9);

const pool = createPool("test");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";
const E = "55555555-5555-4555-8555-555555555555";
const F = "66666666-6666-4666-8666-666666666666";
const G = "77777777-7777-4777-8777-777777777777";
const DRAFT = "99999999-9999-4999-8999-999999999999";
const SUPER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function hostedUrl(slug: string, uuid: string) {
  return `https://tiles.seasketch.org/projects/${slug}/public/${uuid}.json`;
}

function row(
  uuid: string,
  ancestorAcls: LayerAclRow["ancestor_acls"],
  slug = "example"
): LayerAclRow {
  return {
    slug,
    url: hostedUrl(slug, uuid),
    ancestor_acls: ancestorAcls,
  };
}

/**
 * Mirror a typical published TOC tree as the SQL query would emit layers.
 *
 * Layout:
 *   A  public root layer
 *   B  admins_only root layer
 *   C  group [4,9] root layer
 *   folderPublic (public)
 *     D  public child
 *   folderPrivate (admins_only)
 *     E  public child  → inherits admins_only
 *     F  group [4] child → admins_only + group
 *   folderGroup (group [20])
 *     G  public child → inherits group [20]
 *   H  not a hosted URL (ignored)
 */
describe("buildProjectAclDocFromRows (tree scenarios)", () => {
  test("extracts the storage slug and UUID from hosted tile URLs", () => {
    expect(
      extractHostedTilesPath(
        `https://tiles.seasketch.org/projects/storage-slug/public/${A}/1/2/3.mvt`
      )
    ).toEqual({ storageSlug: "storage-slug", uuid: A });
  });

  test("public root + private root + public-in-public-folder", () => {
    expect(
      buildProjectAclDocFromRows(
        [
          row(A, []),
          row(B, [{ t: "admins_only", g: [] }]),
          row(D, []), // child of public folder → no non-public ancestors
        ],
        "example",
        1
      )
    ).toEqual({
      v: 1,
      slug: "example",
      public: [A, D],
      rules: [{ t: "admins_only" }],
      protected: {
        [B]: [0],
      },
    });
  });

  test("public layer inside an admins_only folder inherits folder ACL", () => {
    expect(
      buildProjectAclDocFromRows(
        [row(E, [{ t: "admins_only", g: [] }])],
        "example",
        1
      )
    ).toEqual({
      v: 1,
      slug: "example",
      public: [],
      rules: [{ t: "admins_only" }],
      protected: {
        [E]: [0],
      },
    });
  });

  test("public layer inside a group folder inherits group ACL", () => {
    expect(
      buildProjectAclDocFromRows(
        [row(G, [{ t: "group", g: [20] }])],
        "example",
        1
      )
    ).toEqual({
      v: 1,
      slug: "example",
      public: [],
      rules: [{ t: "group", g: [20] }],
      protected: {
        [G]: [0],
      },
    });
  });

  test("layer under private folder with its own group ACL accumulates both rules", () => {
    expect(
      buildProjectAclDocFromRows(
        [
          row(F, [
            { t: "admins_only", g: [] },
            { t: "group", g: [4] },
          ]),
        ],
        "example",
        1
      )
    ).toEqual({
      v: 1,
      slug: "example",
      public: [],
      rules: [{ t: "admins_only" }, { t: "group", g: [4] }],
      protected: {
        [F]: [0, 1],
      },
    });
  });

  test("deduplicates rules and includes every protected ancestor", () => {
    expect(
      buildProjectAclDocFromRows(
        [
          row(A, []),
          row(B, [
            { t: "group", g: [9, 4, 9] },
            { t: "group", g: [20] },
          ]),
          row(C, [{ t: "group", g: [4, 9] }]),
          row(D, [{ t: "admins_only", g: [] }]),
        ],
        "example",
        123
      )
    ).toEqual({
      v: 123,
      slug: "example",
      public: [A],
      rules: [
        { t: "group", g: [4, 9] },
        { t: "group", g: [20] },
        { t: "admins_only" },
      ],
      protected: {
        [B]: [0, 1],
        [C]: [0],
        [D]: [2],
      },
    });
  });

  test("keeps duplicate tile UUIDs protected if any TOC placement is protected", () => {
    expect(
      buildProjectAclDocFromRows(
        [row(A, []), row(A, [{ t: "group", g: [4] }])],
        "example",
        123
      )
    ).toMatchObject({
      public: [],
      rules: [{ t: "group", g: [4] }],
      protected: { [A]: [0] },
    });
  });

  test("ignores non-hosted URLs", () => {
    expect(
      buildProjectAclDocFromRows(
        [
          {
            slug: "example",
            url: "https://example.com/remote.geojson",
            ancestor_acls: [{ t: "admins_only", g: [] }],
          },
          row(A, []),
        ],
        "example",
        1
      )
    ).toEqual({
      v: 1,
      slug: "example",
      public: [A],
      rules: [],
      protected: {},
    });
  });
});

describe("hostedTileUuidsRequiringAuthFromUrls", () => {
  test("excludes published-public UUIDs and data-library paths", () => {
    expect(
      hostedTileUuidsRequiringAuthFromUrls(
        [A],
        [
          hostedUrl("example", A),
          hostedUrl("example", B).replace(".json", ".pmtiles"),
          `https://tiles.seasketch.org/projects/superuser/public/${SUPER}.json`,
          hostedUrl("example", DRAFT).replace(".json", ".fgb"),
          "https://example.com/remote.geojson",
        ]
      )
    ).toEqual([B, DRAFT]);
  });
});

type TocItem = { itemId: number; stableId: string };

async function projectSlug(
  conn: Parameters<typeof createSession>[0],
  projectId: number
): Promise<string> {
  return String(
    await conn.oneFirst(sql`select slug from projects where id = ${projectId}`)
  );
}

async function createFolder(
  conn: Parameters<typeof createSession>[0],
  projectId: number,
  title: string,
  parentStableId?: string
): Promise<TocItem> {
  const stableId = id();
  const itemId = Number(
    parentStableId
      ? await conn.oneFirst(sql`
          insert into table_of_contents_items
            (project_id, title, is_folder, stable_id, parent_stable_id)
          values (${projectId}, ${title}, true, ${stableId}, ${parentStableId})
          returning id
        `)
      : await conn.oneFirst(sql`
          insert into table_of_contents_items
            (project_id, title, is_folder, stable_id)
          values (${projectId}, ${title}, true, ${stableId})
          returning id
        `)
  );
  return { itemId, stableId };
}

async function createHostedLayer(
  conn: Parameters<typeof createSession>[0],
  projectId: number,
  slug: string,
  uuid: string,
  title: string,
  parentStableId?: string
): Promise<TocItem> {
  const url = hostedUrl(slug, uuid);
  const sourceId = Number(
    await conn.oneFirst(sql`
      insert into data_sources
        (project_id, type, url, import_type, byte_length)
      values
        (${projectId}, 'seasketch-mvt', ${url}, 'upload', 1024)
      returning id
    `)
  );
  const layerId = Number(
    await conn.oneFirst(sql`
      insert into data_layers
        (project_id, data_source_id, source_layer, mapbox_gl_styles)
      values
        (${projectId}, ${sourceId}, 'layer0', ${sql.json([
          { type: "fill", paint: { "fill-color": "#00ff00" } },
        ])})
      returning id
    `)
  );
  const stableId = id();
  const itemId = Number(
    parentStableId
      ? await conn.oneFirst(sql`
          insert into table_of_contents_items
            (project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id)
          values
            (${projectId}, ${title}, false, ${layerId}, ${stableId}, ${parentStableId})
          returning id
        `)
      : await conn.oneFirst(sql`
          insert into table_of_contents_items
            (project_id, title, is_folder, data_layer_id, stable_id)
          values
            (${projectId}, ${title}, false, ${layerId}, ${stableId})
          returning id
        `)
  );
  return { itemId, stableId };
}

async function setAdminsOnly(
  conn: Parameters<typeof createSession>[0],
  tocItemId: number
) {
  await conn.any(sql`
    update access_control_lists
    set type = 'admins_only'
    where table_of_contents_item_id = ${tocItemId}
  `);
}

describe("buildProjectAclDoc (published TOC tree)", () => {
  test("builds public / protected entries from nested folder ACLs", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, _users) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = await projectSlug(conn, projectId);
        const groupId = await createGroup(conn, projectId, "Researchers", [
          adminId,
        ]);

        // Root layers
        await createHostedLayer(conn, projectId, slug, A, "Public root");
        const adminsRoot = await createHostedLayer(
          conn,
          projectId,
          slug,
          B,
          "Admins root"
        );
        await setAdminsOnly(conn, adminsRoot.itemId);
        const groupRoot = await createHostedLayer(
          conn,
          projectId,
          slug,
          C,
          "Group root"
        );
        await limitToGroup(
          conn,
          "table_of_contents_item_id",
          groupRoot.itemId,
          groupId
        );

        // Public folder → public child
        const folderPublic = await createFolder(
          conn,
          projectId,
          "Public folder"
        );
        await createHostedLayer(
          conn,
          projectId,
          slug,
          D,
          "Child in public folder",
          folderPublic.stableId
        );

        // Admins-only folder → public child + group child
        const folderPrivate = await createFolder(
          conn,
          projectId,
          "Private folder"
        );
        await setAdminsOnly(conn, folderPrivate.itemId);
        await createHostedLayer(
          conn,
          projectId,
          slug,
          E,
          "Public child in private folder",
          folderPrivate.stableId
        );
        const groupInPrivate = await createHostedLayer(
          conn,
          projectId,
          slug,
          F,
          "Group child in private folder",
          folderPrivate.stableId
        );
        await limitToGroup(
          conn,
          "table_of_contents_item_id",
          groupInPrivate.itemId,
          groupId
        );

        // Group folder → public child
        const folderGroup = await createFolder(conn, projectId, "Group folder");
        await limitToGroup(
          conn,
          "table_of_contents_item_id",
          folderGroup.itemId,
          groupId
        );
        await createHostedLayer(
          conn,
          projectId,
          slug,
          G,
          "Public child in group folder",
          folderGroup.stableId
        );

        // Non-hosted source should be ignored by ACL builder
        const remoteSourceId = Number(
          await conn.oneFirst(sql`
            insert into data_sources (project_id, type, url)
            values (${projectId}, 'geojson', 'https://example.com/remote.geojson')
            returning id
          `)
        );
        const remoteLayerId = Number(
          await conn.oneFirst(sql`
            insert into data_layers
              (project_id, data_source_id, mapbox_gl_styles)
            values
              (${projectId}, ${remoteSourceId}, ${sql.json([
                { type: "fill", paint: { "fill-color": "#0000ff" } },
              ])})
            returning id
          `)
        );
        await conn.oneFirst(sql`
          insert into table_of_contents_items
            (project_id, title, is_folder, data_layer_id, stable_id)
          values
            (${projectId}, 'Remote geojson', false, ${remoteLayerId}, ${id()})
          returning id
        `);

        await conn.any(sql`select publish_table_of_contents(${projectId})`);

        // buildProjectAclDoc must see committed-looking published rows (same txn)
        // and should bypass RLS pitfalls as postgres after clearing session.
        await clearSession(conn);

        const doc = await buildProjectAclDoc(
          asPg(conn) as any,
          projectId
        );

        expect(doc.slug).toBe(slug);
        expect(doc.public.sort()).toEqual([A, D].sort());

        // Every protected UUID must be present; rule payloads matter more than
        // absolute rule indexes (those depend on encounter order).
        const ruleAt = (uuid: string) =>
          (doc.protected[uuid] || []).map((i) => doc.rules[i]);

        expect(ruleAt(B)).toEqual([{ t: "admins_only" }]);
        expect(ruleAt(C)).toEqual([{ t: "group", g: [groupId] }]);
        expect(ruleAt(E)).toEqual([{ t: "admins_only" }]);
        expect(ruleAt(G)).toEqual([{ t: "group", g: [groupId] }]);

        // Child under private folder + its own group ACL → both rules
        expect(ruleAt(F).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual(
          [{ t: "admins_only" }, { t: "group", g: [groupId] }].sort((a, b) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b))
          )
        );

        // Non-hosted ignored; F is protected not public
        expect(doc.public).not.toContain(F);
        expect(Object.keys(doc.protected).sort()).toEqual(
          [B, C, E, F, G].sort()
        );
      }
    );
  });

  test("returns empty public/protected for a project with no published layers", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = await projectSlug(conn, projectId);
        // draft-only layer should not appear until published
        await createHostedLayer(conn, projectId, slug, A, "Draft only");
        await clearSession(conn);

        const doc = await buildProjectAclDoc(asPg(conn) as any, projectId);
        expect(doc).toMatchObject({
          slug,
          public: [],
          rules: [],
          protected: {},
        });
      }
    );
  });
});
