import { sql } from "slonik";
import { createPool } from "./pool";
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
} from "./helpers";

const pool = createPool("test");

describe("Access Control", () => {
  describe("Authoring of sketches is limited by access control lists", () => {
    test("Public sketch classes", async () => {
      await pool.transaction(async (conn) => {
        const adminId = await createUser(conn);
        const regularJoe = await createUser(conn);
        const projectId = await createProject(conn, adminId, "public");
        await createSession(conn, adminId, true, false, projectId);
        const sketchClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
        );
        await createSession(conn, regularJoe, true, false, projectId);
        const sketchId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${regularJoe}, ${sketchClassId}, 'my sketch') returning id`
        );
        expect(sketchId).toBeTruthy();
        await conn.any(sql`ROLLBACK`);
      });
    });
    test("Admin only sketch classes", async () => {
      await pool.transaction(async (conn) => {
        const adminId = await createUser(conn);
        const regularJoe = await createUser(conn);
        const projectId = await createProject(conn, adminId, "public");
        await createSession(conn, adminId, true, false, projectId);
        const sketchClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
        );
        await clearSession(conn);
        const aclId = await conn.oneFirst(
          sql`select id from access_control_lists where sketch_class_id = ${sketchClassId}`
        );
        await createSession(conn, adminId, true, false, projectId);
        await conn.any(
          sql`update access_control_lists set type = 'admins_only' where id = ${aclId}`
        );
        expect(
          await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name) values (${adminId}, ${sketchClassId}, 'my sketch') returning id`
          )
        ).toBeTruthy();
        await createSession(conn, regularJoe, true, false, projectId);
        expect(
          conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name) values (${regularJoe}, ${sketchClassId}, 'my sketch') returning id`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });
    test("Group-only sketch classes", async () => {
      await pool.transaction(async (conn) => {
        const adminId = await createUser(conn);
        const regularJoe = await createUser(conn);
        const groupMember = await createUser(conn);
        const projectId = await createProject(conn, adminId, "public");
        await createSession(conn, adminId, true, false, projectId);
        const sketchClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
        );
        const groupId = await createGroup(conn, projectId, "Group A", [
          groupMember,
        ]);
        await clearSession(conn);
        const aclId = await conn.oneFirst(
          sql`select id from access_control_lists where sketch_class_id = ${sketchClassId}`
        );
        await createSession(conn, adminId, true, false, projectId);
        await conn.any(
          sql`update access_control_lists set type = 'group' where id = ${aclId}`
        );
        await addGroupToAcl(conn, aclId as number, groupId);
        await createSession(conn, groupMember, true, false, projectId);
        expect(
          await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name) values (${groupMember}, ${sketchClassId}, 'my sketch') returning id`
          )
        ).toBeTruthy();
        await createSession(conn, regularJoe, true, false, projectId);
        expect(
          conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name) values (${regularJoe}, ${sketchClassId}, 'my sketch') returning id`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });
  });

  test("Only admins can author is_archived sketch classes", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const regularJoe = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      await createSession(conn, adminId, true, false, projectId);
      const sketchClassId = await conn.oneFirst(
        sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, is_archived) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION', true) returning id`
      );
      const sketchId = await conn.oneFirst(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${adminId}, ${sketchClassId}, 'my sketch') returning id`
      );
      expect(sketchId).toBeTruthy();
      await createSession(conn, regularJoe, true, false, projectId);
      expect(
        conn.any(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${regularJoe}, ${sketchClassId}, 'my sketch') returning id`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Users cannot create sketches that belong to other users", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const regularJoe = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      await createSession(conn, adminId, true, false, projectId);
      const sketchClassId = await conn.oneFirst(
        sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      await createSession(conn, regularJoe, true, false, projectId);
      expect(
        conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${adminId}, ${sketchClassId}, 'my sketch') returning id`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("Users can only create their own sketches", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userA = await createUser(conn);
      const userB = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      await createSession(conn, adminId, true, false, projectId);
      const sketchClassId = await conn.oneFirst(
        sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      await createSession(conn, userA, true, false, projectId);
      expect(
        conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${userB}, ${sketchClassId}, 'my sketch') returning id`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("Users can only edit their own sketches", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userA = await createUser(conn);
      const userB = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      await createSession(conn, adminId, true, false, projectId);
      const sketchClassId = await conn.oneFirst(
        sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      await createSession(conn, userA, true, false, projectId);
      const sketchId = await conn.oneFirst(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${userA}, ${sketchClassId}, 'my sketch') returning id`
      );
      await createSession(conn, userB, true, false, projectId);
      expect(
        conn.oneFirst(
          sql`update sketches set name = 'my sketch (updated)' where id = ${sketchId}`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("Users can only delete their own sketches", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userA = await createUser(conn);
      const userB = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      await createSession(conn, adminId, true, false, projectId);
      const sketchClassId = await conn.oneFirst(
        sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      await createSession(conn, userA, true, false, projectId);
      const sketchAId = await conn.oneFirst(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${userA}, ${sketchClassId}, 'my sketch') returning id`
      );
      const sketchBId = await conn.oneFirst(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${userA}, ${sketchClassId}, 'my sketch') returning id`
      );
      const deleted = await conn.oneFirst(
        sql`delete from sketches where id = ${sketchAId} returning id`
      );
      expect(deleted).toBe(sketchAId);
      await createSession(conn, userB, true, false, projectId);
      expect(
        conn.oneFirst(sql`delete from sketches where id = ${sketchBId}`)
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("Users can list their own sketches for a project", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userA = await createUser(conn);
      const userB = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      await createSession(conn, adminId, true, false, projectId);
      const sketchClassId = await conn.oneFirst(
        sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
      );
      await createSession(conn, userA, true, false, projectId);
      const sketchAId = await conn.oneFirst(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${userA}, ${sketchClassId}, 'my sketch') returning id`
      );
      const sketchBId = await conn.oneFirst(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${userA}, ${sketchClassId}, 'my sketch') returning id`
      );
      const userASketchIds = [sketchAId, sketchBId];
      await createSession(conn, userB, true, false, projectId);
      const sketchId = await conn.oneFirst(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${userB}, ${sketchClassId}, 'my sketch') returning id`
      );
      const sketchId2 = await conn.oneFirst(
        sql`insert into sketches (user_id, sketch_class_id, name) values (${userB}, ${sketchClassId}, 'my sketch') returning id`
      );
      const userBSketchIds = [sketchId, sketchId2];
      const sketchIds = await conn.manyFirst(
        sql`select id from my_sketches(${projectId})`
      );
      expect(sketchIds.length).toBe(2);
      expect(userASketchIds.indexOf(sketchIds[0])).toBe(-1);
      await conn.any(sql`ROLLBACK`);
    });
  });
});

const polygon = JSON.stringify(
  {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-119.68574523925781, 34.39246231021496],
          [-119.73896026611328, 34.37772911466851],
          [-119.69158172607422, 34.345987273972916],
          [-119.6586227416992, 34.36781108107208],
          [-119.68574523925781, 34.39246231021496],
        ],
      ],
    },
  }.geometry
);

const multiPolygon = JSON.stringify(
  {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [-119.63012695312499, 34.374328778301184],
            [-119.63493347167967, 34.36100946506246],
            [-119.61227416992188, 34.35534102998141],
            [-119.61742401123047, 34.37801246980093],
            [-119.63012695312499, 34.374328778301184],
          ],
        ],
        [
          [
            [-119.68574523925781, 34.39246231021496],
            [-119.73896026611328, 34.37772911466851],
            [-119.69158172607422, 34.345987273972916],
            [-119.6586227416992, 34.36781108107208],
            [-119.68574523925781, 34.39246231021496],
          ],
        ],
      ],
    },
  }.geometry
);

const linestring = JSON.stringify(
  {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [-119.76573944091795, 34.39076245843231],
        [-119.7623062133789, 34.36100946506246],
        [-119.7190475463867, 34.35505759816368],
        [-119.69947814941406, 34.33096239102277],
      ],
    },
  }.geometry
);

const multiLineString = JSON.stringify(
  {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiLineString",
      coordinates: [
        [
          [-119.69347000122069, 34.39940301338182],
          [-119.69776153564453, 34.38197934098774],
          [-119.71853256225587, 34.382829360365285],
        ],
        [
          [-119.6514129638672, 34.377870792354564],
          [-119.68265533447266, 34.36072605241386],
          [-119.70840454101561, 34.34967221153213],
          [-119.7355270385742, 34.35364042469895],
        ],
      ],
    },
  }.geometry
);

const point = JSON.stringify(
  {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [-119.66411590576172, 34.39246231021496],
    },
  }.geometry
);

const validateGeometryTypeCheck = async (
  geometryType: string,
  geom: string,
  invalidGeom: string,
  allowMulti = false
) => {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, userIds) => {
      await createSession(conn, adminId, true, false, projectId);
      const sketchClassId = await conn.oneFirst(
        sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, ${
          geometryType + " sketch class"
        }, ${geometryType}, ${allowMulti}) returning id`
      );
      await createSession(conn, userIds[0], true, false, projectId);
      const sketchId = await conn.oneFirst(
        sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${sketchClassId}, 'my shape', st_geomfromgeojson(${geom}), st_geomfromgeojson(${geom})) returning id`
      );
      expect(sketchId).toBeTruthy();
      expect(
        conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${sketchClassId}, 'my shape 2', st_geomfromgeojson(${invalidGeom}), st_geomfromgeojson(${invalidGeom})) returning id`
        )
      ).rejects.toThrow(/geometry/i);
    }
  );
};

describe("Sketch geometry type must match sketch class", () => {
  test("Polygon", async () => {
    await validateGeometryTypeCheck("POLYGON", polygon, multiPolygon);
  });

  test("Linestring", async () => {
    await validateGeometryTypeCheck("LINESTRING", linestring, polygon);
  });

  test("Point", async () => {
    await validateGeometryTypeCheck("POINT", point, polygon);
  });

  test("MultiPolygon - allow_multi", async () => {
    await validateGeometryTypeCheck("POLYGON", multiPolygon, linestring, true);
  });

  test("MultiLinestring - allow_multi", async () => {
    await validateGeometryTypeCheck(
      "LINESTRING",
      multiLineString,
      polygon,
      true
    );
  });
});

describe("Collections", () => {
  test("Sketches can be organized into sketchCollections", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const polygonClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON', false) returning id`
        );
        const collectionClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
        );
        await createSession(conn, userIds[0], true, false, projectId);
        const collectionId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${userIds[0]}, ${collectionClassId}, 'my collection') returning id`
        );
        const polyId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, collection_id) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), ${collectionId}) returning id`
        );
        expect(polyId).toBeTruthy();
      }
    );
  });

  test("Collections cannot be nested", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const collectionClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
        );
        await createSession(conn, userIds[0], true, false, projectId);
        const collectionId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${userIds[0]}, ${collectionClassId}, 'my collection') returning id`
        );
        expect(
          conn.any(
            sql`insert into sketches (user_id, sketch_class_id, name, collection_id) values (${userIds[0]}, ${collectionClassId}, 'nested collection', ${collectionId}) returning id`
          )
        ).rejects.toThrow(/nested/i);
      }
    );
  });
  test("SketchClasses with valid children specified enforce membership", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const polygonClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON', false) returning id`
        );
        const invalidChildId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Invalid child', 'POLYGON', false) returning id`
        );
        const collectionClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
        );
        await conn.any(
          sql`select add_valid_child_sketch_class(${collectionClassId}, ${polygonClassId})`
        );
        await createSession(conn, userIds[0], true, false, projectId);
        const collectionId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${userIds[0]}, ${collectionClassId}, 'my collection') returning id`
        );
        const polyId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, collection_id) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), ${collectionId}) returning id`
        );
        expect(polyId).toBeTruthy();
        expect(
          conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, collection_id) values (${userIds[0]}, ${invalidChildId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), ${collectionId}) returning id`
          )
        ).rejects.toThrow(/child/i);
      }
    );
  });
});

describe("Generated columns", () => {
  test("bbox", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const polygonClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON', false) returning id`
        );
        await createSession(conn, userIds[0], true, false, projectId);
        const bbox = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning bbox`
        );
        // @ts-ignore
        expect(bbox[0]).toBe(-119.73896);
      }
    );
  });
  test("num_vertices", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const polygonClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON', false) returning id`
        );
        await createSession(conn, userIds[0], true, false, projectId);
        const numVertices = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning num_vertices`
        );
        expect(numVertices).toBe(5);
      }
    );
  });
});

describe("Geometry output", () => {
  // TODO: add this when form fields are figured out
  test.todo("geojson");
  test.todo("geobuf");
});

describe("Folders", () => {
  test("Sketches can be placed in folders", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const polygonClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON', false) returning id`
        );
        await createSession(conn, userIds[0], true, false, projectId);
        const folderId = await conn.oneFirst(
          sql`insert into sketch_folders (name, user_id, project_id) values ('Folder A', ${userIds[0]}, ${projectId}) returning id`
        );
        const sketch = await conn.one(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, folder_id) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), ${folderId}) returning *`
        );
        expect(sketch.folder_id).toBe(folderId);
      }
    );
  });
  test("Folders can be nested", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        await createSession(conn, userIds[0], true, false, projectId);
        const folderA = await conn.oneFirst(
          sql`insert into sketch_folders (name, user_id, project_id) values ('Folder A', ${userIds[0]}, ${projectId}) returning id`
        );
        const folderB = await conn.one(
          sql`insert into sketch_folders (name, user_id, project_id, folder_id) values ('Folder B', ${userIds[0]}, ${projectId}, ${folderA}) returning *`
        );
        expect(folderB.folder_id).toBe(folderA);
      }
    );
  });
  test("Sketches cannot be placed in both a folder and a collection at the same time", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const polygonClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON', false) returning id`
        );
        const collectionClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
        );
        await createSession(conn, userIds[0], true, false, projectId);
        const folderId = await conn.oneFirst(
          sql`insert into sketch_folders (name, user_id, project_id) values ('Folder A', ${userIds[0]}, ${projectId}) returning id`
        );
        const collectionId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${userIds[0]}, ${collectionClassId}, 'my collection') returning id`
        );
        expect(
          conn.one(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, folder_id, collection_id) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), ${folderId}, ${collectionId}) returning *`
          )
        ).rejects.toThrow(/parent/i);
      }
    );
  });

  test("Folder's parent must be owned by the same user", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, userIds[0], true, false, projectId);
        const folderA = await conn.oneFirst(
          sql`insert into sketch_folders (name, user_id, project_id) values ('Folder A', ${userIds[0]}, ${projectId}) returning id`
        );
        await createSession(conn, userIds[1], true, false, projectId);
        expect(
          conn.one(
            sql`insert into sketch_folders (name, user_id, project_id, folder_id) values ('Folder B', ${userIds[1]}, ${projectId}, ${folderA}) returning *`
          )
        ).rejects.toThrow(/parent/);
      }
    );
  });

  test("Folder's parent must be in the same project", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        const projectB = await createProject(conn, adminId, "public");
        await createSession(conn, userIds[0], true, false, projectId);
        const folderA = await conn.oneFirst(
          sql`insert into sketch_folders (name, user_id, project_id) values ('Folder A', ${userIds[0]}, ${projectId}) returning id`
        );
        await createSession(conn, userIds[1], true, false, projectId);
        expect(
          conn.one(
            sql`insert into sketch_folders (name, user_id, project_id, folder_id) values ('Folder B', ${userIds[0]}, ${projectB}, ${folderA}) returning *`
          )
        ).rejects.toThrow(/parent/i);
      }
    );
  });

  test("myFolders - users can list their own folders for a project", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        await createSession(conn, userIds[0], true, false, projectId);
        const folderA = await conn.oneFirst(
          sql`insert into sketch_folders (name, user_id, project_id) values ('Folder A', ${userIds[0]}, ${projectId}) returning id`
        );
        const folderB = await conn.one(
          sql`insert into sketch_folders (name, user_id, project_id, folder_id) values ('Folder B', ${userIds[0]}, ${projectId}, ${folderA}) returning *`
        );
        expect(folderB.folder_id).toBe(folderA);
        const folders = await conn.many(sql`select my_folders(${projectId})`);
        expect(folders.length).toBe(2);
      }
    );
  });

  describe("Access control", () => {
    test("Folder editing operations are limited to the author", async () => {
      await verifyOnlyAuthorsCanEditRecords(pool, "sketch_folders", {
        name: "Folder",
        project_id: ":project_id",
        user_id: ":user_id",
      });
    });

    test("Folders can only be queried directly by their author", async () => {
      await verifyOnlyAuthorsCanAccessRecords(pool, "sketch_folders", {
        name: "Folder",
        project_id: ":project_id",
        user_id: ":user_id",
      });
    });
  });
});

describe("Copy operations", () => {
  test("Copying a single sketch", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const polygonClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON', false) returning id`
        );
        await createSession(conn, userIds[0], true, false, projectId);
        const polyId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, collection_id) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), null) returning id`
        );
        expect(polyId).toBeTruthy();
        const copyId = await conn.oneFirst(
          sql`select id from copy_sketch(${polyId});`
        );
        expect(copyId).toBeTruthy();
        expect(copyId).not.toBe(polyId);
      }
    );
  });
  test("Copying a complex collection with multiple subfolders and child sketches", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        /**
         * 
        Testing copying the following structure:

        > my collection
          * shape a
          > folder a
            * shape b
            > folder b
              * shape c

        */

        await createSession(conn, adminId, true, false, projectId);
        const polygonClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON', false) returning id`
        );
        const collectionClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
        );
        await createSession(conn, userIds[0], true, false, projectId);
        const collectionId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${userIds[0]}, ${collectionClassId}, 'my collection') returning id`
        );
        const shapeA = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, collection_id) values (${userIds[0]}, ${polygonClassId}, 'shape a', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), ${collectionId}) returning id`
        );
        const folderA = await conn.oneFirst(
          sql`insert into sketch_folders (name, user_id, project_id, collection_id) values ('folder a', ${userIds[0]}, ${projectId}, ${collectionId}) returning id`
        );
        const shapeB = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, folder_id) values (${userIds[0]}, ${polygonClassId}, 'shape b', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), ${folderA}) returning id`
        );
        const folderB = await conn.oneFirst(
          sql`insert into sketch_folders (name, user_id, project_id, folder_id) values ('folder b', ${userIds[0]}, ${projectId}, ${folderA}) returning id`
        );
        expect(shapeA).toBeTruthy();
        const shapeC = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, folder_id) values (${userIds[0]}, ${polygonClassId}, 'shape c', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), ${folderB}) returning id`
        );

        const rows = await conn.any(
          sql`select copy_sketch_toc_item_recursive(${collectionId}, 'sketch', true);`
        );
        const copyId = rows[0].copy_sketch_toc_item_recursive;
        expect(copyId).toBeTruthy();
        expect(copyId).not.toBe(collectionId);
        const folders = await conn.manyFirst(
          sql`select * from get_child_folders_recursive(${copyId}, 'sketch')`
        );
        // @ts-ignore
        expect(folders[0].length).toBe(2);
        const sketches = await conn.manyFirst(
          sql`select * from get_child_sketches_recursive(${copyId}, 'sketch')`
        );
        // @ts-ignore
        expect(sketches[0].length).toBe(3);
      }
    );
  });
});
