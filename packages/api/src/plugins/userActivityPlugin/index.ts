import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { resolveVisitors } from "./resolvers/visitors";
import { resolveMapDataRequests } from "./resolvers/mapDataRequests";
import { resolveVisitorMetrics } from "./resolvers/visitorMetrics";

const UserActivityPlugin = makeExtendSchemaPlugin((_build) => {
  return {
    typeDefs: gql`
      enum UserActivityPeriod {
        H24
        D7
        D30
        D90
        D180
      }

      type VisitorDataPoint {
        timestamp: String!
        count: Int!
      }

      type MapDataRequestDataPoint {
        timestamp: String!
        count: Int!
        cacheHitRatio: Float!
      }

      type LabelCount {
        label: String!
        count: Int!
      }

      type UserActivityVisitorMetrics {
        topReferrers: [LabelCount!]!
        topCountries: [LabelCount!]!
        topBrowsers: [LabelCount!]!
        topOperatingSystems: [LabelCount!]!
        topDeviceTypes: [LabelCount!]!
      }

      type UserActivityStats {
        visitors: [VisitorDataPoint!]!
        mapDataRequests: [MapDataRequestDataPoint!]!
        visitorMetrics: UserActivityVisitorMetrics!
      }

      extend type Query {
        userActivityStats(
          period: UserActivityPeriod!
          slug: String
        ): UserActivityStats!
      }
    `,
    resolvers: {
      Query: {
        userActivityStats: async (_query, args, context, _info) => {
          const { period, slug } = args;

          if (!slug) {
            // Global stats require superuser
            if (
              !context.user ||
              !context.user["https://seasketch.org/superuser"]
            ) {
              throw new Error("Unauthorized. Superuser access required.");
            }
          } else {
            // Project stats require project admin
            const { pgClient } = context;
            const {
              rows: [project],
            } = await pgClient.query(`select id from projects where slug = $1`, [
              slug,
            ]);
            if (!project) {
              throw new Error(`Project not found: ${slug}`);
            }
            const {
              rows: [admin],
            } = await pgClient.query(
              `select session_is_admin($1) as is_admin`,
              [project.id]
            );
            if (!admin?.is_admin) {
              throw new Error("Unauthorized. Project admin access required.");
            }
          }

          // Return period and slug as context for child field resolvers
          return { period, slug: slug || undefined };
        },
      },
      UserActivityStats: {
        visitors: resolveVisitors,
        mapDataRequests: resolveMapDataRequests,
        visitorMetrics: resolveVisitorMetrics,
      },
    },
  };
});

export default UserActivityPlugin;
