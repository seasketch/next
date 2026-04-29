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
import type {
  DirectiveNode,
  GraphQLResolveInfo,
  SelectionSetNode,
  ValueNode,
} from "graphql";
import { ensureSketchFragments } from "../sketches";
import { groupByFromStyle } from "gl-style-builder";
import {
  isReportDepsProfileEnabled,
  reportDepsProfileLog,
  reportDepsProfileNowNs,
} from "../reportDepsProfiling";

/**
 * Confirms the session may load report dependency metrics: sketch viewers via
 * session_can_access_sketch, or project participants via session_has_project_access when no sketch is given.
 */
async function assertSessionCanLoadReportDependencies(
  pgClient: Pool | PoolClient,
  projectId: number,
  sketchId: number | null | undefined,
): Promise<void> {
  const { rows } = await pgClient.query<{ ok: boolean }>(
    `
      select case
        when $2::integer is null then session_has_project_access($1::integer)
        else session_can_access_sketch($2::integer)
      end as ok
    `,
    [projectId, sketchId],
  );
  if (!rows[0]?.ok) {
    throw new Error(
      sketchId != null
        ? "You do not have access to this sketch's report dependencies."
        : "You do not have access to this project's report dependencies.",
    );
  }
}

/**
 * Bulk metric JSON is implemented in PostgreSQL as `public.resolve_spatial_metrics_batch`
 * (see packages/api/migrations — graphile-migrate `current.sql` until committed).
 * Reads cached metrics first, inserts missing rows with ON CONFLICT DO NOTHING, then queues
 * calculateSpatialMetric jobs explicitly for newly inserted queued metrics.
 */

type ReportOverlaySourcePartial = {
  tableOfContentsItemId: number;
  stableId: string;
  sourceProcessingJobId?: string;
  outputId?: number;
  sourceUrl?: string;
  containsOverlappingFeatures?: boolean;
  mapboxGlStyles?: AnyLayer[];
  columnDetails?: Record<
    string,
    {
      type: string;
      countDistinct: number;
    }
  >;
  featureCount?: number;
  rasterBandCount?: number;
  vectorGeometryType?: string;
  styleGroupByColumn?: string;
  bestCategoryColumn?: string;
  bestContinuousColumn?: string;
  bestLabelColumn?: string;
  anyColumn?: string;
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
        sourceHasOverlappingFeatures: Boolean
        vrm: String
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
        sourceProcessingJob: SourceProcessingJob!
        sourceProcessingJobId: String!
        outputId: Int!
        output: DataUploadOutput
        sourceUrl: String
        # Whether the source contains overlapping features. This is used to
        # determine if the source should be processed with the overlapping
        # features flag set. Only applicable to polygon sources.
        containsOverlappingFeatures: Boolean
        """
        Number of bands in the source if raster. Otherwise null.
        """
        rasterBandCount: Int
        """
        GeoJSON geometry type, if the source is a vector layer.
        """
        vectorGeometryType: String
        """
        If a column is used for a categorical map presentation, this is the
        column name. Useful for report widgets that support "groupBy" options,
        in which case this column should be pre-selected.
        """
        styleGroupByColumn: String
        """
        The best column to use for report widgets that display a categorical
        breakdown of the data. If AI Data Analyst Notes are available, they
        will inform the choice. Otherwise a string column with low cardinality
        will be picked first, followed by low cardinality numeric columns.
        """
        bestCategoryColumn: String
        """
        The best column to use for numerical report widgets. If AI Data Analyst
        Notes are available, they will inform the choice. Otherwise a numeric
        column with high variance will be picked first, followed by any numeric
        column. Could be null if no numeric columns are available.
        """
        bestContinuousColumn: String
        """
        When determining what column to use for an inline metric or block
        widget, it may be that no categorical or continuous column is available.
        In that case, we need at least one column to use for the metric. It's
        possible the vector layer has no columns, in which case it probably
        shouldn't even appear in any lists for reporting.
        """
        anyColumn: String
        """
        The best column to use for label rendering. If AI Data Analyst Notes are
        available, they will inform the choice. Otherwise a string column with
        high cardinality will be picked.
        """
        bestLabelColumn: String
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
        metrics: [CompatibleSpatialMetric!]!
        cardDependencyLists: [CardDependencyLists!]!
      }

      extend type Report {
        dependencies(sketchId: Int): ReportOverlayDependencies!
          @requires(columns: ["id", "project_id", "sketch_class_id"])
        overlaySources: [ReportOverlaySource!]!
          @requires(columns: ["id", "project_id"])
      }

      input DraftDependenciesInput {
        nodeDependencies: [NodeDependency!]!
        sketchId: Int
      }

      type DraftReportDependenciesResults {
        ready: Boolean!
        sketchId: Int!
        metrics: [CompatibleSpatialMetric!]!
      }

      type DraftReportOverlaySourcesResults {
        ready: Boolean!
        sketchId: Int!
        overlaySources: [ReportOverlaySource!]!
      }

      extend type Query {
        draftReportDependencies(
          input: DraftDependenciesInput
        ): DraftReportDependenciesResults!
        draftReportOverlaySources(
          input: DraftDependenciesInput
        ): DraftReportOverlaySourcesResults!
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
          { graphile: { selectGraphQLResultFromTable } },
        ) {
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`sketch_classes`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(
                  relatedReportCard.sketchClassId,
                )}`,
              );
            },
          );
          return rows[0];
        },
      },
      Project: {
        async reportingLayers(project, args, context, resolveInfo) {
          const { pgClient } = context;
          const wantGeostats = resolveInfoRequestsTopLevelField(
            resolveInfo,
            "geostats",
          );
          const wantStyleGroupByColumn = resolveInfoRequestsTopLevelField(
            resolveInfo,
            "styleGroupByColumn",
          );
          const wantMapboxGlStyles = resolveInfoRequestsTopLevelField(
            resolveInfo,
            "mapboxGlStyles",
          );

          const result = await pgClient.query(
            `
            select
              items.id as table_of_contents_item_id,
              items.stable_id as stable_id,
              ${wantGeostats ? "s.geostats as geostats," : ""}
              l.mapbox_gl_styles as mapbox_gl_styles,
              o.id as output_id,
              o.url as source_url,
              jobs.job_key as source_processing_job_id,
              o.contains_overlapping_features as contains_overlapping_features,
              s.column_details,
              s.raster_band_count,
              s.vector_geometry_type,
              s.feature_count,
              ai.best_label_column as ai_best_label_column,
              ai.best_category_column as ai_best_category_column,
              ai.best_numeric_column as ai_best_numeric_column
            from
              data_sources s
            inner join data_layers l on l.data_source_id = s.id
            inner join table_of_contents_items items on items.data_layer_id = l.id
            inner join source_processing_jobs jobs on jobs.data_source_id = s.id
            left join ai_data_analyst_notes ai on ai.data_source_id = s.id
            left join lateral (
              select
                o.id,
                o.url,
                o.contains_overlapping_features
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
                -- This part of the query seems more complex than it needs to be
                -- That's because project toc items and data layers can refer to
                -- data sources that belong to the superuser project if they are
                -- based on a data library template.
                select data_source_id from source_processing_jobs where data_source_id in (
                  select data_source_id from data_layers where project_id = $1
                )
              ) and l.project_id = $1
          `,
            [project.id],
          );
          if (wantGeostats) {
            for (const row of result.rows) {
              stripUnnecessaryGeostatsFields(row.geostats, false);
            }
          }
          return result.rows.map((row: any) => {
            return {
              __typename: "ReportOverlaySource",
              stableId: row.stable_id,
              tableOfContentsItemId: row.table_of_contents_item_id,
              sourceProcessingJobId: row.source_processing_job_id,
              outputId: row.output_id,
              sourceUrl: row.source_url,
              containsOverlappingFeatures: row.contains_overlapping_features,
              rasterBandCount: row.raster_band_count,
              vectorGeometryType: row.vector_geometry_type,
              bestCategoryColumn:
                row.ai_best_category_column ||
                pickBestCategoryColumn(row.column_details, row.feature_count),
              bestContinuousColumn:
                row.ai_best_numeric_column ||
                pickBestContinuousColumn(row.column_details, row.feature_count),
              bestLabelColumn:
                row.ai_best_label_column ||
                pickBestLabelColumn(row.column_details, row.feature_count),
              anyColumn: Object.keys(row.column_details || {})[0],
              ...(wantGeostats ? { geostats: row.geostats } : {}),
              ...(wantMapboxGlStyles
                ? { mapboxGlStyles: row.mapbox_gl_styles }
                : {}),
              ...(wantStyleGroupByColumn
                ? {
                    styleGroupByColumn: groupByFromStyle(
                      row.mapbox_gl_styles,
                      row.vector_geometry_type,
                      new Set(Object.keys(row.column_details || {})),
                    ),
                  }
                : {}),
            };
          });
        },
      },
      Report: {
        async dependencies(
          report,
          args,
          context: { pgClient: PoolClient; adminPool?: Pool },
        ) {
          const profileCtx = {
            reportId: report.id,
            sketchId: args.sketchId ?? "none",
            projectId: report.projectId,
          };
          const nsResolverFull = reportDepsProfileNowNs();
          let ns = reportDepsProfileNowNs();
          await assertSessionCanLoadReportDependencies(
            context.pgClient,
            report.projectId,
            args.sketchId ?? null,
          );
          reportDepsProfileLog(
            "Report.dependencies",
            "assertSessionCanLoadReportDependencies",
            ns,
            profileCtx,
          );
          const metricsPool = context.adminPool ?? context.pgClient;
          ns = reportDepsProfileNowNs();
          const out = await getOrCreateReportDependencies(
            report.id,
            context.pgClient,
            report.projectId,
            args.sketchId,
            { metricsPool },
          );
          reportDepsProfileLog(
            "Report.dependencies",
            "getOrCreateReportDependencies_total",
            ns,
            profileCtx,
          );
          reportDepsProfileLog(
            "Report.dependencies",
            "dependencies_resolver_total",
            nsResolverFull,
            profileCtx,
          );
          return out;
        },
        async overlaySources(report, args, context) {
          return await getReportOverlaySources(
            report.id,
            context.pgClient,
            report.projectId,
          );
        },
      },
      ReportOverlaySource: {
        async tableOfContentsItem(
          reportOverlaySource,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } },
        ) {
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`table_of_contents_items`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(
                  reportOverlaySource.tableOfContentsItemId,
                )}`,
              );
            },
          );
          return rows[0];
        },
        async sourceProcessingJob(
          reportOverlaySource,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } },
        ) {
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`source_processing_jobs`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.job_key = ${sql.value(
                  reportOverlaySource.sourceProcessingJobId,
                )}`,
              );
            },
          );
          return rows[0];
        },
        async output(
          reportOverlaySource,
          args,
          context,
          { graphile: { selectGraphQLResultFromTable } },
        ) {
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`data_upload_outputs`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(
                  reportOverlaySource.outputId,
                )}`,
              );
            },
          );
          return rows[0];
        },
      },
      Query: {
        async draftReportDependencies(root, args, context, resolveInfo) {
          const { pgClient, adminPool } = context as {
            pgClient: PoolClient;
            adminPool?: Pool;
          };
          const pool = pgClient;
          const sketchId = args.input.sketchId;
          // First, make sure the sketch exists
          const { rows: sketchRows } = await pgClient.query(
            `select sketches.id, sketch_classes.project_id as project_id, session_is_admin(sketch_classes.project_id) as is_admin from sketches inner join sketch_classes on sketches.sketch_class_id = sketch_classes.id where sketches.id = $1`,
            [sketchId],
          );
          if (sketchRows.length === 0) {
            throw new Error("Sketch not found");
          }
          if (!sketchRows[0].is_admin) {
            throw new Error(
              "You are not authorized to access draft metrics for this sketch.",
            );
          }
          const sketch = sketchRows[0];
          const projectId = sketch.project_id;

          // Retrieve all fragments related to the sketch (if any)
          const fragments = await ensureSketchFragments(
            sketchId,
            projectId,
            pgClient,
          );

          // Retrieve all geographies related to the project
          const { rows: geogs } = await pool.query(
            `select name, id from project_geography where project_id = $1`,
            [projectId],
          );
          if (geogs.length === 0) {
            throw new Error("No geographies found");
          }

          const metricsPool = adminPool ?? pgClient;
          const { metrics } = await createMetricsForDependencies(
            pgClient,
            args.input.nodeDependencies,
            true,
            projectId,
            fragments,
            geogs,
            undefined,
            { metricsPool },
          );

          return {
            metrics,
            ready: !metrics.find((m) => m.state !== "complete"),
            sketchId,
          };
        },
        async draftReportOverlaySources(root, args, context, resolveInfo) {
          const { pgClient } = context;
          const sketchId = args.input.sketchId;
          // First, make sure the sketch exists
          const { rows: sketchRows } = await pgClient.query(
            `select sketches.id, sketch_classes.project_id as project_id, session_is_admin(sketch_classes.project_id) as is_admin from sketches inner join sketch_classes on sketches.sketch_class_id = sketch_classes.id where sketches.id = $1`,
            [sketchId],
          );
          if (sketchRows.length === 0) {
            throw new Error("Sketch not found");
          }
          if (!sketchRows[0].is_admin) {
            throw new Error(
              "You are not authorized to access draft overlay source dependencies for this sketch.",
            );
          }
          // Build overlay source list directly from nodeDependencies.
          const overlaySourcesMap = await getOverlaySourcesForDependencies(
            pgClient,
            args.input.nodeDependencies,
            true,
          );
          const overlaySources = Object.values(overlaySourcesMap);

          // Determine readiness based on related source processing jobs.
          const jobKeys = overlaySources
            .map((s) => s.sourceProcessingJobId)
            .filter((k): k is string => !!k);
          const ready = await areSourceProcessingJobsReady(pgClient, jobKeys);

          return { ready, overlaySources, sketchId };
        },
      },
    },
  };
});

async function getOrCreateReportDependencies(
  reportId: number,
  pool: Pool | PoolClient,
  projectId: number,
  sketchId?: number,
  options?: { metricsPool?: Pool | PoolClient },
) {
  const t0 = Date.now();
  const profileCtx = {
    reportId,
    sketchId: sketchId ?? "none",
  };

  let ns = reportDepsProfileNowNs();
  const isDraft = await isDraftReport(reportId, projectId, pool);
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "isDraftReport",
    ns,
    profileCtx,
    { isDraft },
  );

  const results = {
    ready: true,
    metrics: [] as any[],
    cardDependencyLists: [] as {
      cardId: number;
      metrics: number[];
      overlaySources: string[];
    }[],
  };

  // Retrieve all fragments related to the sketch (if any)
  ns = reportDepsProfileNowNs();
  const fragments = sketchId
    ? await ensureSketchFragments(sketchId, projectId, pool as PoolClient)
    : [];
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "ensureSketchFragments",
    ns,
    profileCtx,
    { fragmentCount: fragments.length },
  );

  // Retrieve all geographies related to the project
  ns = reportDepsProfileNowNs();
  const { rows: geogs } = await pool.query(
    `select name, id from project_geography where project_id = $1`,
    [projectId],
  );
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "geogsQuery",
    ns,
    profileCtx,
    { geographyCount: geogs.length },
  );
  if (geogs.length === 0) {
    throw new Error("No geographies found");
  }

  ns = reportDepsProfileNowNs();
  const cards = await pool.query(
    `
      select 
        rc.id, 
        rc.component_settings,
        rc.body
      from 
        report_cards rc
      where 
        rc.id in (select report_card_ids_for_report($1))
      group by rc.id, rc.component_settings`,
    [reportId],
  );
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "cardsQuery",
    ns,
    profileCtx,
    { cardRows: cards.rows.length },
  );

  ns = reportDepsProfileNowNs();
  const perCard = cards.rows.map((card: { id: number; body: unknown }) => ({
    cardId: card.id,
    dependencies: extractMetricDependenciesFromReportBody(
      card.body as Parameters<
        typeof extractMetricDependenciesFromReportBody
      >[0],
    ),
  }));
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "extractDepsPerCard",
    ns,
    profileCtx,
    { cards: perCard.length },
  );

  const allStableIds = new Set<string>();
  for (const pc of perCard) {
    for (const dep of pc.dependencies) {
      if (dep.stableId) {
        allStableIds.add(dep.stableId);
      }
    }
  }

  ns = reportDepsProfileNowNs();
  const overlayRefs = await getOverlaySourceRefsByStableIds(
    pool,
    Array.from(allStableIds),
    isDraft,
  );
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "getOverlaySourceRefsByStableIds",
    ns,
    profileCtx,
    { stableIdCount: allStableIds.size },
  );

  ns = reportDepsProfileNowNs();
  const overlaySourceUrls: { [stableId: string]: string } = {};
  for (const stableId in overlayRefs) {
    if (overlayRefs[stableId]?.sourceUrl) {
      overlaySourceUrls[stableId] = overlayRefs[stableId].sourceUrl!;
    }
  }
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "buildOverlaySourceUrlsMap",
    ns,
    profileCtx,
    { urlMapKeys: Object.keys(overlaySourceUrls).length },
  );

  ns = reportDepsProfileNowNs();
  const globalHashSeen = new Set<string>();
  const uniqueDepsForReport: MetricDependency[] = [];
  for (const pc of perCard) {
    for (const dep of pc.dependencies) {
      const h = hashMetricDependency(dep, overlaySourceUrls);
      if (globalHashSeen.has(h)) {
        continue;
      }
      globalHashSeen.add(h);
      uniqueDepsForReport.push(dep);
    }
  }
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "dedupeUniqueDeps",
    ns,
    profileCtx,
    {
      uniqueDependencyCount: uniqueDepsForReport.length,
      distinctHashes: globalHashSeen.size,
    },
  );

  ns = reportDepsProfileNowNs();
  const { metrics: batchMetrics } = await createMetricsForDependencies(
    pool,
    uniqueDepsForReport,
    isDraft,
    projectId,
    fragments,
    geogs,
    overlayRefs,
    { metricsPool: options?.metricsPool },
  );
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "createMetricsForDependencies_total",
    ns,
    profileCtx,
    { batchMetricRows: batchMetrics.length },
  );

  ns = reportDepsProfileNowNs();
  const metricsByHash = new Map<string, any[]>();
  const seenMetricIds = new Set<number>();
  for (const metric of batchMetrics) {
    if (!metric || metric.id == null) {
      continue;
    }
    const h = metric.dependencyHash as string;
    if (!metricsByHash.has(h)) {
      metricsByHash.set(h, []);
    }
    metricsByHash.get(h)!.push(metric);
    if (!seenMetricIds.has(metric.id)) {
      seenMetricIds.add(metric.id);
      results.metrics.push(metric);
    }
  }
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "postprocess_indexMetricsByHash",
    ns,
    profileCtx,
    {
      metricsDistinct: results.metrics.length,
      hashBuckets: metricsByHash.size,
    },
  );

  ns = reportDepsProfileNowNs();
  for (const pc of perCard) {
    const cardDependencyList = {
      cardId: pc.cardId,
      metrics: [] as number[],
      overlaySources: [] as string[],
    };

    const cardOverlaySources = new Set<string>();
    for (const dep of pc.dependencies) {
      if (dep.stableId) {
        cardOverlaySources.add(dep.stableId);
      }
    }
    cardDependencyList.overlaySources = Array.from(cardOverlaySources);

    const orderedHashesForCard: string[] = [];
    const processedHash = new Set<string>();
    for (const dep of pc.dependencies) {
      const h = hashMetricDependency(dep, overlaySourceUrls);
      if (processedHash.has(h)) {
        continue;
      }
      processedHash.add(h);
      orderedHashesForCard.push(h);
    }

    for (const h of orderedHashesForCard) {
      const forHash = metricsByHash.get(h);
      if (forHash) {
        for (const m of forHash) {
          cardDependencyList.metrics.push(m.id);
        }
      }
    }

    results.cardDependencyLists.push(cardDependencyList);
  }
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "postprocess_buildCardDependencyLists",
    ns,
    profileCtx,
    { cardLists: results.cardDependencyLists.length },
  );

  ns = reportDepsProfileNowNs();
  results.ready = !results.metrics.find((m) => m.state !== "complete");
  reportDepsProfileLog(
    "getOrCreateReportDependencies",
    "computeReady",
    ns,
    profileCtx,
    { ready: results.ready },
  );

  if (isReportDepsProfileEnabled()) {
    ns = reportDepsProfileNowNs();
    const approxBytes = Buffer.byteLength(JSON.stringify(results), "utf8");
    reportDepsProfileLog(
      "getOrCreateReportDependencies",
      "jsonSerialize_results",
      ns,
      profileCtx,
      { approxBytes },
    );
  }

  if (process.env.REPORT_DEPS_TIMING) {
    const elapsedMs = Date.now() - t0;
    const approxBytes = Buffer.byteLength(JSON.stringify(results), "utf8");
    // eslint-disable-next-line no-console
    console.log(
      `[report.dependencies] reportId=${reportId} sketchId=${sketchId ?? "none"} isDraft=${isDraft} metrics=${results.metrics.length} cards=${results.cardDependencyLists.length} approxBytes=${approxBytes} elapsedMs=${elapsedMs}`,
    );
  }
  return results;
}

async function getReportOverlaySources(
  reportId: number,
  pool: Pool | PoolClient,
  projectId: number,
): Promise<ReportOverlaySourcePartial[]> {
  const t0 = Date.now();
  const profileCtx = { reportId, sketchId: "n/a" };

  let ns = reportDepsProfileNowNs();
  const isDraft = await isDraftReport(reportId, projectId, pool);
  reportDepsProfileLog(
    "getReportOverlaySources",
    "isDraftReport",
    ns,
    profileCtx,
    { isDraft },
  );

  ns = reportDepsProfileNowNs();
  const cards = await pool.query(
    `
      select 
        rc.id, 
        rc.body
      from 
        report_cards rc
      where 
        rc.id in (select report_card_ids_for_report($1))
      group by rc.id, rc.body`,
    [reportId],
  );
  reportDepsProfileLog(
    "getReportOverlaySources",
    "cardsQuery",
    ns,
    profileCtx,
    { cardRows: cards.rows.length },
  );

  ns = reportDepsProfileNowNs();
  const allDependencies: MetricDependency[] = [];
  for (const card of cards.rows) {
    const deps = extractMetricDependenciesFromReportBody(
      card.body as Parameters<
        typeof extractMetricDependenciesFromReportBody
      >[0],
    );
    allDependencies.push(...deps);
  }
  reportDepsProfileLog(
    "getReportOverlaySources",
    "extractDepsAllCards",
    ns,
    profileCtx,
    { rawDependencyCount: allDependencies.length },
  );

  ns = reportDepsProfileNowNs();
  const overlaySourcesMap = await getOverlaySourcesForDependencies(
    pool,
    allDependencies,
    isDraft,
  );
  reportDepsProfileLog(
    "getReportOverlaySources",
    "getOverlaySourcesForDependencies",
    ns,
    profileCtx,
    { distinctStableIds: Object.keys(overlaySourcesMap).length },
  );

  const overlaySources = Object.values(overlaySourcesMap);

  if (isReportDepsProfileEnabled()) {
    ns = reportDepsProfileNowNs();
    const approxBytes = Buffer.byteLength(
      JSON.stringify(overlaySources),
      "utf8",
    );
    reportDepsProfileLog(
      "getReportOverlaySources",
      "jsonSerialize_overlaySources",
      ns,
      profileCtx,
      { overlayCount: overlaySources.length, approxBytes },
    );
  }

  if (process.env.REPORT_DEPS_TIMING) {
    const elapsedMs = Date.now() - t0;
    const approxBytes = Buffer.byteLength(
      JSON.stringify(overlaySources),
      "utf8",
    );
    // eslint-disable-next-line no-console
    console.log(
      `[report.overlaySources] reportId=${reportId} isDraft=${isDraft} overlaySources=${overlaySources.length} approxBytes=${approxBytes} elapsedMs=${elapsedMs}`,
    );
  }

  return overlaySources;
}

async function areSourceProcessingJobsReady(
  pool: Pool | PoolClient,
  jobKeys: string[],
): Promise<boolean> {
  if (jobKeys.length === 0) {
    return true;
  }
  const { rows } = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from source_processing_jobs
      where job_key = ANY($1::text[])
        and state not in ('complete', 'error')
    `,
    [jobKeys],
  );
  return (rows[0]?.count || "0") === "0";
}

/** Exported for integration tests; core resolver is `resolve_spatial_metrics_batch` in SQL. */
export async function getOrCreateSpatialMetricsBatch(
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
  }>,
): Promise<any[]> {
  const prepareNs = reportDepsProfileNowNs();
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
        "Either subjectFragmentId or subjectGeographyId must be provided",
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
        throw new Error(
          "overlaySourceUrl or sourceProcessingJobDependency must be provided for non-total_area metrics",
        );
      }
    }

    subjectFragmentIds.push(input.subjectFragmentId || null);
    subjectGeographyIds.push(input.subjectGeographyId || null);
    types.push(input.type);
    overlaySourceUrls.push(overlaySourceUrl || null);
    parameters.push(input.parameters || {});
    sourceProcessingJobDependencies.push(
      input.sourceProcessingJobDependency || null,
    );
    projectIds.push(input.projectId);
    dependencyHashes.push(input.dependencyHash);
  }

  reportDepsProfileLog(
    "getOrCreateSpatialMetricsBatch",
    "prepareUnnestArrays",
    prepareNs,
    {},
    {
      inputCount: inputs.length,
      keptRows: subjectFragmentIds.length,
    },
  );

  const queryParams = [
    subjectFragmentIds,
    subjectGeographyIds,
    types,
    overlaySourceUrls,
    parameters,
    sourceProcessingJobDependencies,
    projectIds,
    dependencyHashes,
  ];
  const sqlNs = reportDepsProfileNowNs();
  const result = await pool.query<{ ord: number; metric: unknown }>(
    `
      SELECT ord, metric
      FROM resolve_spatial_metrics_batch(
        $1::text[],
        $2::int[],
        $3::text[],
        $4::text[],
        $5::jsonb[],
        $6::text[],
        $7::int[],
        $8::text[]
      )
    `,
    queryParams,
  );

  reportDepsProfileLog(
    "getOrCreateSpatialMetricsBatch",
    "pgQuery_resolveSpatialMetricsBatch",
    sqlNs,
    {},
    {
      rowCount: result.rows.length,
      keptRows: subjectFragmentIds.length,
    },
  );

  return result.rows.map((row) => row.metric);
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
  draft?: boolean,
) {
  // get sketch_class data first
  const { rows: sketchClassRows } = await pool.query(
    `select id, report_id, draft_report_id, project_id from sketch_classes where id = (select sketch_class_id from sketches where id = $1)`,
    [sketchId],
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
    sketchId,
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
  isDraft: boolean,
  keepHistogram?: { [stableId: string]: boolean },
): Promise<{
  [stableId: string]: ReportOverlaySourcePartial;
}> {
  const results: {
    [stableId: string]: ReportOverlaySourcePartial;
  } = {};
  if (stableIds.length > 0) {
    const { rows: overlaySourceRows } = await pool.query<
      ReportOverlaySourcePartial & {
        geostats?: { layers: GeostatsLayer[] } | RasterInfo;
        mapboxGlStyles?: AnyLayer[];
        ai_best_label_column?: string;
        ai_best_category_column?: string;
        ai_best_numeric_column?: string;
      }
    >(
      `
      select
        items.id as "tableOfContentsItemId",
        items.stable_id as "stableId",
        reporting_output.url as "sourceUrl",
        coalesce(reporting_output.source_processing_job_key, jobs.job_key) as "sourceProcessingJobId",
        reporting_output.id as "outputId",
        sources.geostats as "geostats",
        layers.mapbox_gl_styles as "mapboxGlStyles",
        reporting_output.contains_overlapping_features as "containsOverlappingFeatures",
        sources.raster_band_count as "rasterBandCount",
        sources.vector_geometry_type as "vectorGeometryType",
        sources.feature_count as "featureCount",
        ai.best_label_column as "ai_best_label_column",
        ai.best_category_column as "ai_best_category_column",
        ai.best_numeric_column as "ai_best_numeric_column"
      from
        table_of_contents_items items
        join data_layers layers on layers.id = items.data_layer_id
        join data_sources sources on sources.id = layers.data_source_id
        left join lateral table_of_contents_items_reporting_output(items.*) as reporting_output on true
        left join source_processing_jobs jobs on jobs.data_source_id = sources.id
        left join ai_data_analyst_notes ai on ai.data_source_id = sources.id
      where
        items.stable_id = ANY($1::text[]) and items.is_draft = $2
      `,
      [stableIds, isDraft],
    );
    for (const row of overlaySourceRows) {
      if (row.geostats) {
        stripUnnecessaryGeostatsFields(
          row.geostats,
          keepHistogram?.[row.stableId] ? true : false,
        );
      }
      if (
        row.vectorGeometryType &&
        row.geostats &&
        !isRasterInfo(row.geostats)
      ) {
        const layer = row.geostats.layers[0] as GeostatsLayer;
        if (layer) {
          const attributes = layer.attributes as unknown as Record<
            string,
            { type: string; countDistinct: number }
          >;
          row.styleGroupByColumn = groupByFromStyle(
            row.mapboxGlStyles,
            row.vectorGeometryType,
            new Set(Object.keys(layer.attributes || {})),
          );
          row.bestCategoryColumn =
            row.ai_best_category_column ||
            pickBestCategoryColumn(attributes, row.featureCount || 0);
          row.bestContinuousColumn =
            row.ai_best_numeric_column ||
            pickBestContinuousColumn(attributes, row.featureCount || 0);
          row.bestLabelColumn =
            row.ai_best_label_column ||
            pickBestLabelColumn(attributes, row.featureCount || 0);
          row.anyColumn = Object.keys(attributes)[0];
          delete row.ai_best_label_column;
          delete row.ai_best_category_column;
          delete row.ai_best_numeric_column;
        }
      }
      results[row.stableId] = row;
    }
    for (const row of overlaySourceRows) {
      if (!row.sourceProcessingJobId) {
        throw new Error(
          `No source processing job id for overlay source: ${row.stableId}`,
        );
      }
    }
  }
  return results;
}

async function getOverlaySourceRefsByStableIds(
  pool: Pool | PoolClient,
  stableIds: string[],
  isDraft: boolean,
): Promise<{
  [stableId: string]: ReportOverlaySourcePartial;
}> {
  const results: {
    [stableId: string]: ReportOverlaySourcePartial;
  } = {};

  if (stableIds.length === 0) {
    return results;
  }

  const { rows } = await pool.query<ReportOverlaySourcePartial>(
    `
      select
        items.id as "tableOfContentsItemId",
        items.stable_id as "stableId",
        reporting_output.url as "sourceUrl",
        coalesce(reporting_output.source_processing_job_key, jobs.job_key) as "sourceProcessingJobId",
        reporting_output.id as "outputId",
        reporting_output.contains_overlapping_features as "containsOverlappingFeatures",
        sources.raster_band_count as "rasterBandCount",
        sources.vector_geometry_type as "vectorGeometryType"
      from
        table_of_contents_items items
        join data_layers layers on layers.id = items.data_layer_id
        join data_sources sources on sources.id = layers.data_source_id
        left join lateral table_of_contents_items_reporting_output(items.*) as reporting_output on true
        left join source_processing_jobs jobs on jobs.data_source_id = sources.id
      where
        items.stable_id = ANY($1::text[]) and items.is_draft = $2
    `,
    [stableIds, isDraft],
  );

  for (const row of rows) {
    results[row.stableId] = row;
  }

  for (const stableId of stableIds) {
    const row = results[stableId];
    if (row && !row.sourceProcessingJobId) {
      throw new Error(
        `No source processing job id for overlay source: ${stableId}`,
      );
    }
  }

  return results;
}

async function getOverlaySourcesForDependencies(
  pool: Pool | PoolClient,
  dependencies: MetricDependency[],
  isDraft: boolean,
): Promise<{ [stableId: string]: ReportOverlaySourcePartial }> {
  const overlaySourceStableIds = Array.from(
    new Set(dependencies.filter((d) => d.stableId).map((d) => d.stableId!)),
  );

  const keepHistogram: { [stableId: string]: boolean } = {};
  for (const dependency of dependencies) {
    if (
      dependency.stableId &&
      ["raster_stats", "column_values"].includes(dependency.type)
    ) {
      keepHistogram[dependency.stableId] = true;
    }
  }

  return await getOverlaySourcesByStableIds(
    pool,
    overlaySourceStableIds,
    isDraft,
    keepHistogram,
  );
}

async function createMetricsForDependencies(
  pool: Pool | PoolClient,
  dependencies: MetricDependency[],
  isDraft: boolean,
  projectId: number,
  fragments: string[],
  geogs: { id: number }[],
  preloadedOverlayRefs?: {
    [stableId: string]: ReportOverlaySourcePartial;
  },
  options?: { metricsPool?: Pool | PoolClient },
) {
  const cmCtx = { projectId };
  const metrics: any[] = [];
  const hashSeen = new Set<string>();
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

  let ns = reportDepsProfileNowNs();
  const overlaySources =
    preloadedOverlayRefs ??
    (await getOverlaySourceRefsByStableIds(
      pool,
      Array.from(
        new Set(dependencies.filter((d) => d.stableId).map((d) => d.stableId!)),
      ),
      isDraft,
    ));
  reportDepsProfileLog(
    "createMetricsForDependencies",
    preloadedOverlayRefs ? "overlayRefs_preloaded" : "overlayRefs_fetch",
    ns,
    cmCtx,
    {
      dependencyCount: dependencies.length,
      stableIdCount: preloadedOverlayRefs
        ? Object.keys(preloadedOverlayRefs).length
        : Array.from(
            new Set(
              dependencies.filter((d) => d.stableId).map((d) => d.stableId!),
            ),
          ).length,
    },
  );

  ns = reportDepsProfileNowNs();
  const overlaySourceUrls = {} as { [stableId: string]: string };
  for (const stableId in overlaySources) {
    if (overlaySources[stableId]?.sourceUrl) {
      overlaySourceUrls[stableId] = overlaySources[stableId].sourceUrl;
    }
  }

  for (const dependency of dependencies) {
    const dependencyHash = hashMetricDependency(dependency, overlaySourceUrls);
    if (hashSeen.has(dependencyHash)) {
      continue;
    }
    hashSeen.add(dependencyHash);

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
  reportDepsProfileLog(
    "createMetricsForDependencies",
    "buildBatchInputs",
    ns,
    cmCtx,
    {
      batchInputCount: batchInputs.length,
      distinctHashes: hashSeen.size,
      fragmentCount: fragments.length,
      geographyCount: geogs.length,
    },
  );

  if (batchInputs.length > 0) {
    ns = reportDepsProfileNowNs();
    const metricsPool = options?.metricsPool ?? pool;
    const batchMetrics = await getOrCreateSpatialMetricsBatch(
      metricsPool,
      batchInputs,
    );
    reportDepsProfileLog(
      "createMetricsForDependencies",
      "awaitSpatialMetricsBatch_total",
      ns,
      cmCtx,
      { returnedRows: batchMetrics.length },
    );
    metrics.push(...batchMetrics);
  }
  return { metrics, hashes: Array.from(hashSeen) };
}

function stripUnnecessaryGeostatsFields(geostats: any, keepHistogram: boolean) {
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
          if (!keepHistogram) {
            delete attribute.stats.histogram;
          }
        }
      }
    }
  } else if (isRasterInfo(geostats)) {
    delete geostats.metadata;
    for (const band of geostats.bands) {
      delete band.metadata;
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
        if (band.stats.categories) {
          band.stats.categories = undefined as any;
        }
      }
    }
  } else {
    console.warn("geostats is not an object or layers is not an array");
    console.log("found instead", geostats);
  }
}

async function isDraftReport(
  reportId: number,
  projectId: number,
  pool: Pool | PoolClient,
) {
  const { rows: reportRows } = await pool.query(
    `
      SELECT EXISTS(
        SELECT 1 FROM sketch_classes 
        WHERE draft_report_id = $1
        and project_id = $2
      ) as is_draft
    `,
    [reportId, projectId],
  );
  return reportRows[0].is_draft;
}

function booleanFromIfArgument(
  value: ValueNode,
  variableValues: Record<string, unknown>,
): boolean {
  if (value.kind === "BooleanValue") {
    return value.value;
  }
  if (value.kind === "Variable") {
    return variableValues[value.name.value] === true;
  }
  return false;
}

/** Respects @skip / @include on a field, spread, or fragment definition. */
function directivesAllowSelection(
  directives: readonly DirectiveNode[] | undefined,
  variableValues: Record<string, unknown>,
): boolean {
  if (!directives?.length) {
    return true;
  }
  let skip: boolean | undefined;
  let include: boolean | undefined;
  for (const d of directives) {
    if (d.name.value === "skip") {
      const arg = d.arguments?.find((a) => a.name.value === "if");
      if (arg) {
        skip = booleanFromIfArgument(arg.value, variableValues);
      }
    } else if (d.name.value === "include") {
      const arg = d.arguments?.find((a) => a.name.value === "if");
      if (arg) {
        include = booleanFromIfArgument(arg.value, variableValues);
      }
    }
  }
  if (skip === true) {
    return false;
  }
  if (include === false) {
    return false;
  }
  return true;
}

/**
 * True if the client asked for `fieldName` on each list element of this field
 * (e.g. ReportOverlaySource fields under reportingLayers). Does not recurse
 * into nested fields — only the selection set that belongs to the list item type.
 */
function selectionSetRequestsTopLevelField(
  selectionSet: SelectionSetNode | undefined | null,
  fieldName: string,
  fragments: GraphQLResolveInfo["fragments"],
  variableValues: Record<string, unknown>,
  visitedFragments: Set<string>,
): boolean {
  if (!selectionSet?.selections.length) {
    return false;
  }
  for (const sel of selectionSet.selections) {
    if (!directivesAllowSelection(sel.directives, variableValues)) {
      continue;
    }
    if (sel.kind === "Field") {
      if (sel.name.value === fieldName) {
        return true;
      }
    } else if (sel.kind === "FragmentSpread") {
      const name = sel.name.value;
      if (visitedFragments.has(name)) {
        continue;
      }
      const frag = fragments[name];
      if (!frag || !directivesAllowSelection(frag.directives, variableValues)) {
        continue;
      }
      visitedFragments.add(name);
      if (
        selectionSetRequestsTopLevelField(
          frag.selectionSet,
          fieldName,
          fragments,
          variableValues,
          visitedFragments,
        )
      ) {
        return true;
      }
    } else if (sel.kind === "InlineFragment") {
      if (
        selectionSetRequestsTopLevelField(
          sel.selectionSet,
          fieldName,
          fragments,
          variableValues,
          visitedFragments,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function resolveInfoRequestsTopLevelField(
  info: GraphQLResolveInfo,
  fieldName: string,
): boolean {
  const variableValues = info.variableValues ?? {};
  for (const node of info.fieldNodes) {
    if (
      selectionSetRequestsTopLevelField(
        node.selectionSet,
        fieldName,
        info.fragments,
        variableValues,
        new Set(),
      )
    ) {
      return true;
    }
  }
  return false;
}

// Column names that are never useful for user-facing categorisation,
// continuous measurement, or labelling.
const JUNK_COLUMN_PATTERNS = [
  /^shape[_-]?length$/i,
  /^shape[_-]?area$/i,
  /^area[_-]?km2?$/i,
  /^area$/i,
  /^length$/i,
  /^perimeter$/i,
  /^fid$/i,
  /^gid$/i,
  /^id$/i,
  /^objectid$/i,
  /^oid$/i,
  /^globalid$/i,
  /^uuid$/i,
  /_id$/i,
];

function isJunkColumn(name: string): boolean {
  return JUNK_COLUMN_PATTERNS.some((p) => p.test(name));
}

/**
 * Picks the best column to use for categorical map or report presentations.
 * Ranks columns by:
 *   * type - strings over booleans over numbers
 *   * cardinality - 2–20 distinct values is ideal; penalise all-unique (better
 *     used as a label) and very high cardinality
 *   * name - junk names (IDs, shape-area, etc.) are penalised
 */
function pickBestCategoryColumn(
  columnDetails: Record<string, { type: string; countDistinct: number }>,
  featureCount: number,
): string | undefined {
  if (!columnDetails) return undefined;

  const scored = Object.entries(columnDetails)
    .map(([name, { type, countDistinct }]) => {
      let score = 0;

      // Must have at least 2 distinct values to be useful as a category
      if (countDistinct < 2) return { name, score: -Infinity };

      // Type preference
      if (type === "string") score += 10;
      else if (type === "boolean") score += 5;
      else if (type === "number") score += 2;

      // Ideal cardinality: 2–20 distinct values
      if (countDistinct <= 20) score += 8;
      else if (countDistinct <= 50) score += 4;
      else if (countDistinct <= 100) score += 1;
      else score -= 5;

      // All-unique values are better used as labels, not categories
      if (featureCount > 0 && countDistinct === featureCount) score -= 10;

      // Penalise system/junk column names
      if (isJunkColumn(name)) score -= 20;

      return { name, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score === -Infinity) return undefined;
  return scored[0].name;
}

/**
 * Picks the best numeric column for continuous (gradient/proportional)
 * presentations. Prefers numeric columns with meaningful variance.
 */
function pickBestContinuousColumn(
  columnDetails: Record<string, { type: string; countDistinct: number }>,
  featureCount: number,
): string | undefined {
  if (!columnDetails) return undefined;

  const scored = Object.entries(columnDetails)
    .filter(([, { type }]) => type === "number")
    .map(([name, { countDistinct }]) => {
      let score = 0;

      // More distinct numeric values → better for continuous scale
      const ratio = featureCount > 0 ? countDistinct / featureCount : 0;
      score += ratio * 10;

      // Penalise if too few distinct values (effectively categorical)
      if (countDistinct <= 2) score -= 8;

      // Penalise junk columns (area, length, etc.)
      if (isJunkColumn(name)) score -= 20;

      return { name, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return undefined;
  const best = scored[0];
  // Don't return a column that has been penalised below a useful threshold
  return best.score > -10 ? best.name : undefined;
}

/**
 * Picks the best column to use as a human-readable label for each feature.
 * Prefers string columns with high uniqueness (close to one value per feature).
 */
function pickBestLabelColumn(
  columnDetails: Record<string, { type: string; countDistinct: number }>,
  featureCount: number,
): string | undefined {
  if (!columnDetails) return undefined;

  const scored = Object.entries(columnDetails)
    .filter(([, { type }]) => type === "string")
    .map(([name, { countDistinct }]) => {
      let score = 0;

      // Ideal: nearly unique values (one per feature)
      const ratio = featureCount > 0 ? countDistinct / featureCount : 0;
      score += ratio * 10;

      // Penalise junk column names
      if (isJunkColumn(name)) score -= 20;

      return { name, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return undefined;
  const best = scored[0];
  return best.score > -10 ? best.name : undefined;
}
