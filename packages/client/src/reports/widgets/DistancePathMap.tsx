import { useContext, useEffect, useMemo, useRef } from "react";
import { Feature, FeatureCollection, LineString, Point } from "geojson";
import mapboxgl, {
  Expression,
  LngLatBounds,
  Map as MapboxMap,
} from "mapbox-gl";
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
const LAYER_LABEL = "distance-path-label";
const LAYER_DISTANCE = "distance-path-distance";
const LAYER_SHORELINE_HALO = "distance-path-shoreline-halo";
const LAYER_SHORELINE = "distance-path-shoreline";

const PATH_COLOR = "#2563eb";
const SHORELINE_COLOR = "#f97316";
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

/** Same ramp as the route stroke, so a distance label reads as part of its line. */
const PATH_LINE_COLOR: Expression = [
  "match",
  ["get", "rank"],
  1,
  "#7c3aed",
  2,
  "#0f766e",
  3,
  "#b45309",
  PATH_COLOR,
];

function pathCollection(
  paths: Feature<LineString>[],
  labels?: Array<string | null>,
  distances?: Array<string | null>,
  endpoints = true
): FeatureCollection<LineString | Point> {
  const features: Feature<LineString | Point>[] = [];
  let rank = 0;
  for (const path of paths) {
    const coords = unwrapRing(path.geometry.coordinates);
    if (coords.length < 2) continue;
    const name = labels?.[rank]?.trim() ?? "";
    const distance = distances?.[rank]?.trim() ?? "";
    // eslint-disable-next-line i18next/no-literal-string
    const label = name && distance ? `${name}\n${distance}` : name;
    features.push({
      type: "Feature",
      properties: { kind: endpoints ? "path" : "shoreline", rank, distance },
      geometry: { type: "LineString", coordinates: coords },
    });
    rank += 1;
    if (!endpoints) continue;
    features.push({
      type: "Feature",
      properties: { kind: "origin" },
      geometry: { type: "Point", coordinates: coords[0]! },
    });
    features.push({
      type: "Feature",
      properties: { kind: "destination", label },
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

const FIT_PADDING = 40;

function fitMap(map: MapboxMap, bounds: LngLatBounds, paddingTop = FIT_PADDING) {
  map.resize();
  map.fitBounds(bounds, {
    padding: {
      top: paddingTop,
      bottom: FIT_PADDING,
      left: FIT_PADDING,
      right: FIT_PADDING,
    },
    duration: 0,
    maxZoom: 12,
  });
}

/** Identity of the route geometry and labels. Parent widgets rebuild these arrays every render. */
function pathSignature(
  paths: Feature<LineString>[],
  labels?: Array<string | null>,
  distances?: Array<string | null>
): string {
  let signature = "";
  for (let i = 0; i < paths.length; i++) {
    signature += `${labels?.[i] ?? ""}:${distances?.[i] ?? ""}:`;
    const coords = paths[i]?.geometry?.coordinates;
    if (coords) {
      for (const coord of coords) {
        signature += `${coord[0]},${coord[1]};`;
      }
    }
    signature += "|";
  }
  return signature;
}

function boundsSignature(bounds: LngLatBounds | null): string | null {
  if (!bounds || bounds.isEmpty()) return null;
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
}

function usePathCollection(
  paths: Feature<LineString>[],
  labels?: Array<string | null>,
  distances?: Array<string | null>,
  endpoints = true
) {
  const key = `${endpoints ? "1" : "0"}:${pathSignature(paths, labels, distances)}`;
  const cache = useRef<{
    key: string;
    collection: FeatureCollection<LineString | Point>;
  } | null>(null);
  if (!cache.current || cache.current.key !== key) {
    cache.current = {
      key,
      collection: pathCollection(paths, labels, distances, endpoints),
    };
  }
  return cache.current.collection;
}

/**
 * Report widgets are HTML-draggable so they can be reordered in the editor.
 * A drag that starts on the map has to pan the map instead of moving the widget.
 */
function keepMapPan(container: HTMLElement) {
  const suppressWidgetDrag = (event: Event) => {
    if (event instanceof MouseEvent && event.button !== 0) return;
    // Mouse gestures also emit pointerdown. Handling that first clears
    // draggable, and the editor's later mousedown turns it back on.
    if (
      event.type === "pointerdown" &&
      event instanceof PointerEvent &&
      event.pointerType === "mouse"
    ) {
      return;
    }
    const widget = container.closest("[draggable='true']");
    if (!(widget instanceof HTMLElement)) return;
    widget.draggable = false;
    if (event.type === "mousedown") event.preventDefault();
    event.stopPropagation();
    const restore = () => {
      widget.draggable = true;
      window.removeEventListener("pointerup", restore, true);
      window.removeEventListener("pointercancel", restore, true);
      window.removeEventListener("mouseup", restore, true);
    };
    window.addEventListener("pointerup", restore, true);
    window.addEventListener("pointercancel", restore, true);
    window.addEventListener("mouseup", restore, true);
  };
  container.addEventListener("pointerdown", suppressWidgetDrag);
  container.addEventListener("mousedown", suppressWidgetDrag);
  return () => {
    container.removeEventListener("pointerdown", suppressWidgetDrag);
    container.removeEventListener("mousedown", suppressWidgetDrag);
  };
}

export function DistancePathMap({
  paths,
  labels,
  distances,
  emptyMessage,
  caption,
  sketchGeojsonUrl,
  basemap = "streets",
  fitPaddingTop = FIT_PADDING,
  heightClass = "h-56",
  endpoints = true,
}: {
  paths: Feature<LineString>[];
  /** Name drawn at each path's destination, in the same order as `paths`. */
  labels?: Array<string | null>;
  /** Distance drawn at the middle of each path, in the same order as `paths`. */
  distances?: Array<string | null>;
  emptyMessage: string;
  caption?: string;
  /** Existing `/sketches/:id.geojson.json` URL. Mapbox fetches it; not stored on the metric. */
  sketchGeojsonUrl?: string | null;
  basemap?: DistancePathBasemap;
  /**
   * Top inset for the initial fit. Larger when a control overlays the map,
   * so routes are placed in the visible area below it.
   */
  fitPaddingTop?: number;
  /** Tailwind height for the map canvas. Defaults to `h-56`. */
  heightClass?: string;
  /** Draw origin and destination dots. Off for a shoreline intersection. */
  endpoints?: boolean;
}) {
  const { t } = useTranslation("reports");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const { printing } = useContext(ReportUIStateContext);

  const collection = usePathCollection(paths, labels, distances, endpoints);
  const bounds = useMemo(() => boundsForCollection(collection), [collection]);
  const boundsKey = boundsSignature(bounds);
  const collectionRef = useRef(collection);
  const boundsRef = useRef(bounds);
  collectionRef.current = collection;
  boundsRef.current = bounds;
  const fitPaddingTopRef = useRef(fitPaddingTop);
  fitPaddingTopRef.current = fitPaddingTop;

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
      renderWorldCopies: true,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    mapRef.current = map;
    const releaseMapPan = keepMapPan(el);

    let fittedToSize = false;
    const fitIfSized = () => {
      const nextBounds = boundsRef.current;
      if (el.clientWidth > 0 && nextBounds) {
        fitMap(map, nextBounds, fitPaddingTopRef.current);
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
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: collectionRef.current,
      });
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
          "line-color": PATH_LINE_COLOR,
          "line-width": 3,
        },
      });
      map.addLayer({
        id: LAYER_DISTANCE,
        type: "symbol",
        source: SOURCE_ID,
        filter: [
          "all",
          ["==", ["get", "kind"], "path"],
          ["!=", ["get", "distance"], ""],
        ],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 220,
          "text-field": ["get", "distance"],
          "text-size": 11,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-rotation-alignment": "map",
          "text-pitch-alignment": "viewport",
          // "text-keep-upright": true,
          "text-max-angle": 45,
          "text-padding": 2,
          "text-optional": true,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: {
          "text-color": PATH_LINE_COLOR,
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.6,
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
      map.addLayer({
        id: LAYER_LABEL,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "destination"],
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, 0.85],
          "text-anchor": "top",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-optional": true,
        },
        paint: {
          "text-color": "#111827",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      });
      map.addLayer({
        id: LAYER_SHORELINE_HALO,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "shoreline"],
        paint: {
          "line-color": "#ffffff",
          "line-width": 9,
          "line-opacity": 1,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });
      map.addLayer({
        id: LAYER_SHORELINE,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "shoreline"],
        paint: {
          "line-color": SHORELINE_COLOR,
          "line-width": 5,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
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
      releaseMapPan();
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
    const source = map.getSource(SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData(collection);
    }
  }, [collection]);

  // Fit when the route extent changes, and again when print layout or the
  // overlay inset changes. Same-extent re-renders must leave the camera alone.
  useEffect(() => {
    const map = mapRef.current;
    const nextBounds = boundsRef.current;
    if (!map || !nextBounds) return;
    map.resize();
    fitMap(map, nextBounds, fitPaddingTopRef.current);
  }, [printing, boundsKey, fitPaddingTop]);

  if (!TOKEN) {
    return (
      <div className={`my-2 flex ${heightClass} items-center justify-center rounded border border-gray-200 bg-slate-50 px-3 text-center text-sm text-gray-600`}>
        {t("Map is unavailable.")}
      </div>
    );
  }

  if (!bounds) {
    return (
      <div className={`my-2 flex ${heightClass} items-center justify-center rounded border border-gray-200 bg-slate-50 px-3 text-center text-sm text-gray-600`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="my-2">
      <div
        ref={containerRef}
        className={`${heightClass} w-full overflow-hidden rounded border border-gray-200 [&_.mapboxgl-ctrl-logo]:hidden`}
      />
      {caption ? (
        <div className="mt-1.5 whitespace-pre-line text-center text-sm text-gray-700">
          {caption}
        </div>
      ) : null}
    </div>
  );
}
