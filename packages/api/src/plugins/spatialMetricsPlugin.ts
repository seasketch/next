import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";

const geographyMetricTopicFromContext = async (args: any, context: any) => {
  // check that user has access to the project
  const sessionHasProjectAccess = await context.pgClient.query(
    `select session_has_project_access($1)`,
    [args.projectId]
  );
  if (!sessionHasProjectAccess.rows[0].session_has_project_access) {
    throw new Error("You do not have access to this project");
  }
  if (args.projectId) {
    return `graphql:projects:${args.projectId}:geography-metrics`;
  } else {
    throw new Error("You must specify projectId");
  }
};

const sketchMetricTopicFromContext = async (args: any, context: any) => {
  if (args.sketchId) {
    const sessionHasSketchAccess = await context.pgClient.query(
      `select session_can_access_sketch($1)`,
      [args.sketchId]
    );
    if (!sessionHasSketchAccess.rows[0].session_can_access_sketch) {
      throw new Error("You do not have access to this sketch");
    }
    return `graphql:sketches:${args.sketchId}:metrics`;
  } else {
    throw new Error("You must specify sketchId");
  }
};

const SpatialMetricsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      input SpatialMetricDependency {
        type: String!
        sketchId: Int
        includeSiblings: Boolean
        geographyIds: [Int!]
        stableId: String
        groupBy: String
        includedProperties: [String!]
      }

      type GeographySubject {
        id: Int!
      }

      type FragmentSubject {
        hash: String!
        geographies: [Int!]!
        sketches: [Int!]!
      }

      union MetricSubject = GeographySubject | FragmentSubject

      type CompatibleSpatialMetric {
        id: BigInt!
        type: String!
        updatedAt: Datetime
        createdAt: Datetime!
        value: JSON
        state: SpatialMetricState!
        stableId: String
        groupBy: String
        includedProperties: [String!]
        subject: MetricSubject!
        errorMessage: String
        progress: Int
      }

      type GetOrCreateSpatialMetricsResults {
        metrics: [CompatibleSpatialMetric!]!
      }

      extend type Mutation {
        """
        Create or update spatial metrics.
        """
        getOrCreateSpatialMetrics(
          inputs: [SpatialMetricDependency!]!
        ): GetOrCreateSpatialMetricsResults!
      }

      type GeographyMetricSubscriptionPayload {
        geographyId: Int!
        projectId: Int!
        metricId: BigInt!
        metric: CompatibleSpatialMetric
      }

      type SketchMetricSubscriptionPayload {
        sketchId: Int!
        metricId: BigInt!
        metric: CompatibleSpatialMetric
      }


      extend type Subscription {
        geographyMetrics(projectId: Int!): GeographyMetricSubscriptionPayload @pgSubscription(topic: ${embed(
          geographyMetricTopicFromContext
        )})
        sketchMetrics(sketchId: Int!): SketchMetricSubscriptionPayload @pgSubscription(topic: ${embed(
          sketchMetricTopicFromContext
        )})
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
          context.sketchIds = inputs
            .map((input: any) => input.sketchId)
            .filter((id: number) => id !== null);
          const geographyIds: number[] = [];
          const rows = await pgClient.query(
            `select get_parent_collection_id(sketches.*) from sketches where id = $1`,
            [inputs[0].sketchId]
          );
          const parentCollectionId = rows.rows[0].get_parent_collection_id;
          for (const dep of inputs) {
            if (
              !dep.sketchId &&
              (!dep.geographyIds || dep.geographyIds.length === 0)
            ) {
              throw new Error(
                "Spatial metric dependency must have a sketchId and/or geographyIds"
              );
            }
            if (dep.geographyIds && dep.geographyIds.length > 0) {
              for (const geographyId of dep.geographyIds) {
                // Ensure metric exists/updated for the geography
                const result = await pgClient.query(
                  `select (select get_or_create_spatial_metric($1, $2, $3::spatial_metric_type, $4, $5, $6, $7, $8)).id as id`,
                  [
                    null, // subject_fragment_id
                    geographyId, // subject_geography_id
                    dep.type,
                    dep.stableId,
                    null,
                    dep.groupBy,
                    dep.includedProperties,
                    null,
                  ]
                );
                geographyIds.push(geographyId);
                spatialMetricIds.push(parseInt(result.rows[0].id));
              }
            }
            if (dep.sketchId) {
              // subject will be the sketch's fragments
              const fragmentsQuery = await pgClient.query(
                `select get_fragment_hashes_for_sketch($1)`,
                [
                  dep.includeSiblings && parentCollectionId
                    ? parentCollectionId
                    : dep.sketchId,
                ]
              );
              const fids = [];
              for (const row of fragmentsQuery.rows) {
                const hashes = row.get_fragment_hashes_for_sketch;
                fids.push(...hashes);
              }

              const results = await pgClient.query(
                `select get_or_create_spatial_metrics_for_fragments($1::text[], $2::spatial_metric_type, $3::text, $4::text, $5::text, $6::text[], $7::metric_overlay_type) as ids`,
                [
                  fids,
                  dep.type,
                  dep.stableId,
                  null,
                  dep.groupBy,
                  dep.includedProperties,
                  null,
                ]
              );
              if (results.rows.length === 1) {
                spatialMetricIds.push(
                  // have to parse the bigint
                  ...results.rows[0].ids.map((id: string) => parseInt(id))
                );
              } else {
                throw new Error(
                  "Problem creating or fetching metrics. Expected 1 result, got " +
                    results.rows.length
                );
              }
            }
          }

          context.spatialMetricIds = spatialMetricIds;
          context.geographyIds = geographyIds;

          return {};
        },
      },
      GetOrCreateSpatialMetricsResults: {
        metrics: async (metrics, args, context, resolveInfo) => {
          const { pgClient } = context;
          const spatialMetricIds: number[] = context.spatialMetricIds || [];
          const geographyIds: number[] = context.geographyIds || [];

          const results: any[] = [];

          // Fetch metrics for geographies using the new function
          for (const geographyId of geographyIds) {
            const geoMetrics = await pgClient.query(
              `select get_metrics_for_geography($1) as metrics`,
              [geographyId]
            );

            const metricsArray = geoMetrics.rows[0]?.metrics;
            if (metricsArray && Array.isArray(metricsArray)) {
              for (const m of metricsArray) {
                if (!m || !context.spatialMetricIds.includes(m.id)) continue;
                results.push({
                  ...m,
                  id: parseInt(m.id),
                  subject: {
                    id: m.subject.id,
                    __typename: "GeographySubject",
                  },
                });
              }
            }
          }

          // now add fragment metrics
          for (const sketchId of context.sketchIds || []) {
            const sketchMetrics = await pgClient.query(
              `select get_metrics_for_sketch($1) as metrics`,
              [sketchId]
            );
            const metricsArray = sketchMetrics.rows[0]?.metrics;
            if (metricsArray && Array.isArray(metricsArray)) {
              for (const m of metricsArray) {
                if (!m || !context.spatialMetricIds.includes(m.id)) continue;
                results.push({
                  ...m,
                  id: parseInt(m.id),
                  subject: {
                    hash: m.subject.hash,
                    sketches: m.subject.sketches,
                    geographies: m.subject.geographies,
                    __typename: "FragmentSubject",
                  },
                });
              }
            }
          }
          return results;
        },
      },
      GeographyMetricSubscriptionPayload: {
        async metric(
          event,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          const { pgClient } = context;
          const result = await pgClient.query(
            `select get_spatial_metric($1) as metric`,
            [parseInt(event.metricId)]
          );
          console.log("subscription payload", {
            id: event.metricId,
            state: result.rows[0].metric.state,
            progress: result.rows[0].metric.progress,
          });
          return {
            __typename: "CompatibleSpatialMetric",
            ...result.rows[0].metric,
          };
        },
      },
      SketchMetricSubscriptionPayload: {
        async metric(
          event,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          const { pgClient } = context;
          const result = await pgClient.query(
            `select get_spatial_metric($1) as metric`,
            [parseInt(event.metricId)]
          );
          return {
            __typename: "CompatibleSpatialMetric",
            ...result.rows[0].metric,
          };
        },
      },
    },
  };
});

export default SpatialMetricsPlugin;
