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
import colors from "yoctocolors-cjs";

const lambda = new AWS.Lambda({
  region: process.env.AWS_REGION || "us-west-2",
  httpOptions: {
    timeout: 120000,
  },
});

export default async function calculateSpatialMetric(
  payload: { metricId: number },
  helpers: Helpers
) {
  const timeout = setTimeout(async () => {
    helpers.logger.error("Timeout", { metricId: payload.metricId });
    await helpers.withPgClient(async (client) => {
      await client.query(
        `update spatial_metrics set state = 'error', error_message = 'Timeout' where id = $1`,
        [payload.metricId]
      );
    });
  }, 10_000);

  try {
    const metric = await getSpatialMetric(payload.metricId, helpers);
    console.log("calculating spatial metric", {
      type: metric.type,
      subject: metric.subject,
      fragment: subjectIsFragment(metric.subject)
        ? (metric.subject as MetricSubjectFragment).hash
        : undefined,
      geography: !subjectIsFragment(metric.subject)
        ? metric.subject.id
        : undefined,
      sourceUrl: metric.sourceUrl,
      parameters: metric.parameters,
      hash: metric.dependencyHash,
    });
    if (metric.type === "total_area") {
      if (subjectIsFragment(metric.subject)) {
        // very simple to do, just ask postgis to calculate the area
        await helpers.withPgClient(async (client) => {
          return client.query(
            `update spatial_metrics set value = to_json(ST_AREA((select geometry from fragments where hash = $1)::geography) / 1000000)::jsonb, state = 'complete' where id = $2`,
            [(metric.subject as MetricSubjectFragment).hash, metric.id]
          );
        });
      } else {
        // ask overlay worker to calculate the area
        const clippingLayers = await getClippingLayersForGeography(
          metric.subject.id,
          helpers
        );
        callOverlayWorker({
          type: "total_area",
          jobKey: metric.jobKey,
          queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
          subject: {
            type: "geography",
            id: metric.subject.id,
            clippingLayers,
          },
          ...metric.parameters,
        } as OverlayWorkerPayload)
          .catch(async (e) => {
            helpers.logger.error("Error calling overlay worker", {
              error: e instanceof Error ? e.message : String(e),
            });
            await helpers.withPgClient(async (client) => {
              await client.query(
                `update spatial_metrics set state = 'error', error_message = $1, updated_at = now() where id = $2`,
                [e instanceof Error ? e.message : "Unknown error", metric.id]
              );
            });
          })
          .finally(() => {
            clearTimeout(timeout);
          });
      }
    } else if (
      metric.type === "overlay_area" ||
      metric.type === "count" ||
      metric.type === "presence" ||
      metric.type === "presence_table" ||
      metric.type === "column_values" ||
      metric.type === "raster_stats" ||
      metric.type === "distance_to_shore"
    ) {
      // If there is no processed source URL yet, do nothing. The preprocessSource task/trigger will handle it.
      if (!metric.sourceUrl) {
        return;
      } else {
        let epsg: number | null = null;
        if (metric.type === "raster_stats") {
          epsg = await helpers.withPgClient(async (client) => {
            const result = await client.query(
              `select epsg from data_upload_outputs where url = $1 and is_reporting_type(type) limit 1`,
              [metric.sourceUrl]
            );
            return result.rows[0]?.epsg || null;
          });
          if (!epsg) {
            throw new Error(
              `No EPSG found for source URL: ${metric.sourceUrl}`
            );
          }
        }
        // delegate to overlay worker
        if (subjectIsFragment(metric.subject)) {
          const geobuf = await getGeobufForFragment(
            metric.subject.hash,
            helpers
          );
          await callOverlayWorker({
            type: metric.type,
            jobKey: metric.jobKey,
            subject: {
              hash: metric.subject.hash,
              geobuf,
            },
            sourceUrl: metric.sourceUrl,
            sourceType: metric.sourceType,
            queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
            epsg,
            ...metric.parameters,
          } as OverlayWorkerPayload);
        } else {
          const clippingLayers = await getClippingLayersForGeography(
            metric.subject.id,
            helpers
          );
          callOverlayWorker({
            type: metric.type,
            jobKey: metric.jobKey,
            subject: {
              type: "geography",
              id: metric.subject.id,
              clippingLayers,
            },
            sourceUrl: metric.sourceUrl,
            sourceType: metric.sourceType,
            queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
            epsg,
            ...metric.parameters,
          })
            .catch(async (e) => {
              helpers.logger.error("Error calling overlay worker", {
                error: e instanceof Error ? e.message : String(e),
              });
              await helpers.withPgClient(async (client) => {
                await client.query(
                  `update spatial_metrics set state = 'error', error_message = $1, updated_at = now() where id = $2`,
                  [e instanceof Error ? e.message : "Unknown error", metric.id]
                );
              });
            })
            .finally(() => {
              clearTimeout(timeout);
            });
        }
      }
    } else {
      throw new Error(`Unsupported metric type: ${(metric as any).type}`);
    }
  } catch (e) {
    await helpers.withPgClient(async (client) => {
      helpers.logger.error("Error calculating spatial metric");
      await client.query(
        `update spatial_metrics set state = 'error', error_message = $1 where id = $2`,
        [e instanceof Error ? e.message : "Unknown error", payload.metricId]
      );
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getGeobufForFragment(fragmentHash: string, helpers: Helpers) {
  return await helpers.withPgClient(async (client) => {
    const result = await client.query(
      `SELECT 
        encode(ST_AsGeoBuf(fragments.*), 'base64') AS geobuf
      FROM fragments 
      WHERE hash = $1 limit 1`,
      [fragmentHash]
    );
    return result.rows[0].geobuf;
  });
}

async function callOverlayWorker(payload: OverlayWorkerPayload) {
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
          InvocationType: "Event", // Async invocation
          Payload: JSON.stringify(payload),
        })
        .promise();
    } catch (e) {
      throw new Error(`Overlay worker lambda error: ${e}`);
    }
  } else {
    throw new Error(
      "Neither OVERLAY_WORKER_DEV_HANDLER nor OVERLAY_WORKER_LAMBDA_ARN are set. Lambda is not implemented."
    );
  }
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
  helpers: Helpers
) {
  let clippingLayers: ClippingLayerOption[] = [];
  await helpers.withPgClient(async (client) => {
    const results = await client.query(
      `select (clipping_layers_for_geography($1)).*`,
      [geographyId]
    );
    clippingLayers = results.rows.map((row) => parseClippingLayer(row));
  });
  return clippingLayers;
}

function getSpatialMetric(metricId: number, helpers: Helpers) {
  return helpers.withPgClient(async (client) => {
    const result = await client.query(
      `select get_spatial_metric($1) as metric`,
      [metricId]
    );
    if (result.rows.length === 0 || !result.rows[0].metric) {
      throw new Error(`Metric not found: ${metricId}`);
    }
    return result.rows[0].metric as Metric & {
      id: number;
      jobKey: string;
      sourceUrl: string;
      sourceType: SourceType;
      parameters: any;
      dependencyHash: string;
    };
  });
}
