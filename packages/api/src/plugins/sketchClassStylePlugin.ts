import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { DBClient } from "../dbClient";
import { validateGLStyleFragment } from "../validatedGLStyleFragment";

/**
 * This plugin allows admins to update the mapbox gl style for a sketch class
 * It validates the style against the mapbox gl style spec and against
 * SeaSketch specific rules first. It also checks that the session is an admin
 * on the sketch class' parent project.
 */
const SketchClassStylePlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Mutation {
        """
        Admin mutation for updating the mapbox gl style for a sketch class
        """
        updateSketchClassMapboxGLStyle(
          sketchClassId: Int!
          style: JSON
        ): SketchClass!
      }
    `,
    resolvers: {
      Mutation: {
        updateSketchClassMapboxGLStyle: async (
          _query,
          args,
          context,
          resolveInfo
        ) => {
          const { pgClient, adminPool } = context;
          const { sketchClassId, style } = args;
          console.log({ style });
          if (!sketchClassId) {
            throw new Error("sketchClassId is required");
          }
          pgClient as DBClient;
          adminPool as DBClient;
          // First check if session is an admin on the sketch class
          const r = await pgClient.query(
            `select session_is_admin((select project_id from sketch_classes where id = $1))`,
            [sketchClassId]
          );
          if (!r.rows[0].session_is_admin) {
            throw new Error("Session is not an admin on this sketch class");
          }
          // Check if the style is valid
          if (style) {
            const errors = validateGLStyleFragment(style);
            if (errors.length > 0) {
              console.log(errors);
              throw new Error(
                `Style is not valid. Errors: ${JSON.stringify(
                  errors.map((e) => e.message)
                )}`
              );
            }
          }

          // Update the style
          await adminPool.query(
            `update sketch_classes set mapbox_gl_style = $1::jsonb where id = $2`,
            [JSON.stringify(style), sketchClassId]
          );

          // return the sketchClass
          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`public.sketch_classes`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(sketchClassId)}`
              );
            }
          );
          return row;
        },
      },
    },
  };
});

export default SketchClassStylePlugin;
