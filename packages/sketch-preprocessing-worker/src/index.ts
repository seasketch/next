import { Context, Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { GeoJSONFeatureSchema } from "zod-geojson";
import {
  prepareSketch,
  clipToGeography,
  clipToGeographies,
  unionAtAntimeridian,
  clipSketchToPolygons,
  GeographySettings,
  SketchFragment,
} from "overlay-engine";
import { SourceCache } from "fgb-source";
import turfArea from "@turf/area";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { cors } from "hono/cors";
import { makeFetchRangeFn } from "./utils/fetch-utils";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST", "OPTIONS", "GET"],
    allowHeaders: ["Content-Type", "Authorization", "X-Ss-Spans"],
    maxAge: 86400, // Cache preflight response
  })
);

const sourceCache = new SourceCache("50mb");

const clipReqSchema = z.object({
  feature: GeoJSONFeatureSchema,
  geographies: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      clippingLayers: z.array(
        z.object({
          id: z.number(),
          op: z.enum(["INTERSECT", "DIFFERENCE"]),
          templateId: z.string().optional().nullable(),
          cql2Query: z.any().optional(),
          dataset: z.string(),
        })
      ),
    })
  ),
});

const clippingLayerSchema = z.object({
  op: z.enum(["INTERSECT", "DIFFERENCE"]),
  source: z.string(),
  cql2Query: z.any().optional(),
});

const geographySettingsSchema = z.object({
  id: z.number(),
  clippingLayers: z.array(clippingLayerSchema),
});

const sketchFragmentSchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    __hash: z.string(),
    __geographyIds: z.array(z.number()),
    __sketchIds: z.array(z.number()),
  }),
  geometry: z.any(),
});

const createFragmentsReqSchema = z.object({
  feature: GeoJSONFeatureSchema,
  geographies: z.array(geographySettingsSchema),
  geographiesForClipping: z.array(z.number()),
  existingOverlappingFragments: z.array(sketchFragmentSchema),
  existingSketchId: z.number().nullable(),
});

app.post(
  "/create-fragments",
  zValidator("json", createFragmentsReqSchema),
  async (c) => {
    const params = c.req.valid("json");
    try {
      const preparedSketch = prepareSketch(params.feature);

      const geographies = params.geographies as GeographySettings[];
      const existingFragments =
        params.existingOverlappingFragments as SketchFragment[];

      const { clipped, fragments } = await clipToGeographies(
        preparedSketch,
        geographies,
        params.geographiesForClipping,
        existingFragments,
        params.existingSketchId,
        async (feature, objectKey, op, cql2Query) => {
          const source = await getSource(c, objectKey);
          return clipSketchToPolygons(
            feature,
            op,
            cql2Query,
            source.getFeaturesAsync(feature.envelopes)
          );
        }
      );

      return c.json({ success: true, clipped, fragments });
    } catch (e: any) {
      console.error(e);
      return c.json({ success: false, error: e.toString() });
    }
  }
);

app.post("/clip", zValidator("json", clipReqSchema), async (c) => {
  const params = c.req.valid("json");
  try {
    const preparedSketch = prepareSketch(params.feature);

    // Evaluate each geography in parallel
    let results = await Promise.all(
      params.geographies.map((geography) => {
        return clipToGeography(
          preparedSketch,
          geography.clippingLayers.map((l) => ({
            op: l.op,
            source: l.dataset,
            cql2Query: l.cql2Query,
          })),
          async (preparedSketch, sourceKey, op, cql2Query) => {
            const source = await getSource(c, sourceKey);
            return clipSketchToPolygons(
              preparedSketch,
              op,
              cql2Query,
              source.getFeaturesAsync(preparedSketch.envelopes)
            );
          }
        );
      })
    );

    // Filter out any null results
    results = results.filter((r) => r !== null);

    if (results.length === 0) {
      return c.json({
        success: false,
        error: "No intersection with any geography",
      });
    }

    // Find the biggest result
    const maxArea = results.reduce((max, current) => {
      const area = turfArea(current!);
      return Math.max(max, area);
    }, 0);
    const biggest = results.find((r) => turfArea(r!) === maxArea);

    // If no biggest result, return an error
    if (!biggest) {
      return c.json({
        success: false,
        error: "No intersection with any geography",
      });
    }

    // Union the biggest result at the antimeridian for display purposes
    return c.json({ success: true, data: unionAtAntimeridian(biggest) });
  } catch (e: any) {
    console.error(e);
    return c.json({ success: false, error: e.toString() });
  }
});

/**
 * Warm the cache for the given source keys. The SeaSketch client will send
 * partially drawn polygons as they are digitized so that the cache is warm
 * for the final clipping step.
 *
 * For this to work well, the fetchRangeFn must be able to handle multiple
 * requests in flight at once, and also cache feature data.
 */
app.post("/warm-cache", zValidator("json", clipReqSchema), async (c) => {
  const params = c.req.valid("json");
  const preparedSketch = prepareSketch(params.feature);
  const uniqueClippingLayers = new Set<string>();
  for (const geography of params.geographies) {
    for (const layer of geography.clippingLayers) {
      uniqueClippingLayers.add(layer.dataset);
    }
  }

  c.executionCtx.waitUntil(
    Promise.all(
      uniqueClippingLayers.values().map(async (sourceKey) => {
        const source = await getSource(c, sourceKey);
        return source.getFeaturesAsync(preparedSketch.envelopes, {
          warmCache: true,
        });
      })
    )
  );
  return c.json({ success: true });
});

function getSource(
  ctx: Context<{ Bindings: CloudflareBindings }>,
  sourceKey: string
) {
  return sourceCache.get<Feature<MultiPolygon | Polygon>>(sourceKey, {
    fetchRangeFn: makeFetchRangeFn(ctx),
  });
}

export default app;
