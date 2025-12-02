import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { Feature } from "geojson";
import { Context } from "postgraphile";
import { Pool } from "pg";
import {
  createOrUpdateSketch,
  deleteSketchTocItems,
  copySketchTocItem,
  updateSketchTocItemParent,
  preprocess,
} from "../sketches";

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
            const sketchId = await createOrUpdateSketch({
              pgClient,
              userGeom,
              sketchClassId,
              projectId: sketchClass.project_id,
              name,
              collectionId,
              folderId,
              properties,
              userId: context.user.id,
            });

            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`sketches`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(sketchId)}`
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

          if (sketchClass.is_geography_clipping_enabled) {
            const sketchId = await createOrUpdateSketch({
              pgClient,
              userGeom,
              sketchClassId: sketchClass.id,
              projectId: sketchClass.project_id,
              name,
              properties,
              userId: context.user.id,
              sketchId: id,
            });
            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`sketches`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(sketchId)}`
                  );
                }
              );
            return row;
          } else if (sketchClass.preprocessing_endpoint) {
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
          const result = await copySketchTocItem(id, type, forForum, pgClient);

          context.sketchIds = result.sketchIds;
          context.folderIds = result.folderIds;
          context.parentId = result.copyId;
          context.parentType = type;
          context.parentCollectionId = result.parentCollectionId;

          return {
            parentId: result.copyId,
          };
        },
        updateSketchTocItemParent: async (
          _query,
          { folderId, collectionId, tocItems },
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          const result = await updateSketchTocItemParent(
            folderId,
            collectionId,
            tocItems,
            pgClient
          );

          context.sketchIds = result.sketchIds;
          context.folderIds = result.folderIds;
          context.previousCollectionIds = result.previousCollectionIds;
          context.tocItems = tocItems;

          return {};
        },
        deleteSketchTocItems: async (_query, { items }, context) => {
          const { pgClient } = context;
          const { deletedItems, previousCollectionIds } =
            await deleteSketchTocItems(items, pgClient);
          context.previousCollectionIds = previousCollectionIds;
          return { deletedItems };
        },
      },
    },
  };
});

export default SketchingPlugin;
