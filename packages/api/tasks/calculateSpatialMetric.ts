import { Helpers } from "graphile-worker";
import {
  ClippingLayerOption,
  Cql2Query,
  Metric,
  MetricSubjectFragment,
  subjectIsFragment,
} from "overlay-engine";
import { MetricSubjectGeography } from "overlay-engine/src/metrics/metrics";
import { OverlayWorkerPayload } from "overlay-worker";
import AWS from "aws-sdk";

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
  let metric: Metric & { id: number; jobKey: string };
  await helpers.withPgClient(async (client) => {
    const result = await client.query(
      `select get_spatial_metric($1) as metric`,
      [payload.metricId]
    );
    metric = result.rows[0].metric;
  });

  try {
    // @ts-ignore
    if (metric === undefined) {
      throw new Error(`Metric not found: ${payload.metricId}`);
    }
    if (metric.type === "total_area") {
      if (subjectIsFragment(metric.subject)) {
        await helpers.withPgClient(async (client) => {
          return client.query(
            `update spatial_metrics set value = to_json(ST_AREA((select geometry from fragments where hash = $1)::geography) / 1000000)::jsonb, state = 'complete' where id = $2`,
            [(metric.subject as MetricSubjectFragment).hash, metric.id]
          );
        });
      } else {
        let clippingLayers: ClippingLayerOption[] = [];
        const geographyId = metric.subject.id;
        await helpers.withPgClient(async (client) => {
          const results = await client.query(
            `select (clipping_layers_for_geography($1)).*`,
            [geographyId]
          );
          const geography = await client.query(
            `select id, name from project_geography where id = $1`,
            [geographyId]
          );
          const geographyName = geography.rows[0].name;
          console.log("calculating area for", geographyName);
          clippingLayers = results.rows.map((row) => parseClippingLayer(row));
        });
        const jobKey = metric.jobKey;
        console.log("submitting spatial_metric with jobKey", jobKey);
        await callOverlayWorker({
          type: "total_area",
          jobKey: jobKey,
          subject: {
            type: "geography",
            id: geographyId,
            clippingLayers,
          },
        } as OverlayWorkerPayload);
      }
    } else {
      throw new Error(`Unsupported metric type: ${metric.type}`);
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

async function callOverlayWorker(payload: OverlayWorkerPayload) {
  if (process.env.OVERLAY_WORKER_DEV_HANDLER) {
    const response = await fetch(process.env.OVERLAY_WORKER_DEV_HANDLER, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.json();
  } else if (process.env.OVERLAY_WORKER_LAMBDA_ARN) {
    const lambda = new AWS.Lambda({
      region: process.env.AWS_REGION || "us-west-2",
      httpOptions: {
        timeout: 120000,
      },
    });

    const res = await lambda
      .invoke({
        FunctionName: process.env.OVERLAY_WORKER_LAMBDA_ARN,
        InvocationType: "Event", // Async invocation
        Payload: JSON.stringify(payload),
      })
      .promise();

    console.log("Lambda invocation response", res);
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
