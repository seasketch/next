import { Helpers } from "graphile-worker";
import { Metric, subjectIsFragment } from "overlay-engine";

export default async function calculateSpatialMetric(
  payload: { metricId: number },
  helpers: Helpers
) {
  await helpers.withPgClient(async (client) => {
    const result = await client.query(
      `select get_spatial_metric($1) as metric`,
      [payload.metricId]
    );
    const metric = result.rows[0].metric as Metric & { id: number };
    if (!metric) {
      throw new Error(`Metric not found: ${payload.metricId}`);
    }
    if (metric.type === "total_area") {
      if (subjectIsFragment(metric.subject)) {
        return client.query(
          `update spatial_metrics set value = to_json(ST_AREA((select geometry from fragments where hash = $1)::geography) / 1000000)::jsonb, state = 'complete' where id = $2`,
          [metric.subject.hash, metric.id]
        );
      } else {
        const area = 555;
        return new Promise((resolve) => {
          setTimeout(async () => {
            await client.query(
              `update spatial_metrics set value = $1::jsonb, state = 'complete' where id = $2`,
              [area, metric.id]
            );
            resolve(true);
          }, 50);
        });
      }
    } else {
      throw new Error(`Unsupported metric type: ${metric.type}`);
    }
  });
}
