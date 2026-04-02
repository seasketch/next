import {
  isRasterInfo,
  SuggestedRasterPresentation,
  type GeostatsLayer,
  type RasterInfo,
} from "@seasketch/geostats-types";
import {
  effectiveReverseNamedPalette,
  type AiDataAnalystNotes,
} from "ai-data-analyst";
import type { Expression, RasterLayer } from "mapbox-gl";
import { VisualizationType } from "../visualizationTypes";
import {
  buildContinuousColorExpression,
  buildRasterStepColorExpression,
  getColorScale,
  rasterValueStepsToRasterStepMethod,
  resolveRasterStepBuckets,
} from "../colorScales";

export function buildRGBRasterLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<RasterLayer, "source" | "id">[] {
  return [
    {
      type: "raster",
      paint: {
        "raster-resampling": "nearest",
        "raster-opacity": 1,
      },
      layout: {
        visibility: "visible",
      },
      metadata: {
        "s:type": VisualizationType.RGB_RASTER,
      },
    },
  ];
}

export function buildContinuousRasterLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<RasterLayer, "source" | "id">[] {
  if (!isRasterInfo(geostats)) {
    throw new Error("Geostats must be a raster info");
  }
  const band = geostats.bands[0]!;
  let rasterColorMix = [
    ["*", 258, 65536],
    ["*", 258, 256],
    258,
    ["+", -32768, band.base],
  ] as any;
  if (band.interval && band.interval !== 1) {
    rasterColorMix = rasterColorMix.map((channel: any) => [
      "*",
      band.interval,
      channel,
    ]);
  }
  if (
    geostats.presentation === SuggestedRasterPresentation.categorical ||
    geostats.byteEncoding
  ) {
    rasterColorMix = [0, 0, 258, band.base];
  }
  const colorScale = getColorScale(
    "continuous",
    aiDataAnalystNotes?.palette || "interpolatePlasma",
  );

  const reversePalette = effectiveReverseNamedPalette(aiDataAnalystNotes);

  const range: [number, number] = [
    geostats.bands[0].minimum,
    geostats.bands[0].maximum,
  ];

  let rasterColor: Expression | undefined;
  const stepsMeta: Record<string, string> = {};
  const vs = aiDataAnalystNotes?.value_steps;
  const vsn = aiDataAnalystNotes?.value_steps_n;
  if (vs && typeof vsn === "number" && Number.isFinite(vsn)) {
    const method = rasterValueStepsToRasterStepMethod(vs);
    if (method) {
      const resolved = resolveRasterStepBuckets(band.stats, method, vsn);
      if (resolved) {
        rasterColor = buildRasterStepColorExpression(
          resolved.buckets,
          colorScale,
          reversePalette,
          ["raster-value"],
        );
        stepsMeta["s:steps"] = `${method}:${resolved.n}`;
      }
    }
  }
  if (!rasterColor) {
    rasterColor = buildContinuousColorExpression(
      colorScale,
      reversePalette,
      range,
      ["raster-value"],
    );
    stepsMeta["s:steps"] = `continuous:10`;
  }

  return [
    {
      type: "raster",
      paint: {
        "raster-opacity": 1,
        "raster-resampling": "nearest",
        "raster-color-mix": rasterColorMix,
        "raster-color-range": geostats.byteEncoding
          ? [band.minimum, band.minimum + 255]
          : [geostats.bands[0].minimum, geostats.bands[0].maximum],
        "raster-fade-duration": 0,
        "raster-color": rasterColor,
      },
      layout: {
        visibility: "visible",
      },
      metadata: {
        "s:palette": colorScale.name,
        ...(reversePalette ? { "s:reverse-palette": true } : {}),
        ...stepsMeta,
        ...(geostats.bands[0].offset || geostats.bands[0].scale
          ? { "s:respect-scale-and-offset": true }
          : {}),
        "s:type": VisualizationType.CONTINUOUS_RASTER,
      },
    },
  ];
}

export function buildCategoricalRasterLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<RasterLayer, "source" | "id">[] {
  if (!isRasterInfo(geostats)) {
    throw new Error("Geostats must be a raster info");
  }
  let colors: [number, string][] = [];
  if (geostats.bands[0].colorTable) {
    colors = geostats.bands[0].colorTable;
  } else if (geostats.bands[0].stats.categories) {
    const categories = geostats.bands[0].stats.categories;
    const colorScale = getColorScale(
      "categorical",
      aiDataAnalystNotes?.palette || "schemeTableau10",
    );
    const reversePalette = effectiveReverseNamedPalette(aiDataAnalystNotes);
    if (reversePalette) {
      categories.reverse();
    }
    for (const category of categories) {
      colors.push([category[0], colorScale(categories.indexOf(category))]);
    }
  }
  return [
    {
      type: "raster",
      paint: {
        "raster-color": [
          "step",
          ["round", ["raster-value"]],
          "transparent",
          ...colors.flat(),
        ],
        "raster-color-mix": [0, 0, 258, geostats.bands[0].base],
        "raster-resampling": "nearest",
        "raster-color-range": [
          geostats.bands[0].minimum,
          geostats.bands[0].minimum + 255,
        ],
        "raster-fade-duration": 0,
      },
      layout: {
        visibility: "visible",
      },
      metadata: {
        "s:palette": geostats.bands[0].colorTable
          ? geostats.bands[0].colorTable.map((b) => b[1])
          : "schemeTableau10",
      },
    },
  ];
}
