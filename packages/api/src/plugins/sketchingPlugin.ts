import { postgraphile } from "postgraphile";
import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { Feature, GeoJsonObject } from "geojson";

const SketchingPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Sketch {
        """
        Greater of updatedAt, createdAt, as stringified epoch timestamp.
        Useful for requesting the latest geometry
        """
        timestamp: String! @requires(columns: ["created_at", "updated_at"])
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
          userGeom: GeoJSON!
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
      }
    `,
    resolvers: {
      Sketch: {
        timestamp: async (sketch, args, context, info) => {
          let date = new Date(sketch.createdAt);
          if (sketch.updatedAt) {
            date = new Date(sketch.updatedAt);
          }
          return date.getTime().toString();
        },
      },
      Project: {
        sketchGeometryToken: async (project, args, context, info) => {
          const projectId = project.id;
          const userId = context?.user?.id;
          const canonicalEmail = context.user?.canonicalEmail;
          if (projectId && userId) {
            return context.loaders.signToken(
              {
                type: "sketch-geometry-access",
                userId,
                projectId,
                canonicalEmail,
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
          context,
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
            `select * from public.sketch_classes where id = $1`,
            [sketchClassId]
          );
          const sketchClass = rows[0];
          delete userGeom.id;
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
