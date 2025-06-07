import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { GeoJSONFeatureSchema } from "zod-geojson";
import {
  prepareSketch,
  clipToGeography,
  unionAtAntimeridian,
  clipSketchToPolygons,
} from "overlay-engine";
import { createSource, SourceCache } from "fgb-source";

const app = new Hono<{ Bindings: CloudflareBindings }>();

const sourceCache = new SourceCache("50mb");

const clipFn: ClippingFn = async (sketch, source, op, query) => {
  const source = sourceCache.get(source, {
    fetchRangeFn: async (key, range) => {
      const request = this.env.SSN_TILES.get(key, {
        range: new Headers({
          Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
        }),
      });
    },
  });
  return clipSketchToPolygons(
    sketch,
    source,
    op,
    source.getFeaturesAsync(query)
  );
};

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

app.post("/clip", zValidator("json", clipReqSchema), async (c) => {
  const params = c.req.valid("json");
  const preparedSketch = prepareSketch(params.feature);
  console.log(preparedSketch);
  // TODO: Implement clipping logic
  return c.json({ success: true, message: "Clipping endpoint" });
});

app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

export default app;
