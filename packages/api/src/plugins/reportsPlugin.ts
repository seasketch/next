import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";
import { AnyLayer } from "mapbox-gl";
import { Pool } from "pg";

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

const reportOverlaySourceTopicFromContext = async (args: any, context: any) => {
  if (args.projectId) {
    return `graphql:projects:${args.projectId}:reportOverlaySources`;
  } else {
    throw new Error("You must specify a projectId");
  }
};

type ReportOverlaySourcePartial = {
  tableOfContentsItemId: number;
  geostats: GeostatsLayer | RasterInfo;
  mapboxGlStyles: AnyLayer[];
  sourceProcessingJobId: string;
  outputId?: number;
  sourceUrl?: string;
};

const ReportsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`

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
        eta: Datetime
        startedAt: Datetime
        completedAt: Datetime
      }

      type GetOrCreateSpatialMetricsResults {
        metrics: [CompatibleSpatialMetric!]!
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

      type ReportOverlaySource {
        tableOfContentsItemId: Int!
        tableOfContentsItem: TableOfContentsItem!
        geostats: JSON!
        mapboxGlStyles: JSON!
        sourceProcessingJob: SourceProcessingJob!
        sourceProcessingJobId: String!
        outputId: Int!
        output: DataUploadOutput
        sourceUrl: String
      }

      type ReportOverlaySourcesSubscriptionPayload {
        jobKey: String!
        source: ReportOverlaySource!
        dataSourceId: Int!
        projectId: Int!
      }

      extend type Subscription {
        
        geographyMetrics(projectId: Int!): GeographyMetricSubscriptionPayload @pgSubscription(topic: ${embed(
          geographyMetricTopicFromContext
        )})
        
        sketchMetrics(sketchId: Int!): SketchMetricSubscriptionPayload @pgSubscription(topic: ${embed(
          sketchMetricTopicFromContext
        )})

        reportOverlaySources(projectId: Int!): ReportOverlaySourcesSubscriptionPayload @pgSubscription(topic: ${embed(
          reportOverlaySourceTopicFromContext
        )})
      }


      type ReportOverlayDependencies {
        ready: Boolean!
        overlaySources: [ReportOverlaySource!]!
        metrics: [CompatibleSpatialMetric!]!
      }

      extend type Report {
        dependencies(sketchId: Int): ReportOverlayDependencies! @requires(columns: ["id", "project_id", "sketch_class_id"])
      }

    `,
    resolvers: {
      Report: {
        async dependencies(report, args, context, resolveInfo) {
          const { pgClient } = context;
          const overlaySources = await getOverlaySources(
            report.id,
            context.pgClient
          );
          const metrics = await getOrCreateMetrics(
            report.id,
            pgClient,
            report.projectId,
            overlaySources,
            args.sketchId
          );
          const ready =
            metrics.every((metric) => metric.state === "complete") &&
            overlaySources.every((source) => Boolean(source.outputId));

          return {
            ready,
            overlaySources,
            metrics,
          };
        },
      },
      ReportOverlaySource: {
        async tableOfContentsItem(
          reportOverlaySource,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          const { pgClient } = context;
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`table_of_contents_items`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(
                  reportOverlaySource.tableOfContentsItemId
                )}`
              );
            }
          );
          return rows[0];
        },
        async sourceProcessingJob(
          reportOverlaySource,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`source_processing_jobs`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.job_key = ${sql.value(
                  reportOverlaySource.sourceProcessingJobId
                )}`
              );
            }
          );
          return rows[0];
        },
        async output(
          reportOverlaySource,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`data_upload_outputs`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(
                  reportOverlaySource.outputId
                )}`
              );
            }
          );
          return rows[0];
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
      ReportOverlaySourcesSubscriptionPayload: {
        async source(
          event,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          const { jobKey, dataSourceId } = event;
          // type ReportOverlaySource {
          //   tableOfContentsItemId: Int!
          //   tableOfContentsItem: TableOfContentsItem!
          //   geostats: JSON!
          //   mapboxGlStyles: JSON!
          //   sourceProcessingJob: SourceProcessingJob!
          //   sourceProcessingJobId: String!
          //   outputId: Int!
          //   output: DataUploadOutput
          //   sourceUrl: String
          // }
          const result = await context.pgClient.query(
            `
            select
              items.id as table_of_contents_item_id,
              s.geostats as geostats,
              l.mapbox_gl_styles as mapbox_gl_styles,
              o.id as output_id,
              o.url as source_url
            from
              data_sources s
            inner join data_layers l on l.data_source_id = s.id
            inner join table_of_contents_items items on items.data_layer_id = l.id
            left join data_upload_outputs o on o.data_source_id = s.id and o.type = 'ReportingFlatgeobufV1'
            where
              s.id = $1
          `,
            [dataSourceId]
          );
          if (!result.rows[0]) {
            throw new Error("Report overlay source not found");
          }
          return {
            __typename: "ReportOverlaySource",
            tableOfContentsItemId: result.rows[0].table_of_contents_item_id,
            geostats: result.rows[0].geostats,
            mapboxGlStyles: result.rows[0].mapbox_gl_styles,
            sourceProcessingJobId: jobKey,
            outputId: result.rows[0].output_id,
            sourceUrl: result.rows[0].source_url,
          };
        },
      },
    },
  };
});

/**
 * Returns all overlay sources for a report. Each card in a report may have
 * layers associated with it for analysis. This function returns distinct layers
 * for all cards in a report.
 *
 * Of particular note for browser clients is the pre-processing state of the
 * source, indicating whether it is ready for metric calculation or not.
 *
 * @param reportId - The id of the report to get overlay sources for
 * @param pool - The database pool to use
 * @returns An array of ReportOverlaySourcePartial objects
 */
async function getOverlaySources(reportId: number, pool: Pool) {
  const rows = await pool.query(
    `
      select 
        distinct on (rcl.table_of_contents_item_id) rcl.table_of_contents_item_id, 
        ds.geostats,
        dl.mapbox_gl_styles,
        spj.job_key as source_processing_job_id,
        duo.id as output_id,
        duo.url as source_url
      from 
        report_card_layers rcl
      inner join table_of_contents_items t on t.id = rcl.table_of_contents_item_id
      inner join data_layers dl on dl.id = t.data_layer_id
      inner join data_sources ds on ds.id = dl.data_source_id
      inner join source_processing_jobs spj on spj.data_source_id = ds.id
      left join data_upload_outputs duo on duo.data_source_id = ds.id and duo.type = 'ReportingFlatgeobufV1'
      where 
        report_card_id in (select report_card_ids_for_report($1))
      `,
    [reportId]
  );
  const overlaySources = rows.rows.map((row: any) => ({
    tableOfContentsItemId: row.table_of_contents_item_id,
    geostats: row.geostats,
    mapboxGlStyles: row.mapbox_gl_styles,
    sourceProcessingJobId: row.source_processing_job_id,
    outputId: row.output_id,
    sourceUrl: row.source_url,
  })) as ReportOverlaySourcePartial[];
  return overlaySources;
}

/**
 * Returns all spatial_metrics for a report, optionally including fragment
 * metrics for the sketch identified by sketchId. This is a getOrCreate type
 * operation, where by the resolver:
 *   1. determines which metrics are dependencies given the report configuration
 *   2. makes sure those metrics are in the db, or creates them and fires off
 *      graphile-worker jobs to handle them. In the process, it checks to make
 *      sure each related overlay source needed is either already preprocessed,
 *      has a source_processing_job in-progress, or it creates and fires off a
 *      new source_processing_job.
 *   3. returns the metrics
 */
async function getOrCreateMetrics(
  reportId: number,
  pool: Pool,
  projectId: number,
  overlaySources?: ReportOverlaySourcePartial[],
  sketchId?: number
) {
  const metrics: any[] = [];
  overlaySources = overlaySources || (await getOverlaySources(reportId, pool));
  if (!overlaySources) {
    throw new Error("No overlay sources found");
  }
  const { rows: geogs } = await pool.query(
    `select name, id from project_geography where project_id = $1`,
    [projectId]
  );
  if (geogs.length === 0) {
    throw new Error("No geographies found");
  }
  const { rows: reportCardLayers } = await pool.query(
    `
    select 
      rcl.table_of_contents_item_id, 
      rcl.report_card_id, 
      rcl.group_by,
      rc.type as card_type,
      rc.component_settings as card_settings
    from 
      report_card_layers rcl
    inner join report_cards rc on rc.id = rcl.report_card_id
    where 
      report_card_id in (select report_card_ids_for_report($1))`,
    [reportId]
  );
  const fragments: string[] = [];
  if (sketchId) {
    const { rows: sketchFragmentsRows } = await pool.query(
      `select get_fragment_hashes_for_sketch($1)`,
      [sketchId]
    );
    fragments.push(...sketchFragmentsRows[0].get_fragment_hashes_for_sketch);
  }

  // First, create total_area metrics. These will be calculated for all
  // geographies and fragments, regardless of configuration.
  for (const geography of geogs) {
    const metricId = await getOrCreateSpatialMetric(
      pool,
      null,
      geography.id,
      "total_area",
      null,
      null,
      null,
      null,
      projectId
    );
    metrics.push(metricId);
  }
  for (const fragment of fragments) {
    const metricId = await getOrCreateSpatialMetric(
      pool,
      fragment,
      null,
      "total_area",
      null,
      null,
      null,
      null,
      projectId
    );
    metrics.push(metricId);
  }

  // Now, move on to overlays referenced by report card layers
  for (const reportCardLayer of reportCardLayers) {
    const overlaySource = overlaySources.find(
      (source) =>
        source.tableOfContentsItemId ===
        reportCardLayer.table_of_contents_item_id
    );
    if (!overlaySource) {
      throw new Error(
        `Overlay source not found for report card (${reportCardLayer.card_type}) layer: ${reportCardLayer.table_of_contents_item_id}`
      );
    }
    switch (reportCardLayer.card_type) {
      case "OverlappingAreas":
        metrics.push(
          ...(await getOrCreateMetricsOfType(
            pool,
            "overlay_area",
            overlaySource,
            reportCardLayer.group_by,
            reportCardLayer.card_settings,
            geogs.map((g) => g.id),
            fragments,
            projectId
          ))
        );
        break;
      case "Size":
        // do nothing. Size already handled above.
        break;
      default:
        throw new Error("Unhandled card type: " + reportCardLayer.card_type);
    }
  }

  return metrics;
}

async function getOrCreateSpatialMetric(
  pool: Pool,
  subjectFragmentId: string | null,
  subjectGeographyId: number | null,
  type: string,
  overlaySourceUrl: string | null,
  overlayGroupBy: string | null,
  includedProperties: string[] | null,
  sourceProcessingJobDependency: string | null,
  projectId: number
) {
  const result = await pool.query(
    `
    select get_or_create_spatial_metric($1::text, $2::int, $3::spatial_metric_type, $4::text, $5::text, $6::text[], $7::text, $8::int) as metric
  `,
    [
      subjectFragmentId,
      subjectGeographyId,
      type,
      overlaySourceUrl,
      overlayGroupBy,
      includedProperties,
      sourceProcessingJobDependency,
      projectId,
    ]
  );
  return result.rows[0].metric;
}

async function getOrCreateMetricsOfType(
  pool: Pool,
  type:
    | "overlay_area"
    | "count"
    | "presence"
    | "presence_table"
    | "contextualized_mean",
  overlaySource: ReportOverlaySourcePartial,
  groupBy: string,
  cardSettings: any,
  geographyIds: number[],
  fragmentHashes: string[],
  projectId: number
) {
  const metrics: any[] = [];
  // first, create geography metrics
  for (const geographyId of geographyIds) {
    const metric = await getOrCreateSpatialMetric(
      pool,
      null,
      geographyId,
      type,
      overlaySource.sourceUrl || null,
      groupBy,
      cardSettings.includedProperties,
      overlaySource.sourceProcessingJobId || null,
      projectId
    );
    metrics.push(metric);
  }
  // then, fragment metrics
  for (const fragmentHash of fragmentHashes) {
    const metric = await getOrCreateSpatialMetric(
      pool,
      fragmentHash,
      null,
      type,
      overlaySource.sourceUrl || null,
      groupBy,
      cardSettings.includedProperties,
      overlaySource.sourceProcessingJobId || null,
      projectId
    );
    metrics.push(metric);
  }
  return metrics;
}

/**
 * Can be used to start calculating report metrics for a sketch. Useful if we
 * want to run them as soon as a sketch is saved rather than waiting for the
 * user to open the report.
 */
export async function startMetricCalculationsForSketch(
  pool: Pool,
  sketchId: number,
  draft?: boolean
) {
  // get sketch_class data first
  const { rows: sketchClassRows } = await pool.query(
    `select id, report_id, draft_report_id, project_id from sketch_classes where id = (select sketch_class_id from sketches where id = $1)`,
    [sketchId]
  );
  const sketchClass = sketchClassRows[0];
  if (!sketchClass) {
    throw new Error("Sketch class not found");
  }
  const reportId = draft ? sketchClass.draft_report_id : sketchClass.report_id;
  if (!reportId) {
    throw new Error(`Report not found for sketch class ${sketchClass.id}`);
  }
  return getOrCreateMetrics(
    reportId,
    pool,
    sketchClass.project_id,
    undefined,
    sketchId
  );
}

export default ReportsPlugin;
