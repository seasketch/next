import { SourceCache } from "fgb-source";
import { Helpers } from "graphile-worker";
import { calculateArea, ClippingLayerOption, Cql2Query } from "overlay-engine";

const sourceCache = new SourceCache("200 MB");

export default async function calculateSizeOfGeography(
  payload: { geographyId: number; metricId: number },
  helpers: Helpers
) {
  await helpers.withPgClient(async (client) => {
    // first, gather all the clipping layers in a format that overlay-engine can use
    const results = await client.query(
      `select (clipping_layers_for_geography($1)).*`,
      [payload.geographyId]
    );
    const clippingLayers = results.rows.map((row) => parseClippingLayer(row));
    try {
      const area = await calculateArea(clippingLayers, sourceCache);
      console.log("area", area);
      await client.query(
        `update spatial_metrics set state = 'complete', value = $1::jsonb where id = $2`,
        [area, payload.metricId]
      );
    } catch (e) {
      // fail the metric, since this isn't supported yet
      await client.query(
        `update spatial_metrics set state = 'error', error_message = $2 where id = $1`,
        [
          payload.metricId,
          "message" in (e as any) ? (e as Error).message : "Unknown error",
        ]
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
