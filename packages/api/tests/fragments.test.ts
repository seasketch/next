import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createUser,
  createProject,
  createSession,
  clearSession,
  projectTransaction,
} from "./helpers";
import {
  createFragments,
  eliminateOverlap,
  prepareSketch,
  SketchFragment,
} from "overlay-engine";
import { Feature, Polygon } from "geojson";

const pool = createPool("test");

// Test geometries
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

const antimeridianPolygon = JSON.stringify(
  {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [179.9, 34.39246231021496],
          [180.1, 34.37772911466851],
          [179.8, 34.345987273972916],
          [179.9, 34.36781108107208],
          [179.9, 34.39246231021496],
        ],
      ],
    },
  }.geometry
);

const antimeridianMultiPolygon = JSON.stringify(
  {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [179.9, 34.39246231021496],
            [180.1, 34.37772911466851],
            [179.8, 34.345987273972916],
            [179.9, 34.36781108107208],
            [179.9, 34.39246231021496],
          ],
        ],
      ],
    },
  }.geometry
);

describe("Fragment functionality", () => {
  describe("Basic fragment operations", () => {
    test("Fragments can be created and associated with a sketch", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          // Create geography records
          const geography1Id = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
          );
          const geography2Id = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 2') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);
          const sketchId = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          // Create a fragment input using Polygon and actual geography IDs
          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[${geography1Id}, ${geography2Id}]
          )::fragment_input]`;

          // Update sketch fragments
          await conn.any(
            sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
          );

          // Verify fragment was created
          const fragments = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketchId}`
          );
          expect(fragments.length).toBe(1);
          expect(fragments[0].geometry).toBeTruthy();
          expect(fragments[0].hash).toBeTruthy();

          // Verify geography associations through fragment
          const fragment = fragments[0];
          const geographies = await conn.many(
            sql`select * from fragment_geographies where fragment_hash = ${fragment.hash}`
          );
          expect(geographies.length).toBe(2);
          expect(geographies.map((g) => g.geography_id).sort()).toEqual(
            [geography1Id, geography2Id].sort()
          );
        }
      );
    });

    test("Two sketches with the same geometry share the same fragment", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          // Create geography record
          const geographyId = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);

          // Create first sketch
          const sketch1Id = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${sketchClassId}, 'shape 1', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          // Create second sketch with same geometry
          const sketch2Id = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${sketchClassId}, 'shape 2', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[${geographyId}]
          )::fragment_input]`;

          // Update fragments for both sketches
          await conn.any(
            sql`select update_sketch_fragments(${sketch1Id}, ${fragmentInput})`
          );
          await conn.any(
            sql`select update_sketch_fragments(${sketch2Id}, ${fragmentInput})`
          );

          // Verify both sketches reference the same fragment
          const fragments1 = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketch1Id}`
          );
          const fragments2 = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketch2Id}`
          );
          expect(fragments1.length).toBe(1);
          expect(fragments2.length).toBe(1);
          expect(fragments1[0].hash).toBe(fragments2[0].hash);
        }
      );
    });

    test("Cannot create fragments that span the antimeridian", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          // Create geography record
          const geographyId = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);
          const sketchId = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${antimeridianPolygon}), st_geomfromgeojson(${antimeridianPolygon})) returning id`
          );

          const fragmentInput = sql`array[(
            st_geomfromgeojson(${antimeridianPolygon}),
            array[${geographyId}]
          )::fragment_input]`;

          // Attempt to update fragments should fail
          await expect(
            conn.any(
              sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
            )
          ).rejects.toThrow(/antimeridian/i);
        }
      );
    });
  });

  describe("Fragment access control", () => {
    test("Only sketch owner can update fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          // Create geography record
          const geographyId = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);
          const sketchId = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[${geographyId}]
          )::fragment_input]`;

          // Switch to different user
          await createSession(conn, userIds[1], true, false, projectId);

          // Attempt to update fragments should fail
          await expect(
            conn.any(
              sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
            )
          ).rejects.toThrow(/Permission denied/i);
        }
      );
    });
  });

  describe("Fragment cleanup", () => {
    test("Deleting a sketch deletes its fragments if not shared", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          // Create geography record
          const geographyId = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);
          const sketchId = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[${geographyId}]
          )::fragment_input]`;

          await conn.any(
            sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
          );

          // Get fragment hash before deletion
          const fragments = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketchId}`
          );
          expect(fragments.length).toBe(1);
          const fragmentHash = fragments[0].hash;

          // Delete sketch
          await conn.any(sql`delete from sketches where id = ${sketchId}`);

          // Verify fragment was deleted by checking if it's still accessible
          const remainingFragments = await conn.any(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketchId}`
          );
          expect(remainingFragments.length).toBe(0);
        }
      );
    });

    test("Deleting a sketch preserves shared fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          // Create geography record
          const geographyId = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);

          // Create two sketches with same geometry
          const sketch1Id = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'shape 1', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );
          const sketch2Id = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'shape 2', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[${geographyId}]
          )::fragment_input]`;

          // Update fragments for both sketches
          await conn.any(
            sql`select update_sketch_fragments(${sketch1Id}, ${fragmentInput})`
          );
          await conn.any(
            sql`select update_sketch_fragments(${sketch2Id}, ${fragmentInput})`
          );

          // Get fragment hash before deletion
          const fragments1 = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketch1Id}`
          );
          const fragmentHash = fragments1[0].hash;

          // Delete first sketch
          await conn.any(sql`delete from sketches where id = ${sketch1Id}`);

          // Verify fragment still exists by checking second sketch
          const fragments2 = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketch2Id}`
          );
          expect(fragments2.length).toBe(1);
          expect(fragments2[0].hash).toBe(fragmentHash);
        }
      );
    });

    test("Orphaned fragments are cleaned up when all sketches are deleted", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);
          const sketchId = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[]::int[]
          )::fragment_input]`;

          await conn.any(
            sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
          );

          // Get fragment hash before deletion
          const fragments = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketchId}`
          );
          expect(fragments.length).toBe(1);
          const fragmentHash = fragments[0].hash;

          // Delete the sketch
          await conn.any(sql`delete from sketches where id = ${sketchId}`);

          // Verify fragment was deleted by checking if it's still accessible through sketches_fragments
          const remainingFragments = await conn.any(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketchId}`
          );
          expect(remainingFragments.length).toBe(0);
        }
      );
    });
  });

  describe("Fragment retrieval", () => {
    test("sketches_fragments function returns correct fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          // Create geography record
          const geographyId = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);
          const sketchId = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[${geographyId}]
          )::fragment_input]`;

          await conn.any(
            sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
          );

          // Test sketches_fragments function
          const fragments = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketchId}`
          );
          expect(fragments.length).toBe(1);
          expect(fragments[0].geometry).toBeTruthy();
          expect(fragments[0].hash).toBeTruthy();
        }
      );
    });

    test("Copying a collection with sketches that have fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          /**
           * Testing copying the following structure:
           *
           * > my collection
           *   * shape a (with fragments)
           *   > folder a
           *     * shape b (with fragments)
           *     > folder b
           *       * shape c (with fragments)
           */

          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type, allow_multi) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON', false) returning id`
          );
          const collectionClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
          );
          await createSession(conn, userIds[0], true, false, projectId);

          // Create collection and folder structure
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
          const shapeC = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom, folder_id) values (${userIds[0]}, ${polygonClassId}, 'shape c', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon}), ${folderB}) returning id`
          );

          // Add fragments to each sketch
          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[]::int[]
          )::fragment_input]`;

          await conn.any(
            sql`select update_sketch_fragments(${shapeA}, ${fragmentInput})`
          );
          await conn.any(
            sql`select update_sketch_fragments(${shapeB}, ${fragmentInput})`
          );
          await conn.any(
            sql`select update_sketch_fragments(${shapeC}, ${fragmentInput})`
          );

          // Copy the collection
          const rows = await conn.any(
            sql`select copy_sketch_toc_item_recursive(${collectionId}, 'sketch', true);`
          );
          const copyId = rows[0].copy_sketch_toc_item_recursive;
          expect(copyId).toBeTruthy();
          expect(copyId).not.toBe(collectionId);

          // Get all sketches in the copied collection
          const sketches = await conn.manyFirst(
            sql`select * from get_child_sketches_recursive(${copyId}, 'sketch')`
          );
          // @ts-ignore
          const sketchIds = sketches[0] as number[];
          expect(sketchIds.length).toBe(3);

          // Verify each copied sketch has the same fragments as the original
          const originalFragments = await conn.many(
            sql`select sketches_fragments(sketches.*) from sketches where id = ${shapeA}`
          );
          const copiedFragments = await conn.many(
            sql`select sketches_fragments(sketches.*) from sketches where id = ${sketchIds[0]}`
          );
          expect(copiedFragments.length).toBe(originalFragments.length);
          expect(copiedFragments[0].hash).toBe(originalFragments[0].hash);

          // Verify fragments are shared (same fragment_hash)
          const fragmentHashes = await conn.manyFirst(
            sql`select fragment_hash from sketch_fragments where sketch_id = ${sketchIds[0]}`
          );
          const originalFragmentHashes = await conn.manyFirst(
            sql`select fragment_hash from sketch_fragments where sketch_id = ${shapeA}`
          );
          expect(fragmentHashes).toEqual(originalFragmentHashes);
        }
      );
    });
  });

  describe("Geography associations", () => {
    test("Geography associations are preserved when copying sketches", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          // Create geography
          const geographyId = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);
          const sketchId = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          // Create fragment with geography
          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[${geographyId}]
          )::fragment_input]`;

          await conn.any(
            sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
          );

          // Copy the sketch
          const copyId = await conn.oneFirst(
            sql`select id from copy_sketch(${sketchId})`
          );

          // Verify the copied sketch has the same fragment with the same geography
          const originalFragments = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketchId}`
          );
          const copiedFragments = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${copyId}`
          );
          expect(copiedFragments.length).toBe(1);
          expect(copiedFragments[0].hash).toBe(originalFragments[0].hash);

          const copiedGeographies = await conn.manyFirst(
            sql`select geography_id from fragment_geographies where fragment_hash = ${copiedFragments[0].hash}`
          );
          expect(copiedGeographies).toEqual([geographyId]);
        }
      );
    });
  });

  describe("Fragment deduplication", () => {
    test("Cannot create duplicate fragments with same geometry and geographies", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          // Create geography
          const geographyId = await conn.oneFirst(
            sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);
          const sketchId = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[${geographyId}]
          )::fragment_input]`;

          // First update should succeed
          await conn.any(
            sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
          );

          // Second update with same geometry and geographies should reuse the same fragment
          await conn.any(
            sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
          );

          // Verify we still only have one fragment
          const fragments = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketchId}`
          );
          expect(fragments.length).toBe(1);
        }
      );
    });
  });

  describe("Antimeridian handling", () => {
    test("Valid MultiPolygon that doesn't span antimeridian is accepted", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const polygonClassId = await conn.oneFirst(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
          );

          await createSession(conn, userIds[0], true, false, projectId);
          const sketchId = await conn.oneFirst(
            sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${userIds[0]}, ${polygonClassId}, 'my shape', st_geomfromgeojson(${polygon}), st_geomfromgeojson(${polygon})) returning id`
          );

          const fragmentInput = sql`array[(
            st_geomfromgeojson(${polygon}),
            array[]::int[]
          )::fragment_input]`;

          // This should succeed since polygon doesn't span antimeridian
          await conn.any(
            sql`select update_sketch_fragments(${sketchId}, ${fragmentInput})`
          );

          const fragments = await conn.many(
            sql`select (sketches_fragments(sketches.*)).* from sketches where id = ${sketchId}`
          );
          expect(fragments.length).toBe(1);
        }
      );
    });
  });
});

describe("overlapping_fragments_for_collection", () => {
  test("overlapping_fragments_for_collection returns correct fragments", async () => {
    const polygonA = {
      type: "Feature",
      properties: {
        __geographyIds: [],
        __sketchIds: [1],
      },
      geometry: {
        coordinates: [
          [
            [-156.1735185066244, 18.775952813480913],
            [-156.1735185066244, 18.5252978761161],
            [-155.5835539973488, 18.5252978761161],
            [-155.5835539973488, 18.775952813480913],
            [-156.1735185066244, 18.775952813480913],
          ],
        ],
        type: "Polygon",
      },
    } as SketchFragment;

    const polygonB = {
      type: "Feature",
      properties: {
        __geographyIds: [],
        __sketchIds: [2],
      },
      geometry: {
        coordinates: [
          [
            [-155.67652041076562, 18.19183988837578],
            [-155.9059510532617, 18.63830908545114],
            [-156.05344218058067, 18.187391609152385],
            [-155.67652041076562, 18.19183988837578],
          ],
        ],
        type: "Polygon",
      },
    } as SketchFragment;

    const revisedPolygonB = {
      type: "Feature",
      properties: {
        __geographyIds: [],
        __sketchIds: [2],
      },
      geometry: {
        coordinates: [
          [
            [-155.67652041076562, 18.19183988837578],
            [-155.88880840947195, 18.418873372021764],
            [-156.05344218058067, 18.187391609152385],
            [-155.67652041076562, 18.19183988837578],
          ],
        ],
        type: "Polygon",
      },
    } as SketchFragment;

    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const polygonClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning id`
        );

        // Create geography
        const geographyId = await conn.oneFirst(
          sql`insert into project_geography (project_id, name) values (${projectId}, 'Geography 1') returning id`
        );

        await createSession(conn, userIds[0], true, false, projectId);
        const sketchA = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${
            userIds[0]
          }, ${polygonClassId}, 'my shape', st_geomfromgeojson(${JSON.stringify(
            polygonA.geometry
          )}), st_geomfromgeojson(${JSON.stringify(
            polygonA.geometry
          )})) returning id`
        );

        const sketchB = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name, user_geom, geom) values (${
            userIds[0]
          }, ${polygonClassId}, 'my shape', st_geomfromgeojson(${JSON.stringify(
            polygonB.geometry
          )}), st_geomfromgeojson(${JSON.stringify(
            polygonB.geometry
          )})) returning id`
        );

        // Update polygon objects with actual geography ID
        polygonA.properties.__geographyIds = [geographyId as number];
        polygonB.properties.__geographyIds = [geographyId as number];

        const fragments = eliminateOverlap([polygonA], [polygonB]);
        expect(fragments.length).toBe(3);
        // should be one fragment related to both sketches
        const overlapping = fragments.filter(
          (f) => f.properties.__sketchIds.length === 2
        );
        expect(overlapping.length).toBe(1);
        const overlap = overlapping[0];
        expect(overlap.properties.__sketchIds).toEqual([1, 2]);
        expect(overlap.properties.__geographyIds).toEqual([
          geographyId as number,
        ]);

        // add fragments to sketchA
        const fragmentsForA = fragments.filter((f) =>
          f.properties.__sketchIds.includes(1)
        );

        const fragmentInputsA = fragmentsForA.map(
          (f) =>
            sql`(st_geomfromgeojson(${JSON.stringify(
              f.geometry
            )}), array[${f.properties.__geographyIds.join(
              ","
            )}])::fragment_input`
        );
        const fragmentInputA = sql`array[${sql.join(
          fragmentInputsA,
          sql`, `
        )}]`;

        await conn.any(
          sql`select update_sketch_fragments(${sketchA}, ${fragmentInputA})`
        );

        // add fragments to sketchB
        const fragmentsForB = fragments.filter((f) =>
          f.properties.__sketchIds.includes(2)
        );

        const fragmentInputsB = fragmentsForB.map(
          (f) =>
            sql`(st_geomfromgeojson(${JSON.stringify(
              f.geometry
            )}), array[${f.properties.__geographyIds.join(
              ","
            )}])::fragment_input`
        );
        const fragmentInputB = sql`array[${sql.join(
          fragmentInputsB,
          sql`, `
        )}]`;

        await conn.any(
          sql`select update_sketch_fragments(${sketchB}, ${fragmentInputB})`
        );

        // Create a collection and add both sketches to it
        await createSession(conn, adminId, true, false, projectId);
        const collectionClassId = await conn.oneFirst(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Collection', 'COLLECTION') returning id`
        );

        // Switch to user session to create the collection
        await createSession(conn, userIds[0], true, false, projectId);
        const collectionId = await conn.oneFirst(
          sql`insert into sketches (user_id, sketch_class_id, name) values (${userIds[0]}, ${collectionClassId}, 'my collection') returning id`
        );

        // Update sketches to be in the collection
        await conn.any(
          sql`update sketches set collection_id = ${collectionId} where id in (${sketchA}, ${sketchB})`
        );

        const preparedSketchA = prepareSketch(polygonA);

        const envelopeGeometries = preparedSketchA.envelopes.map(
          (e) =>
            sql`ST_MakeEnvelope(${e.minX}, ${e.minY}, ${e.maxX}, ${e.maxY}, 4326)`
        );
        const { rows: overlappingFragments } =
          await conn.query<ReturnedFragment>(
            sql`SELECT * FROM overlapping_fragments_for_collection(
            ${collectionId}, 
            ARRAY[${sql.join(envelopeGeometries, sql`, `)}],
            ${sketchA}
          )`
          );

        const hashes = hashesFromFragments(overlappingFragments);

        expect(sketchIdsFromFragments(overlappingFragments)).toEqual([
          sketchA!,
          sketchB!,
        ]);
        // Should return fragments from both sketches since they overlap
        expect(overlappingFragments.length).toBe(3);

        // Check that we have fragments from both sketches
        const sketchIds = overlappingFragments.flatMap((f) => f.sketch_ids);
        expect(sketchIds).toContain(sketchA);
        expect(sketchIds).toContain(sketchB);

        // Revised polygonB should still return all the same fragments
        const preparedRevisedPolygonB = prepareSketch(revisedPolygonB);
        const revisedEnvelopeGeometries = preparedRevisedPolygonB.envelopes.map(
          (e) =>
            sql`ST_MakeEnvelope(${e.minX}, ${e.minY}, ${e.maxX}, ${e.maxY}, 4326)`
        );
        const { rows: revisedOverlappingFragments } =
          await conn.query<ReturnedFragment>(
            sql`SELECT * FROM overlapping_fragments_for_collection(
            ${collectionId}, 
            ARRAY[${sql.join(revisedEnvelopeGeometries, sql`, `)}],
            ${sketchB}
          )`
          );
        const revisedHashes = hashesFromFragments(revisedOverlappingFragments);
        expect(revisedHashes).toEqual(hashes);
        expect(revisedOverlappingFragments.length).toBe(3);
        expect(sketchIdsFromFragments(revisedOverlappingFragments)).toEqual([
          sketchA!,
          sketchB!,
        ]);
      }
    );
  });
});

type ReturnedFragment = {
  sketch_ids: number[];
  geography_ids: number[];
  hash: string;
  geometry: string;
};

function sketchIdsFromFragments(fragments: readonly ReturnedFragment[]) {
  const sketchIds = new Set<number>();
  for (const f of fragments) {
    for (const sketchId of f.sketch_ids) {
      sketchIds.add(sketchId);
    }
  }
  return [...sketchIds];
}

function geographyIdsFromFragments(fragments: readonly ReturnedFragment[]) {
  const geographyIds = new Set<number>();
  for (const f of fragments) {
    for (const geographyId of f.geography_ids) {
      geographyIds.add(geographyId);
    }
  }
  return [...geographyIds];
}

function hashesFromFragments(fragments: readonly ReturnedFragment[]) {
  const hashes = new Set<string>();
  for (const f of fragments) {
    hashes.add(f.hash);
  }
  return [...hashes];
}
