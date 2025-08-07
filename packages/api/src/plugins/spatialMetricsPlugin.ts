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
        },
      },
    },
  };
});

export default SpatialMetricsPlugin;
