import { sql } from "slonik";
import { createPool } from "./pool";
import {
  raw,
  // @ts-ignore
} from "slonik-sql-tag-raw";
import {
  createUser,
  createProject,
  addParticipant,
  createSession,
  clearSession,
  createGroup,
  addGroupToAcl,
  projectTransaction,
  verifyOnlyAuthorsCanEditRecords,
  verifyOnlyAuthorsCanAccessRecords,
  verifyOnlyProjectGroupMembersCanAccessResource,
  limitToGroup,
  verifyCRUDOpsLimitedToAdmins,
} from "./helpers";
import nanoid from "nanoid";
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const id = nanoid.customAlphabet(alphabet, 9);

const pool = createPool("test");

describe("Data validation", () => {
  test("minzoom cannot be set for geojson, image, video, arcgis-vector, or seasketch-vector", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const sourceType = await conn.oneFirst(sql`
            insert into data_sources (project_id, type, url) values (${projectId}, 'geojson', 'https://example.com/geojson.json') returning type
          `);
        expect(sourceType).toBe("geojson");
        expect(
          conn.one(
            sql`insert into data_sources (project_id, type, url, minzoom) values (${projectId}, 'geojson', 'https://example.com/geojson.json', 1) returning *`
          )
        ).rejects.toThrow(/minzoom/i);
      }
    );
  });
  test("maxzoom cannot be specified for image or video sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await conn.any(sql`SAVEPOINT before_create`);
        expect(
          conn.one(
            sql`insert into data_sources (project_id, type, url, maxzoom, coordinates) values (${projectId}, 'image', 'https://example.com/image.png', 1, '{{1,2}, {3,4}}') returning *`
          )
        ).rejects.toThrow(/maxzoom/i);
        await conn.any(sql`ROLLBACK to before_create`);
        expect(
          conn.one(
            sql`insert into data_sources (project_id, type, url, maxzoom, coordinates) values (${projectId}, 'video', 'https://example.com/image.webp', 1, '{{1,2}, {3,4}}') returning *`
          )
        ).rejects.toThrow(/maxzoom/i);
      }
    );
  });
  test("url required for geojson, image, arcgis-dynamic-mapserver, and arcgis-vector sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = [
          "geojson",
          "image",
          "arcgis-dynamic-mapserver",
          "arcgis-vector",
        ];
        for (let i = 0; i < types.length; i++) {
          const type = types[i];
          await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
          if (type === "image") {
            expect(
              conn.one(
                sql`insert into data_sources (project_id, type, coordinates) values (${projectId}, ${type}, '{1,2,3,4}') returning *`
              )
            ).rejects.toThrow(/url/i);
          } else {
            expect(
              conn.one(
                sql`insert into data_sources (project_id, type) values (${projectId}, ${type}) returning *`
              )
            ).rejects.toThrow(/url/i);
          }
          await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
        }
      }
    );
  });
  test("scheme can only be set on raster & vector sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          geojson: false,
          raster: true,
          vector: true,
          "arcgis-vector": false,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let scheme = await conn.oneFirst(
              sql`insert into data_sources (project_id, type, scheme, url) values (${projectId}, ${type}, 'tms', 'https://example.com/item.bin') returning scheme`
            );
            expect(scheme).toBe("tms");
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            expect(
              conn.oneFirst(
                sql`insert into data_sources (project_id, type, scheme, url) values (${projectId}, ${type}, 'tms', 'https://example.com/item.bin') returning scheme`
              )
            ).rejects.toThrow(/scheme/i);
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });
  test("tiles can only be set on raster, vector, and raster-dem sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          geojson: false,
          raster: true,
          vector: true,
          "raster-dem": true,
          "arcgis-vector": false,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let id = await conn.oneFirst(
              sql`insert into data_sources (project_id, type, url, tiles) values (${projectId}, ${type}, 'https://example.com/item.bin', ${sql.array(
                ["https://a.com", "https://b.com"],
                "text"
              )}) returning id`
            );
            expect(id).toBeTruthy();
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            expect(
              conn.oneFirst(
                sql`insert into data_sources (project_id, type, url, tiles) values (${projectId}, ${type}, 'https://example.com/item.bin', ${sql.array(
                  ["https://a.com", "https://b.com"],
                  "text"
                )}) returning id`
              )
            ).rejects.toThrow(/tiles/i);
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });
  test("tile_size can only be set on raster, vector, and raster-dem sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          geojson: false,
          raster: true,
          vector: true,
          "raster-dem": true,
          "arcgis-vector": false,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let id = await conn.oneFirst(
              sql`insert into data_sources (project_id, type, url, tiles, tile_size) values (${projectId}, ${type}, 'https://example.com/item.bin', ${sql.array(
                ["https://a.com", "https://b.com"],
                "text"
              )}, 256) returning id`
            );
            expect(id).toBeTruthy();
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            expect(
              conn.oneFirst(
                sql`insert into data_sources (project_id, type, url, tile_size) values (${projectId}, ${type}, 'https://example.com/item.bin', 256) returning id`
              )
            ).rejects.toThrow(/tile_size/i);
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });
  test("encoding can only be set on raster-dem sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          raster: false,
          vector: false,
          "raster-dem": true,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let id = await conn.oneFirst(
              sql`insert into data_sources (project_id, type, url, tiles, encoding) values (${projectId}, ${type}, 'https://example.com/item.bin', ${sql.array(
                ["https://a.com", "https://b.com"],
                "text"
              )}, 'mapbox') returning id`
            );
            expect(id).toBeTruthy();
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            expect(
              conn.oneFirst(
                sql`insert into data_sources (project_id, type, url, encoding) values (${projectId}, ${type}, 'https://example.com/item.bin', 'mapbox') returning id`
              )
            ).rejects.toThrow(/encoding/i);
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });
  test("buffer, cluster, cluster_max_zoom, cluster_properties, cluster_radius, generate_id, line_metrics, promote_id, and tolerance properties are only available to geojson and seasketch-vector sources.", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const props = {
          buffer: 1,
          cluster: true,
          cluster_max_zoom: 1,
          cluster_radius: 1,
          generate_id: true,
          line_metrics: true,
          promote_id: true,
          tolerance: 0.4,
        };
        for (let i = 0; i < Object.keys(props).length; i++) {
          const prop = Object.keys(props)[i];
          // @ts-ignore
          const val = props[prop];
          let id = await conn.oneFirst(
            sql`insert into data_sources (project_id, type, url, ${raw(
              prop
            )}) values (${projectId}, 'geojson', 'https://example.com/item.bin', ${
              typeof val === "object"
                ? raw(`'${JSON.stringify(val)}'::jsonb`)
                : val
            }) returning id`
          );
          expect(id).toBeTruthy();
          let id2 = await conn.oneFirst(
            sql`insert into data_sources (project_id, type, url, import_type, ${raw(
              prop
            )}, byte_length) values (${projectId}, 'seasketch-vector', 'https://example.com/item.bin', 'arcgis', ${val}, 0) returning id`
          );
          expect(id).toBeTruthy();
          await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
          expect(
            conn.oneFirst(
              sql`insert into data_sources (project_id, type, url, ${raw(
                prop
              )}) values (${projectId}, 'vector', 'https://example.com/item.bin', ${val}) returning id`
            )
          ).rejects.toThrow(/geojson/i);
          await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
        }
      }
    );
  });

  test("coordinates can only be set on video and image sources, and is required", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await conn.any(sql`SAVEPOINT ${raw(`point_a`)}`);
        expect(
          conn.oneFirst(
            sql`insert into data_sources (project_id, type, url, coordinates) values (${projectId}, 'geojson', 'https://example.com/item.bin', '{1,2,3,4}') returning id`
          )
        ).rejects.toThrow(/coordinates/i);
        await conn.any(sql`ROLLBACK to ${raw(`point_a`)}`);
      }
    );
  });

  test("urls can only be set on video sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          geojson: false,
          vector: false,
          "raster-dem": false,
          "arcgis-vector": false,
          image: false,
          video: true,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let id = await conn.oneFirst(
              sql`insert into data_sources (project_id, type, urls, coordinates) values (${projectId}, ${type}, ${sql.array(
                ["https://example.com/item.webp"],
                "text"
              )}, '{1,2,3,4}') returning id`
            );
            expect(id).toBeTruthy();
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            if (type === "image") {
              expect(
                conn.oneFirst(
                  sql`insert into data_sources (project_id, type, urls, url, coordinates) values (${projectId}, ${type}, ${sql.array(
                    ["https://example.com/item.webp"],
                    "text"
                  )}, 'https://example.com/item.webp', '{1,2,3,4}') returning id`
                )
              ).rejects.toThrow(/urls/i);
            } else {
              expect(
                conn.oneFirst(
                  sql`insert into data_sources (project_id, type, urls, url) values (${projectId}, ${type}, ${sql.array(
                    ["https://example.com/item.webp"],
                    "text"
                  )}, 'https://example.com/item.webp') returning id`
                )
              ).rejects.toThrow(/urls/i);
            }
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });

  test("query_parameters is only a valid option for arcgis-vector and arcgis-dynamic-mapserver sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          geojson: false,
          "arcgis-vector": true,
          "arcgis-dynamic-mapserver": true,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let id = await conn.oneFirst(
              sql`insert into data_sources (project_id, type, url, query_parameters) values (${projectId}, ${type}, 'https://example.com/item.webp', '{"foo": "bar"}'::jsonb) returning id`
            );
            expect(id).toBeTruthy();
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            expect(
              conn.oneFirst(
                sql`insert into data_sources (project_id, type, url, query_parameters) values (${projectId}, ${type}, 'https://example.com/item.webp', '{"foo": "bar"}'::jsonb) returning id`
              )
            ).rejects.toThrow(/query_parameters/i);
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });
  test("use_device_pixel_ratio is only a valid option for arcgis-dynamic-mapserver sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          image: false,
          "arcgis-vector": false,
          "arcgis-dynamic-mapserver": true,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let id = await conn.oneFirst(
              sql`insert into data_sources (project_id, type, url, use_device_pixel_ratio) values (${projectId}, ${type}, 'https://example.com/item.webp', true) returning id`
            );
            expect(id).toBeTruthy();
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            if (type === "image") {
              expect(
                conn.oneFirst(
                  sql`insert into data_sources (project_id, type, url, use_device_pixel_ratio, coordinates) values (${projectId}, ${type}, 'https://example.com/item.webp', true, '{1,2,3,4}') returning id`
                )
              ).rejects.toThrow(/use_device_pixel_ratio/i);
            } else {
              expect(
                conn.oneFirst(
                  sql`insert into data_sources (project_id, type, url, use_device_pixel_ratio) values (${projectId}, ${type}, 'https://example.com/item.webp', true) returning id`
                )
              ).rejects.toThrow(/use_device_pixel_ratio/i);
            }
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });

  test("import_type is required and available only for seasketch-vector source types", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          geojson: false,
          "arcgis-vector": false,
          "seasketch-vector": true,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let id = await conn.oneFirst(
              type === "seasketch-vector"
                ? sql`insert into data_sources (project_id, type, url, import_type, byte_length) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload', 0) returning id`
                : sql`insert into data_sources (project_id, type, url, import_type) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload') returning id`
            );
            expect(id).toBeTruthy();
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            expect(
              conn.oneFirst(
                type === "seasketch-vector"
                  ? sql`insert into data_sources (project_id, type, url, byte_length) values (${projectId}, ${type}, 'https://example.com/item.webp', 12) returning id`
                  : sql`insert into data_sources (project_id, type, url) values (${projectId}, ${type}, 'https://example.com/item.webp') returning id`
              )
            ).rejects.toThrow(/import_type/i);
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            expect(
              conn.oneFirst(
                sql`insert into data_sources (project_id, type, url, import_type) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload') returning id`
              )
            ).rejects.toThrow(/import_type/i);
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });

  test("original_source_url is only available for seasketch-vector source types", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          geojson: false,
          "arcgis-vector": false,
          "seasketch-vector": true,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let id = await conn.oneFirst(
              type === "seasketch-vector"
                ? sql`insert into data_sources (project_id, type, url, import_type, original_source_url, byte_length) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload', 'https://example.com/arcgis/rest/services/bullshit', 0) returning id`
                : sql`insert into data_sources (project_id, type, url, import_type, original_source_url) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload', 'https://example.com/arcgis/rest/services/bullshit') returning id`
            );
            expect(id).toBeTruthy();
            // not required, so this should work
            let id2 = conn.oneFirst(
              type === "seasketch-vector"
                ? sql`insert into data_sources (project_id, type, url, import_type, byte_length) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload', 12) returning id`
                : sql`insert into data_sources (project_id, type, url, import_type) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload') returning id`
            );
            expect(id2).toBeTruthy();
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            expect(
              conn.oneFirst(
                sql`insert into data_sources (project_id, type, url, original_source_url) values (${projectId}, ${type}, 'https://example.com/item.webp', 'https://example.com/foo') returning id`
              )
            ).rejects.toThrow(/original_source_url/i);
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });
  test("enhanced security is required and only available for seasketch-vector source types", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const types = {
          geojson: false,
          "arcgis-vector": false,
          "seasketch-vector": true,
        };
        for (let i = 0; i < Object.values(types).length; i++) {
          const ok = Object.values(types)[i];
          const type = Object.keys(types)[i];
          if (ok) {
            let id = await conn.oneFirst(
              type === "seasketch-vector"
                ? sql`insert into data_sources (project_id, type, url, import_type, enhanced_security, byte_length) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload', true, 0) returning id`
                : sql`insert into data_sources (project_id, type, url, import_type, enhanced_security) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload', true) returning id`
            );
            expect(id).toBeTruthy();
            // not required, so this should work
            let id2 = conn.oneFirst(
              type === "seasketch-vector"
                ? sql`insert into data_sources (project_id, type, url, import_type, byte_length) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload', 12) returning id`
                : sql`insert into data_sources (project_id, type, url, import_type) values (${projectId}, ${type}, 'https://example.com/item.webp', 'upload') returning id`
            );
            expect(id2).toBeTruthy();
          } else {
            await conn.any(sql`SAVEPOINT ${raw(`point_${i}`)}`);
            expect(
              conn.oneFirst(
                sql`insert into data_sources (project_id, type, url, enhanced_security) values (${projectId}, ${type}, 'https://example.com/item.webp', false) returning id`
              )
            ).rejects.toThrow(/enhanced_security/i);
            await conn.any(sql`ROLLBACK to ${raw(`point_${i}`)}`);
          }
        }
      }
    );
  });
  describe("seasketch-vector", () => {
    // before-insert trigger
    test("bucket and key are auto-populated and tiles property is cleared when inserting a new seasketch-vector source", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA]) => {
          const { bucket_id, object_key, tiles, url } = await conn.one(sql`
                insert into data_sources (project_id, type, url, import_type, tiles, byte_length) values (${projectId}, 'seasketch-vector', 'https://example.com/geojson.json', 'upload', ${sql.array(
            ["https://example.com/foo"],
            "text"
          )}, 0) returning bucket_id, object_key, tiles, url
              `);
          expect(bucket_id).toBe("geojson-1.seasketch-data.org");
          expect((object_key as string).length).toBeGreaterThan(20);
          expect(tiles).toBe(null);
        }
      );
    });
    test("bucket and key cannot be changed after insertion", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA]) => {
          await createSession(conn, adminId);
          const id = await conn.oneFirst(sql`
                insert into data_sources (project_id, type, url, import_type, tiles, byte_length) values (${projectId}, 'seasketch-vector', 'https://example.com/geojson.json', 'upload', ${sql.array(
            ["https://example.com/foo"],
            "text"
          )}, 0) returning id
              `);
          expect(id).toBeTruthy();
          expect(
            conn.any(
              sql`update data_sources set bucket_id = 3 where id = ${id} returning id`
            )
          ).rejects.toThrow(/denied/);
        }
      );
    });
    test("enhanced security option cannot be changed after insertion via update", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA]) => {
          await createSession(conn, adminId);
          const id = await conn.oneFirst(sql`
                  insert into data_sources (project_id, type, import_type, enhanced_security, byte_length) values (${projectId}, 'seasketch-vector', 'upload', true, 0) returning id
                `);
          expect(id).toBeTruthy();
          expect(
            conn.any(
              sql`update data_sources set enhanced_security = false where id = ${id}`
            )
          ).rejects.toThrow(/denied/);
        }
      );
    });
    test("import_type and original_source_url cannot be changed after insertion", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA]) => {
          await createSession(conn, adminId);
          const id = await conn.oneFirst(sql`
                    insert into data_sources (project_id, type, import_type, original_source_url, byte_length) values (${projectId}, 'seasketch-vector', 'arcgis', 'https://example.com/arcgis/rest/services/bullshit/MapServer', 12) returning id
                  `);
          expect(id).toBeTruthy();
          expect(
            conn.any(
              sql`update data_sources set import_type = 'upload' where id = ${id}`
            )
          ).rejects.toThrow(/denied/);
        }
      );
    });
  });
});

describe("Access Control", () => {
  test("Only admins can create and edit data_sources in their own project", async () => {
    await verifyCRUDOpsLimitedToAdmins(pool, {
      create: async (conn, projectId, adminId) => {
        return sql`insert into data_sources (project_id, type, import_type, original_source_url, byte_length) values (${projectId}, 'seasketch-vector', 'arcgis', 'https://example.com/arcgis/rest/services/bullshit/MapServer', 0) returning id`;
      },
      update: (id) => {
        return sql`update data_sources set buffer = 1 where id = ${id} returning *`;
      },
      delete: (id) => {
        return sql`delete from data_sources where id = ${id}`;
      },
    });
  });
  test("data_sources can only be edited if they are not associated with a public table of contents item", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '3') returning id`
        );
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'item1', false, ${layerId}, ${"abc123"}) returning id`
        );
        const updated = await conn.oneFirst(
          sql`update data_layers set sublayer = 2 where id = ${layerId} returning id`
        );
        expect(updated).toBe(layerId);
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        const publishedLayerId = await conn.oneFirst(
          sql`select data_layer_id from table_of_contents_items where is_draft = false and stable_id = 'abc123'`
        );
        const publishedSourceId = await conn.oneFirst(
          sql`select data_source_id from data_layers where id = ${publishedLayerId}`
        );
        expect(publishedSourceId).toBeTruthy();
        expect(
          conn.oneFirst(
            sql`update data_sources set attribution = 'me' where id = ${publishedSourceId} returning attribution`
          )
        ).rejects.toThrow(/not found/);
      }
    );
  });
  test("Anonymous users can access data_sources that are included in public table of contents items", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const groupId = await createGroup(conn, projectId);
        const folderAStableId = id();
        const folderBStableId = id();
        const protectedId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${folderAStableId}) returning id`
        );
        const protectedSubfolderId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id, parent_stable_id) values (${projectId}, 'subfolder', true, ${folderBStableId}, ${folderAStableId}) returning id`
        );
        const unprotectedFolderStableId = id();
        const unprotectedFolderId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'unprotected', true, ${unprotectedFolderStableId}) returning id`
        );
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '3') returning id`
        );
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'unprotected layer', false, ${layerId}, ${"abc123"}, ${unprotectedFolderStableId}) returning id`
        );

        await limitToGroup(
          conn,
          "table_of_contents_item_id",
          protectedId,
          groupId
        );
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        let publishedItem = await conn.one(
          sql`select * from table_of_contents_items where is_draft = false and stable_id = ${folderBStableId}`
        );
        let unprotectedItem = await conn.one(
          sql`select id, title, stable_id, is_folder, is_draft from table_of_contents_items where is_draft = false and stable_id = ${unprotectedFolderStableId}`
        );
        let publishedLayerTocItem = await conn.one(
          sql`select path, title, is_draft, stable_id, parent_stable_id, id, data_layer_id from table_of_contents_items where is_draft = false and stable_id = ${"abc123"}`
        );
        let publishedSourceId = await conn.oneFirst(
          sql`select data_source_id from data_layers where id = ${publishedLayerTocItem.data_layer_id}`
        );
        await clearSession(conn);
        await createSession(conn);
        expect(
          conn.oneFirst(
            sql`select url from data_sources where id = ${publishedSourceId}`
          )
        ).resolves.toBe(
          "https://example.com/arcgis/rest/services/bullshit/MapServer"
        );
      }
    );
  });
  test("Logged in users can access data_sources that are included in table of contents items that they have access to", async () => {
    await verifyOnlyProjectGroupMembersCanAccessResource(
      pool,
      "data_sources",
      async (conn, projectId, groupId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderAStableId = id();
        const folderBStableId = id();
        const protectedId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${folderAStableId}) returning id`
        );
        const protectedSubfolderId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id, parent_stable_id) values (${projectId}, 'subfolder', true, ${folderBStableId}, ${folderAStableId}) returning id`
        );
        const unprotectedFolderStableId = id();
        const unprotectedFolderId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'unprotected', true, ${unprotectedFolderStableId}) returning id`
        );
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '3') returning id`
        );
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'protected layer', false, ${layerId}, ${"abc123"}, ${folderBStableId}) returning id`
        );

        await limitToGroup(
          conn,
          "table_of_contents_item_id",
          protectedId,
          groupId
        );
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        let publishedItem = await conn.one(
          sql`select * from table_of_contents_items where is_draft = false and stable_id = ${"abc123"}`
        );
        const publishedSourceId = await conn.oneFirst(
          sql`select data_source_id from data_layers where id = ${publishedItem.data_layer_id}`
        );
        await clearSession(conn);
        await createSession(conn);
        return publishedSourceId as number;
      }
    );
  });
  test("Users without access to an invite-only project have no access to private data sources", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const outsideUser = await createUser(conn);
        const groupId = await createGroup(conn, projectId);
        const folderAStableId = id();
        const folderBStableId = id();
        const protectedId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${folderAStableId}) returning id`
        );
        const protectedSubfolderId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id, parent_stable_id) values (${projectId}, 'subfolder', true, ${folderBStableId}, ${folderAStableId}) returning id`
        );
        const unprotectedFolderStableId = id();
        const unprotectedFolderId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'unprotected', true, ${unprotectedFolderStableId}) returning id`
        );
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '3') returning id`
        );
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'unprotected layer', false, ${layerId}, ${"abc123"}, ${unprotectedFolderStableId}) returning id`
        );

        await limitToGroup(
          conn,
          "table_of_contents_item_id",
          protectedId,
          groupId
        );
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        let publishedItem = await conn.one(
          sql`select * from table_of_contents_items where is_draft = false and stable_id = ${folderBStableId}`
        );
        let unprotectedItem = await conn.one(
          sql`select id, title, stable_id, is_folder, is_draft from table_of_contents_items where is_draft = false and stable_id = ${unprotectedFolderStableId}`
        );
        let publishedLayerTocItem = await conn.one(
          sql`select path, title, is_draft, stable_id, parent_stable_id, id, data_layer_id from table_of_contents_items where is_draft = false and stable_id = ${"abc123"}`
        );
        let publishedSourceId = await conn.oneFirst(
          sql`select data_source_id from data_layers where id = ${publishedLayerTocItem.data_layer_id}`
        );
        await clearSession(conn);
        await createSession(conn, outsideUser, true, false, projectId);
        expect(
          conn.oneFirst(
            sql`select url from data_sources where id = ${publishedSourceId}`
          )
        ).rejects.toThrow(/not found/);
      }
    );
  });
  test.todo("Only admins can gain access to the presignedUploadUrl");
});

describe("Orphan sources cleanup", () => {
  test.todo(
    "deleting a layer deletes the associated source if no other reference it"
  );
  test.todo(
    "deleted sources are put into a deleted_sources table for later deletion from s3"
  );
  test.todo("scheduled task deletes s3 sources listed in deleted_sources");
});
