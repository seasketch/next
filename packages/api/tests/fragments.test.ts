import { DatabaseTransactionConnectionType, sql } from "slonik";
import { createPool } from "./pool";
import { createSession, projectTransaction, asPg } from "./helpers";
import {
  ClippingFn,
  clipSketchToPolygons,
  eliminateOverlap,
  FragmentResult,
  GeographySettings,
  prepareSketch,
  SketchFragment,
} from "overlay-engine";
import { SourceCache } from "fgb-source";
import { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  createOrUpdateSketch,
  deleteSketchTocItems,
  getFragmentsForSketch,
  updateSketchTocItemParent,
} from "../src/sketches";
import { PoolClient } from "pg";
import calcArea from "@turf/area";
// @ts-ignore
import fetch, { Headers, Request, Response } from "node-fetch";
import * as fs from "fs";
import * as path from "path";

if (!global.fetch) {
  // @ts-ignore
  global.fetch = fetch;
  // @ts-ignore
  global.Headers = Headers;
  // @ts-ignore
  global.Request = Request;
  // @ts-ignore
  global.Response = Response;
}

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

const eezUrl = "https://uploads.seasketch.org/eez-land-joined.fgb";
const territorialSeaUrl =
  "https://uploads.seasketch.org/territorial-sea-land-joined.fgb";
const landUrl = "https://uploads.seasketch.org/land-big-2.fgb";

const sourceCache = new SourceCache("256mb");
const clippingFn: ClippingFn = async (sketch, source, op, query) => {
  const fgbSource = await sourceCache.get<Feature<MultiPolygon | Polygon>>(
    source
  );
  const overlappingFeatures = fgbSource.getFeaturesAsync(sketch.envelopes);
  return clipSketchToPolygons(sketch, op, query, overlappingFeatures);
};

const nationalGeographies: (GeographySettings & { name: string })[] = [
  {
    id: 1,
    name: "Territorial Sea",
    clippingLayers: [
      {
        source: territorialSeaUrl,
        op: "INTERSECT",
      },
      {
        source: landUrl,
        op: "DIFFERENCE",
      },
    ],
  },
  {
    id: 2,
    name: "EEZ",
    clippingLayers: [
      {
        source: eezUrl,
        op: "INTERSECT",
      },
      {
        source: landUrl,
        op: "DIFFERENCE",
      },
    ],
  },
];

describe("Integration tests", () => {
  beforeAll(async () => {
    jest.setTimeout(8000);
  });
  describe("createOrUpdateSketch", () => {
    test("Fragments are created for new sketches", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds } = await setupIntegrationTestEnv(
            conn,
            projectId,
            adminId,
            userIds,
            nationalGeographies,
            2
          );
          await createSession(conn, userIds[0], true, false, projectId);
          // await createSession(conn, userIds[0], true, false, projectId);
          const inputGeom = {
            type: "Feature",
            properties: {},
            geometry: {
              coordinates: [
                [
                  [-155.96373458694404, 19.05002169396613],
                  [-155.96373458694404, 18.77426385112655],
                  [-155.6532455881057, 18.77426385112655],
                  [-155.6532455881057, 19.05002169396613],
                  [-155.96373458694404, 19.05002169396613],
                ],
              ],
              type: "Polygon",
            },
          } as Feature<Polygon>;
          const { sketch, fragments } = await createSketch(
            conn,
            userIds[0],
            inputGeom,
            projectId,
            sketchClassId
          );

          // Uncomment these lines to regenerate expected outputs:
          // await writeOutput(
          //   "createOrUpdateSketch - Fragments are created for new sketches",
          //   "input",
          //   inputGeom
          // );
          // await writeOutput(
          //   "createOrUpdateSketch - Fragments are created for new sketches",
          //   "sketch",
          //   sketch
          // );
          // await writeOutput(
          //   "createOrUpdateSketch - Fragments are created for new sketches",
          //   "fragments",
          //   fragments
          // );

          // ensure all fragment coordinates are between -180 and 180 longitude,
          // and -90 and 90 latitude
          validateFragmentCoordinates(fragments);

          // Compare against expected outputs for regression testing
          compareWithExpectedOutput(
            "createOrUpdateSketch - Fragments are created for new sketches",
            "sketch",
            sketch
          );
          compareWithExpectedOutput(
            "createOrUpdateSketch - Fragments are created for new sketches",
            "fragments",
            fragments
          );

          expect(sketch.id).toBeGreaterThan(0);
          expect(fragments.length).toBe(2);
        }
      );
    });

    test("Antimeridian crossings produce a single sketch geometry and multiple fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds } = await setupIntegrationTestEnv(
            conn,
            projectId,
            adminId,
            userIds,
            nationalGeographies,
            2
          );
          await createSession(conn, userIds[0], true, false, projectId);
          const inputGeom = {
            type: "Feature",
            properties: {},
            geometry: {
              coordinates: [
                [
                  [179.71910173034433, -19.555060759856303],
                  [179.71910173034433, -20.39168462112778],
                  [180.54382364947065, -20.39168462112778],
                  [180.54382364947065, -19.555060759856303],
                  [179.71910173034433, -19.555060759856303],
                ],
              ],
              type: "Polygon",
            },
          } as Feature<Polygon>;
          const { sketch, fragments } = await createSketch(
            conn,
            userIds[0],
            inputGeom,
            projectId,
            sketchClassId
          );
          // Uncomment these lines to regenerate expected outputs:
          // await writeOutput(
          //   "createOrUpdateSketch - Antimeridian crossings produce a single sketch geometry and multiple fragments",
          //   "input",
          //   inputGeom
          // );
          // await writeOutput(
          //   "createOrUpdateSketch - Antimeridian crossings produce a single sketch geometry and multiple fragments",
          //   "sketch",
          //   sketch
          // );
          // await writeOutput(
          //   "createOrUpdateSketch - Antimeridian crossings produce a single sketch geometry and multiple fragments",
          //   "fragments",
          //   fragments
          // );

          validateFragmentCoordinates(fragments);

          // Compare against expected outputs for regression testing
          compareWithExpectedOutput(
            "createOrUpdateSketch - Antimeridian crossings produce a single sketch geometry and multiple fragments",
            "sketch",
            sketch
          );
          compareWithExpectedOutput(
            "createOrUpdateSketch - Antimeridian crossings produce a single sketch geometry and multiple fragments",
            "fragments",
            fragments
          );

          expect(sketch.id).toBeGreaterThan(0);
          expect(sketch.geometry.type).toBe("MultiPolygon");
          expect(sketch.geometry.coordinates.length).toBe(1);
          expect(fragments.length).toBe(4);
        }
      );
    });

    test("Two overlapping sketches in a collection produces multiple fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies,
              2
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const inputs = [
            {
              type: "Feature",
              properties: {
                name: "a",
              },
              geometry: {
                coordinates: [
                  [
                    [177.46661991456375, -21.47749524198204],
                    [177.46661991456375, -22.07146904222543],
                    [178.40351778737318, -22.07146904222543],
                    [178.40351778737318, -21.47749524198204],
                    [177.46661991456375, -21.47749524198204],
                  ],
                ],
                type: "Polygon",
              },
              id: 0,
            },
            {
              type: "Feature",
              properties: {
                name: "b",
              },
              geometry: {
                coordinates: [
                  [
                    [179.59265739516695, -21.611562757901822],
                    [179.59265739516695, -22.446647354141106],
                    [180.85386607010219, -22.446647354141106],
                    [180.85386607010219, -21.611562757901822],
                    [179.59265739516695, -21.611562757901822],
                  ],
                ],
                type: "Polygon",
              },
              id: 1,
            },
            {
              type: "Feature",
              properties: {
                name: "c",
              },
              geometry: {
                coordinates: [
                  [
                    [-178.554032432184, -21.17534377737954],
                    [-179.18023709341125, -21.17534377737954],
                    [-179.18023709341125, -21.665216264126798],
                    [-178.554032432184, -21.665216264126798],
                    [-178.554032432184, -21.17534377737954],
                  ],
                ],
                type: "Polygon",
              },
            },
          ] as Feature<Polygon>[];
          const featureA = inputs[0];
          const featureB = inputs[1];
          const featureC = inputs[2];
          // await writeOutput(
          //   "Two overlapping sketches in a collection produces multiple fragments",
          //   "input",
          //   {
          //     type: "FeatureCollection",
          //     features: inputs,
          //   }
          // );
          await createSession(conn, userIds[0], true, false, projectId);

          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const sketchA = await createSketch(
            conn,
            userIds[0],
            featureA,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const sketchC = await createSketch(
            conn,
            userIds[0],
            featureC,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          // no intersection with any other sketch, or antimeridian
          validateFragmentCoordinates(sketchA.fragments);
          expect(sketchA.fragments.length).toBe(1);
          // Crosses the antimeridian
          validateFragmentCoordinates(sketchB.fragments);
          expect(sketchB.fragments.length).toBe(2);
          // Overlaps neighbor b, and territorial sea
          expect(sketchC.fragments.length).toBe(3);
          const collectionFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          expect(collectionFragments.length).toBe(6);
          await writeOutput(
            "Two overlapping sketches in a collection produces multiple fragments",
            "all fragments",
            collectionFragments
          );
          compareWithExpectedOutput(
            "Two overlapping sketches in a collection produces multiple fragments",
            "all fragments",
            collectionFragments
          );
        }
      );
    });

    test("Creating a sketch with multiple overlaps with neighbor sketches in a collection produces multiple fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 2),
              2
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const existingInput = [
            {
              type: "Feature",
              properties: {},
              geometry: {
                coordinates: [
                  [
                    [-179.69376748065613, -19.733487992663996],
                    [-179.69376748065613, -20.242961918244646],
                    [-178.9252499159708, -20.242961918244646],
                    [-178.9252499159708, -19.733487992663996],
                    [-179.69376748065613, -19.733487992663996],
                  ],
                ],
                type: "Polygon",
              },
            },
            {
              type: "Feature",
              properties: {},
              geometry: {
                coordinates: [
                  [
                    [-181.397612624067, -19.699838631580946],
                    [-181.397612624067, -20.421723623763782],
                    [-180.44441254383713, -20.421723623763782],
                    [-180.44441254383713, -19.699838631580946],
                    [-181.397612624067, -19.699838631580946],
                  ],
                ],
                type: "Polygon",
              },
            },
          ] as Feature<Polygon>[];
          const input = {
            type: "Feature",
            properties: {},
            geometry: {
              coordinates: [
                [
                  [-180.55760505336443, -19.879219862636106],
                  [-180.55760505336443, -20.0863764576697],
                  [-179.5924899721317, -20.0863764576697],
                  [-179.5924899721317, -19.879219862636106],
                  [-180.55760505336443, -19.879219862636106],
                ],
              ],
              type: "Polygon",
            },
          } as Feature<Polygon>;
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          for (const feature of existingInput) {
            await createSketch(
              conn,
              userIds[0],
              feature,
              projectId,
              sketchClassId,
              undefined,
              collection.id
            );
          }
          const newSketch = await createSketch(
            conn,
            userIds[0],
            input,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const collectionFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          await writeOutput(
            "Creating a sketch with multiple overlaps with neighbor sketches in a collection produces multiple fragments",
            "inputs",
            {
              type: "FeatureCollection",
              features: [...existingInput, input],
            }
          );
          await writeOutput(
            "Creating a sketch with multiple overlaps with neighbor sketches in a collection produces multiple fragments",
            "all fragments",
            collectionFragments
          );
          expect(collectionFragments.length).toBe(6);
        }
      );
    });

    test("Updating a sketch to overlap with neighbor creates new fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 2),
              2
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const neighborInput = {
            type: "Feature",
            properties: {
              name: "neighbor",
            },
            geometry: {
              coordinates: [
                [
                  [177.72302930394233, -19.520030766472928],
                  [177.6293966930524, -19.712964327097993],
                  [177.93955471662377, -19.787319527080697],
                  [178.2731208929165, -19.62203878551813],
                  [178.08292965204765, -19.467623216692942],
                  [177.72302930394233, -19.520030766472928],
                ],
              ],
              type: "Polygon",
            },
          } as Feature<Polygon>;
          const input = {
            type: "Feature",
            properties: {
              name: "input",
            },
            geometry: {
              coordinates: [
                [
                  [178.5862049355793, -19.508999008601165],
                  [178.53938863013428, -19.61928266154696],
                  [178.48086824832865, -19.790072757662557],
                  [178.81736044371274, -19.812096888091304],
                  [179.05144197093512, -19.66337497005965],
                  [178.86125073006627, -19.453828937456137],
                  [178.5862049355793, -19.508999008601165],
                ],
              ],
              type: "Polygon",
            },
          } as Feature<Polygon>;
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const neighborSketch = await createSketch(
            conn,
            userIds[0],
            neighborInput,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const inputSketch = await createSketch(
            conn,
            userIds[0],
            input,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const collectionFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          // await writeOutput(
          //   "Updating a sketch to overlap with neighbor creates new fragments",
          //   "inputs",
          //   {
          //     type: "FeatureCollection",
          //     features: [neighborInput, input],
          //   }
          // );
          expect(collectionFragments.length).toBe(2);
          await createOrUpdateSketch({
            pgClient: asPg(conn) as unknown as PoolClient,
            userGeom: {
              type: "Feature",
              properties: {
                name: "input",
              },
              geometry: {
                coordinates: [
                  [
                    [178.5862049355793, -19.508999008601165],
                    [178.0529606573133, -19.616772083295743],
                    [178.48086824832865, -19.790072757662557],
                    [178.81736044371274, -19.812096888091304],
                    [179.05144197093512, -19.66337497005965],
                    [178.86125073006627, -19.453828937456137],
                    [178.5862049355793, -19.508999008601165],
                  ],
                ],
                type: "Polygon",
              },
            } as Feature<Polygon>,
            projectId,
            sketchClassId,
            name: "test",
            collectionId: collection.id,
            folderId: undefined,
            properties: {},
            userId: userIds[0],
            sketchId: inputSketch.sketch.id as number,
          });
          const updatedCollectionFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          // await writeOutput(
          //   "Updating a sketch to overlap with neighbor creates new fragments",
          //   "updated fragments",
          //   updatedCollectionFragments
          // );
          compareWithExpectedOutput(
            "Updating a sketch to overlap with neighbor creates new fragments",
            "updated fragments",
            updatedCollectionFragments
          );
          expect(updatedCollectionFragments.length).toBe(3);
        }
      );
    });

    test("Updating a sketch to no longer overlap with a neighbor", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 2),
              2
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const neighbors = [
            {
              type: "Feature",
              properties: {},
              geometry: {
                coordinates: [
                  [
                    [-119.7953893680354, 34.20717598495169],
                    [-119.7953893680354, 34.13793236148773],
                    [-119.66547737524084, 34.13793236148773],
                    [-119.66547737524084, 34.20717598495169],
                    [-119.7953893680354, 34.20717598495169],
                  ],
                ],
                type: "Polygon",
              },
            },
            {
              type: "Feature",
              properties: {},
              geometry: {
                coordinates: [
                  [
                    [-119.8394220386703, 34.152405873228844],
                    [-119.8394220386703, 34.08751418090428],
                    [-119.67765662456543, 34.08751418090428],
                    [-119.67765662456543, 34.152405873228844],
                    [-119.8394220386703, 34.152405873228844],
                  ],
                ],
                type: "Polygon",
              },
            },
          ] as Feature<Polygon>[];
          const input = {
            type: "Feature",
            properties: {},
            geometry: {
              coordinates: [
                [
                  [-119.57803661085974, 34.092428042893005],
                  [-119.57834889930407, 34.117768695640024],
                  [-119.68702527789176, 34.143618679674205],
                  [-119.70326427699112, 34.143360218967445],
                  [-119.65517185658148, 34.08880733013355],
                  [-119.57803661085974, 34.092428042893005],
                ],
              ],
              type: "Polygon",
            },
          } as Feature<Polygon>;
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          for (const n of neighbors) {
            await createSketch(
              conn,
              userIds[0],
              n,
              projectId,
              sketchClassId,
              undefined,
              collection.id
            );
          }
          const inputSketch = await createSketch(
            conn,
            userIds[0],
            input,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const initialFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          await writeOutput(
            "Updating a sketch to no longer overlap with a neighbor",
            "initial fragments",
            initialFragments
          );
          expect(initialFragments.length).toBe(7);
          await createOrUpdateSketch({
            pgClient: asPg(conn) as unknown as PoolClient,
            userGeom: {
              type: "Feature",
              properties: {
                name: "input",
              },
              geometry: {
                coordinates: [
                  [
                    [-119.57803661085974, 34.092428042893005],
                    [-119.57834889930407, 34.117768695640024],
                    [-119.6670388174617, 34.13172863249778],
                    [-119.66578966368516, 34.10975362087467],
                    [-119.65517185658148, 34.08880733013355],
                    [-119.57803661085974, 34.092428042893005],
                  ],
                ],
                type: "Polygon",
              },
            },
            projectId,
            sketchClassId,
            name: "test",
            collectionId: collection.id,
            folderId: undefined,
            properties: {},
            userId: userIds[0],
            sketchId: inputSketch.sketch.id as number,
          });
          const updatedFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          await writeOutput(
            "Updating a sketch to no longer overlap with a neighbor",
            "updated fragments",
            updatedFragments
          );
          expect(updatedFragments.length).toBe(4);
        }
      );
    });

    test("Unrelated overlap within a collection is not impacted by fragment updates elsewhere", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 2),
              2
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const neighbors = [
            {
              type: "Feature",
              properties: {},
              geometry: {
                coordinates: [
                  [
                    [-119.7953893680354, 34.20717598495169],
                    [-119.7953893680354, 34.13793236148773],
                    [-119.66547737524084, 34.13793236148773],
                    [-119.66547737524084, 34.20717598495169],
                    [-119.7953893680354, 34.20717598495169],
                  ],
                ],
                type: "Polygon",
              },
            },
            {
              type: "Feature",
              properties: {},
              geometry: {
                coordinates: [
                  [
                    [-119.8394220386703, 34.152405873228844],
                    [-119.8394220386703, 34.08751418090428],
                    [-119.67765662456543, 34.08751418090428],
                    [-119.67765662456543, 34.152405873228844],
                    [-119.8394220386703, 34.152405873228844],
                  ],
                ],
                type: "Polygon",
              },
            },
            {
              type: "Feature",
              properties: {
                name: "neighbor3",
              },
              geometry: {
                coordinates: [
                  [
                    [-119.94849753229323, 34.14890904961294],
                    [-119.94849753229323, 34.11852930649634],
                    [-119.83227304717465, 34.11852930649634],
                    [-119.83227304717465, 34.14890904961294],
                    [-119.94849753229323, 34.14890904961294],
                  ],
                ],
                type: "Polygon",
              },
              id: 3,
            },
          ] as Feature<Polygon>[];
          const input = {
            type: "Feature",
            properties: {},
            geometry: {
              coordinates: [
                [
                  [-119.57803661085974, 34.092428042893005],
                  [-119.57834889930407, 34.117768695640024],
                  [-119.68702527789176, 34.143618679674205],
                  [-119.70326427699112, 34.143360218967445],
                  [-119.65517185658148, 34.08880733013355],
                  [-119.57803661085974, 34.092428042893005],
                ],
              ],
              type: "Polygon",
            },
          } as Feature<Polygon>;
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          for (const n of neighbors) {
            await createSketch(
              conn,
              userIds[0],
              n,
              projectId,
              sketchClassId,
              undefined,
              collection.id
            );
          }
          const inputSketch = await createSketch(
            conn,
            userIds[0],
            input,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const initialFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          // await writeOutput(
          //   "Unrelated overlap within a collection is not impacted by fragment updates elsewhere",
          //   "initial fragments",
          //   initialFragments
          // );
          expect(initialFragments.length).toBe(9);
          await createOrUpdateSketch({
            pgClient: asPg(conn) as unknown as PoolClient,
            userGeom: {
              type: "Feature",
              properties: {
                name: "input",
              },
              geometry: {
                coordinates: [
                  [
                    [-119.57803661085974, 34.092428042893005],
                    [-119.57834889930407, 34.117768695640024],
                    [-119.6670388174617, 34.13172863249778],
                    [-119.66578966368516, 34.10975362087467],
                    [-119.65517185658148, 34.08880733013355],
                    [-119.57803661085974, 34.092428042893005],
                  ],
                ],
                type: "Polygon",
              },
            },
            projectId,
            sketchClassId,
            name: "test",
            collectionId: collection.id,
            folderId: undefined,
            properties: {},
            userId: userIds[0],
            sketchId: inputSketch.sketch.id as number,
          });
          const updatedFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          // await writeOutput(
          //   "Unrelated overlap within a collection is not impacted by fragment updates elsewhere",
          //   "updated fragments",
          //   updatedFragments
          // );
          compareWithExpectedOutput(
            "Unrelated overlap within a collection is not impacted by fragment updates elsewhere",
            "updated fragments",
            updatedFragments
          );
          expect(updatedFragments.length).toBe(6);
        }
      );
    });

    test("High-protection MPA within Low-Protection NMS scenario", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const nms = {
            type: "Feature",
            properties: {},
            geometry: {
              coordinates: [
                [
                  [-119.99264132815875, 34.16694515002861],
                  [-120.24515685327896, 34.17051572439864],
                  [-120.57540935618125, 34.141187215613115],
                  [-120.6289747011642, 34.055142680616285],
                  [-120.46697389345498, 33.82710605620815],
                  [-120.09572271243863, 33.78093145610964],
                  [-119.8593607496702, 33.78862873880166],
                  [-119.48367791940399, 33.85185372536827],
                  [-119.3040911470111, 33.943430741863494],
                  [-119.28597140540197, 34.04758838305804],
                  [-119.33751200375681, 34.12828933333195],
                  [-119.48931517234914, 34.19259484448145],
                  [-119.81869180871101, 34.201920072596764],
                  [-119.99264132815875, 34.16694515002861],
                ],
              ],
              type: "Polygon",
            },
          } as Feature<Polygon>;
          const mpa = {
            type: "Feature",
            properties: {},
            geometry: {
              coordinates: [
                [
                  [-119.5855575174486, 34.04967543466515],
                  [-119.55754500513144, 34.04967543466515],
                  [-119.55754500513144, 34.08003999982695],
                  [-119.5855575174486, 34.08003999982695],
                  [-119.5855575174486, 34.04967543466515],
                ],
              ],
              type: "Polygon",
            },
          } as Feature<Polygon>;
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          await createSketch(
            conn,
            userIds[0],
            nms,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const mpaSketch = await createSketch(
            conn,
            userIds[0],
            mpa,
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const fragments = await fragmentsForCollection(conn, collection.id);
          // await writeOutput(
          //   "High-protection MPA within Low-Protection NMS scenario",
          //   "fragments",
          //   fragments
          // );
          compareWithExpectedOutput(
            "High-protection MPA within Low-Protection NMS scenario",
            "fragments",
            fragments
          );
          expect(fragments.length).toBe(2);
          await createOrUpdateSketch({
            pgClient: asPg(conn) as unknown as PoolClient,
            userGeom: {
              type: "Feature",
              properties: {
                name: "updated",
              },
              geometry: {
                coordinates: [
                  [
                    [-119.97468117299056, 34.30104723623559],
                    [-119.97468117299056, 34.243377362251664],
                    [-119.88847386563229, 34.243377362251664],
                    [-119.88847386563229, 34.30104723623559],
                    [-119.97468117299056, 34.30104723623559],
                  ],
                ],
                type: "Polygon",
              },
              id: 2,
            },
            projectId,
            sketchClassId,
            name: "test",
            collectionId: collection.id,
            folderId: undefined,
            properties: {},
            userId: userIds[0],
            sketchId: mpaSketch.sketch.id as number,
          });
          const updatedFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          // await writeOutput(
          //   "High-protection MPA within Low-Protection NMS scenario",
          //   "updated fragments",
          //   updatedFragments
          // );
          expect(updatedFragments.length).toBe(2);
        }
      );
    });
  });

  describe("copySketchTocItem", () => {
    test("Copying an individual sketch create new references to the same fragment(s)", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const { sketch, fragments } = await createSketch(
            conn,
            userIds[0],
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
            },
            projectId,
            sketchClassId,
            undefined
          );
          expect(fragments.length).toBe(1);
          const copy = await copySketch(sketch.id as number, conn);
          expect(copy.fragments.length).toBe(1);
          expect(copy.fragments[0].properties.__sketchIds).toEqual([
            sketch.id,
            copy.sketch.id,
          ]);
          expect(copy.fragments[0].properties.__geographyIds).toEqual(
            fragments[0].properties.__geographyIds
          );
        }
      );
    });

    test("Copying a sketch within a collection", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const { sketch, fragments } = await createSketch(
            conn,
            userIds[0],
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
            },
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const copy = await copySketch(sketch.id as number, conn);
          expect(copy.fragments.length).toBe(1);
          expect(copy.fragments[0].properties.__sketchIds).toEqual([
            sketch.id,
            copy.sketch.id,
          ]);
          const collectionFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          expect(collectionFragments.length).toBe(1);
          expect(collectionFragments[0].properties.__sketchIds).toEqual([
            sketch.id,
            copy.sketch.id,
          ]);
          // If one of the sketches is changed, the number of fragments should
          // increase
          await createOrUpdateSketch({
            pgClient: asPg(conn) as unknown as PoolClient,
            userGeom: {
              type: "Feature",
              properties: {},
              geometry: {
                coordinates: [
                  [
                    [-119.94113964916716, 34.394290193603794],
                    [-119.94113964916716, 34.35408297723009],
                    [-119.8543220932051, 34.35408297723009],
                    [-119.8543220932051, 34.394290193603794],
                    [-119.94113964916716, 34.394290193603794],
                  ],
                ],
                type: "Polygon",
              },
            },
            projectId,
            sketchClassId,
            name: "test",
            collectionId: collection.id,
            folderId: undefined,
            properties: {},
            userId: userIds[0],
            sketchId: sketch.id as number,
          });
          const updatedCollectionFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          expect(updatedCollectionFragments.length).toBe(2);
          updatedCollectionFragments.sort((a, b) => {
            return a.properties.__sketchIds[0] - b.properties.__sketchIds[0];
          });
          // should have 2 fragments referring to different sketch ids
          expect(updatedCollectionFragments[0].properties.__sketchIds).toEqual([
            sketch.id,
          ]);
          expect(updatedCollectionFragments[1].properties.__sketchIds).toEqual([
            copy.sketch.id,
          ]);
        }
      );
    });

    test("Copying a whole collection makes references to the same fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const { sketch, fragments } = await createSketch(
            conn,
            userIds[0],
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
            },
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const { sketch: collectionCopy } = await copySketch(
            collection.id as number,
            conn
          );
          expect(collectionCopy.id).not.toBe(collection.id);
          const fragmentsForOriginalCollection = await fragmentsForCollection(
            conn,
            collection.id
          );
          const fragmentsForCopyCollection = await fragmentsForCollection(
            conn,
            collectionCopy.id as number
          );
          expect(fragmentsForOriginalCollection.length).toBe(
            fragmentsForCopyCollection.length
          );
          expect(
            fragmentsForOriginalCollection[0].properties.__sketchIds
          ).toEqual(fragmentsForCopyCollection[0].properties.__sketchIds);
        }
      );
    });

    test("Copied fragments are reconsciled properly across user accounts", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          /**
           * Scenario description:
           * - User 1 creates a collection with a single sketch
           * - User 2 copies that collection
           * - At this point, fragments are shared between the two users
           * - User 2 updates their copy of the sketch to slightly move a
           *   boundary
           * - Now, there should be two distinct fragments, and only two. The
           *   overlap between these two fragments should not be union'd
           */
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const { sketch, fragments } = await createSketch(
            conn,
            userIds[0],
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
            },
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          await createSession(conn, userIds[1], true, false, projectId);
          const { sketch: copiedCollection } = await copySketch(
            collection.id as number,
            conn
          );
          expect(copiedCollection.id).not.toBe(collection.id);
          const userId = await conn.oneFirst(
            sql`select user_id from sketches where id = ${
              copiedCollection.id as number
            }`
          );
          expect(userId).toBe(userIds[1]);
          const originalFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          const copiedFragments = await fragmentsForCollection(
            conn,
            copiedCollection.id as number
          );
          // await writeOutput(
          //   "Copied fragments are reconsciled properly across user accounts",
          //   "originalFragments",
          //   originalFragments
          // );
          // await writeOutput(
          //   "Copied fragments are reconsciled properly across user accounts",
          //   "copiedFragments",
          //   copiedFragments
          // );
          expect(originalFragments.length).toBe(copiedFragments.length);
          expect(originalFragments.map((f) => f.properties.__hash)).toEqual(
            copiedFragments.map((f) => f.properties.__hash)
          );
          let copiedSketchId: number | undefined;
          // look for new sketch id referenced in copied fragments
          for (const f of copiedFragments) {
            if (f.properties.__sketchIds.length === 2) {
              for (const sketchId of f.properties.__sketchIds) {
                if (sketchId !== sketch.id) {
                  copiedSketchId = sketchId;
                  break;
                }
              }
              break;
            }
          }
          if (!copiedSketchId) {
            throw new Error("No copied sketch id found");
          }
          // User 2 updates their copy of the sketch to slightly move a
          // boundary
          await createSession(conn, userIds[1], true, false, projectId);

          await createOrUpdateSketch({
            pgClient: asPg(conn) as unknown as PoolClient,
            userGeom: {
              type: "Feature",
              properties: {},
              geometry: {
                coordinates: [
                  [
                    [-119.68574523925781, 34.39246231021496],
                    [-119.73896026611328, 34.37772911466851],
                    [-119.69158172607422, 34.345987273972916],
                    [-119.68574523925781, 34.39246231021496],
                  ],
                ],
                type: "Polygon",
              },
            },
            projectId,
            sketchClassId,
            name: "test",
            collectionId: copiedCollection.id as number,
            folderId: undefined,
            properties: {},
            userId: userIds[1],
            sketchId: copiedSketchId,
          });
          const updatedCopiedFragments = await fragmentsForCollection(
            conn,
            copiedCollection.id as number
          );
          // await writeOutput(
          //   "Copied fragments are reconsciled properly across user accounts",
          //   "updatedCopiedFragments",
          //   updatedCopiedFragments
          // );
          expect(updatedCopiedFragments.length).toBe(1);
          expect(updatedCopiedFragments[0].properties.__sketchIds).toEqual([
            copiedSketchId,
          ]);
          const newOriginalFragments = await fragmentsForCollection(
            conn,
            collection.id
          );
          expect(newOriginalFragments.length).toBe(1);
          expect(newOriginalFragments[0].properties.__sketchIds).toEqual([
            sketch.id,
          ]);
          expect(newOriginalFragments[0].properties.__hash).toEqual(
            originalFragments[0].properties.__hash
          );
        }
      );
    });
  });

  describe("deleteSketchTocItems", () => {
    test("Deleting a sketch deletes related fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const { sketch, fragments } = await createSketch(
            conn,
            userIds[0],
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
            },
            projectId,
            sketchClassId,
            undefined,
            undefined
          );
          expect(fragments.length).toBe(1);
          expect(fragments[0].properties.__sketchIds).toEqual([sketch.id]);
          const hashes = fragments.map((f) => f.properties.__hash);
          await deleteSketchTocItems(
            [{ type: "sketch", id: parseInt(sketch.id as string) }],
            asPg(conn) as unknown as PoolClient
          );
          const remainingFragments = await getFragments(conn, hashes);
          expect(remainingFragments.length).toBe(0);
        }
      );
    });

    test("Deleting a collection deletes related fragments", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const { sketch, fragments } = await createSketch(
            conn,
            userIds[0],
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
            },
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          expect(fragments.length).toBe(1);
          expect(fragments[0].properties.__sketchIds).toEqual([sketch.id]);
          const hashes = fragments.map((f) => f.properties.__hash);
          await deleteSketchTocItems(
            [{ type: "sketch", id: collection.id! }],
            asPg(conn) as unknown as PoolClient
          );
          const remainingFragments = await getFragments(conn, hashes);
          expect(remainingFragments.length).toBe(0);
        }
      );
    });

    test("Deleting a sketch that has overlap with a neighbor in a collection deletes only the non-overlapping fragment(s)", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const sketchA = await createSketch(
            conn,
            userIds[0],
            {
              type: "Feature",
              properties: {
                name: "sketchA",
              },
              geometry: {
                coordinates: [
                  [
                    [-119.97210491435324, 34.31860175394256],
                    [-119.97210491435324, 34.24505627487936],
                    [-119.84470091133778, 34.24505627487936],
                    [-119.84470091133778, 34.31860175394256],
                    [-119.97210491435324, 34.31860175394256],
                  ],
                ],
                type: "Polygon",
              },
            },
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const sketchB = await createSketch(
            conn,
            userIds[0],
            {
              type: "Feature",
              properties: { name: "sketchB" },
              geometry: {
                coordinates: [
                  [
                    [-119.86331702136752, 34.25755873771136],
                    [-119.86331702136752, 34.196471395783774],
                    [-119.68762748296275, 34.196471395783774],
                    [-119.68762748296275, 34.25755873771136],
                    [-119.86331702136752, 34.25755873771136],
                  ],
                ],
                type: "Polygon",
              },
            },
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const fragments = await fragmentsForCollection(conn, collection.id!);
          expect(fragments.length).toBe(3);
          const overlappingFragments = fragments.filter(
            (f) => f.properties.__sketchIds.length === 2
          );
          expect(overlappingFragments.length).toBe(1);
          await deleteSketchTocItems(
            [{ type: "sketch", id: parseInt(sketchA.sketch.id as string) }],
            asPg(conn) as unknown as PoolClient
          );
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          /**
           * Note here that the overlapping fragment is not deleted at this
           * point. This means that collections may contain "stale" fragments
           * that wouldn't otherwise be generated if the deleted sketch hadn't
           * ever existed. This is fine, and actually beneficial in that report
           * results need not be re-generated for these sketches, as would be
           * the case if every deletion triggered some sort of consolidation of
           * fragments.
           */
          expect(remainingFragments.length).toBe(2);
          const oldOverlap = remainingFragments.find(
            (f) =>
              f.properties.__hash === overlappingFragments[0].properties.__hash
          );
          expect(oldOverlap).not.toBeUndefined();
          /**
           * If sketchB is modified in the future, or new overlap is created
           * with it, the old overlapping fragment will be reconciled.
           */
          const sketchC = await createSketch(
            conn,
            userIds[0],
            {
              type: "Feature",
              properties: {
                name: "sketchC",
              },
              geometry: {
                coordinates: [
                  [
                    [-119.86270170653235, 34.29649624603775],
                    [-119.86270170653235, 34.25303387664022],
                    [-119.83021604972475, 34.25303387664022],
                    [-119.83021604972475, 34.29649624603775],
                    [-119.86270170653235, 34.29649624603775],
                  ],
                ],
                type: "Polygon",
              },
            },
            projectId,
            sketchClassId,
            undefined,
            collection.id
          );
          const remainingFragments2 = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Deleting a sketch that has overlap with a neighbor in a collection deletes only the non-overlapping fragment(s)",
            "remainingFragments2",
            remainingFragments2
          );
          expect(remainingFragments2.length).toBe(3);
          const newOverlap = remainingFragments2.find(
            (f) =>
              f.properties.__hash === overlappingFragments[0].properties.__hash
          );
          expect(newOverlap).toBeUndefined();
          // verify that remainingFragments2 matches expected output
          compareWithExpectedOutput(
            "Deleting a sketch that has overlap with a neighbor in a collection deletes only the non-overlapping fragment(s)",
            "remainingFragments2",
            remainingFragments2
          );
        }
      );
    });

    test("Deleting a folder of sketches within a collection, which overlap with neighbors, deletes only the non-overlapping fragment(s)", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const folder = await createFolder(
            conn,
            "test folder",
            collection.id!,
            userIds[0],
            projectId
          );
          const sketchA = await createSketch(
            conn,
            userIds[0],
            {
              type: "Feature",
              properties: {
                name: "sketch-a",
              },
              geometry: {
                coordinates: [
                  [
                    [-120.07208496480516, 34.31278228669419],
                    [-120.07208496480516, 34.23440415433534],
                    [-119.94134895366315, 34.23440415433534],
                    [-119.94134895366315, 34.31278228669419],
                    [-120.07208496480516, 34.31278228669419],
                  ],
                ],
                type: "Polygon",
              },
            },
            projectId,
            sketchClassId,
            undefined,
            collection.id,
            undefined
          );
          const sketchB = await createSketch(
            conn,
            userIds[0],
            {
              type: "Feature",
              properties: {
                name: "sketch-b",
              },
              geometry: {
                coordinates: [
                  [
                    [-120.22804525769584, 34.316579278744484],
                    [-120.22804525769584, 34.26151287401366],
                    [-120.05458505990643, 34.26151287401366],
                    [-120.05458505990643, 34.316579278744484],
                    [-120.22804525769584, 34.316579278744484],
                  ],
                ],
                type: "Polygon",
              },
              id: 1,
            },
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );
          const sketchC = await createSketch(
            conn,
            userIds[0],
            {
              type: "Feature",
              properties: {
                name: "sketch-c",
              },
              geometry: {
                coordinates: [
                  [
                    [-119.81362064721381, 34.32363646394519],
                    [-119.96059184928183, 34.32363646394519],
                    [-119.96059184928183, 34.26645620467768],
                    [-119.81362064721381, 34.26645620467768],
                    [-119.81362064721381, 34.32363646394519],
                  ],
                ],
                type: "Polygon",
              },
              id: 2,
            },
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );
          const children = await conn.query(sql`
            select get_child_sketches_recursive(${collection.id}, 'sketch')
          `);
          const fragments = await fragmentsForCollection(conn, collection.id!);
          await writeOutput(
            "Deleting a folder of sketches within a collection, which overlap with neighbors, deletes only the non-overlapping fragment(s)",
            "fragments",
            fragments
          );
          expect(fragments.length).toBe(5);
          await deleteSketchTocItems(
            [{ type: "sketch_folder", id: folder.id }],
            asPg(conn) as unknown as PoolClient
          );
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Deleting a folder of sketches within a collection, which overlap with neighbors, deletes only the non-overlapping fragment(s)",
            "remainingFragments",
            remainingFragments
          );
          // Remember, overlap-generated fragments won't be cleaned up until the
          // sketch is edited or another sketch overlaps it, triggering new
          // fragment generation.
          expect(remainingFragments.length).toBe(3);
          // update the sketch
          const updatedFeature: Feature<Polygon> = {
            type: "Feature",
            properties: {},
            geometry: {
              coordinates: [
                [
                  [-120.08289575431301, 34.30900063176291],
                  [-120.08289575431301, 34.22710427841557],
                  [-119.9466350850291, 34.22710427841557],
                  [-119.9466350850291, 34.30900063176291],
                  [-120.08289575431301, 34.30900063176291],
                ],
              ],
              type: "Polygon",
            },
          };
          await createOrUpdateSketch({
            pgClient: asPg(conn) as unknown as PoolClient,
            userGeom: updatedFeature,
            projectId,
            sketchClassId,
            name: "test",
            collectionId: collection.id,
            folderId: undefined,
            properties: {},
            userId: userIds[0],
            // sketchId: sketchA.sketch.id as number,
          });
          const remainingFragments2 = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Deleting a folder of sketches within a collection, which overlap with neighbors, deletes only the non-overlapping fragment(s)",
            "remainingFragments2",
            remainingFragments2
          );
          expect(remainingFragments2.length).toBe(3);
        }
      );
    });
  });

  describe("updateSketchTocItemParent", () => {
    // Test data for the new test cases
    const featureA = {
      type: "Feature",
      properties: {
        name: "feature-a",
      },
      geometry: {
        coordinates: [
          [
            [-120.19740752483946, 34.33799761602599],
            [-120.19740752483946, 34.30087228990429],
            [-120.11093404341582, 34.30087228990429],
            [-120.11093404341582, 34.33799761602599],
            [-120.19740752483946, 34.33799761602599],
          ],
        ],
        type: "Polygon",
      },
    } as Feature<Polygon>;

    const featureB = {
      type: "Feature",
      properties: {
        name: "feature-b",
      },
      geometry: {
        coordinates: [
          [
            [-120.29340451743317, 34.35938441202245],
            [-120.29340451743317, 34.29206048013964],
            [-120.18902683500993, 34.29206048013964],
            [-120.18902683500993, 34.35938441202245],
            [-120.29340451743317, 34.35938441202245],
          ],
        ],
        type: "Polygon",
      },
    } as Feature<Polygon>;

    const featureC = {
      type: "Feature",
      properties: {
        name: "feature-c",
      },
      geometry: {
        coordinates: [
          [
            [-119.9977947307161, 34.377307375504],
            [-120.121981316373, 34.377307375504],
            [-120.121981316373, 34.28733948755175],
            [-119.9977947307161, 34.28733948755175],
            [-119.9977947307161, 34.377307375504],
          ],
        ],
        type: "Polygon",
      },
    } as Feature<Polygon>;

    const existingFeatureA = {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [-120.21977093949863, 34.3163493289872],
            [-120.21977093949863, 34.24894022417101],
            [-120.10353388216868, 34.24894022417101],
            [-120.10353388216868, 34.3163493289872],
            [-120.21977093949863, 34.3163493289872],
          ],
        ],
        type: "Polygon",
      },
    } as Feature<Polygon>;
    const existingCollectionFC = {
      type: "FeatureCollection",
      features: [existingFeatureA],
    } as FeatureCollection<Polygon>;

    test("Moving a sketch into a collection", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const sketchA = await createSketch(
            conn,
            userIds[0],
            existingFeatureA,
            projectId,
            sketchClassId,
            undefined,
            collection.id,
            undefined
          );
          await writeOutput(
            "Moving a sketch into a collection",
            "sketchA",
            sketchA.fragments
          );
          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            undefined
          );
          await writeOutput(
            "Moving a sketch into a collection",
            "sketchB",
            sketchB.fragments
          );
          const fragments = await fragmentsForCollection(conn, collection.id!);
          expect(fragments.length).toBe(1);
          await writeOutput(
            "Moving a sketch into a collection",
            "original fragments",
            fragments
          );
          await updateParent(
            conn,
            sketchB.sketch.id! as number,
            collection.id!,
            "sketch"
          );
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Moving a sketch into a collection",
            "remainingFragments",
            remainingFragments
          );
          expect(remainingFragments.length).toBe(3);
        }
      );
    });

    test("Moving a sketch into a folder, which is part of a collection", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );
          const folder = await createFolder(
            conn,
            "test folder",
            collection.id!,
            userIds[0],
            projectId
          );
          const sketchA = await createSketch(
            conn,
            userIds[0],
            existingFeatureA,
            projectId,
            sketchClassId,
            undefined,
            collection.id,
            undefined
          );
          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            undefined
          );
          const fragments = await fragmentsForCollection(conn, collection.id!);
          expect(fragments.length).toBe(1);
          await updateParent(
            conn,
            sketchB.sketch.id! as number,
            folder.id!,
            "sketch_folder"
          );
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          expect(remainingFragments.length).toBe(3);
        }
      );
    });

    test("Moving a folder full of sketches into a collection", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);

          // Create a collection
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );

          // Create a folder outside the collection
          const folder = await createFolder(
            conn,
            "test folder",
            null, // Not in collection initially
            userIds[0],
            projectId
          );

          const sketchA = await createSketch(
            conn,
            userIds[0],
            featureA,
            projectId,
            sketchClassId,
            undefined,
            collection.id!,
            undefined
          );
          // Create sketches in the folder
          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );
          const sketchC = await createSketch(
            conn,
            userIds[0],
            featureC,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );

          // Initially, collection should have just one fragment for sketchA
          const initialFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          expect(initialFragments.length).toBe(1);

          // Move the folder into the collection
          await updateParent(
            conn,
            folder.id!,
            collection.id!,
            "sketch",
            "sketch_folder"
          );

          // After moving folder, collection should have fragments from both sketches, combined
          // with the overlap with sketchA
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Moving a folder full of sketches into a collection",
            "remainingFragments",
            remainingFragments
          );
          await writeOutput(
            "Moving a folder full of sketches into a collection",
            "inputSketches",
            {
              type: "FeatureCollection",
              features: [featureA, featureB, featureC],
            }
          );
          expect(remainingFragments.length).toBe(5); // A + B + C should create 3 fragments
        }
      );
    });

    test("Moving a folder with one sketch into a collection. Unrelated sketches are not affected.", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);

          // Create a collection
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );

          // Create a folder outside the collection
          const folder = await createFolder(
            conn,
            "test folder",
            null, // Not in collection initially
            userIds[0],
            projectId
          );

          const sketchA = await createSketch(
            conn,
            userIds[0],
            featureA,
            projectId,
            sketchClassId,
            undefined,
            collection.id!,
            undefined
          );
          // Create sketches in the folder
          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );
          const sketchC = await createSketch(
            conn,
            userIds[0],
            featureC,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            undefined
          );

          expect(sketchA.fragments.length).toBe(1);
          expect(sketchB.fragments.length).toBe(1);
          expect(sketchC.fragments.length).toBe(1);

          const fragmentsForSketchC = await getFragmentsForSketch(
            sketchC.sketch.id! as number,
            asPg(conn) as PoolClient
          );
          expect(fragmentsForSketchC.length).toBe(1);

          await writeOutput(
            "Moving a folder with one sketch into a collection. Unrelated sketches are not affected.",
            "inputSketches",
            {
              type: "FeatureCollection",
              features: [featureA, featureB, featureC],
            }
          );

          // Initially, collection should have just one fragment for sketchA
          const initialFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          expect(initialFragments.length).toBe(1);

          await writeOutput(
            "Moving a folder with one sketch into a collection. Unrelated sketches are not affected.",
            "initialFragments",
            initialFragments
          );
          // Move the folder into the collection
          await updateParent(
            conn,
            folder.id!,
            collection.id!,
            "sketch",
            "sketch_folder"
          );

          // After moving folder, collection should have fragments from both sketches, combined
          // with the overlap with sketchA
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Moving a folder with one sketch into a collection. Unrelated sketches are not affected.",
            "remainingFragments",
            remainingFragments
          );
          await writeOutput(
            "Moving a folder with one sketch into a collection. Unrelated sketches are not affected.",
            "inputSketches",
            {
              type: "FeatureCollection",
              features: [featureA, featureB, featureC],
            }
          );
          expect(remainingFragments.length).toBe(3); // A + B should create 3 fragments
        }
      );
    });

    test("Moving a sketch out of a collection", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);

          // Create a collection
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );

          // Create sketches in the collection
          const sketchA = await createSketch(
            conn,
            userIds[0],
            featureA,
            projectId,
            sketchClassId,
            undefined,
            collection.id,
            undefined
          );
          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            collection.id,
            undefined
          );

          // Initially, collection should have fragments from both sketches
          const initialFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          expect(initialFragments.length).toBe(3); // A + B should create 3 fragments

          // Move sketchB out of the collection
          await updateParent(conn, sketchB.sketch.id! as number, null, null);

          // After moving sketchB out, collection should only have fragments from sketchA
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Moving a sketch out of a collection",
            "remainingFragments",
            remainingFragments
          );
          expect(remainingFragments.length).toBeLessThan(3); // Only A should remain
        }
      );
    });

    test("Moving a folder full of sketches out of a collection", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);

          // Create a collection
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );

          // Create a folder in the collection
          const folder = await createFolder(
            conn,
            "test folder",
            collection.id,
            userIds[0],
            projectId
          );

          // Create sketches in the folder
          const sketchA = await createSketch(
            conn,
            userIds[0],
            featureA,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );
          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );
          const sketchC = await createSketch(
            conn,
            userIds[0],
            featureC,
            projectId,
            sketchClassId,
            undefined,
            collection.id!,
            undefined
          );

          // Initially, collection should have fragments from both sketches
          const initialFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          expect(initialFragments.length).toBe(5); // A + B + C should create 5 fragments

          // Move the folder out of the collection
          await updateParent(conn, folder.id!, null, null, "sketch_folder");

          // After moving folder out, collection should have 3 fragments
          // (all C, but with some remaining unreconciled overlap)
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Moving a folder full of sketches out of a collection",
            "remainingFragments",
            remainingFragments
          );
          expect(remainingFragments.length).toBeLessThan(3);
        }
      );
    });

    test("Moving a folder full of sketches out of a collection, then back into it", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);

          // Create a collection
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );

          // Create a folder in the collection
          const folder = await createFolder(
            conn,
            "test folder",
            collection.id,
            userIds[0],
            projectId
          );

          // Create sketches in the folder
          const sketchA = await createSketch(
            conn,
            userIds[0],
            featureA,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );
          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );

          // Initially, collection should have fragments from both sketches
          const initialFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          expect(initialFragments.length).toBe(3); // A + B should create 3 fragments

          // Move the folder out of the collection
          await updateParent(conn, folder.id!, null, null, "sketch_folder");

          // After moving folder out, collection should have no fragments
          const fragmentsAfterMoveOut = await fragmentsForCollection(
            conn,
            collection.id!
          );
          expect(fragmentsAfterMoveOut.length).toBe(0);

          // Move the folder back into the collection
          await updateParent(
            conn,
            folder.id!,
            collection.id!,
            "sketch",
            "sketch_folder"
          );

          // After moving folder back, collection should have fragments from both sketches again
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Moving a folder full of sketches out of a collection, then back into it",
            "remainingFragments",
            remainingFragments
          );
          expect(remainingFragments.length).toBe(3); // A + B should create 3 fragments again
        }
      );
    });

    test("Moving a sketch from a folder, to the root collection (still in the same collection)", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);

          // Create a collection
          const collection = await createCollection(
            conn,
            "test",
            collectionSketchClassId,
            userIds[0]
          );

          // Create a folder in the collection
          const folder = await createFolder(
            conn,
            "test folder",
            collection.id,
            userIds[0],
            projectId
          );

          // Create a sketch in the folder
          const sketchA = await createSketch(
            conn,
            userIds[0],
            featureA,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );

          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            collection.id!,
            undefined
          );

          // Initially, collection should have fragments from the sketch
          const initialFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          expect(initialFragments.length).toBe(3);

          // Move the sketch from folder to root collection
          await updateParent(
            conn,
            sketchA.sketch.id! as number,
            collection.id!,
            "sketch"
          );

          // After moving sketch to root, collection should still have the same fragments
          const remainingFragments = await fragmentsForCollection(
            conn,
            collection.id!
          );
          await writeOutput(
            "Moving a sketch from a folder, to the root collection (still in the same collection)",
            "remainingFragments",
            remainingFragments
          );
          expect(remainingFragments.length).toBe(3); // Should still have 3 fragments
        }
      );
    });

    test("Moving a sketch from one collection to another", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);

          // Create two collections
          const collection1 = await createCollection(
            conn,
            "collection1",
            collectionSketchClassId,
            userIds[0]
          );
          const collection2 = await createCollection(
            conn,
            "collection2",
            collectionSketchClassId,
            userIds[0]
          );

          // Create a sketch in collection1
          const sketchA = await createSketch(
            conn,
            userIds[0],
            featureA,
            projectId,
            sketchClassId,
            undefined,
            collection1.id,
            undefined
          );

          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            collection1.id,
            undefined
          );

          const sketchC = await createSketch(
            conn,
            userIds[0],
            featureC,
            projectId,
            sketchClassId,
            undefined,
            collection2.id,
            undefined
          );

          await writeOutput(
            "Moving a sketch from one collection to another",
            "inputSketches",
            {
              type: "FeatureCollection",
              features: [featureA, featureB, featureC],
            }
          );

          // Initially, collection1 should have fragments from the overlap of A and B
          const initialFragments1 = await fragmentsForCollection(
            conn,
            collection1.id!
          );
          expect(initialFragments1.length).toBe(3);
          await writeOutput(
            "Moving a sketch from one collection to another",
            "initialFragments1",
            initialFragments1
          );

          // Initially, collection2 should have a single fragment for C
          const initialFragments2 = await fragmentsForCollection(
            conn,
            collection2.id!
          );
          await writeOutput(
            "Moving a sketch from one collection to another",
            "initialFragments2",
            initialFragments2
          );
          expect(initialFragments2.length).toBe(1);

          // Move the sketch from collection1 to collection2
          await updateParent(
            conn,
            sketchA.sketch.id! as number,
            collection2.id!,
            "sketch"
          );

          // After moving sketch, collection1 should have 2 fragments
          const remainingFragments1 = await fragmentsForCollection(
            conn,
            collection1.id!
          );
          expect(remainingFragments1.length).toBe(2);

          // After moving sketch, collection2 should have fragments from A + C
          const remainingFragments2 = await fragmentsForCollection(
            conn,
            collection2.id!
          );
          await writeOutput(
            "Moving a sketch from one collection to another",
            "remainingFragments2",
            remainingFragments2
          );
          expect(remainingFragments2.length).toBe(3);
        }
      );
    });

    test("Moving a folder full of sketches from one collection to another", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          const { sketchClassId, geographyIds, collectionSketchClassId } =
            await setupIntegrationTestEnv(
              conn,
              projectId,
              adminId,
              userIds,
              nationalGeographies.filter((g) => g.id === 1),
              1
            );
          await createSession(conn, userIds[0], true, false, projectId);

          // Create two collections
          const collection1 = await createCollection(
            conn,
            "collection1",
            collectionSketchClassId,
            userIds[0]
          );
          const collection2 = await createCollection(
            conn,
            "collection2",
            collectionSketchClassId,
            userIds[0]
          );

          // Create a folder in collection1
          const folder = await createFolder(
            conn,
            "test folder",
            collection1.id,
            userIds[0],
            projectId
          );

          // Create sketches in the folder
          const sketchA = await createSketch(
            conn,
            userIds[0],
            featureA,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );
          const sketchB = await createSketch(
            conn,
            userIds[0],
            featureB,
            projectId,
            sketchClassId,
            undefined,
            undefined,
            folder.id
          );

          // Initially, collection1 should have fragments from both sketches
          const initialFragments1 = await fragmentsForCollection(
            conn,
            collection1.id!
          );
          expect(initialFragments1.length).toBe(3); // A + B should create 3 fragments

          // Initially, collection2 should have no fragments
          const initialFragments2 = await fragmentsForCollection(
            conn,
            collection2.id!
          );
          expect(initialFragments2.length).toBe(0);

          // Move the folder from collection1 to collection2
          await updateParent(
            conn,
            folder.id!,
            collection2.id!,
            "sketch",
            "sketch_folder"
          );

          // After moving folder, collection1 should have no fragments
          const remainingFragments1 = await fragmentsForCollection(
            conn,
            collection1.id!
          );
          expect(remainingFragments1.length).toBe(0);

          // After moving folder, collection2 should have fragments from both sketches
          const remainingFragments2 = await fragmentsForCollection(
            conn,
            collection2.id!
          );
          await writeOutput(
            "Moving a folder full of sketches from one collection to another",
            "remainingFragments2",
            remainingFragments2
          );
          expect(remainingFragments2.length).toBe(3); // A + B should create 3 fragments
        }
      );
    });
  });
});

async function updateParent(
  conn: DatabaseTransactionConnectionType,
  sketchId: number,
  parentId: number | null,
  parentType: "sketch" | "sketch_folder" | null,
  childType?: "sketch" | "sketch_folder" | null
) {
  childType = childType || "sketch";
  await updateSketchTocItemParent(
    parentType === "sketch_folder" ? parentId : null,
    parentType === "sketch" ? parentId : null,
    [{ type: childType, id: sketchId }],
    asPg(conn) as unknown as PoolClient
  );
}

async function getFragments(
  conn: DatabaseTransactionConnectionType,
  hashes: string[]
) {
  await conn.any(sql`set role = postgres`);
  const { rows } = await conn.query<{
    hash: string;
  }>(
    sql`select hash from fragments where hash = any(${sql.array(
      hashes,
      "text"
    )})`
  );
  await conn.any(sql`set role = seasketch_user`);
  return rows;
}

async function createFolder(
  conn: DatabaseTransactionConnectionType,
  name: string,
  collectionId: number | null,
  userId: number,
  projectId: number
) {
  const folder = await conn.one<{
    id: number;
    name: string;
    collection_id: number | null;
    user_id: number;
    project_id: number;
  }>(
    sql`insert into sketch_folders (name, collection_id, user_id, project_id) values (${name}, ${collectionId}, ${userId}, ${projectId}) returning *`
  );
  return folder;
}

async function createSketch(
  conn: DatabaseTransactionConnectionType,
  userId: number,
  inputGeom: Feature<Polygon>,
  projectId: number,
  sketchClassId: number,
  sketchId?: number,
  collectionId?: number,
  folderId?: number
) {
  // Use the existing asPg helper and cast it to PoolClient
  const pgClient = asPg(conn) as unknown as PoolClient;

  const newSketchId = await createOrUpdateSketch({
    pgClient,
    userGeom: inputGeom,
    projectId,
    sketchClassId,
    name: "test",
    collectionId,
    folderId,
    properties: {},
    userId,
    sketchId,
  });

  const sketchGeometry = await conn.one<{
    folder_id: number;
    collection_id: number;
    geom: string;
  }>(sql`
    select ST_AsGeoJSON(geom) as geom, folder_id, collection_id from sketches where id = ${newSketchId}
  `);

  const sketch = {
    type: "Feature",
    id: newSketchId,
    properties: {
      folderId: sketchGeometry.folder_id,
      collectionId: sketchGeometry.collection_id,
    },
    geometry: JSON.parse(sketchGeometry.geom),
  } as Feature<Polygon | MultiPolygon>;

  await conn.any(sql`set role = postgres`);

  const fragments = (
    await conn.query<{
      hash: string;
      geometry: string;
      sketch_ids: number[];
      geography_ids: number[];
    }>(sql`
    select 
      f.hash, 
      ST_AsGeoJSON(f.geometry) as geometry,
      coalesce(array_agg(distinct sf.sketch_id) filter (where sf.sketch_id is not null), array[]::int[]) as sketch_ids,
      coalesce(array_agg(distinct fg.geography_id) filter (where fg.geography_id is not null), array[]::int[]) as geography_ids
    from fragments f
    left join sketch_fragments sf on f.hash = sf.fragment_hash
    left join fragment_geographies fg on f.hash = fg.fragment_hash
    where f.hash = any(
      select fragment_hash from sketch_fragments where sketch_id = ${newSketchId}
    )
    group by f.hash, f.geometry
  `)
  ).rows.map((f) => ({
    type: "Feature",
    properties: {
      __hash: f.hash,
      __geographyIds: f.geography_ids,
      __sketchIds: f.sketch_ids,
    },
    geometry: JSON.parse(f.geometry as string),
  })) as SketchFragment[];

  await conn.any(sql`set role = seasketch_user`);

  return { sketch, fragments };
}

async function copySketch(
  sketchId: number,
  conn: DatabaseTransactionConnectionType
): Promise<{
  sketch: Feature<Polygon | MultiPolygon>;
  fragments: SketchFragment[];
}> {
  const pgClient = asPg(conn) as unknown as PoolClient;
  const { rows } = await pgClient.query(
    `select copy_sketch_toc_item_recursive($1, $2, true)`,
    [sketchId, "sketch"]
  );
  const copyId: number = rows[0].copy_sketch_toc_item_recursive;
  const sketchGeometry = await conn.oneFirst(sql`
    select ST_AsGeoJSON(geom) from sketches where id = ${copyId}
  `);

  const sketch = {
    type: "Feature",
    id: copyId,
    properties: {},
    geometry: JSON.parse(sketchGeometry as string),
  } as Feature<Polygon | MultiPolygon>;

  await conn.any(sql`set role = postgres`);

  const fragments = (
    await conn.query<{
      hash: string;
      geometry: string;
      sketch_ids: number[];
      geography_ids: number[];
    }>(sql`
    select 
      f.hash, 
      ST_AsGeoJSON(f.geometry) as geometry,
      coalesce(array_agg(distinct sf.sketch_id) filter (where sf.sketch_id is not null), array[]::int[]) as sketch_ids,
      coalesce(array_agg(distinct fg.geography_id) filter (where fg.geography_id is not null), array[]::int[]) as geography_ids
    from fragments f
    left join sketch_fragments sf on f.hash = sf.fragment_hash
    left join fragment_geographies fg on f.hash = fg.fragment_hash
    where f.hash = any(
      select fragment_hash from sketch_fragments where sketch_id = ${copyId}
    )
    group by f.hash, f.geometry
  `)
  ).rows.map((f) => ({
    type: "Feature",
    properties: {
      __hash: f.hash,
      __geographyIds: f.geography_ids,
      __sketchIds: f.sketch_ids,
    },
    geometry: JSON.parse(f.geometry as string),
  })) as SketchFragment[];

  await conn.any(sql`set role = seasketch_user`);

  return { sketch, fragments };
}

async function setupIntegrationTestEnv(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  adminId: number,
  userIds: number[],
  geographies: (GeographySettings & { name: string })[],
  clipToGeographyId: number
) {
  await createSession(conn, adminId, true, false, projectId);
  const sketchClass = await conn.one<{ id: number }>(
    sql`insert into sketch_classes (mapbox_gl_style, project_id, name, geometry_type) values ('[]'::jsonb, ${projectId}, 'Poly', 'POLYGON') returning *`
  );
  const collectionSketchClass = await conn.one<{ id: number }>(
    sql`insert into sketch_classes (project_id, name, geometry_type) values (${projectId}, 'Collection', 'COLLECTION') returning *`
  );

  const geographyIds: { [name: string]: number } = {};
  for (const geography of geographies) {
    const geographyId = await createGeography(
      conn,
      projectId,
      adminId,
      geography
    );
    geographyIds[geography.name] = geographyId;
  }
  await conn.any(
    sql`update sketch_classes set is_geography_clipping_enabled = true where id = ${sketchClass.id}`
  );
  await conn.any(sql`set role = postgres`);
  clipToGeographyId =
    geographyIds[geographies.find((g) => g.id === clipToGeographyId)!.name!];
  await conn.any(sql`
    insert into sketch_class_geographies (
      sketch_class_id, geography_id
    ) values (${sketchClass.id}, ${clipToGeographyId})
  `);
  await createSession(conn, adminId, true, false, projectId);
  return {
    sketchClassId: sketchClass.id,
    geographyIds,
    collectionSketchClassId: collectionSketchClass.id,
  };
}

async function createGeography(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  adminId: number,
  settings: GeographySettings & { name: string }
) {
  const geography = await conn.one<{ id: number }>(
    sql`insert into project_geography (project_id, name) values (${projectId}, ${settings.name}) returning *`
  );
  for (const layer of settings.clippingLayers) {
    // create a data_source
    const dataSource = await conn.one<{ id: number }>(
      sql`insert into data_sources (project_id, type, url, import_type) values (${projectId}, 'seasketch-mvt', ${layer.source}, 'upload') returning *`
    );
    // data_upload_output
    const remoteUrl = `r2://tiles/${layer.source.replace(
      "https://uploads.seasketch.org/",
      ""
    )}`;
    const filename = layer.source.replace("https://uploads.seasketch.org/", "");

    // Switch to postgres role to bypass permission checks
    await conn.any(sql`set role = postgres`);
    const dataUploadOutput = await conn.one(
      sql`insert into data_upload_outputs (
        data_source_id, 
        project_id,
        type, 
        url,
        remote, 
        is_original, 
        size,
        filename
      ) values (
        ${dataSource.id}, 
        ${projectId},
        ${sql`'FlatGeobuf'::data_upload_output_type`}, 
        ${layer.source},
        ${remoteUrl}, 
        true, 
        0,
        ${filename}
      ) returning *`
    );
    // Switch back to admin role
    await createSession(conn, adminId, true, false, projectId);

    // and finally, a data_layer
    const dataLayer = await conn.one<{ id: number }>(
      sql`insert into data_layers (data_source_id, project_id, mapbox_gl_styles) values (${dataSource.id}, ${projectId}, '[]'::jsonb) returning *`
    );
    const object_key = await conn.oneFirst(sql`
      select data_layers_vector_object_key(data_layers.*) from data_layers where id = ${dataLayer.id}
    `);
    if (!object_key) {
      throw new Error("No object key found for newly created clipping layer");
    }

    await conn.any(
      sql`insert into geography_clipping_layers (project_geography_id, data_layer_id, operation_type) values (${
        geography.id
      }, ${
        dataLayer.id
      }, ${sql`${layer.op.toLowerCase()}::geography_layer_operation`})`
    );
  }
  return geography.id;
}

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

// Helper function to validate fragment coordinates
function validateFragmentCoordinates(fragments: SketchFragment[]): void {
  for (
    let fragmentIndex = 0;
    fragmentIndex < fragments.length;
    fragmentIndex++
  ) {
    const fragment = fragments[fragmentIndex];
    for (
      let coordIndex = 0;
      coordIndex < fragment.geometry.coordinates[0].length;
      coordIndex++
    ) {
      const coordinate = fragment.geometry.coordinates[0][coordIndex];
      const [lon, lat] = coordinate;

      if (lon < -180 || lon > 180) {
        throw new Error(
          `Longitude coordinate at position ${coordIndex} in fragment ${fragmentIndex} is ${lon}, which is ${
            lon < -180 ? "less than -180" : "greater than 180"
          }. Valid range is [-180, 180].`
        );
      }

      if (lat < -90 || lat > 90) {
        throw new Error(
          `Latitude coordinate at position ${coordIndex} in fragment ${fragmentIndex} is ${lat}, which is ${
            lat < -90 ? "less than -90" : "greater than 90"
          }. Valid range is [-90, 90].`
        );
      }
    }
  }
}

// Helper function to write output files for debugging
async function writeOutput(
  testName: string,
  outputType: string,
  data: any
): Promise<void> {
  if (Array.isArray(data) && data[0]?.type === "Feature") {
    data = {
      type: "FeatureCollection",
      features: data.map((f) => f),
    };
  }
  const outputDir = path.join(__dirname, "outputs", testName);
  const outputPath = path.join(outputDir, `${outputType}.json`);

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write the data as formatted JSON
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
}

// Helper function to load expected output from saved files
function loadExpectedOutput(testName: string, outputType: string): any {
  const outputPath = path.join(
    __dirname,
    "outputs",
    testName,
    `${outputType}.json`
  );
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Expected output file not found: ${outputPath}`);
  }
  const content = fs.readFileSync(outputPath, "utf8");
  return JSON.parse(content);
}

// Helper function to compare current results against expected outputs
function compareWithExpectedOutput(
  testName: string,
  filename: string,
  currentData: any
): void {
  try {
    const expectedData = loadExpectedOutput(testName, filename);

    if (
      Array.isArray(currentData) &&
      currentData.length > 0 &&
      currentData[0].type === "Feature"
    ) {
      // Comparing fragments
      const currentFragments = currentData as SketchFragment[];
      // Handle both FeatureCollection and array formats for expected data
      const expectedFragments =
        expectedData.type === "FeatureCollection"
          ? (expectedData.features as SketchFragment[])
          : (expectedData as SketchFragment[]);

      expect(currentFragments.length).toBe(expectedFragments.length);

      // Sort fragments by hash for consistent comparison
      const sortedCurrentFragments = [...currentFragments].sort((a, b) =>
        a.properties.__hash.localeCompare(b.properties.__hash)
      );
      const sortedExpectedFragments = [...expectedFragments].sort((a, b) =>
        a.properties.__hash.localeCompare(b.properties.__hash)
      );

      for (let i = 0; i < sortedCurrentFragments.length; i++) {
        const current = sortedCurrentFragments[i];
        const expected = sortedExpectedFragments[i];

        expect(current.geometry).toEqual(expected.geometry);
        expect(current.properties.__hash).toBe(expected.properties.__hash);
        // Note: We don't compare geography IDs or sketch IDs since they depend on database state
        // and are not meaningful for regression testing
      }
    } else {
      // Comparing sketch
      const currentSketch = currentData as Feature<Polygon | MultiPolygon>;
      const expectedSketch = expectedData as Feature<Polygon | MultiPolygon>;

      expect(currentSketch.geometry).toEqual(expectedSketch.geometry);
      // Note: We don't compare IDs since they depend on database state and are not meaningful for regression testing
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Expected output file not found")
    ) {
      throw new Error(
        `Expected output file "${filename}" not found for test "${testName}". Run the test with writeOutput enabled first to generate expected outputs.`
      );
    }
    throw error;
  }
}

async function createCollection(
  conn: DatabaseTransactionConnectionType,
  name: string,
  sketchClassId: number,
  userId: number
) {
  const collection = await conn.one<{ id: number }>(
    sql`insert into sketches (sketch_class_id, name, user_id) values (${sketchClassId}, ${name}, ${userId}) returning *`
  );
  return collection;
}

async function fragmentsForCollection(
  conn: DatabaseTransactionConnectionType,
  collectionId: number
): Promise<SketchFragment[]> {
  await conn.any(sql`set role = postgres`);
  const fragments = (
    await conn.query<{
      hash: string;
      geometry: string;
      sketch_ids: number[];
      geography_ids: number[];
    }>(sql`
    select 
      f.hash, 
      ST_AsGeoJSON(f.geometry) as geometry,
      coalesce(array_agg(distinct sf.sketch_id) filter (where sf.sketch_id is not null), array[]::int[]) as sketch_ids,
      coalesce(array_agg(distinct fg.geography_id) filter (where fg.geography_id is not null), array[]::int[]) as geography_ids
    from fragments f
    left join sketch_fragments sf on f.hash = sf.fragment_hash
    left join fragment_geographies fg on f.hash = fg.fragment_hash
    where f.hash in (
      select fragment_hash from sketch_fragments where sketch_id in (
        select unnest(get_child_sketches_recursive(${collectionId}, 'sketch'))
      )
    )
    group by f.hash, f.geometry
  `)
  ).rows.map((f) => ({
    type: "Feature",
    properties: {
      __hash: f.hash,
      __geographyIds: f.geography_ids,
      __sketchIds: f.sketch_ids,
    },
    geometry: JSON.parse(f.geometry as string),
  })) as SketchFragment[];
  await conn.any(sql`set role = seasketch_user`);
  return fragments;
}
