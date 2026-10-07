import { useContext, useEffect, useMemo, useRef } from "react";
import { Feature, FeatureCollection, LineString, Point } from "geojson";
import mapboxgl, { LngLatBounds, Map as MapboxMap } from "mapbox-gl";
import { useTranslation } from "react-i18next";
import { ReportUIStateContext } from "../context/ReportUIStateContext";

const TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
if (TOKEN) {
  mapboxgl.accessToken = TOKEN;
}

const SOURCE_ID = "distance-path";
const SKETCH_SOURCE_ID = "distance-path-sketch";
const LAYER_SKETCH_FILL = "distance-path-sketch-fill";
const LAYER_SKETCH_LINE = "distance-path-sketch-line";
const LAYER_CASING = "distance-path-casing";
const LAYER_LINE = "distance-path";
const LAYER_ORIGIN = "distance-path-origin";
const LAYER_DEST = "distance-path-dest";

const PATH_COLOR = "#2563eb";
const ORIGIN_COLOR = "#0f172a";
const DEST_COLOR = "#dc2626";
/** Light outline so the sketch stays visible on dark satellite imagery. */
const SATELLITE_SKETCH_COLOR = "#ffffff";

export type DistancePathBasemap = "light" | "streets" | "satellite";

const BASEMAP_STYLES: Record<DistancePathBasemap, string> = {
  light: "mapbox://styles/mapbox/light-v11",
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

export function isDistancePathBasemap(
  value: unknown
): value is DistancePathBasemap {
  return value === "light" || value === "streets" || value === "satellite";
}

function unwrapRing(coords: number[][]): number[][] {
  if (coords.length === 0) return coords;
  const out: number[][] = [[coords[0]![0], coords[0]![1]]];
  for (let i = 1; i < coords.length; i++) {
    let lng = coords[i]![0];
    const prev = out[i - 1]![0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, coords[i]![1]]);
  }
  return out;
}

function pathCollection(
  paths: Feature<LineString>[]
): FeatureCollection<LineString | Point> {
  const features: Feature<LineString | Point>[] = [];
  for (const path of paths) {
    const coords = unwrapRing(path.geometry.coordinates);
    if (coords.length < 2) continue;
    features.push({
      type: "Feature",
      properties: { kind: "path" },
      geometry: { type: "LineString", coordinates: coords },
    });
    features.push({
      type: "Feature",
      properties: { kind: "origin" },
      geometry: { type: "Point", coordinates: coords[0]! },
    });
    features.push({
      type: "Feature",
      properties: { kind: "destination" },
      geometry: { type: "Point", coordinates: coords[coords.length - 1]! },
    });
  }
  return { type: "FeatureCollection", features };
}

function boundsForCollection(
  collection: FeatureCollection<LineString | Point>
): LngLatBounds | null {
  const bounds = new LngLatBounds();
  let any = false;
  for (const f of collection.features) {
    if (f.geometry.type === "Point") {
      bounds.extend(f.geometry.coordinates as [number, number]);
      any = true;
    } else {
      for (const c of f.geometry.coordinates) {
        bounds.extend(c as [number, number]);
        any = true;
      }
    }
  }
  return any ? bounds : null;
}

function fitMap(map: MapboxMap, bounds: LngLatBounds) {
  map.resize();
  map.fitBounds(bounds, {
    padding: 40,
    duration: 0,
    maxZoom: 12,
  });
}

export function DistancePathMap({
  paths,
  emptyMessage,
  caption,
  sketchGeojsonUrl,
  basemap = "streets",
}: {
  paths: Feature<LineString>[];
  emptyMessage: string;
  caption?: string;
  /** Existing `/sketches/:id.geojson.json` URL. Mapbox fetches it; not stored on the metric. */
  sketchGeojsonUrl?: string | null;
  basemap?: DistancePathBasemap;
}) {
  const { t } = useTranslation("reports");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const { printing } = useContext(ReportUIStateContext);

  const collection = useMemo(() => pathCollection(paths), [paths]);
  const bounds = useMemo(() => boundsForCollection(collection), [collection]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !TOKEN || !bounds) {
      return;
    }

    const map = new mapboxgl.Map({
      container: el,
      style: BASEMAP_STYLES[basemap],
      attributionControl: false,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      renderWorldCopies: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    mapRef.current = map;

    let fittedToSize = false;
    const fitIfSized = () => {
      if (el.clientWidth > 0 && bounds) {
        fitMap(map, bounds);
        fittedToSize = true;
      }
    };

    const onLoad = () => {
      if (sketchGeojsonUrl) {
        const sketchColor =
          basemap === "satellite" ? SATELLITE_SKETCH_COLOR : ORIGIN_COLOR;
        map.addSource(SKETCH_SOURCE_ID, {
          type: "geojson",
          data: sketchGeojsonUrl,
        });
        map.addLayer({
          id: LAYER_SKETCH_FILL,
          type: "fill",
          source: SKETCH_SOURCE_ID,
          filter: [
            "match",
            ["geometry-type"],
            ["Polygon", "MultiPolygon"],
            true,
            false,
          ],
          paint: {
            "fill-color": sketchColor,
            "fill-opacity": basemap === "satellite" ? 0.18 : 0.15,
          },
        });
        map.addLayer({
          id: LAYER_SKETCH_LINE,
          type: "line",
          source: SKETCH_SOURCE_ID,
          paint: {
            "line-color": sketchColor,
            "line-width": basemap === "satellite" ? 2 : 1.5,
            "line-opacity": basemap === "satellite" ? 0.95 : 0.85,
          },
        });
      }
      map.addSource(SOURCE_ID, { type: "geojson", data: collection });
      map.addLayer({
        id: LAYER_CASING,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "path"],
        paint: {
          "line-color": "#ffffff",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: LAYER_LINE,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "path"],
        paint: {
          "line-color": PATH_COLOR,
          "line-width": 3,
        },
      });
      map.addLayer({
        id: LAYER_ORIGIN,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "origin"],
        paint: {
          "circle-radius": 5,
          "circle-color": ORIGIN_COLOR,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: LAYER_DEST,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "destination"],
        paint: {
          "circle-radius": 5,
          "circle-color": DEST_COLOR,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.resize();
      fitIfSized();
    };
    map.on("load", onLoad);

    const observer = new ResizeObserver(() => {
      const current = mapRef.current;
      if (!current) return;
      current.resize();
      if (!fittedToSize) {
        fitIfSized();
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      map.off("load", onLoad);
      map.remove();
      mapRef.current = null;
    };
    // collection is applied in a separate effect after load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(bounds), Boolean(TOKEN), sketchGeojsonUrl, basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(collection);
    }
    if (bounds) {
      fitMap(map, bounds);
    }
  }, [collection, bounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    map.resize();
    fitMap(map, bounds);
  }, [printing, bounds]);

  if (!TOKEN) {
    return (
      <div className="my-2 flex h-56 items-center justify-center rounded border border-gray-200 bg-slate-50 px-3 text-center text-sm text-gray-600">
        {t("Map is unavailable.")}
      </div>
    );
  }

  if (!bounds) {
    return (
      <div className="my-2 flex h-56 items-center justify-center rounded border border-gray-200 bg-slate-50 px-3 text-center text-sm text-gray-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="my-2">
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded border border-gray-200 [&_.mapboxgl-ctrl-logo]:hidden"
      />
      {caption ? (
        <div className="mt-1.5 text-center text-sm text-gray-700">{caption}</div>
      ) : null}
    </div>
  );
}
