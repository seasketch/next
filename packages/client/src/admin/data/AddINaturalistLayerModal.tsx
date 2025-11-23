import { Trans, useTranslation } from "react-i18next";
import AddRemoteServiceMapModal from "./AddRemoteServiceMapModal";
import { useCallback, useEffect, useRef, useState } from "react";
import { Map, Popup } from "mapbox-gl";
import Switch from "../../components/Switch";
import Warning from "../../components/Warning";
import INaturalistProjectAutocomplete from "./INaturalistProjectAutocomplete";
import INaturalistTaxonAutocomplete from "./INaturalistTaxonAutocomplete";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { useLocalForage } from "../../useLocalForage";
import INaturalistLegendContent from "../../dataLayers/legends/INaturalistLegendContent";
import INaturalistProjectCallToAction from "./INaturalistProjectCallToAction";

// Zoom level cutoff for switching between grid/heatmap and points layers
// Grid/heatmap layers are shown below this zoom, points layers at this zoom and above
const DEFAULT_ZOOM_CUTOFF = 9;
const MIN_ZOOM_CUTOFF = 3;
const MAX_ZOOM_CUTOFF = 13;
const RASTER_SOURCE_MAX_ZOOM = 18;
const RASTER_LAYER_MAX_ZOOM = 20;

interface ProjectResult {
  id: number;
  title: string;
  description?: string;
  icon?: string;
  slug?: string;
}

interface TaxonResult {
  id: number;
  name: string;
  preferred_common_name?: string;
  default_photo?: {
    square_url?: string;
    medium_url?: string;
  };
}

type LayerType =
  | "grid+points"
  | "points"
  | "grid"
  | "heatmap"
  | "heatmap+points";

type INaturalistLayerConfig = {
  projectId: string | null;
  taxonIds: number[];
  d1: string | null;
  d2: string | null;
  verifiable: boolean;
  useCustomColor: boolean;
  color: string | null;
  type: LayerType;
  zoomCutoff: number;
  showCallToAction: boolean;
};

const INATURALIST_LEGEND_STATE_KEY = "inaturalist-legend-collapsed";

export default function AddINaturalistLayerModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const [map, setMap] = useState<Map | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);

  const [config, setConfig] = useState<INaturalistLayerConfig>({
    projectId: null,
    taxonIds: [],
    d1: null,
    d2: null,
    verifiable: true,
    useCustomColor: false,
    color: null,
    type: "grid+points",
    zoomCutoff: DEFAULT_ZOOM_CUTOFF,
    showCallToAction: false,
  });

  const [selectedProject, setSelectedProject] = useState<ProjectResult | null>(
    null
  );
  const [selectedTaxa, setSelectedTaxa] = useState<TaxonResult[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentSourceIds = useRef<string[]>([]);
  const currentLayerIds = useRef<string[]>([]);
  const currentPopupRef = useRef<Popup | null>(null);
  const currentPopupDatasetRef = useRef<"grid" | "points" | null>(null);
  const utfgridCacheRef = useRef<
    Record<
      string,
      { grid: string[]; keys: string[]; data: Record<string, any> }
    >
  >({});
  const lastTileKeyRef = useRef<string | null>(null);
  const configRef = useRef<INaturalistLayerConfig>(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Build tile URL template based on configuration and layer type
  const buildTileUrl = useCallback(
    (layerType: LayerType): string => {
      const baseUrl = "https://api.inaturalist.org/v1";
      let endpointType = layerType;

      // Map layer types to API endpoint types
      if (layerType === "grid+points") {
        // This shouldn't be called directly for grid+points
        endpointType = "grid";
      } else if (layerType === "heatmap+points") {
        // This shouldn't be called directly for heatmap+points
        endpointType = "heatmap";
      }

      // Build query parameters
      const params: string[] = [];
      if (config.projectId) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`project_id=${encodeURIComponent(config.projectId)}`);
      }

      if (config.taxonIds.length > 0) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`taxon_id=${config.taxonIds.join(",")}`);
      }

      if (config.d1) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`d1=${encodeURIComponent(config.d1)}`);
      }

      if (config.d2) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`d2=${encodeURIComponent(config.d2)}`);
      }

      if (config.verifiable) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push("verifiable=true");
      }

      if (config.useCustomColor && config.color) {
        // Remove # if present
        const colorValue = config.color.replace("#", "");
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`color=${encodeURIComponent(colorValue)}`);
      }

      // eslint-disable-next-line i18next/no-literal-string
      const queryString = params.length > 0 ? `?${params.join("&")}` : "";
      // eslint-disable-next-line i18next/no-literal-string
      return `${baseUrl}/${endpointType}/{z}/{x}/{y}.png${queryString}`;
    },
    [config]
  );

  // Update map layers when configuration changes
  useEffect(() => {
    if (!map) return;

    // Remove all existing layers and sources
    currentLayerIds.current.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });
    currentSourceIds.current.forEach((sourceId) => {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    });
    currentSourceIds.current = [];
    currentLayerIds.current = [];

    // Validate that at least project or taxon is selected
    if (!config.projectId && config.taxonIds.length === 0) {
      return;
    }

    // Handle grid+points: create two layers (grid below cutoff, points at cutoff and above)
    if (config.type === "grid+points") {
      // eslint-disable-next-line i18next/no-literal-string
      const gridSourceId = "inaturalist-grid-source";
      // eslint-disable-next-line i18next/no-literal-string
      const gridLayerId = "inaturalist-grid-layer";
      // eslint-disable-next-line i18next/no-literal-string
      const pointsSourceId = "inaturalist-points-source";
      // eslint-disable-next-line i18next/no-literal-string
      const pointsLayerId = "inaturalist-points-layer";

      // Add grid source and layer (visible below cutoff zoom)
      map.addSource(gridSourceId, {
        type: "raster",
        tiles: [buildTileUrl("grid")],
        tileSize: 256,
        maxzoom: RASTER_SOURCE_MAX_ZOOM,
        attribution:
          '<a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer">iNaturalist</a>',
      });
      map.addLayer({
        id: gridLayerId,
        type: "raster",
        source: gridSourceId,
        minzoom: 0,
        maxzoom: config.zoomCutoff,
      });

      // Add points source and layer (visible at cutoff zoom and above)
      map.addSource(pointsSourceId, {
        type: "raster",
        tiles: [buildTileUrl("points")],
        tileSize: 256,
        maxzoom: RASTER_SOURCE_MAX_ZOOM,
        attribution:
          '<a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer">iNaturalist</a>',
      });
      map.addLayer({
        id: pointsLayerId,
        type: "raster",
        source: pointsSourceId,
        minzoom: config.zoomCutoff,
        maxzoom: RASTER_LAYER_MAX_ZOOM,
      });

      currentSourceIds.current = [gridSourceId, pointsSourceId];
      currentLayerIds.current = [gridLayerId, pointsLayerId];
    }
    // Handle heatmap+points: create two layers (heatmap below cutoff, points at cutoff and above)
    else if (config.type === "heatmap+points") {
      // eslint-disable-next-line i18next/no-literal-string
      const heatmapSourceId = "inaturalist-heatmap-source";
      // eslint-disable-next-line i18next/no-literal-string
      const heatmapLayerId = "inaturalist-heatmap-layer";
      // eslint-disable-next-line i18next/no-literal-string
      const pointsSourceId = "inaturalist-points-source";
      // eslint-disable-next-line i18next/no-literal-string
      const pointsLayerId = "inaturalist-points-layer";

      // Add heatmap source and layer (visible below cutoff zoom)
      map.addSource(heatmapSourceId, {
        type: "raster",
        tiles: [buildTileUrl("heatmap")],
        tileSize: 256,
        maxzoom: RASTER_SOURCE_MAX_ZOOM,
        attribution:
          '<a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer">iNaturalist</a>',
      });
      map.addLayer({
        id: heatmapLayerId,
        type: "raster",
        source: heatmapSourceId,
        minzoom: 0,
        maxzoom: config.zoomCutoff,
      });

      // Add points source and layer (visible at cutoff zoom and above)
      map.addSource(pointsSourceId, {
        type: "raster",
        tiles: [buildTileUrl("points")],
        tileSize: 256,
        maxzoom: RASTER_SOURCE_MAX_ZOOM,
        attribution:
          '<a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer">iNaturalist</a>',
      });
      map.addLayer({
        id: pointsLayerId,
        type: "raster",
        source: pointsSourceId,
        minzoom: config.zoomCutoff,
        maxzoom: RASTER_LAYER_MAX_ZOOM,
      });

      currentSourceIds.current = [heatmapSourceId, pointsSourceId];
      currentLayerIds.current = [heatmapLayerId, pointsLayerId];
    }
    // Handle single layer types (points, grid, heatmap)
    else {
      // eslint-disable-next-line i18next/no-literal-string
      const sourceId = "inaturalist-layer-source";
      // eslint-disable-next-line i18next/no-literal-string
      const layerId = "inaturalist-layer-raster";

      // Add source
      map.addSource(sourceId, {
        type: "raster",
        tiles: [buildTileUrl(config.type)],
        tileSize: 256,
        maxzoom: 16,
        attribution:
          '<a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer">iNaturalist</a>',
      });

      // Add layer
      map.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
        minzoom: 0,
        maxzoom: RASTER_LAYER_MAX_ZOOM,
      });

      currentSourceIds.current = [sourceId];
      currentLayerIds.current = [layerId];
    }
  }, [map, config, buildTileUrl]);

  // Update config when project/taxa change
  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      projectId:
        selectedProject?.id.toString() || selectedProject?.slug || null,
      taxonIds: selectedTaxa.map((t) => t.id),
    }));
  }, [selectedProject, selectedTaxa]);

  const handleMapLoad = useCallback((loadedMap: Map) => {
    setMap(loadedMap);
    setCurrentZoom(loadedMap.getZoom());
    loadedMap.on("zoomend", () => {
      const zoom = loadedMap.getZoom();
      setCurrentZoom(zoom);
      const cfg = configRef.current;
      if (
        currentPopupRef.current &&
        currentPopupDatasetRef.current === "grid" &&
        (cfg.type === "grid+points" || cfg.type === "heatmap+points") &&
        zoom >= cfg.zoomCutoff
      ) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
        currentPopupDatasetRef.current = null;
      }
    });
  }, []);

  // Attach UTFGrid hover/click interaction for grid and point tiles
  useEffect(() => {
    if (!map) {
      return;
    }

    const getUtfgridDataForEvent = async (
      e: mapboxgl.MapMouseEvent & mapboxgl.EventData
    ): Promise<{
      data: Record<string, any>;
      lngLat: mapboxgl.LngLat;
      dataset: "grid" | "points";
    } | null> => {
      const cfg = configRef.current;

      // UTFGrid should only be active when a layer is actually displayed
      if (!cfg.projectId && cfg.taxonIds.length === 0) {
        return null;
      }
      if (!currentSourceIds.current.length) {
        return null;
      }

      const zoom = Math.floor(map.getZoom());
      let dataset: "grid" | "points" | null = null;

      if (cfg.type === "grid") {
        dataset = "grid";
      } else if (cfg.type === "points") {
        dataset = "points";
      } else if (cfg.type === "grid+points") {
        dataset = zoom < cfg.zoomCutoff ? "grid" : "points";
      } else if (cfg.type === "heatmap+points") {
        // Only points tiles have UTFGrid for heatmap+points
        dataset = zoom >= cfg.zoomCutoff ? "points" : null;
      } else {
        dataset = null;
      }

      if (!dataset) {
        return null;
      }

      const { lng, lat } = e.lngLat;
      const n = 2 ** zoom;
      const latRad = (lat * Math.PI) / 180;
      const xFloat = ((lng + 180) / 360) * n;
      const yFloat =
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
          2) *
        n;

      const xTile = Math.floor(xFloat);
      const yTile = Math.floor(yFloat);
      const xPixel = Math.floor((xFloat - xTile) * 256);
      const yPixel = Math.floor((yFloat - yTile) * 256);

      const params: string[] = [];
      if (cfg.projectId) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`project_id=${encodeURIComponent(cfg.projectId)}`);
      }
      if (cfg.taxonIds.length > 0) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`taxon_id=${cfg.taxonIds.join(",")}`);
      }
      if (cfg.d1) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`d1=${encodeURIComponent(cfg.d1)}`);
      }
      if (cfg.d2) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`d2=${encodeURIComponent(cfg.d2)}`);
      }
      if (cfg.verifiable) {
        // eslint-disable-next-line i18next/no-literal-string
        params.push("verifiable=true");
      }
      if (cfg.useCustomColor && cfg.color) {
        const colorValue = cfg.color.replace("#", "");
        // eslint-disable-next-line i18next/no-literal-string
        params.push(`color=${encodeURIComponent(colorValue)}`);
      }

      // Include filters in cache key so cached UTFGrid data always matches
      // the currently active layer configuration
      const filterKey = [
        cfg.projectId || "",
        cfg.taxonIds.join(","),
        cfg.d1 || "",
        cfg.d2 || "",
        cfg.verifiable ? "1" : "0",
        cfg.useCustomColor && cfg.color ? cfg.color.replace("#", "") : "",
      ].join("|");
      const tileKey = `${dataset}:${zoom}:${xTile}:${yTile}:${filterKey}`;

      // eslint-disable-next-line i18next/no-literal-string
      const baseUrl = "https://api.inaturalist.org/v1";
      // eslint-disable-next-line i18next/no-literal-string
      const queryString = params.length > 0 ? `?${params.join("&")}` : "";
      // eslint-disable-next-line i18next/no-literal-string
      const url = `${baseUrl}/${dataset}/${zoom}/${xTile}/${yTile}.grid.json${queryString}`;

      try {
        let json = utfgridCacheRef.current[tileKey];
        if (!json) {
          const response = await fetch(url);
          if (!response.ok) {
            return null;
          }
          json = (await response.json()) as {
            grid: string[];
            keys: string[];
            data: Record<string, any>;
          };
          if (!json.grid || !json.grid.length || !json.keys) {
            return null;
          }
          utfgridCacheRef.current[tileKey] = json;
        }

        const gridSize = json.grid.length;
        const resolution = 256 / gridSize;
        const row = Math.floor(yPixel / resolution);
        const col = Math.floor(xPixel / resolution);

        if (
          row < 0 ||
          row >= json.grid.length ||
          col < 0 ||
          col >= json.grid[row].length
        ) {
          return null;
        }

        const char = json.grid[row].charAt(col);
        const code = char.charCodeAt(0);
        let idx = code - 32;
        if (code >= 93) {
          idx--;
        }
        if (code >= 35) {
          idx--;
        }

        const key = json.keys[idx];
        const data = key ? json.data[key] : null;
        if (!data) {
          return null;
        }

        lastTileKeyRef.current = tileKey;
        return { data, lngLat: e.lngLat, dataset };
      } catch {
        return null;
      }
    };

    const handleMouseMove = async (
      e: mapboxgl.MapMouseEvent & mapboxgl.EventData
    ) => {
      const result = await getUtfgridDataForEvent(e);
      if (result) {
        map.getCanvas().style.cursor = "pointer";
      } else {
        map.getCanvas().style.cursor = "";
      }
    };

    const handleClick = async (
      e: mapboxgl.MapMouseEvent & mapboxgl.EventData
    ) => {
      const result = await getUtfgridDataForEvent(e);
      if (!result) {
        return;
      }

      const { data, lngLat, dataset } = result;

      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
      }

      const container = document.createElement("div");

      if (dataset === "grid") {
        // Grid popup: solid orange background and a single large count label
        container.style.backgroundColor = "#ff6600";
        container.style.color = "#ffffff";
        container.style.padding = "12px 16px";
        container.style.borderRadius = "4px";
        container.style.textAlign = "center";

        const count =
          (data && typeof data.cellCount === "number" && data.cellCount) ||
          (data && typeof data.cell_count === "number" && data.cell_count);

        const text = document.createElement("div");
        text.style.fontSize = "18px";
        text.style.lineHeight = "1.2";
        text.style.fontWeight = "700";
        const countLabel =
          typeof count === "number"
            ? t("{{count}} Observations", { count })
            : t("Observations");
        text.textContent = countLabel;
        container.appendChild(text);

        // Add zoom hint for grid+points mode
        const cfg = configRef.current;
        if (cfg.type === "grid+points") {
          const hint = document.createElement("div");
          hint.style.fontSize = "12px";
          hint.style.lineHeight = "1.4";
          hint.style.fontWeight = "400";
          hint.style.marginTop = "8px";
          hint.style.opacity = "0.9";
          // eslint-disable-next-line i18next/no-literal-string
          hint.textContent = t("Zoom in to visualize point locations");
          container.appendChild(hint);
        }
      } else {
        // Points popup: rich observation details without extra inner card chrome
        container.className = "text-xs w-80";

        const body = document.createElement("div");
        body.className = "flex space-x-2 max-w-full overflow-hidden";

        const imageWrapper = document.createElement("div");
        imageWrapper.className =
          "w-24 h-24 flex-shrink-0 bg-gray-200 overflow-hidden";
        const imageLink = document.createElement("a");
        imageLink.target = "_blank";
        imageLink.rel = "noopener noreferrer";
        const imageEl = document.createElement("img");
        imageEl.className = "w-full h-full object-cover";
        imageLink.appendChild(imageEl);
        imageWrapper.appendChild(imageLink);

        const content = document.createElement("div");
        content.className = "flex-1 max-w-full overflow-hidden";

        const commonNameLink = document.createElement("a");
        commonNameLink.className =
          "font-semibold text-sm mb-0.5 truncate block";
        commonNameLink.style.color = "inherit";
        commonNameLink.style.textDecoration = "none";
        commonNameLink.target = "_blank";
        commonNameLink.rel = "noopener noreferrer";
        commonNameLink.textContent = t("Loading observation…");

        const scientificNameEl = document.createElement("div");
        scientificNameEl.className =
          "text-xs italic text-gray-700 mb-0.5 truncate";

        const locationEl = document.createElement("div");
        locationEl.className = "text-xs text-gray-700 mb-0.5 truncate";

        const dateEl = document.createElement("div");
        dateEl.className = "text-xs text-gray-500";

        const linkEl = document.createElement("a");
        linkEl.className = "mt-2 inline-block text-xs underline";
        linkEl.style.color = "#74ac00";
        linkEl.target = "_blank";
        linkEl.rel = "noopener noreferrer";

        content.appendChild(commonNameLink);
        content.appendChild(scientificNameEl);
        content.appendChild(locationEl);
        content.appendChild(dateEl);
        content.appendChild(linkEl);

        body.appendChild(imageWrapper);
        body.appendChild(content);
        container.appendChild(body);

        const uuid =
          data && typeof data.uuid === "string" ? data.uuid : undefined;

        if (uuid) {
          // Fetch detailed observation data for nicer popup content
          (async () => {
            try {
              /* eslint-disable i18next/no-literal-string */
              const obsUrl = `https://api.inaturalist.org/v2/observations/${encodeURIComponent(
                uuid
              )}?locale=en-US&fields=(comments_count%3A!t%2Ccreated_at%3A!t%2Ccreated_at_details%3Aall%2Ccreated_time_zone%3A!t%2Cfaves_count%3A!t%2Cgeoprivacy%3A!t%2Cid%3A!t%2Cidentifications%3A(current%3A!t)%2Cidentifications_count%3A!t%2Clocation%3A!t%2Cmappable%3A!t%2Cobscured%3A!t%2Cobserved_on%3A!t%2Cobserved_on_details%3Aall%2Cobserved_time_zone%3A!t%2Cphotos%3A(id%3A!t%2Curl%3A!t)%2Cplace_guess%3A!t%2Cprivate_geojson%3A!t%2Cquality_grade%3A!t%2Csounds%3A(id%3A!t)%2Ctaxon%3A(iconic_taxon_id%3A!t%2Cname%3A!t%2Cpreferred_common_name%3A!t%2Cpreferred_common_names%3A(name%3A!t)%2Crank%3A!t%2Crank_level%3A!t)%2Ctime_observed_at%3A!t%2Cuser%3A(icon_url%3A!t%2Cid%3A!t%2Clogin%3A!t))`;
              /* eslint-enable i18next/no-literal-string */

              const resp = await fetch(obsUrl);
              if (!resp.ok) {
                return;
              }
              const json = (await resp.json()) as {
                results?: any[];
              };
              const obs = json.results && json.results[0];
              if (!obs) {
                return;
              }

              const taxon = obs.taxon || {};
              const commonName: string =
                taxon.preferred_common_name ||
                (Array.isArray(taxon.preferred_common_names) &&
                  taxon.preferred_common_names[0]?.name) ||
                taxon.name ||
                t("Unknown taxon");
              const scientificName: string =
                taxon.name && typeof taxon.name === "string" ? taxon.name : "";

              commonNameLink.textContent = commonName;
              scientificNameEl.textContent = scientificName
                ? `(${scientificName})`
                : "";

              if (obs.place_guess && typeof obs.place_guess === "string") {
                locationEl.textContent = obs.place_guess;
              } else {
                locationEl.textContent = "";
              }

              const dateSource: string | null =
                (obs.observed_on as string | null) ||
                (obs.time_observed_at as string | null) ||
                (obs.created_at as string | null) ||
                null;
              if (dateSource) {
                const date = new Date(dateSource);
                const formatted = date.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                dateEl.textContent = formatted;
              } else {
                dateEl.textContent = "";
              }

              if (Array.isArray(obs.photos) && obs.photos.length > 0) {
                const photo = obs.photos[0];
                if (photo.url && typeof photo.url === "string") {
                  const url: string = photo.url.replace("square", "medium");
                  imageEl.src = url;
                  imageEl.alt = commonName;
                }
              }

              if (typeof obs.id === "number") {
                // eslint-disable-next-line i18next/no-literal-string
                const observationUrl = `https://www.inaturalist.org/observations/${obs.id}`;
                linkEl.href = observationUrl;
                linkEl.textContent = t("View on iNaturalist");
                imageLink.href = observationUrl;
                commonNameLink.href = observationUrl;
              }
            } catch {
              // Ignore errors and leave the basic loading state
            }
          })();
        } else {
          // No uuid available – fall back to simple key/value listing
          container.className = "text-xs";
          container.innerHTML = "";
          const title = document.createElement("div");
          title.className = "font-semibold mb-1";
          title.textContent = "iNaturalist Observations";
          container.appendChild(title);

          const list = document.createElement("dl");
          list.className = "space-y-0.5";
          Object.entries(data).forEach(([k, v]) => {
            const dt = document.createElement("dt");
            dt.className = "font-mono text-gray-600";
            dt.textContent = k;
            const dd = document.createElement("dd");
            dd.className = "text-gray-800 break-words";
            dd.textContent =
              typeof v === "string" ? v : JSON.stringify(v, null, 2);
            list.appendChild(dt);
            list.appendChild(dd);
          });
          container.appendChild(list);
        }
      }

      const popup = new Popup({
        closeButton: true,
        closeOnClick: true,
        className: "!max-w-128",
      })
        .setLngLat(lngLat)
        .setDOMContent(container)
        .addTo(map);

      currentPopupRef.current = popup;
      currentPopupDatasetRef.current = dataset;
    };

    map.on("mousemove", handleMouseMove);
    map.on("click", handleClick);
    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("click", handleClick);
      map.getCanvas().style.cursor = "";
      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
        currentPopupDatasetRef.current = null;
      }
    };
  }, [map, t]);

  const handleSave = () => {
    // Validate
    if (!config.projectId && config.taxonIds.length === 0) {
      setValidationError(
        t("Please select at least one project or taxon to continue.")
      );
      return;
    }

    setValidationError(null);

    // Output configuration object
    const layerConfig = {
      projectId: config.projectId,
      taxonIds: config.taxonIds,
      d1: config.d1,
      d2: config.d2,
      verifiable: config.verifiable,
      color: config.useCustomColor ? config.color : null,
      type: config.type,
      zoomCutoff: config.zoomCutoff,
      showCallToAction: config.showCallToAction,
    };

    // eslint-disable-next-line no-console
    console.log("iNaturalist Layer Configuration:", layerConfig);
    // TODO: Replace with GraphQL mutation when backend is ready
    onRequestClose();
  };

  const canSave = config.projectId !== null || config.taxonIds.length > 0;
  const hasProject = config.projectId !== null;

  let visualizationType: "grid" | "points" | "heatmap" = "grid";
  if (
    config.type === "grid" ||
    config.type === "points" ||
    config.type === "heatmap"
  ) {
    visualizationType = config.type;
  } else {
    const zoom = currentZoom ?? config.zoomCutoff;
    if (config.type === "grid+points") {
      visualizationType = zoom < config.zoomCutoff ? "grid" : "points";
    } else if (config.type === "heatmap+points") {
      visualizationType = zoom < config.zoomCutoff ? "heatmap" : "points";
    }
  }

  return (
    <AddRemoteServiceMapModal
      title={t("Add iNaturalist Layer")}
      onRequestClose={onRequestClose}
      onMapLoad={handleMapLoad}
      basemap="google-earth"
      legendContent={<INaturalistLegend type={visualizationType} />}
      bottomCenterContent={
        config.showCallToAction && config.projectId ? (
          <INaturalistProjectCallToAction projectId={config.projectId} />
        ) : undefined
      }
    >
      <div className="flex flex-col h-full">
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <p className="text-sm">
            <Trans ns="admin:data">
              Select at least one project or taxa to create a layer of{" "}
              <a
                className="text-primary-500 hover:underline"
                href="https://www.inaturalist.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                iNaturalist
              </a>{" "}
              observations. Adjust options to update the preview layer on the
              map. Click save when you are ready to add this layer to your
              project's Overlay Layers list.
            </Trans>
          </p>

          {validationError && (
            <Warning level="error">{validationError}</Warning>
          )}

          <div className="space-y-4">
            <INaturalistProjectAutocomplete
              value={selectedProject}
              onChange={setSelectedProject}
            />

            <INaturalistTaxonAutocomplete
              value={selectedTaxa}
              onChange={setSelectedTaxa}
            />

            <div>
              <label className="block text-sm font-medium leading-5 text-gray-800 mb-1">
                <Trans ns="admin:data">Date Range (optional)</Trans>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={config.d1 || ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      d1: e.target.value || null,
                    }))
                  }
                  className="flex-1 border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
                />
                <span className="text-gray-500">
                  <Trans ns="admin:data">to</Trans>
                </span>
                <input
                  type="date"
                  value={config.d2 || ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      d2: e.target.value || null,
                    }))
                  }
                  min={config.d1 || undefined}
                  className="flex-1 border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-5 text-gray-800 mb-2">
                <Trans ns="admin:data">Layer Presentation</Trans>
              </label>
              <select
                value={config.type}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    type: e.target.value as LayerType,
                  }))
                }
                className="w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
              >
                <option value="grid+points">{t("Grid + Points")}</option>
                <option value="heatmap+points">{t("Heatmap + Points")}</option>
                <option value="points">{t("Points")}</option>
                <option value="grid">{t("Grid")}</option>
                <option value="heatmap">{t("Heatmap")}</option>
              </select>
              {(config.type === "grid+points" ||
                config.type === "heatmap+points") && (
                <div className="mt-3">
                  <label className="block text-sm font-medium leading-5 text-gray-800 mb-2">
                    <Trans ns="admin:data">Point Layer Reveal Zoom Level</Trans>
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min={MIN_ZOOM_CUTOFF}
                      max={MAX_ZOOM_CUTOFF}
                      step="1"
                      value={config.zoomCutoff}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        setConfig((prev) => ({
                          ...prev,
                          zoomCutoff: value,
                        }));
                      }}
                      className="zoom-cutoff-slider flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        // eslint-disable-next-line i18next/no-literal-string
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                          ((config.zoomCutoff - MIN_ZOOM_CUTOFF) /
                            (MAX_ZOOM_CUTOFF - MIN_ZOOM_CUTOFF)) *
                          100
                        }%, #e5e7eb ${
                          ((config.zoomCutoff - MIN_ZOOM_CUTOFF) /
                            (MAX_ZOOM_CUTOFF - MIN_ZOOM_CUTOFF)) *
                          100
                        }%, #e5e7eb 100%)`,
                      }}
                    />
                    <span className="text-sm font-medium text-gray-700 w-8 text-center">
                      {config.zoomCutoff}
                    </span>
                  </div>
                  <style>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    {`.zoom-cutoff-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid #ffffff;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  }
                  .zoom-cutoff-slider::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid #ffffff;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  }
                  .zoom-cutoff-slider:focus {
                    outline: none;
                  }
                  .zoom-cutoff-slider:focus::-webkit-slider-thumb {
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
                  }
                  .zoom-cutoff-slider:focus::-moz-range-thumb {
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
                  }`}
                  </style>
                  <p className="text-xs text-gray-500 mt-1">
                    {config.type === "grid+points" ? (
                      <Trans
                        ns="admin:data"
                        i18nKey="Grid tiles will be shown at zoom levels 0-{{cutoff}}, and point tiles at zoom levels {{cutoffPlus}} and above."
                        values={{
                          cutoff: config.zoomCutoff - 1,
                          cutoffPlus: config.zoomCutoff,
                        }}
                      />
                    ) : (
                      <Trans
                        ns="admin:data"
                        i18nKey="Heatmap tiles will be shown at zoom levels 0-{{cutoff}}, and point tiles at zoom levels {{cutoffPlus}} and above."
                        values={{
                          cutoff: config.zoomCutoff - 1,
                          cutoffPlus: config.zoomCutoff,
                        }}
                      />
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium leading-5 text-gray-800">
                  <Trans ns="admin:data">
                    Show only verifiable observations
                  </Trans>
                </label>
                <Switch
                  isToggled={config.verifiable}
                  onClick={(val) =>
                    setConfig((prev) => ({ ...prev, verifiable: val }))
                  }
                />
              </div>

              <div
                className={`transition-opacity ${
                  !hasProject ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium leading-5 text-gray-800">
                    <Trans ns="admin:data">Show Call to Action</Trans>
                  </label>
                  <Switch
                    isToggled={config.showCallToAction && hasProject}
                    disabled={!hasProject}
                    onClick={(val) => {
                      if (!hasProject) {
                        return;
                      }
                      setConfig((prev) => ({
                        ...prev,
                        showCallToAction: val,
                      }));
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {hasProject ? (
                    <Trans ns="admin:data">
                      If enabled, users will be encouraged to contribute
                      observations to the associated iNaturalist project.
                    </Trans>
                  ) : (
                    <Trans ns="admin:data">
                      Select a project above to enable this option. If enabled,
                      users will be encouraged to contribute observations to the
                      associated iNaturalist project.
                    </Trans>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-100 p-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onRequestClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 border border-transparent rounded-md shadow-sm hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("Add Layer to Project Overlays")}
          </button>
        </div>
      </div>
    </AddRemoteServiceMapModal>
  );
}

function INaturalistLegend({ type }: { type: "grid" | "points" | "heatmap" }) {
  const [hidden, setHidden] = useLocalForage<boolean>(
    INATURALIST_LEGEND_STATE_KEY,
    true,
    true
  );
  return (
    <div className="rounded w-72 shadow text-xs sm:text-sm flex flex-col overflow-hidden bg-white/95 ring-2 ring-black/10">
      <button
        type="button"
        className="flex items-center w-full px-3 py-2 border-b border-black border-opacity-10 bg-gray-50 font-semibold text-gray-800 text-left"
        onClick={() => {
          setHidden((prev) => !prev);
        }}
      >
        <span className="flex-1">
          <Trans ns="admin:data">Map Legend</Trans>
        </span>
        <CaretDownIcon
          className={`w-4 h-4 transform transition-transform ${
            hidden ? "-rotate-90 text-black" : "rotate-0 text-gray-500"
          }`}
          aria-hidden
        />
      </button>
      {!hidden && (
        <div className="p-3 space-y-4 max-h-[360px] overflow-y-auto bg-white/95">
          <INaturalistLegendContent type={type} />
        </div>
      )}
    </div>
  );
}
