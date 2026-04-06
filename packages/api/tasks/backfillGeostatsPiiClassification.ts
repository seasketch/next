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
 * For bulk backfill, enqueue with `queue_name := 'geostats_pii_backfill'` so
 * jobs run one at a time (Graphile Worker serializes per queue name).
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
