import {
  GeostatsLayer,
  isRasterInfo,
  RasterInfo,
} from "@seasketch/geostats-types";
import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";
import { AnyLayer } from "mapbox-gl";
import { hashMetricDependency, MetricDependency } from "overlay-engine";
import { Pool, PoolClient } from "pg";
import { extractMetricDependenciesFromReportBody } from "overlay-engine";

type ReportOverlaySourcePartial = {
  tableOfContentsItemId: number;
  stableId: string;
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

      type ReportOverlaySource {
        tableOfContentsItemId: Int!
        stableId: String!
        tableOfContentsItem: TableOfContentsItem!
        geostats: JSON!
        mapboxGlStyles: JSON!
        sourceProcessingJob: SourceProcessingJob
        sourceProcessingJobId: String
        outputId: Int!
        output: DataUploadOutput
        sourceUrl: String
      }

      input NodeDependency {
        # e.g. "total_area", "presence", "presence_table", "column_values", "raster_stats", "distance_to_shore"
        type: String!
        # "fragments" or "geographies"
        subjectType: String!
        stableId: String
        geographies: [Int!]
        parameters: JSON
        hash: String!
      }

      type CardDependencyLists {
        cardId: Int!
        metrics: [BigInt!]!
        # References the stable id of the related layer (table of contents item)
        overlaySources: [String!]!
      }

      type ReportOverlayDependencies {
        ready: Boolean!
        overlaySources: [ReportOverlaySource!]!
        metrics: [CompatibleSpatialMetric!]!
        cardDependencyLists: [CardDependencyLists!]!
      }

      extend type Report {
        dependencies(sketchId: Int): ReportOverlayDependencies!
          @requires(columns: ["id", "project_id", "sketch_class_id"])
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
        draftReportDependencies(
          input: DraftDependenciesInput
        ): DraftReportDependenciesResults!
      }

      extend type Project {
        reportingLayers: [ReportOverlaySource!]! @requires(columns: ["id"])
      }

      extend type RelatedReportCard {
        sketchClass: SketchClass! @requires(columns: ["sketch_class_id"])
      }
    `,
    resolvers: {
      RelatedReportCard: {
        async sketchClass(
          relatedReportCard,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`sketch_classes`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(
                  relatedReportCard.sketchClassId
                )}`
              );
            }
          );
          return rows[0];
        },
      },
      Project: {
        async reportingLayers(project, args, context, resolveInfo) {
          const { pgClient } = context;
          const result = await context.pgClient.query(
            `
            select
              items.id as table_of_contents_item_id,
              items.stable_id as stable_id,
              s.geostats as geostats,
              l.mapbox_gl_styles as mapbox_gl_styles,
              o.id as output_id,
              o.url as source_url,
              jobs.job_key as source_processing_job_id
            from
              data_sources s
            inner join data_layers l on l.data_source_id = s.id
            inner join table_of_contents_items items on items.data_layer_id = l.id
            inner join source_processing_jobs jobs on jobs.data_source_id = s.id
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
            stableId: row.stable_id,
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
        async dependencies(report, args, context) {
          return getOrCreateReportDependencies(
            report.id,
            context.pgClient,
            report.projectId,
            args.sketchId
          );
        },
      },
      ReportOverlaySource: {
        async tableOfContentsItem(
          reportOverlaySource,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
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

          const { metrics, overlaySources } =
            await createMetricsForDependencies(
              pgClient,
              args.input.nodeDependencies,
              true,
              projectId,
              fragments,
              geogs
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
  pool: Pool | PoolClient,
  projectId: number,
  sketchId?: number
) {
  const isDraft = await isDraftReport(reportId, projectId, pool);
  // Retrieve all overlay sources related to the report
  // const overlaySources = await getOverlaySources(reportId, pool);

  const results = {
    overlaySources: [] as ReportOverlaySourcePartial[],
    ready: true,
    metrics: [] as any[],
    cardDependencyLists: [] as {
      cardId: number;
      metrics: number[];
      overlaySources: string[];
    }[],
  };

  // Retrieve all fragments related to the sketch (if any)
  const fragments = sketchId
    ? await getFragmentHashesForSketch(sketchId, pool)
    : [];

  // Retrieve all geographies related to the project
  const { rows: geogs } = await pool.query(
    `select name, id from project_geography where project_id = $1`,
    [projectId]
  );
  if (geogs.length === 0) {
    throw new Error("No geographies found");
  }

  const allOverlaySources = {} as {
    [stableId: string]: ReportOverlaySourcePartial;
  };

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
      overlaySources: [] as string[],
    };
    const dependencies = extractMetricDependenciesFromReportBody(card.body);

    const { metrics, overlaySources } = await createMetricsForDependencies(
      pool,
      dependencies,
      isDraft,
      projectId,
      fragments,
      geogs
    );

    const cardOverlaySources = new Set<string>();
    for (const dep of dependencies) {
      if (dep.stableId) {
        cardOverlaySources.add(dep.stableId);
      }
    }
    cardDependencyList.overlaySources = Array.from(cardOverlaySources);

    for (const metric of metrics) {
      cardDependencyList.metrics.push(metric.id);
      if (!results.metrics.find((m) => m.id === metric.id)) {
        results.metrics.push(metric);
      }
    }

    results.cardDependencyLists.push(cardDependencyList);
    for (const stableId in overlaySources) {
      allOverlaySources[stableId] = overlaySources[stableId];
    }
  }

  results.overlaySources = Object.values(allOverlaySources);

  // add all metrics to the results
  return results;
}

async function getOrCreateSpatialMetricsBatch(
  pool: Pool | PoolClient,
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
      if (input.sourceProcessingJobDependency) {
        // likely the preprocessed report output just isn't finished yet.
        // don't return anything for this one
        continue;
      } else {
        continue;
        // throw new Error(
        //   "overlaySourceUrl or sourceProcessingJobDependency must be provided for non-total_area metrics"
        // );
      }
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
 * user to open the report. To avoid permission issues, and to keep work off the
 * main thread, this is designed to be run by the
 * tasks/startMetricCalculationsForSketch.ts graphile-worker task.
 */
export async function startMetricCalculationsForSketch(
  pool: Pool | PoolClient,
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

/**
 * Get overlay sources for a list of stable ids. Depending on the isDraft flag,
 * this will return overlay sources from the draft or published layer list.
 *
 * The return type, ReportOverlaySourcePartial, can be fed into the graphql
 * resolver to produce full ReportOverlaySource objects.
 *
 * @param pool
 * @param stableIds
 * @param isDraft
 * @returns A map of stable ids to overlay source objectss
 */
async function getOverlaySourcesByStableIds(
  pool: Pool | PoolClient,
  stableIds: string[],
  isDraft: boolean
): Promise<{
  [stableId: string]: ReportOverlaySourcePartial;
}> {
  const results: {
    [stableId: string]: ReportOverlaySourcePartial;
  } = {};
  if (stableIds.length > 0) {
    const { rows: overlaySourceRows } =
      await pool.query<ReportOverlaySourcePartial>(
        `
      select
        items.id as "tableOfContentsItemId",
        items.stable_id as "stableId",
        reporting_output.url as "sourceUrl",
        coalesce(reporting_output.source_processing_job_key, jobs.job_key) as "sourceProcessingJobId",
        reporting_output.id as "outputId",
        sources.geostats as "geostats",
        layers.mapbox_gl_styles as "mapboxGlStyles"
      from
        table_of_contents_items items
        join data_layers layers on layers.id = items.data_layer_id
        join data_sources sources on sources.id = layers.data_source_id
        left join lateral table_of_contents_items_reporting_output(items.*) as reporting_output on true
        left join source_processing_jobs jobs on jobs.data_source_id = sources.id
      where
        items.stable_id = ANY($1::text[]) and items.is_draft = $2
      `,
        [stableIds, isDraft]
      );
    for (const row of overlaySourceRows) {
      stripUnnecessaryGeostatsFields(row.geostats);
      results[row.stableId] = row;
    }
    for (const row of overlaySourceRows) {
      if (!row.sourceProcessingJobId) {
        console.log("no source processing job id for", row.stableId);
      }
    }
  }
  return results;
}

async function createMetricsForDependencies(
  pool: Pool | PoolClient,
  dependencies: MetricDependency[],
  isDraft: boolean,
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

  const overlaySourceStableIds = Array.from(
    new Set(dependencies.filter((d) => d.stableId).map((d) => d.stableId!))
  );

  const overlaySources = await getOverlaySourcesByStableIds(
    pool,
    overlaySourceStableIds,
    isDraft
  );

  const overlaySourceUrls = {} as { [stableId: string]: string };
  for (const stableId in overlaySources) {
    if (overlaySources[stableId]?.sourceUrl) {
      overlaySourceUrls[stableId] = overlaySources[stableId].sourceUrl;
    }
  }

  for (const dependency of dependencies) {
    const dependencyHash = hashMetricDependency(dependency, overlaySourceUrls);
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
          overlaySourceUrl: dependency.stableId
            ? overlaySources[dependency.stableId]?.sourceUrl
            : undefined,
          sourceProcessingJobDependency: dependency.stableId
            ? overlaySources[dependency.stableId]?.sourceProcessingJobId
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
          overlaySourceUrl: dependency.stableId
            ? overlaySources[dependency.stableId]?.sourceUrl
            : undefined,
          sourceProcessingJobDependency: dependency.stableId
            ? overlaySources[dependency.stableId]?.sourceProcessingJobId
            : undefined,
        });
      }
    } else {
      throw new Error(`Unknown subject type: ${dependency.subjectType}`);
    }
  }
  if (batchInputs.length > 0) {
    const batchMetrics = await getOrCreateSpatialMetricsBatch(
      pool,
      batchInputs
    );
    metrics.push(...batchMetrics);
  }
  return { metrics, hashes, overlaySources };
}

function stripUnnecessaryGeostatsFields(geostats: any) {
  if (geostats && "layers" in geostats && Array.isArray(geostats.layers)) {
    const layer = geostats.layers[0];
    if (layer && "attributes" in layer && Array.isArray(layer.attributes)) {
      for (const attribute of layer.attributes) {
        if (attribute && "stats" in attribute) {
          delete attribute.stats.equalInterval;
          delete attribute.stats.naturalBreaks;
          delete attribute.stats.quantiles;
          delete attribute.stats.geometricInterval;
          delete attribute.stats.standardDeviations;
        }
      }
    } else {
      console.log("layer is not an array");
    }
  } else if (isRasterInfo(geostats)) {
    for (const band of geostats.bands) {
      if (band.stats) {
        if (band.stats.equalInterval) {
          band.stats.equalInterval = undefined as any;
        }
        if (band.stats.naturalBreaks) {
          band.stats.naturalBreaks = undefined as any;
        }
        if (band.stats.quantiles) {
          band.stats.quantiles = undefined as any;
        }
        if (band.stats.geometricInterval) {
          band.stats.geometricInterval = undefined as any;
        }
        if (band.stats.standardDeviations) {
          band.stats.standardDeviations = undefined as any;
        }
      }
    }
  } else {
    console.warn("geostats is not an object or layers is not an array");
    console.log("found instead", geostats);
  }
}

async function getFragmentHashesForSketch(
  sketchId: number,
  pool: Pool | PoolClient
): Promise<string[]> {
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
  return fragments;
}

async function isDraftReport(
  reportId: number,
  projectId: number,
  pool: Pool | PoolClient
) {
  const { rows: reportRows } = await pool.query(
    `
      SELECT EXISTS(
        SELECT 1 FROM sketch_classes 
        WHERE draft_report_id = $1
        and project_id = $2
      ) as is_draft
    `,
    [reportId, projectId]
  );
  return reportRows[0].is_draft;
}
