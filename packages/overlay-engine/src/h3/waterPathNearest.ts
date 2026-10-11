import { Feature, LineString, MultiPolygon, Polygon, Position } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import { openLandOccupancy, LandOccupancy } from "@seasketch/h3-land/client";
import {
  archiveFor,
  centroid,
  geometryRings,
  landPolygonsFromSource,
  sampleResolution,
  searchBitmap,
  WATER_PATH_RESOLUTION_DEGREES,
  WaterPathResolution,
} from "./bitmapSearch";
import {
  bboxToEnvelope,
  cleanBBox,
  splitBBoxAntimeridian,
} from "../utils/bboxUtils";

export type {
  WaterPathCandidate,
  WaterPathFeatureHit,
  WaterPathNearestResult,
} from "./waterPathNearestH3";

import type { WaterPathNearestResult } from "./waterPathNearestH3";

export const MAX_DISTANCE_TO_FEATURES_KM = 400;
export const DEFAULT_WATER_PATH_MAX_RESULTS = 3;
/** Default search radius, in kilometres. */
export const DEFAULT_WATER_PATH_DISTANCE_KM = 300;
export const MAX_WATER_PATH_RESULTS = 25;

const openings = new Map<string, Promise<LandOccupancy>>();

function landArchive(url: string): Promise<LandOccupancy> {
  const existing = openings.get(url);
  if (existing) return existing;
  const pending = openLandOccupancy(url, {
    cacheBytes: 64 * 1024 * 1024,
  }).catch((error: unknown) => {
    openings.delete(url);
    throw error;
  });
  openings.set(url, pending);
  return pending;
}

function publicProperties(
  properties: Record<string, unknown> | null | undefined,
  includedColumns: string[] | undefined,
): Record<string, unknown> {
  if (!properties) return {};
  const keys = includedColumns?.length
    ? includedColumns
    : Object.keys(properties);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key.startsWith("__")) continue;
    if (key in properties) out[key] = properties[key];
  }
  return out;
}

function featureId(feature: Feature, position: Position): number {
  const offset = (feature.properties as { __offset?: unknown } | null)
    ?.__offset;
  if (typeof offset === "number" && Number.isFinite(offset)) return offset;
  return (
    Math.round(position[0] * 1e5) * 1_000_003 + Math.round(position[1] * 1e5)
  );
}

function pointPositions(feature: Feature): Position[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "MultiPoint") return geometry.coordinates;
  return [];
}

async function loadPoints(
  source: FlatGeobufSource<Feature>,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Promise<Feature[]> {
  const parts = splitBBoxAntimeridian(
    cleanBBox([minX, minY, maxX, maxY]) as [number, number, number, number],
  );
  const found: Feature[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    const envelope = bboxToEnvelope(part);
    for await (const feature of source.getFeaturesAsync(envelope as never)) {
      const offset = (feature.properties as { __offset?: unknown } | null)
        ?.__offset;
      if (typeof offset === "number") {
        if (seen.has(offset)) continue;
        seen.add(offset);
      }
      found.push(feature);
    }
  }
  return found;
}

function textProp(
  properties: Record<string, unknown>,
  key: string,
): string {
  const value = properties[key];
  return typeof value === "string" ? value : "";
}

/**
 * Water-path distance from a sketch to the nearest point features.
 * The ocean bitmap is classified from the H3 land archive. The land
 * polygons are the caller's shoreline source, the same file distance-to-shore
 * uses, and they carry a port out of a harbor the archive has filled in.
 */
export async function searchWaterPathNearest(
  feature: Feature,
  points: FlatGeobufSource<Feature>,
  land: FlatGeobufSource<Feature>,
  options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
    /** Grid cell size. Omitted means the fine grid. */
    resolution?: WaterPathResolution;
    /** Epoch ms. The search stops and returns the routes it has. */
    deadline?: number;
    /** Record the grid walk for the debug viewer. */
    trace?: boolean;
    archiveUrl?: string;
    onProgress?: (text: string) => void;
  },
): Promise<WaterPathNearestResult> {
  if (!feature.geometry) {
    throw new Error("searchWaterPathNearest: feature.geometry is required");
  }
  const maxResults = Math.min(
    MAX_WATER_PATH_RESULTS,
    Math.max(1, options?.maxResults ?? DEFAULT_WATER_PATH_MAX_RESULTS),
  );
  const requestedKm = options?.maxDistanceKm ?? DEFAULT_WATER_PATH_DISTANCE_KM;
  const maxMeters =
    Math.min(requestedKm, MAX_DISTANCE_TO_FEATURES_KM) * 1000;
  const resolution = options?.resolution ?? "high";
  const degrees = WATER_PATH_RESOLUTION_DEGREES[resolution];
  const origin = centroid(feature);
  const rings = geometryRings(feature);
  const latPad = maxMeters / 111_320;
  const lngPad =
    latPad / Math.max(0.2, Math.cos((origin[1] * Math.PI) / 180));
  const pointFeatures = await loadPoints(
    points,
    origin[0] - lngPad,
    origin[1] - latPad,
    origin[0] + lngPad,
    origin[1] + latPad,
  );

  const ports: Array<{
    name: string;
    country: string;
    lng: number;
    lat: number;
    id: number;
    properties: Record<string, unknown>;
  }> = [];
  for (const pointFeature of pointFeatures) {
    const properties = publicProperties(
      pointFeature.properties as Record<string, unknown> | null,
      options?.includedColumns,
    );
    for (const position of pointPositions(pointFeature)) {
      ports.push({
        name: textProp(properties, "PORT_NAME") || textProp(properties, "name"),
        country: textProp(properties, "COUNTRY"),
        lng: position[0],
        lat: position[1],
        id: featureId(pointFeature, position),
        properties,
      });
    }
  }

  const archiveUrl =
    options?.archiveUrl ??
    process.env.H3_LAND_URL ??
    archiveFor(sampleResolution(degrees));
  const occupancy = await landArchive(archiveUrl);
  const goalPool = Math.min(24, maxResults * 6);
  const deadline = options?.deadline;
  const result = await searchBitmap(occupancy, origin, ports, {
    degrees,
    margin: 1,
    maxMeters,
    maxExpansions: 250_000,
    maxGoals: goalPool,
    maxResults,
    rings,
    landPolygons: landPolygonsFromSource(
      land as FlatGeobufSource<Feature<Polygon | MultiPolygon>>,
    ),
    trace: options?.trace ?? false,
    cancelled: () => deadline != null && Date.now() > deadline,
    onProgress: options?.onProgress,
  });

  const features = result.routes.map((route) => ({
    __id: route.port.id ?? featureId(
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [route.port.lng, route.port.lat] } },
      [route.port.lng, route.port.lat],
    ),
    meters: route.pathMeters,
    properties: route.port.properties ?? {
      ...(route.port.name ? { PORT_NAME: route.port.name } : {}),
      ...(route.port.country ? { COUNTRY: route.port.country } : {}),
    },
    geojsonLine: {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: route.smoothed,
      },
    } satisfies Feature<LineString>,
  }));

  const routed = new Map(features.map((hit) => [hit.__id, hit.meters]));
  const candidates = result.goals.map((goal) => ({
    __id: 0,
    position: [goal.lng, goal.lat] as Position,
    properties: goal.name ? { PORT_NAME: goal.name } : {},
    geodesicMeters: 0,
    meters: undefined as number | undefined,
  }));
  for (const route of result.routes) {
    const candidate = candidates.find(
      (item) => item.properties.PORT_NAME === route.port.name && item.position[0] === route.port.lng,
    );
    if (!candidate) continue;
    candidate.__id = route.port.id ?? 0;
    candidate.meters = route.pathMeters;
    candidate.properties = route.port.properties ?? candidate.properties;
  }

  return {
    features,
    exceededLimit:
      ports.length > features.length || result.stop === "expansions",
    candidates: candidates.map((candidate) => ({
      ...candidate,
      meters: routed.get(candidate.__id) ?? candidate.meters,
    })),
  };
}
