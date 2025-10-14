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

const sourceProcessingJobTopicFromContext = async (args: any, context: any) => {
  if (args.projectId) {
    return `graphql:projects:${args.projectId}:sourceProcessingJobs`;
  } else {
    throw new Error("You must specify projectId");
  }
};

const SpatialMetricsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`

      enum MetricSourceType {
        FlatGeobuf
        GeoJSON
        GeoTIFF
      }


      input SpatialMetricDependency {
        type: String!
        sketchId: Int
        includeSiblings: Boolean
        geographyIds: [Int!]
        sourceUrl: String
        groupBy: String
        includedProperties: [String!]
        sourceProcessingJobDependency: String
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
        groupBy: String
        includedProperties: [String!]
        subject: MetricSubject!
        errorMessage: String
        progress: Int
        jobKey: String
        sourceProcessingJobDependency: String
        sourceUrl: String
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

      type SourceProcessingJobSubscriptionPayload {
        projectId: Int!
        jobKey: String!
        job: SourceProcessingJob!
      }

      extend type Subscription {
        geographyMetrics(projectId: Int!): GeographyMetricSubscriptionPayload @pgSubscription(topic: ${embed(
          geographyMetricTopicFromContext
        )})
        sketchMetrics(sketchId: Int!): SketchMetricSubscriptionPayload @pgSubscription(topic: ${embed(
          sketchMetricTopicFromContext
        )})
        sourceProcessingJobs(projectId: Int!): SourceProcessingJobSubscriptionPayload @pgSubscription(topic: ${embed(
          sourceProcessingJobTopicFromContext
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
            console.log("dep", dep);
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
                  `select (select get_or_create_spatial_metric($1, $2, $3::spatial_metric_type, $4, $5, $6, $7)).id as id`,
                  [
                    null, // subject_fragment_id
                    geographyId, // subject_geography_id
                    dep.type, // type
                    dep.sourceUrl, // dep.sourceUrl
                    dep.groupBy, // overlay_group_by
                    dep.includedProperties, // included_properties
                    dep.sourceProcessingJobDependency,
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
                `select get_or_create_spatial_metrics_for_fragments($1::text[], $2::spatial_metric_type, $3::text, $4::text, $5::text[], $6::text) as ids`,
                [
                  fids, // subject_fragments
                  dep.type, // type
                  dep.sourceUrl, // overlay_source_url
                  dep.groupBy, // overlay_group_by
                  dep.includedProperties, // included_properties
                  dep.sourceProcessingJobDependency,
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

          // Fetch all metrics in a single query for performance
          const { rows } = await pgClient.query(
            `select get_spatial_metrics($1::bigint[]) as metrics`,
            [spatialMetricIds]
          );
          const results: any[] = rows[0]?.metrics ?? [];
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
      SourceProcessingJobSubscriptionPayload: {
        async job(
          event,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`source_processing_jobs`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.job_key = ${sql.value(event.jobKey)}`
              );
            }
          );
          return rows[0];
        },
      },
    },
  };
});

export default SpatialMetricsPlugin;
