import { postgraphile } from "postgraphile";
import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { Feature, GeoJsonObject } from "geojson";

const SketchingPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Mutation {
        """
        Create a new sketch in the user's account. If preprocessing is enabled,
        the sketch's final geometry will be set by running the proprocessing
        function again on userGeom. This ensures the value conforms to the
        project's rules, and also benefits the user in that they need not submit
        a huge geometry to the server.

        FormElement data should be stored in the GeoJSON properties
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
        ): Sketch
      }
    `,
    resolvers: {
      Mutation: {
        createSketch: async (
          _query,
          { name, sketchClassId, userGeom, collectionId, folderId },
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
          console.log({ sketchClass, name, userGeom });
          delete userGeom.id;
          // Check to see if preprocessing is required. If so, do it
          let geometry: Feature;
          if (sketchClass.preprocessing_endpoint) {
            // TODO: submit for geoprocessing
            geometry = userGeom;
          } else {
            geometry = userGeom;
          }
          console.log([
            name,
            sketchClassId,
            context.user.id,
            collectionId,
            JSON.stringify(userGeom.geometry),
            JSON.stringify(geometry.geometry),
            folderId,
            userGeom.properties,
          ]);
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
              userGeom.properties,
            ]
          );

          console.log("sketch", sketch);
          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`sketches`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(sketch.id)}`
              );
            }
          );
          console.log("row", row);
          return row;
          // // return the new sketch
          // throw new Error("Not implemented");
        },
      },
    },
  };
});

export default SketchingPlugin;
