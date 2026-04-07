import { Helpers } from "graphile-worker";
import type { GeostatsLayer } from "@seasketch/geostats-types";
import { classifyGeostatsPii } from "spatial-uploads-handler";

type GeostatsDocument = {
  layers: GeostatsLayer[];
  layerCount?: number;
};

function isVectorGeostatsDoc(value: unknown): value is GeostatsDocument {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const layers = (value as GeostatsDocument).layers;
  return Array.isArray(layers) && layers.length > 0;
}

function parseDataSourceId(payload: unknown): number {
  if (
    payload === null ||
    typeof payload !== "object" ||
    !("dataSourceId" in payload)
  ) {
    throw new Error("backfillGeostatsPiiClassification: payload.dataSourceId is required");
  }
  const raw = (payload as { dataSourceId: unknown }).dataSourceId;
  const id =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(id) || id < 1) {
    throw new Error(
      "backfillGeostatsPiiClassification: dataSourceId must be a positive integer",
    );
  }
  return id;
}

/**
 * Runs vector geostats through the geostats-pii-risk-classifier Lambda and
 * updates `data_sources.geostats` when the first layer is not yet assessed
 * (`piiRiskWasAssessed`). No-op if there is no vector geostats document or
 * assessment already completed.
 *
 * Payload: `{ dataSourceId: number }`
 *
 * The assessed flag lives on **`geostats.layers[0]`** (the first
 * {@link GeostatsLayer}), not on the root `geostats` object.
 *
 * ## Bulk backfill from `psql`
 *
 * Workers must have **`GEOSTATS_PII_CLASSIFIER_ARN`** set (same as spatial
 * upload processing). Run `graphile_worker.add_job` as a DB role that may
 * enqueue jobs (often `postgres` / `admin`).
 *
 * **Task identifier** (Graphile file name): `backfillGeostatsPiiClassification`
 *
 * Use **`queue_name := 'geostats_pii_backfill'`** so jobs run **serially**
 * (one queue → one job at a time per worker concurrency for that queue).
 *
 * **`max_attempts`**: total tries, not “retries after failure”. Use `1` for a
 * single attempt only; use `2` for one retry after the first failure.
 *
 * Optional **`job_key`** avoids duplicate pending jobs per data source (default
 * `job_key_mode` replaces an existing unlocked job with the same key).
 *
 * Preview rows that would be backfilled (tune `type IN (...)` if needed):
 *
 * ```sql
 * SELECT ds.id AS data_source_id,
 *        ds.type,
 *        ds.geostats->'layers'->0->>'piiRiskWasAssessed' AS layer0_pii_risk_was_assessed
 * FROM data_sources ds
 * WHERE ds.geostats IS NOT NULL
 *   AND jsonb_typeof(ds.geostats->'layers') = 'array'
 *   AND jsonb_array_length(ds.geostats->'layers') > 0
 *   AND (ds.geostats->'layers'->0->>'piiRiskWasAssessed') IS DISTINCT FROM 'true'
 *   AND ds.type IN ('seasketch-vector', 'seasketch-mvt');
 * ```
 *
 * Enqueue jobs (example: one retry after failure):
 *
 * ```sql
 * SELECT graphile_worker.add_job(
 *   'backfillGeostatsPiiClassification',
 *   json_build_object('dataSourceId', ds.id),
 *   queue_name := 'geostats_pii_backfill',
 *   max_attempts := 2,
 *   job_key := 'backfillGeostatsPiiClassification:' || ds.id
 * )
 * FROM data_sources ds
 * WHERE ds.geostats IS NOT NULL
 *   AND jsonb_typeof(ds.geostats->'layers') = 'array'
 *   AND jsonb_array_length(ds.geostats->'layers') > 0
 *   AND (ds.geostats->'layers'->0->>'piiRiskWasAssessed') IS DISTINCT FROM 'true'
 *   AND ds.type IN ('seasketch-vector', 'seasketch-mvt');
 * ```
 */
export default async function backfillGeostatsPiiClassification(
  payload: unknown,
  helpers: Helpers,
) {
  const dataSourceId = parseDataSourceId(payload);

  await helpers.withPgClient(async (client) => {
    const row = await client.query<{ geostats: unknown }>(
      `select geostats from data_sources where id = $1`,
      [dataSourceId],
    );
    if (row.rows.length === 0) {
      helpers.logger.info(
        `backfillGeostatsPiiClassification: data source ${dataSourceId} not found; skipping`,
      );
      return;
    }

    const raw = row.rows[0].geostats;
    if (raw === null || raw === undefined) {
      helpers.logger.info(
        `backfillGeostatsPiiClassification: data source ${dataSourceId} has no geostats; skipping`,
      );
      return;
    }

    if (!isVectorGeostatsDoc(raw)) {
      helpers.logger.info(
        `backfillGeostatsPiiClassification: data source ${dataSourceId} has no vector layers in geostats; skipping`,
      );
      return;
    }

    const layer0 = raw.layers[0];
    if (layer0.piiRiskWasAssessed === true) {
      helpers.logger.info(
        `backfillGeostatsPiiClassification: data source ${dataSourceId} already has piiRiskWasAssessed; skipping`,
      );
      return;
    }

    const assessed = await classifyGeostatsPii(layer0);

    const updated: GeostatsDocument = {
      ...raw,
      layers: [assessed, ...raw.layers.slice(1)],
    };

    await client.query(
      `update data_sources set geostats = $2::jsonb where id = $1`,
      [dataSourceId, JSON.stringify(updated)],
    );

    helpers.logger.info(
      `backfillGeostatsPiiClassification: updated geostats PII classification for data source ${dataSourceId}`,
    );
  });
}
