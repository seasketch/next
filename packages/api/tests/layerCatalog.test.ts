import express from "express";
import http, { Server } from "http";
import { AddressInfo } from "net";
import { randomUUID } from "crypto";
import { PgLayerCatalogStore } from "../src/layerCatalog/pgStore";
import { createPgPool } from "./pool";
import { layerIsOpenToAnyone, passesLayerAccess } from "../src/layerCatalog/access";
import {
  CatalogLayer,
  CatalogOutput,
  catalogColumns,
  catalogCsv,
  catalogRecords,
  whereHosted,
} from "../src/layerCatalog/columns";
import {
  parseMetadataFormat,
  renderMetadata,
} from "../src/layerCatalog/metadataDocument";
import { layersInOverlayOrder } from "../src/layerCatalog/order";
import { registerLayerCatalog } from "../src/layerCatalog/router";
import {
  AccessListRecord,
  LayerCatalogStore,
  LayerResourceRecord,
  RawTocItem,
} from "../src/layerCatalog/types";

const HEADERS = [
  "Layer name",
  "Folder",
  "Stable ID",
  "Access type",
  "Access groups",
  "Where hosted",
  "Service host",
  "Source type",
  "Service URL",
  "Sublayer",
  "Added at",
  "Added by",
  "Spatial type",
  "Feature count",
  "Raster type",
  "Source CRS",
  "Uploaded file type",
  "Uploaded file",
  "Uploaded file URL",
  "Tile service URL",
  "Normalized file",
  "Normalized file URL",
  "Style URL",
  "Geostats URL",
  "Has metadata",
  "Metadata URL",
  "Metadata file URL",
  "Downloadable",
  "Attribution",
];

function layer(overrides: Partial<CatalogLayer> = {}): CatalogLayer {
  return {
    title: "Kelp",
    folder: "Habitat / Nearshore",
    stableId: "kelpLayer",
    accessType: "public",
    accessGroupNames: [],
    sourceType: "seasketch-mvt",
    sublayerType: null,
    sublayer: null,
    sourceUrl: "https://tiles.seasketch.org/kelp",
    sourceLayer: "kelp",
    createdAt: "2024-05-12T18:04:00.123Z",
    authorName: "Jane Doe",
    authorEmail: "jane@example.gov",
    geostats: {
      layers: [{ layer: "kelp", geometry: "MultiPolygon", count: 12480 }],
    },
    attribution: "DFO",
    enableDownload: true,
    hasMetadata: true,
    uploadedSourceFilename: "kelp.shp",
    outputs: [
      {
        type: "ZippedShapefile",
        url: "https://uploads.example/kelp.zip",
        isOriginal: true,
        originalFilename: "kelp_2024.zip",
        epsg: 3005,
      },
      {
        type: "FlatGeobuf",
        url: "https://uploads.example/kelp.fgb",
        isOriginal: false,
        originalFilename: "kelp_2024.zip",
        epsg: 4326,
      },
      {
        type: "XMLMetadata",
        url: "https://uploads.example/kelp.xml",
        isOriginal: false,
        originalFilename: "kelp.xml",
        epsg: null,
      },
    ],
    styleUrl: "https://api.example/layers/demo/kelpLayer/style",
    geostatsUrl: "https://api.example/layers/demo/kelpLayer/geostats",
    metadataUrl: "https://api.example/layers/demo/kelpLayer/metadata",
    ...overrides,
  };
}

function record(overrides: Partial<CatalogLayer> = {}) {
  return catalogRecords([layer(overrides)])[0];
}

describe("layer catalog columns", () => {
  test("keeps the agreed header order", () => {
    expect(catalogColumns.map((column) => column.header)).toEqual(HEADERS);
  });

  test("describes a hosted vector layer", () => {
    const row = record();
    expect(row["Layer name"]).toBe("Kelp");
    expect(row["Folder"]).toBe("Habitat / Nearshore");
    expect(row["Stable ID"]).toBe("kelpLayer");
    expect(row["Where hosted"]).toBe("SeaSketch");
    expect(row["Service host"]).toBe("");
    expect(row["Service URL"]).toBe("");
    expect(row["Source type"]).toBe("Vector Tiles hosted on SeaSketch");
    expect(row["Added at"]).toBe("2024-05-12T18:04:00Z");
    expect(row["Added by"]).toBe("Jane Doe <jane@example.gov>");
    expect(row["Spatial type"]).toBe("Polygon");
    expect(row["Feature count"]).toBe("12480");
    expect(row["Raster type"]).toBe("");
    expect(row["Source CRS"]).toBe("EPSG:3005");
    expect(row["Uploaded file type"]).toBe("Shapefile");
    expect(row["Uploaded file"]).toBe("kelp_2024.zip");
    expect(row["Uploaded file URL"]).toBe("https://uploads.example/kelp.zip");
    expect(row["Tile service URL"]).toBe("https://tiles.seasketch.org/kelp.json");
    expect(row["Normalized file"]).toBe("FlatGeobuf");
    expect(row["Normalized file URL"]).toBe("https://uploads.example/kelp.fgb");
    expect(row["Has metadata"]).toBe("true");
    expect(row["Metadata file URL"]).toBe("https://uploads.example/kelp.xml");
    expect(row["Downloadable"]).toBe("Yes");
    expect(row["Attribution"]).toBe("DFO");
  });

  test("classifies ArcGIS Online, Enterprise, and other remote sources", () => {
    expect(
      whereHosted({
        sourceType: "arcgis-vector",
        sourceUrl: "https://services.arcgis.com/abc/FeatureServer/0",
      })
    ).toBe("ArcGIS Online");
    expect(
      whereHosted({
        sourceType: "arcgis-dynamic-mapserver",
        sourceUrl: "https://gis.example.gov/arcgis/rest/services/Habitat/MapServer",
      })
    ).toBe("ArcGIS Enterprise");
    expect(
      whereHosted({
        sourceType: "vector",
        sourceUrl: "https://tiles.example.gov/kelp.json",
      })
    ).toBe("Other");

    const enterprise = record({
      sourceType: "arcgis-dynamic-mapserver",
      sublayerType: "vector",
      sublayer: "3",
      sourceUrl: "https://gis.example.gov/arcgis/rest/services/Habitat/MapServer",
      geostats: null,
      outputs: [],
    });
    expect(enterprise["Service host"]).toBe("gis.example.gov");
    expect(enterprise["Service URL"]).toBe(
      "https://gis.example.gov/arcgis/rest/services/Habitat/MapServer/3"
    );
    expect(enterprise["Sublayer"]).toBe("3");
    expect(enterprise["Source type"]).toBe("ArcGIS Mapserver Sublayer (vector)");
    expect(enterprise["Uploaded file type"]).toBe("");
  });

  test("lists group names only when access type is group", () => {
    expect(
      record({ accessType: "group", accessGroupNames: ["Advisors", "Science team"] })[
        "Access groups"
      ]
    ).toBe("Advisors, Science team");
    expect(
      record({ accessType: "public", accessGroupNames: ["Science team"] })["Access groups"]
    ).toBe("");
    expect(record({ accessType: "admins_only" })["Access type"]).toBe("admins_only");
  });

  test("describes a raster and a legacy geojson upload", () => {
    const raster = record({
      sourceType: "seasketch-raster",
      sourceUrl: "https://tiles.seasketch.org/bathy",
      geostats: {
        presentation: 2,
        bands: [{}, {}, {}, {}],
      },
      outputs: [
        {
          type: "GeoTIFF",
          url: "https://uploads.example/bathy.tif",
          isOriginal: true,
          originalFilename: "bathy.tif",
          epsg: 4326,
        },
        {
          type: "GeoTIFF",
          url: "https://uploads.example/bathy-normalized.tif",
          isOriginal: false,
          originalFilename: null,
          epsg: 4326,
        },
      ] as CatalogOutput[],
    });
    expect(raster["Spatial type"]).toBe("Raster");
    expect(raster["Feature count"]).toBe("");
    expect(raster["Raster type"]).toBe("4 bands, RGBA");
    expect(raster["Normalized file"]).toBe("GeoTIFF");
    expect(raster["Tile service URL"]).toBe("https://tiles.seasketch.org/bathy.json");

    const legacy = record({
      sourceType: "seasketch-vector",
      sourceUrl: "https://uploads.example/old.json",
      uploadedSourceFilename: "old.geojson",
      outputs: [],
      geostats: { layers: [{ geometry: "Point", count: 2 }] },
    });
    expect(legacy["Uploaded file type"]).toBe("GeoJSON");
    expect(legacy["Uploaded file URL"]).toBe("https://uploads.example/old.json");
    expect(legacy["Uploaded file"]).toBe("old.geojson");
    expect(legacy["Spatial type"]).toBe("Point");
    expect(legacy["Added by"]).toBe("Jane Doe <jane@example.gov>");
  });

  test("quotes csv cells and neutralizes formulas", () => {
    const csv = catalogCsv([
      layer({ title: 'Kelp, "north"', attribution: "=1+1" }),
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Kelp, ""north"""');
    expect(csv).toContain("'=1+1");
    expect(csv.startsWith("\uFEFFLayer name,Folder,")).toBe(true);
  });

  test("walks the overlay list depth-first", () => {
    const ordered = layersInOverlayOrder([
      { stableId: "b", parentStableId: null, title: "B", isFolder: true, sortIndex: 1 },
      { stableId: "a", parentStableId: null, title: "A", isFolder: true, sortIndex: 0 },
      { stableId: "a2", parentStableId: "a", title: "Second", isFolder: false, sortIndex: 1 },
      { stableId: "a1", parentStableId: "a", title: "First", isFolder: false, sortIndex: 0 },
      { stableId: "root", parentStableId: null, title: "Root", isFolder: false, sortIndex: 2 },
    ]);
    expect(ordered.map((item) => [item.title, item.folder])).toEqual([
      ["First", "A"],
      ["Second", "A"],
      ["Root", ""],
    ]);
  });
});

describe("layer access", () => {
  test("requires every list on the path", () => {
    expect(passesLayerAccess({ isProjectAdmin: false, lists: [] })).toBe(true);
    expect(
      passesLayerAccess({
        isProjectAdmin: false,
        lists: [{ type: "public", member: false }],
      })
    ).toBe(true);
    expect(
      passesLayerAccess({
        isProjectAdmin: false,
        lists: [{ type: "group", member: true }],
      })
    ).toBe(true);
    expect(
      passesLayerAccess({
        isProjectAdmin: false,
        lists: [
          { type: "group", member: true },
          { type: "group", member: false },
        ],
      })
    ).toBe(false);
    expect(
      passesLayerAccess({
        isProjectAdmin: false,
        lists: [{ type: "admins_only", member: false }],
      })
    ).toBe(false);
    expect(
      passesLayerAccess({
        isProjectAdmin: true,
        lists: [{ type: "admins_only", member: false }],
      })
    ).toBe(true);
  });

  test("opens a layer only when the project and the path are public", () => {
    expect(
      layerIsOpenToAnyone({ projectAccess: "public", lists: [{ type: "public" }] })
    ).toBe(true);
    expect(layerIsOpenToAnyone({ projectAccess: "public", lists: [] })).toBe(true);
    expect(
      layerIsOpenToAnyone({
        projectAccess: "public",
        lists: [{ type: "public" }, { type: "group" }],
      })
    ).toBe(false);
    expect(
      layerIsOpenToAnyone({ projectAccess: "invite_only", lists: [{ type: "public" }] })
    ).toBe(false);
    expect(
      layerIsOpenToAnyone({ projectAccess: "admins_only", lists: [{ type: "public" }] })
    ).toBe(false);
  });
});

describe("metadata documents", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Kelp" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "See " },
          {
            type: "text",
            text: "the survey",
            marks: [{ type: "link", attrs: { href: "https://example.gov/kelp" } }],
          },
          { type: "text", text: "." },
        ],
      },
    ],
  };

  test("selects a format", () => {
    expect(parseMetadataFormat(undefined)).toBe("json");
    expect(parseMetadataFormat("markdown")).toBe("md");
    expect(parseMetadataFormat("HTML")).toBe("html");
    expect(parseMetadataFormat("pdf")).toBeNull();
  });

  test("renders html, text, and markdown", () => {
    expect(renderMetadata(doc, "html")).toContain("<h1>Kelp</h1>");
    expect(renderMetadata(doc, "html")).toContain(
      '<a href="https://example.gov/kelp">the survey</a>'
    );
    expect(renderMetadata(doc, "txt")).toContain("Kelp");
    expect(renderMetadata(doc, "txt")).toContain("the survey (https://example.gov/kelp)");
    expect(renderMetadata(doc, "md")).toContain("# Kelp");
    expect(renderMetadata(doc, "md")).toContain("[the survey](https://example.gov/kelp)");
    expect(JSON.parse(renderMetadata(doc, "json"))).toEqual(doc);
  });
});

describe("layer catalog routes", () => {
  let server: Server;
  let base: string;

  beforeAll((done) => {
    const store = new MemoryStore();
    const app = express();
    const router = express.Router();
    registerLayerCatalog(router, {
      store,
      authenticate: async (req) => {
        const header = req.header("authorization") || "";
        if (header === "Bearer admin") {
          return { id: 1, superuser: false, emailVerified: true };
        }
        if (header === "Bearer member") {
          return { id: 5, superuser: false, emailVerified: true };
        }
        if (header === "Bearer other") {
          return { id: 9, superuser: false, emailVerified: true };
        }
        return null;
      },
    });
    app.use("/layers", router);
    server = app.listen(0, () => {
      const address = server.address() as AddressInfo;
      base = `http://127.0.0.1:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  test("requires a project admin for the spreadsheet", async () => {
    expect((await request(`${base}/layers/demo.csv`)).status).toBe(401);
    expect(
      (await request(`${base}/layers/demo.csv`, { authorization: "Bearer other" })).status
    ).toBe(403);
    expect((await request(`${base}/layers/missing.csv`)).status).toBe(404);

    const response = await request(`${base}/layers/demo.csv`, {
      authorization: "Bearer admin",
    });
    expect(response.status).toBe(200);
    expect(String(response.headers["content-type"])).toContain("text/csv");
    const csv = response.body;
    expect(csv).toContain("Layer name");
    expect(csv).toContain("Kelp");
    expect(csv).toContain("Habitat");
    expect(csv).toContain("ArcGIS Online");
    expect(csv).toContain("services.arcgis.com");
    expect(csv).toContain("/layers/demo/kelpLayer/style");
    expect(csv).toContain("Secret");
  });

  test("returns the same rows as json", async () => {
    const response = await request(`${base}/layers/demo.json`, {
      authorization: "Bearer admin",
    });
    const rows = JSON.parse(response.body);
    expect(rows).toHaveLength(2);
    expect(rows[0]["Stable ID"]).toBe("kelpLayer");
    expect(rows[0]["Access type"]).toBe("group");
    expect(rows[0]["Access groups"]).toBe("Science team");
    expect(Object.keys(rows[0])).toEqual(HEADERS);
  });

  test("serves style, geostats, and metadata with access checks", async () => {
    const anonPublic = await request(`${base}/layers/demo/portsLayer/style`);
    expect(anonPublic.status).toBe(200);
    expect(JSON.parse(anonPublic.body)).toEqual({ published: "ports" });

    expect((await request(`${base}/layers/demo/secretLayer/style`)).status).toBe(401);
    expect(
      (
        await request(`${base}/layers/demo/secretLayer/style`, {
          authorization: "Bearer other",
        })
      ).status
    ).toBe(403);

    const member = await request(`${base}/layers/demo/kelpLayer/style`, {
      authorization: "Bearer member",
    });
    expect(member.status).toBe(200);
    expect(JSON.parse(member.body)).toEqual({ published: "kelp" });

    const admin = await request(`${base}/layers/demo/kelpLayer/geostats`, {
      authorization: "Bearer admin",
    });
    expect(JSON.parse(admin.body)).toEqual({ draft: true });

    const metadata = await request(`${base}/layers/demo/portsLayer/metadata?format=txt`);
    expect(metadata.status).toBe(204);
    expect(metadata.body).toBe("");

    const stored = await request(`${base}/layers/demo/kelpLayer/metadata?format=json`, {
      authorization: "Bearer admin",
    });
    expect(stored.status).toBe(200);
    expect(JSON.parse(stored.body)).toEqual({ type: "doc", content: [] });

    expect(
      (await request(`${base}/layers/demo/kelpLayer/metadata?format=pdf`, {
        authorization: "Bearer admin",
      })).status
    ).toBe(400);
    expect((await request(`${base}/layers/demo/nope/style`)).status).toBe(404);

    const closedAnon = await request(`${base}/layers/closed/openLayer/style`);
    expect(closedAnon.status).toBe(401);
    const closedUser = await request(`${base}/layers/closed/openLayer/style`, {
      authorization: "Bearer other",
    });
    expect(closedUser.status).toBe(200);
    expect(JSON.parse(closedUser.body)).toEqual({ published: "open" });
    const closedApiKey = await request(`${base}/layers/closed/openLayer/geostats`, {
      authorization: "Bearer geoprocessing-key",
    });
    expect(closedApiKey.status).toBe(401);
  });
});

describe("layer catalog sql", () => {
  const pool = createPgPool("test");

  afterAll(() => pool.end());

  test("loads a draft layer with its folder, group, and upload", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const slug = `cat${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const userId = (
        await client.query(
          `select get_or_create_user_by_sub($1, $2) as id`,
          [`test:${slug}`, `${slug}@example.com`]
        )
      ).rows[0].id;
      await client.query(
        `select set_config('session.user_id', $1, true),
                set_config('session.email_verified', 'true', true),
                set_config('session.canonical_email', $2, true)`,
        [String(userId), `${slug}@example.com`]
      );
      await client.query(
        `update user_profiles set fullname = 'Jane Doe' where user_id = $1`,
        [userId]
      );
      const projectId = (
        await client.query(`select id from create_project($1, $1)`, [slug])
      ).rows[0].id;
      const sourceId = (
        await client.query(
          `insert into data_sources (
             project_id, type, url, created_by, uploaded_source_filename, import_type, geostats
           ) values (
             $1, 'seasketch-mvt', 'https://tiles.example/kelp', $2, 'kelp.shp', 'upload',
             '{"layers":[{"geometry":"Polygon","count":12}]}'::jsonb
           ) returning id`,
          [projectId, userId]
        )
      ).rows[0].id;
      await client.query(
        `insert into data_upload_outputs (
           data_source_id, project_id, type, url, remote, is_original, size, filename, original_filename, epsg
         ) values
           ($1, $2, 'ZippedShapefile', 'https://uploads.example/kelp.zip', 'r2://kelp.zip', true, 10, 'kelp.zip', 'kelp_2024.zip', 3005),
           ($1, $2, 'FlatGeobuf', 'https://uploads.example/kelp.fgb', 'r2://kelp.fgb', false, 20, 'kelp.fgb', 'kelp_2024.zip', 4326)`,
        [sourceId, projectId]
      );
      const layerId = (
        await client.query(
          `insert into data_layers (project_id, data_source_id, mapbox_gl_styles)
           values ($1, $2, '{"layers":[]}'::jsonb) returning id`,
          [projectId, sourceId]
        )
      ).rows[0].id;
      const folderId = (
        await client.query(
          `insert into table_of_contents_items (project_id, title, is_folder, stable_id)
           values ($1, 'Habitat', true, 'habitat01') returning stable_id`,
          [projectId]
        )
      ).rows[0].stable_id;
      const itemId = (
        await client.query(
          `insert into table_of_contents_items (
             project_id, title, is_folder, stable_id, parent_stable_id, data_layer_id, metadata
           ) values ($1, 'Kelp', false, 'kelpLayer', $2, $3, '{"type":"doc"}'::jsonb)
           returning id`,
          [projectId, folderId, layerId]
        )
      ).rows[0].id;
      const aclId = (
        await client.query(
          `update access_control_lists set type = 'group'
           where table_of_contents_item_id = $1
           returning id`,
          [itemId]
        )
      ).rows[0].id;
      const groupId = (
        await client.query(
          `insert into project_groups (project_id, name) values ($1, 'Science team') returning id`,
          [projectId]
        )
      ).rows[0].id;
      await client.query(`select add_group_to_acl($1, $2)`, [aclId, groupId]);

      const store = new PgLayerCatalogStore(client);
      const items = await store.draftItems(projectId);
      const [kelp] = layersInOverlayOrder(items).filter((item) => !item.isFolder && item.stableId === "kelpLayer");
      const row = catalogRecords([
        {
          ...kelp,
          styleUrl: "style",
          geostatsUrl: "geostats",
          metadataUrl: "metadata",
        },
      ])[0];
      expect(row["Layer name"]).toBe("Kelp");
      expect(row["Folder"]).toBe("Habitat");
      expect(row["Access type"]).toBe("group");
      expect(row["Access groups"]).toBe("Science team");
      expect(row["Where hosted"]).toBe("SeaSketch");
      expect(row["Uploaded file type"]).toBe("Shapefile");
      expect(row["Uploaded file"]).toBe("kelp_2024.zip");
      expect(row["Normalized file"]).toBe("FlatGeobuf");
      expect(row["Has metadata"]).toBe("true");
      expect(row["Added by"]).toBe(`Jane Doe <${slug}@example.com>`);
      expect(row["Source CRS"]).toBe("EPSG:3005");

      const admin = await store.isProjectAdmin(projectId, userId);
      expect(admin).toBe(true);
      const project = await store.projectBySlug(slug);
      expect(project).toEqual({ id: projectId, accessControl: "admins_only" });
      const resource = await store.layerResource(projectId, "kelpLayer", true);
      expect(resource?.path).toContain("kelpLayer");
      const lists = await store.accessLists(projectId, true, resource!.path);
      expect(lists.some((list) => list.type === "group")).toBe(true);
      const memberIds = await store.memberAclIds(
        lists.map((list) => list.id),
        userId
      );
      expect(memberIds).toEqual([]);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});

function request(
  url: string,
  headers?: Record<string, string>
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
  });
}

class MemoryStore implements LayerCatalogStore {
  async projectBySlug(slug: string) {
    if (slug === "demo") {
      return { id: 7, accessControl: "public" };
    }
    if (slug === "closed") {
      return { id: 8, accessControl: "admins_only" };
    }
    return null;
  }

  async draftItems(): Promise<RawTocItem[]> {
    return [
      item({
        stableId: "habitat",
        title: "Habitat",
        isFolder: true,
        sortIndex: 0,
      }),
      item({
        stableId: "kelpLayer",
        parentStableId: "habitat",
        title: "Kelp",
        sortIndex: 0,
        accessType: "group",
        accessGroupNames: ["Science team"],
        sourceType: "arcgis-vector",
        sourceUrl: "https://services.arcgis.com/abc/arcgis/rest/services/Kelp/FeatureServer/0",
        geostats: { layers: [{ geometry: "Polygon", count: 12 }] },
      }),
      item({
        stableId: "secretLayer",
        title: "Secret",
        sortIndex: 1,
        accessType: "admins_only",
      }),
    ];
  }

  async layerResource(projectId: number, stableId: string, isDraft: boolean) {
    const key = `${isDraft ? "draft" : "published"}:${stableId}`;
    return resources.get(key) || null;
  }

  async accessLists(projectId: number, isDraft: boolean, path: string) {
    return access.get(`${isDraft ? "draft" : "published"}:${path}`) || [];
  }

  async isProjectAdmin(_projectId: number, userId: number) {
    return userId === 1;
  }

  async memberAclIds(aclIds: number[], userId: number) {
    if (userId !== 5) {
      return [];
    }
    return aclIds.filter((id) => id === 11);
  }
}

function item(overrides: Partial<RawTocItem>): RawTocItem {
  return {
    stableId: "layer",
    parentStableId: null,
    title: "Layer",
    isFolder: false,
    sortIndex: 0,
    accessType: "public",
    accessGroupNames: [],
    sourceType: null,
    sublayerType: null,
    sublayer: null,
    sourceUrl: null,
    sourceLayer: null,
    createdAt: null,
    authorName: null,
    authorEmail: null,
    geostats: null,
    attribution: null,
    enableDownload: false,
    hasMetadata: false,
    uploadedSourceFilename: null,
    outputs: [],
    ...overrides,
  };
}

const resources = new Map<string, LayerResourceRecord>([
  [
    "draft:kelpLayer",
    {
      stableId: "kelpLayer",
      path: "habitat.kelpLayer",
      metadata: { type: "doc", content: [] },
      sublayer: null,
      style: { draft: "kelp" },
      geostats: { draft: true },
      sourceType: "arcgis-vector",
      sourceUrl: "https://services.arcgis.com/abc/FeatureServer/0",
    },
  ],
  [
    "published:kelpLayer",
    {
      stableId: "kelpLayer",
      path: "habitat.kelpLayer",
      metadata: null,
      sublayer: null,
      style: { published: "kelp" },
      geostats: { published: true },
      sourceType: "arcgis-vector",
      sourceUrl: "https://services.arcgis.com/abc/FeatureServer/0",
    },
  ],
  [
    "published:portsLayer",
    {
      stableId: "portsLayer",
      path: "portsLayer",
      metadata: null,
      sublayer: null,
      style: { published: "ports" },
      geostats: null,
      sourceType: "arcgis-vector",
      sourceUrl: "https://services.arcgis.com/abc/FeatureServer/1",
    },
  ],
  [
    "published:secretLayer",
    {
      stableId: "secretLayer",
      path: "secretLayer",
      metadata: null,
      sublayer: null,
      style: { published: "secret" },
      geostats: null,
      sourceType: "seasketch-mvt",
      sourceUrl: "https://tiles.seasketch.org/secret",
    },
  ],
  [
    "published:openLayer",
    {
      stableId: "openLayer",
      path: "openLayer",
      metadata: null,
      sublayer: null,
      style: { published: "open" },
      geostats: null,
      sourceType: "arcgis-vector",
      sourceUrl: "https://services.arcgis.com/abc/FeatureServer/2",
    },
  ],
]);

const access = new Map<string, AccessListRecord[]>([
  ["draft:habitat.kelpLayer", [{ id: 11, type: "group" }]],
  ["published:habitat.kelpLayer", [{ id: 11, type: "group" }]],
  ["published:portsLayer", [{ id: 2, type: "public" }]],
  ["published:secretLayer", [{ id: 3, type: "admins_only" }]],
  ["published:openLayer", [{ id: 4, type: "public" }]],
]);
