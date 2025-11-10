import { Trans, useTranslation } from "react-i18next";
import AddRemoteServiceMapModal from "./AddRemoteServiceMapModal";
import { useCallback, useEffect, useRef, useState } from "react";
import { Map } from "mapbox-gl";
import Switch from "../../components/Switch";
import Warning from "../../components/Warning";
import INaturalistProjectAutocomplete from "./INaturalistProjectAutocomplete";
import INaturalistTaxonAutocomplete from "./INaturalistTaxonAutocomplete";

// Zoom level cutoff for switching between grid/heatmap and points layers
// Grid/heatmap layers are shown below this zoom, points layers at this zoom and above
const DEFAULT_ZOOM_CUTOFF = 9;
const MIN_ZOOM_CUTOFF = 3;
const MAX_ZOOM_CUTOFF = 13;

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

interface INaturalistLayerConfig {
  projectId: string | null;
  taxonIds: number[];
  d1: string | null;
  d2: string | null;
  verifiable: boolean;
  useCustomColor: boolean;
  color: string | null;
  type: LayerType;
  zoomCutoff: number;
}

export default function AddINaturalistLayerModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const [map, setMap] = useState<Map | null>(null);

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
  });

  const [selectedProject, setSelectedProject] = useState<ProjectResult | null>(
    null
  );
  const [selectedTaxa, setSelectedTaxa] = useState<TaxonResult[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentSourceIds = useRef<string[]>([]);
  const currentLayerIds = useRef<string[]>([]);

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
        maxzoom: 16,
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
        maxzoom: 16,
      });
      map.addLayer({
        id: pointsLayerId,
        type: "raster",
        source: pointsSourceId,
        minzoom: config.zoomCutoff,
        maxzoom: 18,
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
        maxzoom: 16,
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
        maxzoom: 16,
      });
      map.addLayer({
        id: pointsLayerId,
        type: "raster",
        source: pointsSourceId,
        minzoom: config.zoomCutoff,
        maxzoom: 18,
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
      });

      // Add layer
      map.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
        minzoom: 0,
        maxzoom: 18,
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
  }, []);

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
    };

    console.log("iNaturalist Layer Configuration:", layerConfig);
    // TODO: Replace with GraphQL mutation when backend is ready
    onRequestClose();
  };

  const canSave = config.projectId !== null || config.taxonIds.length > 0;

  return (
    <AddRemoteServiceMapModal
      title={t("Add iNaturalist Layer")}
      onRequestClose={onRequestClose}
      onMapLoad={handleMapLoad}
      basemap="google-earth"
    >
      <div className="flex flex-col h-full">
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <p className="text-sm">
            <Trans ns="admin:data">
              Select at least one project or taxa to create a layer of
              iNaturalist observations. Adjust options to update the preview
              layer on the map. Click save when you are ready to add this layer
              to your project's Overlay Layers list.
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

            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium leading-5 text-gray-800">
                <Trans ns="admin:data">Show only verifiable observations</Trans>
              </label>
              <Switch
                isToggled={config.verifiable}
                onClick={(val) =>
                  setConfig((prev) => ({ ...prev, verifiable: val }))
                }
              />
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
            {t("Save Layer")}
          </button>
        </div>
      </div>
    </AddRemoteServiceMapModal>
  );
}
