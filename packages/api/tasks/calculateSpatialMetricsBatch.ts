import { Helpers } from "graphile-worker";
import {
  ClippingLayerOption,
  Cql2Query,
  Metric,
  MetricSubjectFragment,
  subjectIsFragment,
  SourceType,
} from "overlay-engine";
import { OverlayWorkerPayload } from "overlay-worker";
import AWS from "aws-sdk";
import Bottleneck from "bottleneck";
import colors from "yoctocolors-cjs";
import area from "@turf/area";

const METRIC_CHUNK_SIZE =
  parseInt(process.env.SPATIAL_METRICS_BATCH_CHUNK_SIZE ?? "400", 10) || 400;

/** How many metrics to process at once within a chunk (Lambda invoke + PG updates overlap). */
const METRIC_PROCESS_CONCURRENCY =
  parseInt(process.env.SPATIAL_METRICS_PROCESS_CONCURRENCY ?? "128", 10) || 128;

const metricProcessLimiter = new Bottleneck({
  maxConcurrent: METRIC_PROCESS_CONCURRENCY,
});

/** Rate-limits overlay worker Lambda/dev-handler calls (e.g. 10k per 5 min). No concurrency cap. */
const rateLimit =
  parseInt(process.env.OVERLAY_WORKER_RATE_LIMIT ?? "10000", 10) || 10000;
const rateLimitWindowMs =
  (parseInt(process.env.OVERLAY_WORKER_RATE_LIMIT_WINDOW_MINUTES ?? "5", 10) ||
    5) *
  60 *
  1000;

const overlayWorkerLimiter = new Bottleneck({
  maxConcurrent: 10000,
  reservoir: rateLimit,
  reservoirRefreshAmount: rateLimit,
  reservoirRefreshInterval: rateLimitWindowMs,
});

const lambda = new AWS.Lambda({
  region: process.env.AWS_REGION || "us-west-2",
  httpOptions: {
    timeout: 120000,
  },
});

type SpatialMetricJson = Metric & {
  id: number;
  jobKey: string;
  sourceUrl: string;
  sourceType: SourceType;
  parameters: Record<string, unknown>;
};

const OVERLAY_WORKER_RATE_LIMIT_EXCEEDED =
  "Overlay worker rate limit exceeded. Try again after the limit window refreshes.";

export default async function calculateSpatialMetricsBatch(
  payload: { metricIds?: unknown },
  helpers: Helpers,
) {
  const raw = payload?.metricIds;
  const flat: number[] = Array.isArray(raw)
    ? raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const uniqueIds = [...new Set(flat)];

  if (uniqueIds.length === 0) {
    return;
  }

  for (let i = 0; i < uniqueIds.length; i += METRIC_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + METRIC_CHUNK_SIZE);
    await processMetricChunk(chunk, helpers);
  }
}

async function processMetricChunk(metricIds: number[], helpers: Helpers) {
  let claimed: number[] = [];
  try {
    claimed = await claimSpatialMetrics(metricIds, helpers);
    if (claimed.length === 0) {
      return;
    }

    const metrics = await loadSpatialMetrics(claimed, helpers);
    const byId = new Map(metrics.map((m) => [m.id, m]));
    const missingJson = claimed.filter((id) => !byId.has(id));
    if (missingJson.length > 0) {
      await revertClaimedToQueued(missingJson, helpers);
    }
    const orderedMetrics = claimed
      .map((id) => byId.get(id))
      .filter((m): m is SpatialMetricJson => m != null);
    if (orderedMetrics.length === 0) {
      return;
    }

    const geobufByHash = await loadGeobufsForFragments(
      collectFragmentHashes(orderedMetrics),
      helpers,
    );
    const clippingByGeoId = await loadClippingLayersForGeographies(
      collectGeographyIds(orderedMetrics),
      helpers,
    );
    const epsgByUrl = await loadEpsgForUrls(
      collectRasterSourceUrls(orderedMetrics),
      helpers,
    );

    const results = await Promise.allSettled(
      orderedMetrics.map((metric) =>
        metricProcessLimiter.schedule(() =>
          processOneSpatialMetric(
            metric,
            geobufByHash,
            clippingByGeoId,
            epsgByUrl,
            helpers,
          ),
        ),
      ),
    );
    for (const r of results) {
      if (r.status === "rejected") {
        helpers.logger.error("calculateSpatialMetricsBatch metric rejected", {
          error:
            r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    }
  } catch (e) {
    if (claimed.length > 0) {
      await revertClaimedToQueued(claimed, helpers);
    }
    throw e;
  }
}

async function claimSpatialMetrics(
  metricIds: number[],
  helpers: Helpers,
): Promise<number[]> {
  return helpers.withPgClient(async (client) => {
    const result = await client.query<{ id: string }>(
      `
      UPDATE spatial_metrics sm
      SET
        state = 'processing'::spatial_metric_state,
        started_at = COALESCE(sm.started_at, now()),
        updated_at = now()
      WHERE sm.id = ANY($1::bigint[])
        AND sm.state IN (
          'queued'::spatial_metric_state,
          'error'::spatial_metric_state,
          'dependency_not_ready'::spatial_metric_state
        )
        AND (
          sm.type = 'total_area'::spatial_metric_type
          OR sm.overlay_source_url IS NOT NULL
        )
      RETURNING sm.id
      `,
      [metricIds],
    );
    return result.rows.map((r) => Number(r.id));
  });
}

async function revertClaimedToQueued(ids: number[], helpers: Helpers) {
  if (ids.length === 0) return;
  await helpers.withPgClient(async (client) => {
    await client.query(
      `
      UPDATE spatial_metrics
      SET
        state = 'queued'::spatial_metric_state,
        updated_at = now()
      WHERE id = ANY($1::bigint[])
        AND state = 'processing'::spatial_metric_state
      `,
      [ids],
    );
  });
}

async function loadSpatialMetrics(
  ids: number[],
  helpers: Helpers,
): Promise<SpatialMetricJson[]> {
  return helpers.withPgClient(async (client) => {
    const result = await client.query<{ m: SpatialMetricJson[] }>(
      `SELECT get_spatial_metrics($1::bigint[]) AS m`,
      [ids],
    );
    const raw = result.rows[0]?.m;
    if (!raw || !Array.isArray(raw)) {
      return [];
    }
    return raw as SpatialMetricJson[];
  });
}

function collectFragmentHashes(metrics: SpatialMetricJson[]): string[] {
  const s = new Set<string>();
  for (const m of metrics) {
    if (subjectIsFragment(m.subject)) {
      s.add((m.subject as MetricSubjectFragment).hash);
    }
  }
  return [...s];
}

function collectGeographyIds(metrics: SpatialMetricJson[]): number[] {
  const s = new Set<number>();
  for (const m of metrics) {
    if (!subjectIsFragment(m.subject) && m.subject && "id" in m.subject) {
      s.add((m.subject as { id: number }).id);
    }
  }
  return [...s];
}

function collectRasterSourceUrls(metrics: SpatialMetricJson[]): string[] {
  const s = new Set<string>();
  for (const m of metrics) {
    if (m.type === "raster_stats" && m.sourceUrl) {
      s.add(m.sourceUrl);
    }
  }
  return [...s];
}

async function loadGeobufsForFragments(
  hashes: string[],
  helpers: Helpers,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (hashes.length === 0) return map;
  return helpers.withPgClient(async (client) => {
    // ST_AsGeoBuf is aggregate-like in some PostGIS builds; putting it beside outer
    // columns triggers GROUP BY errors. Keep encoding inside a scalar subquery so each
    // evaluation sees exactly one fragments row.
    const result = await client.query<{ hash: string; geobuf: string | null }>(
      `
      SELECT q.hash::text AS hash,
        (
          SELECT encode(ST_AsGeoBuf(fr.*), 'base64')
          FROM fragments fr
          WHERE fr.hash = q.hash
          LIMIT 1
        ) AS geobuf
      FROM unnest($1::text[]) AS q(hash)
      `,
      [hashes],
    );
    for (const row of result.rows) {
      if (row.geobuf != null) {
        map.set(row.hash, row.geobuf);
      }
    }
    return map;
  });
}

async function loadClippingLayersForGeographies(
  geographyIds: number[],
  helpers: Helpers,
): Promise<Map<number, ClippingLayerOption[]>> {
  const map = new Map<number, ClippingLayerOption[]>();
  if (geographyIds.length === 0) return map;
  const pairs = await Promise.all(
    geographyIds.map(async (gid) => {
      const layers = await getClippingLayersForGeography(gid, helpers);
      return [gid, layers] as const;
    }),
  );
  for (const [gid, layers] of pairs) {
    map.set(gid, layers);
  }
  return map;
}

async function loadEpsgForUrls(
  urls: string[],
  helpers: Helpers,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (urls.length === 0) return map;
  return helpers.withPgClient(async (client) => {
    const result = await client.query<{ url: string; epsg: number }>(
      `
      SELECT url, epsg
      FROM data_upload_outputs
      WHERE url = ANY($1::text[])
        AND is_reporting_type(type)
      `,
      [urls],
    );
    for (const row of result.rows) {
      if (row.epsg != null) {
        map.set(row.url, row.epsg);
      }
    }
    return map;
  });
}

async function processOneSpatialMetric(
  metric: SpatialMetricJson,
  geobufByHash: Map<string, string>,
  clippingByGeoId: Map<number, ClippingLayerOption[]>,
  epsgByUrl: Map<string, number>,
  helpers: Helpers,
) {
  try {
    if (metric.type === "total_area") {
      if (subjectIsFragment(metric.subject)) {
        await helpers.withPgClient(async (client) => {
          const startTime = Date.now();
          const geojsonResult = await client.query(
            `select ST_AsGeoJSON(geometry)::json as geojson from fragments where hash = $1`,
            [(metric.subject as MetricSubjectFragment).hash],
          );
          const geojson = geojsonResult.rows[0]?.geojson;
          if (!geojson) {
            throw new Error(
              `Fragment not found: ${(metric.subject as MetricSubjectFragment).hash}`,
            );
          }
          const sqKm =
            area({ type: "Feature", geometry: geojson, properties: {} }) /
            1_000_000;
          const endTime = Date.now();
          const durationMs = endTime - startTime;
          await client.query(
            `update spatial_metrics set value = to_json($1::float)::jsonb, state = 'complete', duration = make_interval(secs => $2::float / 1000.0) where id = $3`,
            [sqKm, durationMs, metric.id],
          );
        });
      } else {
        const gid = (metric.subject as { id: number }).id;
        const clippingLayers = clippingByGeoId.get(gid);
        if (clippingLayers === undefined) {
          throw new Error(
            `Missing clipping layers for geography ${gid} after batch preload (metric ${metric.id})`,
          );
        }
        callOverlayWorker({
          type: "total_area",
          jobKey: metric.jobKey,
          queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
          subject: {
            type: "geography",
            id: gid,
            clippingLayers,
          },
          ...metric.parameters,
        } as unknown as OverlayWorkerPayload).catch(async (e) => {
          helpers.logger.error("Error calling overlay worker", {
            error: e instanceof Error ? e.message : String(e),
          });
          await helpers.withPgClient(async (client) => {
            await client.query(
              `update spatial_metrics set state = 'error', error_message = $1, updated_at = now() where id = $2`,
              [e instanceof Error ? e.message : "Unknown error", metric.id],
            );
          });
        });
      }
      return;
    }

    if (
      metric.type === "overlay_area" ||
      metric.type === "count" ||
      metric.type === "presence" ||
      metric.type === "presence_table" ||
      metric.type === "column_values" ||
      metric.type === "raster_stats" ||
      metric.type === "distance_to_shore"
    ) {
      if (!metric.sourceUrl) {
        await helpers.withPgClient(async (client) => {
          await client.query(
            `update spatial_metrics set state = 'queued', updated_at = now() where id = $1`,
            [metric.id],
          );
        });
        return;
      }

      let epsg: number | null = null;
      if (metric.type === "raster_stats") {
        const e = epsgByUrl.get(metric.sourceUrl);
        if (e == null) {
          throw new Error(
            `Missing EPSG for raster_stats after batch preload (metric ${metric.id}, url ${metric.sourceUrl})`,
          );
        }
        epsg = e;
      }

      if (subjectIsFragment(metric.subject)) {
        const hash = (metric.subject as MetricSubjectFragment).hash;
        const geobuf = geobufByHash.get(hash);
        if (geobuf === undefined) {
          throw new Error(
            `Missing geobuf for fragment ${hash} after batch preload (metric ${metric.id})`,
          );
        }
        await callOverlayWorker({
          type: metric.type,
          jobKey: metric.jobKey,
          subject: {
            hash,
            geobuf,
          },
          sourceUrl: metric.sourceUrl,
          sourceType: metric.sourceType,
          queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
          epsg,
          ...metric.parameters,
        } as unknown as OverlayWorkerPayload);
      } else {
        const gid = (metric.subject as { id: number }).id;
        const clippingLayers = clippingByGeoId.get(gid);
        if (clippingLayers === undefined) {
          throw new Error(
            `Missing clipping layers for geography ${gid} after batch preload (metric ${metric.id})`,
          );
        }
        callOverlayWorker({
          type: metric.type,
          jobKey: metric.jobKey,
          subject: {
            type: "geography",
            id: gid,
            clippingLayers,
          },
          sourceUrl: metric.sourceUrl,
          sourceType: metric.sourceType,
          queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
          epsg,
          ...metric.parameters,
        } as unknown as OverlayWorkerPayload).catch(async (e) => {
          helpers.logger.error("Error calling overlay worker", {
            error: e instanceof Error ? e.message : String(e),
          });
          await helpers.withPgClient(async (client) => {
            await client.query(
              `update spatial_metrics set state = 'error', error_message = $1, updated_at = now() where id = $2`,
              [e instanceof Error ? e.message : "Unknown error", metric.id],
            );
          });
        });
      }
      return;
    }

    {
      const m = metric as SpatialMetricJson;
      await helpers.withPgClient(async (client) => {
        await client.query(
          `update spatial_metrics set state = 'error', error_message = $1 where id = $2`,
          [`Unsupported metric type: ${String(m.type)}`, m.id],
        );
      });
    }
    return;
  } catch (e) {
    await helpers.withPgClient(async (client) => {
      helpers.logger.error("Error calculating spatial metric in batch");
      await client.query(
        `update spatial_metrics set state = 'error', error_message = $1 where id = $2`,
        [e instanceof Error ? e.message : "Unknown error", metric.id],
      );
    });
  }
}

async function callOverlayWorker(payload: OverlayWorkerPayload) {
  const reservoir = await (
    overlayWorkerLimiter as Bottleneck
  ).currentReservoir();
  if (reservoir == null || reservoir <= 0) {
    throw new Error(OVERLAY_WORKER_RATE_LIMIT_EXCEEDED);
  }
  return overlayWorkerLimiter.schedule(async () => {
    console.log(colors.bgMagenta(`[${payload.jobKey}] Calling overlay worker`));
    if (process.env.OVERLAY_WORKER_DEV_HANDLER) {
      const response = await fetch(process.env.OVERLAY_WORKER_DEV_HANDLER, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(`Overlay worker dev handler error: ${data.error}`);
      }
      return data;
    } else if (process.env.OVERLAY_WORKER_LAMBDA_ARN) {
      try {
        await lambda
          .invoke({
            FunctionName: process.env.OVERLAY_WORKER_LAMBDA_ARN,
            InvocationType: "Event",
            Payload: JSON.stringify(payload),
          })
          .promise();
      } catch (e) {
        throw new Error(`Overlay worker lambda error: ${e}`);
      }
    } else {
      throw new Error(
        "Neither OVERLAY_WORKER_DEV_HANDLER nor OVERLAY_WORKER_LAMBDA_ARN are set. Lambda is not implemented.",
      );
    }
  });
}

function parseClippingLayer(clippingLayer: {
  id: number;
  cql2_query: Cql2Query;
  template_id: string;
  object_key: string;
  url: string;
  operation_type: "intersect" | "difference";
}): ClippingLayerOption {
  return {
    cql2Query: clippingLayer.cql2_query,
    source: `https://uploads.seasketch.org/${clippingLayer.object_key}`,
    op:
      clippingLayer.operation_type === "intersect" ? "INTERSECT" : "DIFFERENCE",
  };
}

async function getClippingLayersForGeography(
  geographyId: number,
  helpers: Helpers,
) {
  let clippingLayers: ClippingLayerOption[] = [];
  await helpers.withPgClient(async (client) => {
    const results = await client.query(
      `select (clipping_layers_for_geography($1)).*`,
      [geographyId],
    );
    clippingLayers = results.rows.map((row) => parseClippingLayer(row));
  });
  return clippingLayers;
}
