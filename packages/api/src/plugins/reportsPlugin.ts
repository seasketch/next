import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";
import { AnyLayer } from "mapbox-gl";
import { hashMetricDependency, MetricDependency } from "overlay-engine";
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
  sourceProcessingJobId?: string;
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

      type MetricParameters {
        groupBy: String
        includedColumns: [String!]
        valueColumn: String
        bufferDistanceKm: Float
        maxResults: Int
        maxDistanceKm: Float
      }

      type CompatibleSpatialMetric {
        id: BigInt!
        type: String!
        updatedAt: Datetime
        createdAt: Datetime!
        value: JSON
        state: SpatialMetricState!
        parameters: MetricParameters!
        subject: MetricSubject!
        errorMessage: String
        progress: Int
        jobKey: String
        sourceProcessingJobDependency: String
        sourceUrl: String
        eta: Datetime
        startedAt: Datetime
        completedAt: Datetime
        durationSeconds: Float
        dependencyHash: String!
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
        sourceProcessingJob: SourceProcessingJob
        sourceProcessingJobId: String
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

      input NodeDependency {
        # e.g. "total_area", "presence", "presence_table", "column_values", "raster_stats", "distance_to_shore"
        type: String!
        # "fragments" or "geographies"
        subjectType: String!
        tableOfContentsItemId: Int
        geographies: [Int!]
        parameters: JSON
        hash: String!
      }

      type CardDependencyLists {
        cardId: Int!
        metrics: [BigInt!]!
        overlaySources: [Int!]!
      }

      type ReportOverlayDependencies {
        ready: Boolean!
        overlaySources: [ReportOverlaySource!]!
        metrics: [CompatibleSpatialMetric!]!
        cardDependencyLists: [CardDependencyLists!]!
      }

      extend type Report {
        dependencies(sketchId: Int): ReportOverlayDependencies! @requires(columns: ["id", "project_id", "sketch_class_id"])
      }

      input DraftDependenciesInput {
        nodeDependencies: [NodeDependency!]!
        sketchId: Int
      }

      type DraftReportDependenciesResults {
        ready: Boolean!
        sketchId: Int!
        overlaySources: [ReportOverlaySource!]!
        metrics: [CompatibleSpatialMetric!]!
      }

      extend type Query {
        draftReportDependencies(input: DraftDependenciesInput): DraftReportDependenciesResults!
      }

      extend type Project {
        reportingLayers: [ReportOverlaySource!]! @requires(columns: ["id"])
      }
      
    `,
    resolvers: {
      Project: {
        async reportingLayers(project, args, context, resolveInfo) {
          const { pgClient } = context;
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
            left join lateral (
              select
                o.id,
                o.url
              from
                data_upload_outputs o
              where
                o.data_source_id = s.id
                and is_reporting_type(o.type)
              order by
                o.id desc
              limit 1
            ) o on true
            where
              s.id  in (
                select data_source_id from source_processing_jobs where project_id = $1
              )
          `,
            [project.id]
          );
          for (const row of result.rows) {
            stripUnnecessaryGeostatsFields(row.geostats);
          }
          return result.rows.map((row: any) => ({
            __typename: "ReportOverlaySource",
            tableOfContentsItemId: row.table_of_contents_item_id,
            geostats: row.geostats,
            mapboxGlStyles: row.mapbox_gl_styles,
            sourceProcessingJobId: row.source_processing_job_id,
            outputId: row.output_id,
            sourceUrl: row.source_url,
          }));
        },
      },
      Report: {
        async dependencies(report, args, context, resolveInfo) {
          const { pgClient } = context;

          console.time('getOrCreateReportDependencies');
          const deps = await getOrCreateReportDependencies(
            report.id,
            pgClient,
            report.projectId,
            args.sketchId
          );
          console.timeEnd('getOrCreateReportDependencies');
          return deps;
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
            left join data_upload_outputs o on o.data_source_id = s.id and is_reporting_type(o.type)
            where
              s.id = $1
          `,
            [dataSourceId]
          );
          if (!result.rows[0]) {
            throw new Error("Report overlay source not found");
          }
          // delete unnecessary geostats fields
          for (const row of result.rows) {
            stripUnnecessaryGeostatsFields(row.geostats);
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
      Query: {
        async draftReportDependencies(root, args, context, resolveInfo) {
          const { pgClient } = context;
          const pool = pgClient;
          const sketchId = args.input.sketchId;
          // First, make sure the sketch exists
          const { rows: sketchRows } = await pgClient.query(
            `select sketches.id, sketch_classes.project_id as project_id, session_is_admin(sketch_classes.project_id) as is_admin from sketches inner join sketch_classes on sketches.sketch_class_id = sketch_classes.id where sketches.id = $1`,
            [sketchId]
          );
          if (sketchRows.length === 0) {
            throw new Error("Sketch not found");
          }
          if (!sketchRows[0].is_admin) {
            throw new Error(
              "You are not authorized to access draft metrics for this sketch."
            );
          }
          const sketch = sketchRows[0];
          const projectId = sketch.project_id;

          // Retrieve all fragments related to the sketch (if any)
          const fragments: string[] = [];
          if (sketchId) {
            const { rows: sketchFragmentsRows } = await pool.query(
              `select get_fragment_hashes_for_sketch($1)`,
              [sketchId]
            );
            if (
              sketchFragmentsRows.length > 0 &&
              sketchFragmentsRows[0].get_fragment_hashes_for_sketch &&
              Array.isArray(
                sketchFragmentsRows[0].get_fragment_hashes_for_sketch
              )
            ) {
              fragments.push(
                ...sketchFragmentsRows[0].get_fragment_hashes_for_sketch
              );
            }
          }

          // Retrieve all geographies related to the project
          const { rows: geogs } = await pool.query(
            `select name, id from project_geography where project_id = $1`,
            [projectId]
          );
          if (geogs.length === 0) {
            throw new Error("No geographies found");
          }

          const { tableOfContentsItemIds, metrics, hashes } =
            await createMetricsForDependencies(
              pgClient,
              args.input.nodeDependencies,
              projectId,
              fragments,
              geogs
            );

          const relatedTableOfContentsItemIds = new Set<number>(
            tableOfContentsItemIds
          );

          const overlaySources = await getOverlaySourcesForDependencies(
            pool,
            Array.from(relatedTableOfContentsItemIds),
            projectId
          );
          return {
            overlaySources: Object.values(overlaySources),
            metrics,
            ready: !metrics.find((m) => m.state !== "complete"),
            sketchId,
          };
        },
      },
    },
  };
});

async function getOrCreateReportDependencies(
  reportId: number,
  pool: Pool,
  projectId: number,
  sketchId?: number
) {
  // Retrieve all overlay sources related to the report
  // const overlaySources = await getOverlaySources(reportId, pool);

  const relatedTableOfContentsItemIds = new Set<number>();
  const results = {
    overlaySources: [] as ReportOverlaySourcePartial[],
    ready: true,
    metrics: [] as any[],
    cardDependencyLists: [] as {
      cardId: number;
      metrics: number[];
      overlaySources: number[];
    }[],
  };

  // Retrieve all fragments related to the sketch (if any)
  const fragments: string[] = [];
  if (sketchId) {
    const { rows: sketchFragmentsRows } = await pool.query(
      `select get_fragment_hashes_for_sketch($1)`,
      [sketchId]
    );
    if (
      sketchFragmentsRows.length > 0 &&
      sketchFragmentsRows[0].get_fragment_hashes_for_sketch &&
      Array.isArray(sketchFragmentsRows[0].get_fragment_hashes_for_sketch)
    ) {
      fragments.push(...sketchFragmentsRows[0].get_fragment_hashes_for_sketch);
    }
  }

  // Retrieve all geographies related to the project
  const { rows: geogs } = await pool.query(
    `select name, id from project_geography where project_id = $1`,
    [projectId]
  );
  if (geogs.length === 0) {
    throw new Error("No geographies found");
  }

  const cards = await pool.query(
    `
      select 
        rc.id, 
        rc.type, 
        rc.component_settings,
        rc.body
      from 
        report_cards rc
      where 
        rc.id in (select report_card_ids_for_report($1))
      group by rc.id, rc.type, rc.component_settings`,
    [reportId]
  );

  for (const card of cards.rows) {
    const cardDependencyList = {
      cardId: card.id,
      metrics: [] as number[],
      overlaySources: [] as number[],
    };
    const dependencies = extractMetricDependenciesFromReportBody(card.body);

    const { tableOfContentsItemIds, metrics, hashes } =
      await createMetricsForDependencies(
        pool,
        dependencies,
        projectId,
        fragments,
        geogs
      );

    for (const tableOfContentsItemId of tableOfContentsItemIds) {
      relatedTableOfContentsItemIds.add(tableOfContentsItemId);
    }
    for (const metric of metrics) {
      cardDependencyList.metrics.push(metric.id);
      // Note that some performance optimization is possible here in order to
      // skip runing the getOrCreateSpatialMetric function if the metric already
      // exists. TODO for later.
      if (!results.metrics.find((m) => m.id === metric.id)) {
        results.metrics.push(metric);
      }
    }

    results.cardDependencyLists.push(cardDependencyList);
  }

  const overlaySources = await getOverlaySourcesForDependencies(
    pool,
    Array.from(relatedTableOfContentsItemIds),
    projectId
  );

  for (const tableOfContentsItemIdString in overlaySources) {
    const tableOfContentsItemId = Number(tableOfContentsItemIdString);
    results.overlaySources.push({
      tableOfContentsItemId: tableOfContentsItemId,
      geostats: overlaySources[tableOfContentsItemIdString].geostats,
      mapboxGlStyles:
        overlaySources[tableOfContentsItemIdString].mapboxGlStyles,
      sourceProcessingJobId:
        overlaySources[tableOfContentsItemIdString].sourceProcessingJobId,
      outputId: overlaySources[tableOfContentsItemIdString].outputId,
      sourceUrl: overlaySources[tableOfContentsItemIdString].sourceUrl,
    });
  }

  // add all metrics to the results
  return results;
}

async function getOrCreateSpatialMetric({
  pool,
  subjectFragmentId,
  subjectGeographyId,
  type,
  overlaySourceUrl,
  parameters,
  sourceProcessingJobDependency,
  projectId,
  dependencyHash,
}: {
  pool: Pool;
  subjectFragmentId?: string;
  subjectGeographyId?: number;
  type: string;
  overlaySourceUrl?: string;
  parameters: any;
  sourceProcessingJobDependency?: string;
  projectId: number;
  dependencyHash: string;
}): Promise<any> {
  if (!subjectFragmentId && !subjectGeographyId) {
    throw new Error(
      "Either subjectFragmentId or subjectGeographyId must be provided"
    );
  }
  if (type === "distance_to_shore" && !overlaySourceUrl) {
    overlaySourceUrl = "https://uploads.seasketch.org/land-big-2.fgb";
  }
  if (
    type !== "total_area" &&
    !overlaySourceUrl &&
    !sourceProcessingJobDependency
  ) {
    throw new Error(
      "overlaySourceUrl or sourceProcessingJobDependency must be provided for non-total_area metrics"
    );
  }
  const result = await pool.query(
    `
    select get_or_create_spatial_metric($1::text, $2::int, $3::spatial_metric_type, $4::text, $5::jsonb, $6::text, $7::int, $8::text) as metric
  `,
    [
      subjectFragmentId || null,
      subjectGeographyId || null,
      type,
      overlaySourceUrl || null,
      parameters,
      sourceProcessingJobDependency || null,
      projectId,
      dependencyHash,
    ]
  );
  return result.rows[0].metric;
}

async function getOrCreateSpatialMetricsBatch(
  pool: Pool,
  inputs: Array<{
    subjectFragmentId?: string;
    subjectGeographyId?: number;
    type: string;
    overlaySourceUrl?: string;
    parameters: any;
    sourceProcessingJobDependency?: string;
    projectId: number;
    dependencyHash: string;
  }>
): Promise<any[]> {
  const subjectFragmentIds: (string | null)[] = [];
  const subjectGeographyIds: (number | null)[] = [];
  const types: string[] = [];
  const overlaySourceUrls: (string | null)[] = [];
  const parameters: any[] = [];
  const sourceProcessingJobDependencies: (string | null)[] = [];
  const projectIds: number[] = [];
  const dependencyHashes: string[] = [];

  for (const input of inputs) {
    if (!input.subjectFragmentId && !input.subjectGeographyId) {
      throw new Error(
        "Either subjectFragmentId or subjectGeographyId must be provided"
      );
    }
    let overlaySourceUrl = input.overlaySourceUrl;
    if (input.type === "distance_to_shore" && !overlaySourceUrl) {
      overlaySourceUrl = "https://uploads.seasketch.org/land-big-2.fgb";
    }
    if (
      input.type !== "total_area" &&
      !overlaySourceUrl &&
      !input.sourceProcessingJobDependency
    ) {
      throw new Error(
        "overlaySourceUrl or sourceProcessingJobDependency must be provided for non-total_area metrics"
      );
    }

    subjectFragmentIds.push(input.subjectFragmentId || null);
    subjectGeographyIds.push(input.subjectGeographyId || null);
    types.push(input.type);
    overlaySourceUrls.push(overlaySourceUrl || null);
    parameters.push(input.parameters || {});
    sourceProcessingJobDependencies.push(
      input.sourceProcessingJobDependency || null
    );
    projectIds.push(input.projectId);
    dependencyHashes.push(input.dependencyHash);
  }

  const result = await pool.query(
    `
      select
        get_or_create_spatial_metric(
          t.subject_fragment_id::text,
          t.subject_geography_id::int,
          t.type::spatial_metric_type,
          t.overlay_source_url::text,
          t.parameters::jsonb,
          t.source_processing_job_dependency::text,
          t.project_id::int,
          t.dependency_hash::text
        ) as metric
      from unnest(
        $1::text[],
        $2::int[],
        $3::text[],
        $4::text[],
        $5::jsonb[],
        $6::text[],
        $7::int[],
        $8::text[]
      ) as t(
        subject_fragment_id,
        subject_geography_id,
        type,
        overlay_source_url,
        parameters,
        source_processing_job_dependency,
        project_id,
        dependency_hash
      )
    `,
    [
      subjectFragmentIds,
      subjectGeographyIds,
      types,
      overlaySourceUrls,
      parameters,
      sourceProcessingJobDependencies,
      projectIds,
      dependencyHashes,
    ]
  );

  return result.rows.map((row: { metric: any }) => row.metric);
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
    return;
  }

  return await getOrCreateReportDependencies(
    reportId,
    pool,
    sketchClass.project_id,
    sketchId
  );
}

export default ReportsPlugin;

export function extractMetricDependenciesFromReportBody(
  node: ProsemirrorNode,
  dependencies: MetricDependency[] = []
) {
  if (typeof node !== "object" || node === null || !node.type) {
    throw new Error("Invalid node");
  }
  if (
    (node.type === "metric" || node.type === "blockMetric") &&
    node.attrs?.metrics
  ) {
    const metrics = node.attrs.metrics;
    if (!Array.isArray(metrics)) {
      throw new Error("Invalid metrics");
    }
    if (metrics.length > 0) {
      if (typeof metrics[0] !== "object") {
        throw new Error("Invalid metric");
      }
      dependencies.push(...metrics);
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      extractMetricDependenciesFromReportBody(child, dependencies);
    }
  }
  return dependencies;
}

type ProsemirrorNode = {
  type: string;
  attrs?: Record<string, any>;
  content?: ProsemirrorNode[];
};

async function getOverlaySourcesForDependencies(
  pool: Pool,
  tableOfContentsItemIds: number[],
  projectId: number
): Promise<{
  [tableOfContentsItemId: number]: {
    sourceUrl?: string;
    sourceProcessingJobId?: string;
    tableOfContentsItemId: number;
    geostats: any;
    mapboxGlStyles: any;
    outputId?: number;
  };
}> {
  const results: {
    [tableOfContentsItemId: number]: {
      sourceUrl?: string;
      sourceProcessingJobId?: string;
      tableOfContentsItemId: number;
      geostats: any;
      mapboxGlStyles: any;
      outputId?: number;
    };
  } = {};
  if (tableOfContentsItemIds.length > 0) {
    const { rows: overlaySourceRows } = await pool.query<{
      table_of_contents_item_id: number;
      source_url: string;
      source_processing_job_id: string;
      geostats: any;
      mapbox_gl_styles: any;
      output_id?: number;
    }>(
      `
      select
        items.id as table_of_contents_item_id,
        outputs.url as source_url,
        jobs.job_key as source_processing_job_id,
        sources.geostats as geostats,
        layers.mapbox_gl_styles as mapbox_gl_styles,
        outputs.id as output_id
      from
        table_of_contents_items items
        join data_layers layers on layers.id = items.data_layer_id
        join data_sources sources on sources.id = layers.data_source_id
        join lateral (
          select url, id
          from data_upload_outputs o
          where o.data_source_id = sources.id
            and is_reporting_type(o.type)
          order by o.created_at desc
          limit 1
        ) outputs on true
        left join source_processing_jobs jobs on jobs.data_source_id = sources.id
      where
        items.id = ANY($1::int[])
      `,
      [tableOfContentsItemIds]
    );
    for (const row of overlaySourceRows) {
      stripUnnecessaryGeostatsFields(row.geostats);
      results[row.table_of_contents_item_id] = {
        sourceUrl: row.source_url,
        sourceProcessingJobId: row.source_processing_job_id,
        tableOfContentsItemId: row.table_of_contents_item_id,
        geostats: row.geostats,
        mapboxGlStyles: row.mapbox_gl_styles,
        outputId: row.output_id,
      };
    }
    // if any of the source processing job ids are null, call preprocess_source for the source
    for (const tableOfContentsItemId of tableOfContentsItemIds) {
      const sourceProcessingJobId =
        results[tableOfContentsItemId]?.sourceProcessingJobId;
      if (
        !sourceProcessingJobId &&
        !results[tableOfContentsItemId]?.sourceUrl
      ) {
        await pool.query(
          `select preprocess_source((select slug from projects where id = $1), (select data_source_id from data_layers where id = (select data_layer_id from table_of_contents_items where id = $2))) as table_of_contents_item_id`,
          [projectId, tableOfContentsItemId]
        );
        // const rows = await pool.query<{ job_key: string }>(
        //   `select job_key from source_processing_jobs where data_source_id = (select data_source_id from data_layers where id = (select data_layer_id from table_of_contents_items where id = $1))`,
        //   [tableOfContentsItemId]
        // );
        const { rows } = await pool.query<{
          table_of_contents_item_id: number;
          source_url: string;
          source_processing_job_id: string;
          geostats: any;
          mapbox_gl_styles: any;
          output_id?: number;
        }>(
          `
          select
            items.id as table_of_contents_item_id,
            jobs.job_key as source_processing_job_id,
            sources.geostats as geostats,
            layers.mapbox_gl_styles as mapbox_gl_styles
          from
            table_of_contents_items items
            join data_layers layers on layers.id = items.data_layer_id
            join data_sources sources on sources.id = layers.data_source_id
            left join source_processing_jobs jobs on jobs.data_source_id = sources.id
          where
            items.id = $1
          `,
          [tableOfContentsItemId]
        );

        if (rows.length > 0) {
          results[tableOfContentsItemId] = {
            tableOfContentsItemId: tableOfContentsItemId,
            geostats: rows[0].geostats,
            mapboxGlStyles: rows[0].mapbox_gl_styles,
            sourceProcessingJobId: rows[0].source_processing_job_id,
          };
        } else {
          throw new Error(
            `Source processing job not found for table of contents item: ${tableOfContentsItemId}`
          );
        }
      }
    }
  }
  return results;
}

async function createMetricsForDependencies(
  pool: Pool,
  dependencies: MetricDependency[],
  projectId: number,
  fragments: string[],
  geogs: { id: number }[]
) {
  const metrics: any[] = [];
  const hashes: string[] = [];
  const batchInputs: Array<{
    subjectFragmentId?: string;
    subjectGeographyId?: number;
    type: string;
    overlaySourceUrl?: string;
    parameters: any;
    sourceProcessingJobDependency?: string;
    projectId: number;
    dependencyHash: string;
  }> = [];

  const overlaySources = await getOverlaySourcesForDependencies(
    pool,
    Array.from(
      new Set(
        dependencies
          .filter((d) => d.tableOfContentsItemId)
          .map((d) => d.tableOfContentsItemId!)
      )
    ),
    projectId
  );
  const tableOfContentsItemIds = Object.keys(overlaySources).map(Number);

  for (const dependency of dependencies) {
    const dependencyHash = hashMetricDependency(dependency);
    if (hashes.includes(dependencyHash)) {
      continue;
    }
    hashes.push(dependencyHash);

    if (dependency.subjectType === "fragments") {
      for (const fragment of fragments) {
        batchInputs.push({
          subjectFragmentId: fragment,
          type: dependency.type,
          parameters: dependency.parameters || {},
          projectId,
          dependencyHash,
          overlaySourceUrl: dependency.tableOfContentsItemId
            ? overlaySources[dependency.tableOfContentsItemId]?.sourceUrl
            : undefined,
          sourceProcessingJobDependency: dependency.tableOfContentsItemId
            ? overlaySources[dependency.tableOfContentsItemId]
                ?.sourceProcessingJobId
            : undefined,
        });
      }
    } else if (dependency.subjectType === "geographies") {
      // Calculate metrics for all geographies in the project.
      for (const geography of geogs) {
        batchInputs.push({
          subjectGeographyId: geography.id,
          type: dependency.type,
          parameters: dependency.parameters || {},
          projectId,
          dependencyHash,
          overlaySourceUrl: dependency.tableOfContentsItemId
            ? overlaySources[dependency.tableOfContentsItemId]?.sourceUrl
            : undefined,
          sourceProcessingJobDependency: dependency.tableOfContentsItemId
            ? overlaySources[dependency.tableOfContentsItemId]
                ?.sourceProcessingJobId
            : undefined,
        });
      }
    } else {
      throw new Error(`Unknown subject type: ${dependency.subjectType}`);
    }
  }
  if (batchInputs.length > 0) {
    const batchMetrics = await getOrCreateSpatialMetricsBatch(pool, batchInputs);
    metrics.push(...batchMetrics);
  }
  return { tableOfContentsItemIds, metrics, hashes };
}

function stripUnnecessaryGeostatsFields(geostats: any) {
  if (geostats && 'layers' in geostats && Array.isArray(geostats.layers)) {
    const layer = geostats.layers[0];
    if (layer && 'attributes' in layer && Array.isArray(layer.attributes)) {
      for (const attribute of layer.attributes) {
        if (attribute && 'stats' in attribute) {
          delete attribute.stats.equalInterval;
          delete attribute.stats.naturalBreaks;
          delete attribute.stats.quantiles;
          delete attribute.stats.geometricInterval;
          delete attribute.stats.standardDeviations;
        }
      }
    } else {
      console.log('layer is not an array');
    }
  } else {
    console.log('geostats is not an object or layers is not an array');
  }
}