import { Helpers } from "graphile-worker";
import {
  Metric,
  MetricSubjectFragment,
  subjectIsFragment,
} from "overlay-engine";
import { MetricSubjectGeography } from "overlay-engine/src/metrics/metrics";

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
  let metric: Metric & { id: number };
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
        await helpers.addJob(
          "calculateSizeOfGeography",
          {
            geographyId: metric.subject.id,
            metricId: metric.id,
          },
          {
            queueName: "calculate-size-of-geography",
          }
        );
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
