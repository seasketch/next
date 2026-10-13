import { ReactNode, useContext, useEffect, useMemo, useRef } from "react";
import { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";
import mapboxgl, { LngLatBounds, Map as MapboxMap } from "mapbox-gl";
import { useTranslation } from "react-i18next";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { shiftLongitudesToShortArc } from "./distancePathBounds";
import {
  DEFAULT_SHORELINE_OVERLAP_COLOR,
  DISTANCE_PATH_SOURCE_ID,
  distancePathReportStyle,
  shorelineOverlapColor,
} from "./distancePathStyle";

const TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
if (TOKEN) {
  mapboxgl.accessToken = TOKEN;
}

const SOURCE_ID = DISTANCE_PATH_SOURCE_ID;
const SEARCH_AREA_SOURCE_ID = "distance-search-area";
const EMPTY_SEARCH_AREA: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [],
};

/** Buffer outline under the sketch. Cleared when the search found routes. */
function syncSearchArea(
  map: MapboxMap,
  area: FeatureCollection<Polygon> | null
) {
  const data = area && area.features.length > 0 ? area : EMPTY_SEARCH_AREA;
  const existing = map.getSource(SEARCH_AREA_SOURCE_ID);
  if (existing && existing.type === "geojson") {
    existing.setData(data);
    return;
  }
  if (data.features.length === 0) return;
  const before = map.getLayer("distance-path-sketch-fill")
    ? "distance-path-sketch-fill"
    : map.getLayer("distance-path-casing")
      ? "distance-path-casing"
      : undefined;
  map.addSource(SEARCH_AREA_SOURCE_ID, { type: "geojson", data });
  map.addLayer(
    {
      id: "distance-search-area-fill",
      type: "fill",
      source: SEARCH_AREA_SOURCE_ID,
      paint: {
        "fill-color": "#2563eb",
        "fill-opacity": 0.14,
      },
    },
    before
  );
  map.addLayer(
    {
      id: "distance-search-area-casing",
      type: "line",
      source: SEARCH_AREA_SOURCE_ID,
      paint: {
        "line-color": "#ffffff",
        "line-width": 3,
        "line-opacity": 0.9,
      },
    },
    before
  );
  map.addLayer(
    {
      id: "distance-search-area-line",
      type: "line",
      source: SEARCH_AREA_SOURCE_ID,
      paint: {
        "line-color": "#2563eb",
        "line-width": 1.5,
        "line-opacity": 0.85,
        "line-dasharray": [2, 1.5],
      },
    },
    before
  );
}

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

/**
 * Place name, plus each distance on its own line when one or two routes end
 * there. More than two routes leave the name alone; those distances stay on
 * the lines.
 */
export function destinationLocationLabel(
  name: string,
  distances: string[]
): string {
  if (!name) return "";
  const lines = distances.map((distance) => distance.trim()).filter(Boolean);
  if (lines.length === 0 || lines.length > 2) return name;
  lines.sort((a, b) => distanceMagnitude(a) - distanceMagnitude(b));
  // eslint-disable-next-line i18next/no-literal-string
  return [name, ...lines].join("\n");
}

function distanceMagnitude(distance: string): number {
  const match = distance.replace(/,/g, "").match(/[\d.]+/);
  const value = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function pathCollection(
  paths: Feature<LineString>[],
  labels?: Array<string | null>,
  distances?: Array<string | null>,
  endpoints: boolean | boolean[] = true
): FeatureCollection<LineString | Point> {
  const drawn: {
    coords: number[][];
    name: string;
    distance: string;
    endpoints: boolean;
  }[] = [];
  for (let index = 0; index < paths.length; index++) {
    const coords = unwrapRing(paths[index]!.geometry.coordinates);
    if (coords.length < 2) continue;
    drawn.push({
      coords,
      name: labels?.[index]?.trim() ?? "",
      distance: distances?.[index]?.trim() ?? "",
      endpoints: Array.isArray(endpoints)
        ? endpoints[index] !== false
        : endpoints,
    });
  }
  const distancesByLocation = new Map<string, string[]>();
  for (const entry of drawn) {
    if (!entry.name || !entry.distance) continue;
    const list = distancesByLocation.get(entry.name) ?? [];
    list.push(entry.distance);
    distancesByLocation.set(entry.name, list);
  }
  const labeledLocations = new Set<string>();

  const features: Feature<LineString | Point>[] = [];
  for (let i = 0; i < drawn.length; i++) {
    const entry = drawn[i]!;
    const { coords, name, distance } = entry;
    // Place names are shared across routes, so one label carries their
    // distances. A label with no route distance, such as a shore distance,
    // stays on every line.
    const sharedPlace = distancesByLocation.has(name);
    let label = "";
    if (name && (!sharedPlace || !labeledLocations.has(name))) {
      label = destinationLocationLabel(
        name,
        distancesByLocation.get(name) ?? []
      );
      if (sharedPlace) labeledLocations.add(name);
    }
    features.push({
      type: "Feature",
      properties: {
        kind: entry.endpoints ? "path" : "shoreline",
        rank: i,
        distance,
      },
      geometry: { type: "LineString", coordinates: coords },
    });
    if (!entry.endpoints) {
      if (name) {
        features.push({
          type: "Feature",
          properties: { kind: "shoreline-label", label: name },
          geometry: {
            type: "Point",
            coordinates: coords[Math.floor((coords.length - 1) / 2)]!,
          },
        });
      }
      continue;
    }
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

export function boundsForCollection(
  collection: FeatureCollection<LineString | Point>
): LngLatBounds | null {
  const points: Array<[number, number]> = [];
  for (const f of collection.features) {
    if (f.geometry.type === "Point") {
      const c = f.geometry.coordinates;
      points.push([c[0]!, c[1]!]);
    } else {
      for (const c of f.geometry.coordinates) {
        points.push([c[0]!, c[1]!]);
      }
    }
  }
  if (points.length === 0) return null;
  const bounds = new LngLatBounds();
  for (const point of shiftLongitudesToShortArc(points)) {
    bounds.extend(point);
  }
  return bounds;
}

export const FIT_PADDING = 40;

function fitMap(
  map: MapboxMap,
  bounds: LngLatBounds,
  paddingTop = FIT_PADDING,
  paddingBottom = FIT_PADDING
) {
  map.resize();
  map.fitBounds(bounds, {
    padding: {
      top: paddingTop,
      bottom: paddingBottom,
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

export function usePathCollection(
  paths: Feature<LineString>[],
  labels?: Array<string | null>,
  distances?: Array<string | null>,
  endpoints: boolean | boolean[] = true
) {
  const endpointKey = Array.isArray(endpoints)
    ? endpoints.map((value) => (value ? "1" : "0")).join("")
    : endpoints
    ? "1"
    : "0";
  const key = `${endpointKey}:${pathSignature(paths, labels, distances)}`;
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
  shorelineColor = DEFAULT_SHORELINE_OVERLAP_COLOR,
  fitPaddingTop = FIT_PADDING,
  fitPaddingBottom = FIT_PADDING,
  heightClass = "h-56",
  endpoints = true,
  interactive = true,
  overlay = null,
  searchFrame = null,
  searchArea = null,
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
  /** Stroke and label color for a shoreline overlap. Defaults to orange. */
  shorelineColor?: string;
  /**
   * Top inset for the initial fit. Larger when a control overlays the map,
   * so routes are placed in the visible area below it.
   */
  fitPaddingTop?: number;
  /** Bottom inset. Larger when a control overlays the bottom of the map. */
  fitPaddingBottom?: number;
  /** Tailwind height for the map canvas. Defaults to `h-56`. */
  heightClass?: string;
  /** Draw origin and destination dots. Off for a shoreline intersection. An array sets this per path, in the same order as `paths`. */
  endpoints?: boolean | boolean[];
  /** False while the same layers are showing on the project map. */
  interactive?: boolean;
  /** Control drawn over the map canvas, above the inactive treatment. */
  overlay?: ReactNode;
  /**
   * Southwest and northeast corners used when there are no routes, so the map
   * can still frame the sketch. The empty message is drawn over that map.
   */
  searchFrame?: [[number, number], [number, number]] | null;
  /** Simplified sketch buffered by the search limit. Drawn under the sketch. */
  searchArea?: FeatureCollection<Polygon> | null;
}) {
  const { t } = useTranslation("reports");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const { printing } = useContext(ReportUIStateContext);

  const collection = usePathCollection(paths, labels, distances, endpoints);
  const pathBounds = useMemo(
    () => boundsForCollection(collection),
    [collection]
  );
  const frameBounds = useMemo(() => {
    if (!searchFrame) return null;
    const next = new LngLatBounds();
    next.extend(searchFrame[0]);
    next.extend(searchFrame[1]);
    return next.isEmpty() ? null : next;
  }, [searchFrame]);
  const bounds = pathBounds ?? frameBounds;
  const showEmptyNote = pathBounds == null && frameBounds != null;
  const boundsKey = boundsSignature(bounds);
  const hasBounds = Boolean(bounds);
  const collectionRef = useRef(collection);
  const boundsRef = useRef(bounds);
  collectionRef.current = collection;
  boundsRef.current = bounds;
  const fitPaddingTopRef = useRef(fitPaddingTop);
  const fitPaddingBottomRef = useRef(fitPaddingBottom);
  fitPaddingTopRef.current = fitPaddingTop;
  fitPaddingBottomRef.current = fitPaddingBottom;
  const shorelineColorRef = useRef(shorelineOverlapColor(shorelineColor));
  shorelineColorRef.current = shorelineOverlapColor(shorelineColor);
  const searchAreaRef = useRef(searchArea);
  searchAreaRef.current = searchArea;

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
        fitMap(
          map,
          nextBounds,
          fitPaddingTopRef.current,
          fitPaddingBottomRef.current
        );
        fittedToSize = true;
      }
    };

    const onLoad = () => {
      const style = distancePathReportStyle({
        collection: collectionRef.current,
        sketchGeojsonUrl,
        basemap,
        shorelineColor: shorelineColorRef.current,
      });
      for (const [id, source] of Object.entries(style.sources)) {
        map.addSource(id, source);
      }
      for (const layer of style.layers) {
        map.addLayer(layer);
      }
      syncSearchArea(map, searchAreaRef.current);
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
    const color = shorelineOverlapColor(shorelineColor);
    if (map.getLayer("distance-path-shoreline")) {
      map.setPaintProperty("distance-path-shoreline", "line-color", color);
    }
    if (map.getLayer("distance-path-shoreline-label")) {
      map.setPaintProperty(
        "distance-path-shoreline-label",
        "text-color",
        color
      );
    }
  }, [shorelineColor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncSearchArea(map, searchArea);
  }, [searchArea, hasBounds]);

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
    fitMap(
      map,
      nextBounds,
      fitPaddingTopRef.current,
      fitPaddingBottomRef.current
    );
  }, [printing, boundsKey, fitPaddingTop, fitPaddingBottom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const controls = [
      map.scrollZoom,
      map.boxZoom,
      map.dragPan,
      map.doubleClickZoom,
      map.keyboard,
    ];
    if (interactive) {
      controls.forEach((control) => control.enable());
    } else {
      controls.forEach((control) => control.disable());
    }
  }, [interactive, hasBounds]);

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
      <div className={`relative ${heightClass}`}>
        <div
          ref={containerRef}
          data-distance-map=""
          className={`h-full w-full overflow-hidden rounded border border-gray-200 [&_.mapboxgl-ctrl-logo]:hidden${
            interactive ? "" : " pointer-events-none grayscale opacity-60"
          }`}
        />
        {showEmptyNote ? (
          <div className="pointer-events-none absolute inset-x-4 top-1/2 z-10 flex -translate-y-1/2 justify-center">
            <p className="max-w-sm rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-center text-sm leading-snug text-gray-800 shadow-sm backdrop-blur-[12px]">
              {emptyMessage}
            </p>
          </div>
        ) : null}
        {overlay}
      </div>
      {caption ? (
        <div className="mt-1.5 whitespace-pre-line text-center text-sm text-gray-700">
          {caption}
        </div>
      ) : null}
    </div>
  );
}
