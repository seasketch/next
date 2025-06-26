import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { SourceCache, SourceCacheOptions } from "fgb-source";
import { prepareSketch, GeographySettings } from "overlay-engine";
import { S3 } from "aws-sdk";
import { clippingWorkerManager } from "../workers/clipping/clippingWorkerManager";
import { Context } from "postgraphile";
import { Pool, PoolClient } from "pg";
import { clipToGeographies } from "overlay-engine/dist/src/geographies";

const r2 = new S3({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  signatureVersion: "v4",
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
});

const sourceCache = new SourceCache(process.env.SOURCE_CACHE_SIZE || "256MB", {
  fetchRangeFn: async (key: string, range: [number, number | null]) => {
    const response = await fetch(`https://uploads.seasketch.org/${key}`, {
      headers: range
        ? new Headers({
            Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
          })
        : undefined,
    });
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
  },
});

const SketchingPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      input UpdateTocItemParentInput {
        type: SketchChildType!
        id: Int!
      }

      type TocItemDetails {
        type: SketchChildType!
        id: Int!
      }

      type DeleteSketchTocItemsResults {
        updatedCollections: [Sketch]!
        deletedItems: [String!]!
      }

      type CopySketchTocItemResults {
        sketches: [Sketch!]
        folders: [SketchFolder!]
        parentId: Int!
        """
        Returns the parent collection (if exists) so that the client can select an updated updatedAt
        """
        updatedCollection: Sketch
      }

      type UpdateSketchTocItemParentResults {
        sketches: [Sketch]!
        folders: [SketchFolder]!
        updatedCollections: [Sketch]!
      }

      extend type Sketch {
        """
        Greater of updatedAt, createdAt, as stringified epoch timestamp.
        Useful for requesting the latest geometry
        """
        timestamp: String! @requires(columns: ["created_at", "updated_at"])
      }

      extend type SketchClass {
        clippingGeographies: [Geography]! @requires(columns: ["id"])
      }

      extend type Project {
        """
        This token can be used to access this user's sketches from the geojson endpoint.
        For example, \`/sketches/123.geojson.json?access_token=xxx\`
        Returns null if user is not singed in. Can be used only for a single
        project. Must be refreshed occasionally.
        """
        sketchGeometryToken: String @requires(columns: ["id"])
      }

      extend type Mutation {
        """
        Create a new sketch in the user's account. If preprocessing is enabled,
        the sketch's final geometry will be set by running the proprocessing
        function again on userGeom. This ensures the value conforms to the
        project's rules, and also benefits the user in that they need not submit
        a huge geometry to the server.

        In the case of collections, the userGeom can be omitted.
        """
        createSketch(
          """
          Name for the sketch. Required.
          """
          name: String!
          sketchClassId: Int!
          """
          Sketch as drawn by the user.
          """
          userGeom: GeoJSON
          """
          Sketches can be assigned directly to a collection on creation.
          """
          collectionId: Int
          """
          Sketches can be assigned directly to a folder on creation.
          """
          folderId: Int
          """
          Form element data
          """
          properties: JSON!
        ): Sketch

        """
        If preprocessing is enabled,
        the sketch's final geometry will be set by running the proprocessing
        function again on userGeom. This ensures the value conforms to the
        project's rules, and also benefits the user in that they need not submit
        a huge geometry to the server.

        When updating a sketch, be sure to use the Sketch.parentCollection
        association to update the client graphql cache with an up to date
        updatedAt timestamp. This will ensure a correct cache key is used when
        requesting collection reports.
        """
        updateSketch(
          id: Int!
          """
          Name for the sketch. Required.
          """
          name: String!
          """
          Sketch as drawn by the user. If unchanged this can be omitted
          """
          userGeom: GeoJSON
          """
          Form element data
          """
          properties: JSON!
        ): Sketch

        copySketchTocItem(
          id: Int!
          type: SketchChildType!
          forForum: Boolean
        ): CopySketchTocItemResults

        """
        Create to respond to drag & drop actions in the sketch table of contents.
        Can assign a folder_id or collection_id to one or multiple Sketches or
        SketchFolders.

        Returns an updatedCollections property which should be used to update the
        updatedAt property on related collections so that correct cache keys are
        used when requesting reports.
        """
        updateSketchTocItemParent(
          folderId: Int
          collectionId: Int
          tocItems: [UpdateTocItemParentInput]!
        ): UpdateSketchTocItemParentResults

        """
        Deletes one or more Sketch or SketchFolders

        Returns an updatedCollections property which should be used to update the
        updatedAt property on related collections so that correct cache keys are
        used when requesting reports.
        """
        deleteSketchTocItems(
          items: [UpdateTocItemParentInput]!
        ): DeleteSketchTocItemsResults
      }
    `,
    resolvers: {
      UpdateSketchTocItemParentResults: {
        sketches: async (results, args, context, resolveInfo) => {
          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`sketches`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = any(${sql.value(
                  context.sketchIds
                )})`
              );
            }
          );
        },
        folders: async (results, args, context, resolveInfo) => {
          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`sketch_folders`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = any(${sql.value(
                  context.folderIds
                )})`
              );
            }
          );
        },
        updatedCollections: async (results, args, context, resolveInfo) => {
          const {
            sketchIds,
            folderIds,
            pgClient,
            collectionId,
            folderId,
            tocItems,
            previousCollectionIds,
          } = context;

          const { rows } = await pgClient.query(
            `
            select distinct(
              get_parent_collection_id(type, id)
            ) as collection_id from json_to_recordset($1) as (type sketch_child_type, id int)`,
            [JSON.stringify(tocItems)]
          );
          const updatedCollectionIds = [
            ...(previousCollectionIds || []),
            ...rows.map((r: any) => r.collection_id),
          ];

          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`sketches`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = any(${sql.value(
                  updatedCollectionIds
                )})`
              );
            }
          );
        },
      },
      CopySketchTocItemResults: {
        sketches: async (results, args, context, resolveInfo) => {
          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`sketches`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = any(${sql.value(
                  context.sketchIds
                )})`
              );
            }
          );
        },
        folders: async (results, args, context, resolveInfo) => {
          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`sketch_folders`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = any(${sql.value(
                  context.folderIds
                )})`
              );
            }
          );
        },
        updatedCollection: async (results, args, context, resolveInfo) => {
          if (!context.parentCollectionId) {
            return null;
          }
          const [row] =
            (await resolveInfo.graphile.selectGraphQLResultFromTable(
              sql.fragment`sketches`,
              (tableAlias, queryBuilder) => {
                queryBuilder.where(
                  sql.fragment`${tableAlias}.id = ${sql.value(
                    context.parentCollectionId
                  )}`
                );
              }
            )) as any;
          return row || null;
        },
      },
      DeleteSketchTocItemsResults: {
        updatedCollections: async (results, args, context, resolveInfo) => {
          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`sketches`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = any(${sql.value(
                  context.previousCollectionIds
                )})`
              );
            }
          );
        },
      },
      Sketch: {
        timestamp: async (sketch, args, context, info) => {
          let date = new Date(sketch.createdAt);
          if (sketch.updatedAt) {
            date = new Date(sketch.updatedAt);
          }
          return date.getTime().toString();
        },
      },
      SketchClass: {
        clippingGeographies: async (
          sketchClass,
          args,
          context: Context<{ pgClient: Pool }>,
          resolveInfo
        ) => {
          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`project_geography`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = any(select geography_id from sketch_class_geographies where sketch_class_id = ${sql.value(
                  sketchClass.id
                )})`
              );
            }
          );
        },
      },
      Project: {
        sketchGeometryToken: async (project, args, context, info) => {
          const projectId = project.id;
          const userId = context?.user?.id;
          const canonicalEmail = context.user?.canonicalEmail;
          const isSuperuser = context.user?.superuser;
          if (projectId && userId) {
            return context.loaders.signToken(
              {
                type: "sketch-geometry-access",
                userId,
                projectId,
                canonicalEmail,
                isSuperuser,
              },
              "1 day"
            );
          } else {
            return null;
          }
        },
      },
      Mutation: {
        createSketch: async (
          _query,
          { name, sketchClassId, userGeom, collectionId, folderId, properties },
          context: Context<{ pgClient: Pool }>,
          resolveInfo
        ) => {
          if (!context.user.id) {
            throw new Error("Permission denied");
          }
          if (!name || name.length < 1) {
            throw new Error("Sketch name is required");
          }
          const { pgClient } = context;
          // Get the related sketch class
          const { rows } = await pgClient.query(
            `select geometry_type, is_geography_clipping_enabled, preprocessing_endpoint, id, project_id from public.sketch_classes where id = $1`,
            [sketchClassId]
          );
          const sketchClass = rows[0] as {
            geometry_type: string;
            is_geography_clipping_enabled: boolean;
            preprocessing_endpoint: string;
            id: number;
            project_id: number;
          };
          delete userGeom?.id;
          if (
            sketchClass.geometry_type === "COLLECTION" ||
            sketchClass.geometry_type === "FILTERED_PLANNING_UNITS"
          ) {
            const {
              rows: [sketch],
            } = await pgClient.query(
              `INSERT INTO sketches(name, sketch_class_id, user_id, collection_id, folder_id, properties) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [
                name,
                sketchClassId,
                context.user.id,
                collectionId,
                folderId,
                properties,
              ]
            );

            const [row] =
              (await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`sketches`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(sketch.id)}`
                  );
                }
              )) as any;
            return row;
          } else if (sketchClass.is_geography_clipping_enabled) {
            const { clipped, fragments } = await preprocessGeography(
              pgClient,
              userGeom,
              sketchClassId,
              sketchClass.project_id
            );
            const {
              rows: [sketch],
            } = await pgClient.query(
              `INSERT INTO sketches(name, sketch_class_id, user_id, collection_id, user_geom, geom, folder_id, properties) VALUES ($1, $2, $3, $4, ST_GeomFromGeoJSON($5), ST_GeomFromGeoJSON($6), $7, $8) RETURNING id`,
              [
                name,
                sketchClassId,
                context.user.id,
                collectionId,
                JSON.stringify(userGeom.geometry),
                JSON.stringify(clipped?.geometry),
                folderId,
                properties,
              ]
            );
            // TODO: update fragments

            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`sketches`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(sketch.id)}`
                  );
                }
              );
            return row;
          } else {
            // Check to see if preprocessing is required. If so, do it
            let geometry: Feature;
            if (sketchClass.preprocessing_endpoint) {
              // submit for geoprocessing
              const response = await preprocess(
                sketchClass.preprocessing_endpoint,
                userGeom
              );
              geometry = response;
            } else {
              geometry = userGeom;
            }
            const {
              rows: [sketch],
            } = await pgClient.query(
              `INSERT INTO sketches(name, sketch_class_id, user_id, collection_id, user_geom, geom, folder_id, properties) VALUES ($1, $2, $3, $4, ST_GeomFromGeoJSON($5), ST_GeomFromGeoJSON($6), $7, $8) RETURNING id`,
              [
                name,
                sketchClassId,
                context.user.id,
                collectionId,
                JSON.stringify(userGeom.geometry),
                JSON.stringify(geometry.geometry),
                folderId,
                properties,
              ]
            );

            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`sketches`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(sketch.id)}`
                  );
                }
              );
            return row;
          }
        },
        updateSketch: async (
          _query,
          { id, name, userGeom, properties },
          context,
          resolveInfo
        ) => {
          if (!context.user.id) {
            throw new Error("Permission denied");
          }
          if (!name || name.length < 1) {
            throw new Error("Sketch name is required");
          }
          if (!id) {
            throw new Error("id parameter required");
          }
          if (!properties) {
            throw new Error("properties parameter required");
          }

          const { pgClient } = context;

          if (!userGeom) {
            const {
              rows: [sketch],
            } = await pgClient.query(
              `update sketches set name = $1, properties = $2 where id = $3 RETURNING id`,
              [name, properties, id]
            );

            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`sketches`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(sketch.id)}`
                  );
                }
              );
            return row;
          }

          // Get the related sketch class
          const { rows } = await pgClient.query(
            `select * from public.sketch_classes where id = ((select sketch_class_id from sketches where id = $1))`,
            [id]
          );
          if (rows.length === 0) {
            throw new Error("Sketch class or sketch not found.");
          }
          const sketchClass = rows[0];
          // Check to see if preprocessing is required. If so, do it
          let geometry: Feature;
          if (sketchClass.preprocessing_endpoint) {
            // submit for geoprocessing
            const response = await preprocess(
              sketchClass.preprocessing_endpoint,
              userGeom
            );
            geometry = response;
          } else if (sketchClass.is_geography_clipping_enabled) {
            const { clipped, fragments } = await preprocessGeography(
              pgClient,
              userGeom,
              sketchClass.id,
              sketchClass.project_id
            );
            if (!clipped) {
              throw new Error("Clipping failed");
            }
            const {
              rows: [sketch],
            } = await pgClient.query(
              `update sketches set name = $1, user_geom = ST_GeomFromGeoJSON($2), geom = ST_GeomFromGeoJSON($3), properties = $4 where id = $5 RETURNING id`,
              [
                name,
                JSON.stringify(userGeom.geometry),
                JSON.stringify(clipped.geometry),
                properties,
                id,
              ]
            );
            // TODO: update fragments
            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`sketches`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(sketch.id)}`
                  );
                }
              );
            return row;
          } else {
            geometry = userGeom;
          }
          const {
            rows: [sketch],
          } = await pgClient.query(
            `update sketches set name = $1, user_geom = ST_GeomFromGeoJSON($2), geom = ST_GeomFromGeoJSON($3), properties = $4 where id = $5 RETURNING id`,
            [
              name,
              JSON.stringify(userGeom.geometry),
              JSON.stringify(geometry.geometry),
              properties,
              id,
            ]
          );

          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`sketches`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(sketch.id)}`
              );
            }
          );
          return row;
        },
        copySketchTocItem: async (
          _query,
          { id, type, forForum },
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          if (!forForum) {
            // check that the user owns this sketch
            const { rows } = await pgClient.query(
              `select user_id from ${
                type === "sketch" ? "sketches" : "sketch_folders"
              } where id = $1`,
              [id]
            );
            if (rows.length === 0) {
              throw new Error(`${type} not found or permission denied`);
            }
          }
          const {
            rows: [row],
          } = await pgClient.query(
            forForum
              ? `select copy_sketch_toc_item_recursive_for_forum($1, $2, false)`
              : `select copy_sketch_toc_item_recursive($1, $2, true)`,
            [id, type]
          );
          const copyId: number = forForum
            ? row.copy_sketch_toc_item_recursive_for_forum
            : row.copy_sketch_toc_item_recursive;
          let {
            rows: [{ get_child_folders_recursive: folderIds }],
          } = await pgClient.query(
            `select get_child_folders_recursive($1, $2)`,
            [copyId, type]
          );
          let {
            rows: [{ get_child_sketches_and_collections_recursive: sketchIds }],
          } = await pgClient.query(
            `select get_child_sketches_and_collections_recursive($1, $2)`,
            [copyId, type]
          );
          if (type === "sketch") {
            sketchIds.push(copyId);
          } else {
            folderIds.push(copyId);
          }
          context.sketchIds = sketchIds;
          context.folderIds = folderIds;
          context.parentId = copyId;
          context.parentType = type;
          let {
            rows: [{ get_parent_collection_id }],
          } = await pgClient.query(`select get_parent_collection_id($1, $2)`, [
            type,
            copyId,
          ]);
          context.parentCollectionId = get_parent_collection_id;
          // will be finished by CopySketchTocItemResults functions at the top
          // of the resolvers
          return {
            parentId: copyId,
          };
        },
        updateSketchTocItemParent: async (
          _query,
          { folderId, collectionId, tocItems },
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          const { rows } = await pgClient.query(
            `
            select distinct(
              get_parent_collection_id(type, id)
            ) as collection_id from json_to_recordset($1) as (type sketch_child_type, id int)`,
            [JSON.stringify(tocItems)]
          );
          context.previousCollectionIds = rows.map((r: any) => r.collection_id);

          const folders: number[] = tocItems
            .filter((f: any) => f.type === "sketch_folder")
            .map((f: any) => f.id);
          const sketches: number[] = tocItems
            .filter((f: any) => f.type === "sketch")
            .map((f: any) => f.id);
          // update collection_id and folder_id on related sketches
          await pgClient.query(
            `update sketches set collection_id = $1, folder_id = $2 where id = any($3)`,
            [collectionId, folderId, sketches]
          );
          // update collection_id and folder_id on related folders
          await pgClient.query(
            `update sketch_folders set collection_id = $1, folder_id = $2 where id = any($3)`,
            [collectionId, folderId, folders]
          );
          context.sketchIds = sketches;
          context.folderIds = folders;
          context.tocItems = tocItems;

          return {};
        },
        deleteSketchTocItems: async (_query, { items }, context) => {
          const { pgClient } = context;
          // Get IDs of collections these items belong to to be included in
          // updatedCollections
          const { rows } = await pgClient.query(
            `
            select distinct(
              get_parent_collection_id(type, id)
            ) as collection_id from json_to_recordset($1) as (type sketch_child_type, id int)`,
            [JSON.stringify(items)]
          );
          context.previousCollectionIds = rows.map((r: any) => r.collection_id);
          // Get IDs of all items to be deleted (including their children) to
          // be added to deletedItems output
          const childrenResult = await pgClient.query(
            `
            select distinct(
              get_all_sketch_toc_children(id, type)
            ) as children from json_to_recordset($1) as (type sketch_child_type, id int)`,
            [JSON.stringify(items)]
          );

          const deletedItems: string[] = [
            ...items.map(
              (item: any) =>
                `${/folder/i.test(item.type) ? "SketchFolder" : "Sketch"}:${
                  item.id
                }`
            ),
          ];
          for (const row of childrenResult.rows) {
            if (row.children && row.children.length) {
              for (const id of row.children) {
                if (deletedItems.indexOf(id) === -1) {
                  deletedItems.push(id);
                }
              }
            }
          }

          // Do the deleting
          const folders: number[] = items
            .filter((f: any) => f.type === "sketch_folder")
            .map((f: any) => f.id);
          const sketches: number[] = items
            .filter((f: any) => f.type === "sketch")
            .map((f: any) => f.id);

          await pgClient.query(
            `delete from sketch_folders where id = any($1)`,
            [folders]
          );

          await pgClient.query(`delete from sketches where id = any($1)`, [
            sketches,
          ]);

          // results will be populated by resolvers above
          return { deletedItems };
        },
      },
    },
  };
});

export default SketchingPlugin;

async function preprocess(endpoint: string, feature: Feature<any>) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ feature }),
  }).then(async (response) => {
    if (response.ok) {
      const { data, error } = await response.json();
      if (error) {
        throw new Error(`Preprocessing Error: ${error}`);
      }
      return data;
    } else {
      const { data, error } = await response.json();
      if (error) {
        throw new Error(`Preprocessing Error: ${error}`);
      } else {
        throw new Error("Unrecognized response from preprocessor");
      }
    }
  });
}

async function preprocessGeography(
  pgClient: PoolClient,
  userGeom: Feature<any>,
  sketchClassId: number,
  projectId: number
) {
  // First, prepare the sketch for clipping (e.g. convert to multipolygon,
  // split at antimeridian, and normalize coordinates)
  const preparedSketch = prepareSketch(userGeom);

  // Get all the clipping layers for geographies in this project, including
  // those used for clipping this sketch class.
  let { rows: clippingLayers } = await pgClient.query(
    `
    select 
      gcl.id,
      gcl.project_geography_id as geography_id,
      data_layers_vector_object_key((select dl from data_layers dl where dl.id = gcl.data_layer_id)) as object_key,
      gcl.operation_type,
      gcl.cql2_query,
      gcl.template_id,
      exists(
        select 1 
        from sketch_class_geographies scg 
        where scg.geography_id = gcl.project_geography_id 
        and scg.sketch_class_id = $1
      ) as for_clipping
    from geography_clipping_layers gcl
    join project_geography pg on gcl.project_geography_id = pg.id
    where pg.project_id = $2
    `,
    [sketchClassId, projectId]
  );

  // group by geography_id
  const geographies = clippingLayers.reduce(
    (acc: GeographySettings[], l: any) => {
      let geography: GeographySettings | undefined = acc.find(
        (g) => g.id === l.geography_id
      );
      if (!geography) {
        geography = {
          id: l.geography_id,
          clippingLayers: [],
        };
        acc.push(geography);
      }
      geography.clippingLayers.push({
        op: l.operation_type.toUpperCase(),
        source: l.object_key,
        cql2Query: l.cql2_query,
      });
      return acc;
    },
    [] as GeographySettings[]
  );

  // Filter out layers that are not used for clipping this sketch class.
  const clippingGeographyLayers = clippingLayers
    .filter((l: any) => l.for_clipping)
    .map((l: any) => l.geography_id);

  // Clip the sketch to the geographies.
  const { clipped, fragments } = await clipToGeographies(
    preparedSketch,
    geographies,
    clippingGeographyLayers,
    [],
    async (feature, objectKey, op, cql2Query) => {
      // ClippingFn is provided to clipToGeography to handle the actual
      // clipping. This is done to accomadate different architectures. For
      // example, on this API server we don't want to block the event-loop, so
      // we use a worker (via clippingWorkerManager) to handle the clipping.
      const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        objectKey
      );
      return clippingWorkerManager.clipSketchToPolygonsWithWorker(
        feature,
        op,
        cql2Query,
        source.getFeaturesAsync(feature.envelopes)
      );
    }
  );

  if (!clipped) {
    throw new Error("Clipping failed. No geometry returned.");
  }

  console.log("fragments", fragments);

  return {
    clipped,
    fragments,
  };
}
