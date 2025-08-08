import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { Context } from "postgraphile";
import { Pool } from "pg";

const SpatialMetricsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      input SpatialMetricDependency {
        type: String!
        sketchId: Int
        geographyIds: [Int!]
        stableId: String
        groupBy: String
        includedProperties: [String!]
      }

      type GetOrCreateSpatialMetricsResults {
        metrics: [SpatialMetric!]!
      }

      extend type Mutation {
        """
        Create or update spatial metrics.
        """
        getOrCreateSpatialMetrics(
          inputs: [SpatialMetricDependency!]!
        ): GetOrCreateSpatialMetricsResults!
      }
    `,
    resolvers: {
      Mutation: {
        getOrCreateSpatialMetrics: async (
          _,
          { inputs },
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          const spatialMetricIds: number[] = [];
          context.spatialMetricIds = [];
          for (const dep of inputs) {
            if (dep.geographyIds && dep.geographyIds.length > 0) {
              // subject is a geography
              if (dep.sketchId) {
                throw new Error(
                  "Geography metrics with sketchId are not supported"
                );
              }
              for (const geographyId of dep.geographyIds) {
                const results = await pgClient.query(
                  `select get_or_create_spatial_metric($1, $2, $3, $4, $5, $6, $7, $8) as id`,
                  [
                    null, // subject_fragment_id
                    geographyId, // subject_geography_id
                    dep.type,
                    dep.overlayStableId,
                    dep.overlaySourceRemote,
                    dep.overlayGroupBy,
                    dep.includedProperties,
                    dep.overlayType,
                  ]
                );
                spatialMetricIds.push(parseInt(results.rows[0].id));
              }
            } else if (dep.sketchId) {
              // subject will be the sketch's fragments
              const fragmentIds = await pgClient.query(
                `select fragment_ids_for_sketch($1)`,
                [dep.sketchId]
              );
              for (const row of fragmentIds.rows) {
                const fragmentId = row.fragment_ids_for_sketch;
                const results = await pgClient.query(
                  `select get_or_create_spatial_metric($1, $2, $3, $4, $5, $6, $7, $8) as id`,
                  [
                    fragmentId, // subject_fragment_id
                    null, // subject_geography_id
                    dep.type,
                    dep.overlayStableId,
                    dep.overlaySourceRemote,
                    dep.overlayGroupBy,
                    dep.includedProperties,
                    dep.overlayType,
                  ]
                );
                spatialMetricIds.push(parseInt(results.rows[0].id));
              }
            } else {
              throw new Error(
                "Spatial metric dependency must have a sketchId or geographyIds"
              );
            }
          }

          console.log("spatialMetricIds", spatialMetricIds);
          context.spatialMetricIds = spatialMetricIds;

          return {};
        },
      },
      GetOrCreateSpatialMetricsResults: {
        metrics: async (metrics, args, context, resolveInfo) => {
          const { pgClient } = context;
          const spatialMetricIds: number[] = context.spatialMetricIds;
          // get metrics for ids
          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`spatial_metrics`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = any(${sql.value(
                  spatialMetricIds
                )})`
              );
            }
          );
        },
      },
    },
  };
});

export default SpatialMetricsPlugin;
