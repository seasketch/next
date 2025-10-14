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
import { v4 as uuid } from "uuid";

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
        await callOverlayWorker({
          type: "total_area",
          jobKey: metric.jobKey,
          queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
          subject: {
            type: "geography",
            id: metric.subject.id,
            clippingLayers,
          },
        } as OverlayWorkerPayload);
      }
    } else if (metric.type === "overlay_area") {
      // If there is no processed source URL yet, do nothing. The preprocessSource task/trigger will handle it.
      if (!metric.sourceUrl) {
        return;
      } else {
        // delegate to overlay worker
        if (subjectIsFragment(metric.subject)) {
          const geobuf = await getGeobufForFragment(
            metric.subject.hash,
            helpers
          );
          await callOverlayWorker({
            type: "overlay_area",
            jobKey: metric.jobKey,
            subject: {
              hash: metric.subject.hash,
              geobuf,
            },
            groupBy: metric.groupBy,
            sourceUrl: metric.sourceUrl,
            sourceType: metric.sourceType,
            queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
          } as OverlayWorkerPayload);
        } else {
          const clippingLayers = await getClippingLayersForGeography(
            metric.subject.id,
            helpers
          );
          await callOverlayWorker({
            type: "overlay_area",
            jobKey: metric.jobKey,
            subject: {
              type: "geography",
              id: metric.subject.id,
              clippingLayers,
            },
            groupBy: metric.groupBy,
            sourceUrl: metric.sourceUrl,
            sourceType: metric.sourceType,
            queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
          });
        }
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
  if (process.env.OVERLAY_WORKER_DEV_HANDLER) {
    console.log("Calling overlay worker dev handler", payload);
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
    console.log(
      "Calling production overlay worker lambda",
      JSON.stringify(payload)
    );

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
    };
  });
}

function getCanonicalDataSource(stableId: string, helpers: Helpers) {
  return helpers.withPgClient(async (client) => {
    const result = await client.query(
      `
        select
          o.url,
          o.data_source_id
        from
          data_upload_outputs o
        where
          o.data_source_id = (
            select
              data_source_id
            from
              data_layers
            where
              id = (
              select data_layer_id from table_of_contents_items where stable_id = $1 and is_draft = true
            )
          )
        order by case when o.type = 'FlatGeobuf' then 0 else 1 end
        limit 1
        `,
      [stableId]
    );
    if (result.rows.length === 0) {
      throw new Error(
        `Canonical source URL not found for stable ID: ${stableId}`
      );
    }
    return {
      sourceUrl: result.rows[0].url as string,
      sourceId: result.rows[0].data_source_id as number,
    };
  });
}

// assignSubdivisionJob removed. Preprocessing is handled by preprocessSource task and DB triggers.
