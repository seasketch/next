import mapboxgl from "mapbox-gl";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  MapManagerContext,
  MapOverlayContext,
  DigitizingLockState,
  DigitizingLockStateChangeEventType,
  type MapUIStateContextState,
  type MapOverlayContextState,
  type Tooltip,
} from "./MapContextManager";
import { BasemapContext, type BasemapContextState } from "./BasemapContext";
import LayerInteractivityManager, {
  type InteractivityUIUpdate,
} from "./LayerInteractivityManager";
import CoordinatesControl from "./CoordinatesControl";
import { useMapPreferences } from "./useMapPreferences";
import type {
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  BasemapDetailsFragment,
} from "../generated/graphql";
import type { CustomGLSource } from "@seasketch/mapbox-gl-esri-sources";

/** Tooltip, banner, popup, digitizing-lock, and display-preference state. */
export const MapUIStateContext = createContext<MapUIStateContextState>({
  bannerMessages: [],
  fixedBlocks: [],
  digitizingLockState: DigitizingLockState.Free,
  inaturalistCallToActions: [],
  toggleScale: () => {},
  toggleCoordinates: () => {},
});

function buildVisibleLayers(
  overlay: MapOverlayContextState,
  basemap: BasemapContextState
): {
  visibleLayers: DataLayerDetailsFragment[];
  dataSources: { [id: string]: DataSourceDetailsFragment };
  basemap: BasemapDetailsFragment | undefined;
  tocItemLabels: { [stableId: string]: { label?: string } };
} {
  const dataLayers = overlay.dataLayers ?? [];
  const dataSourcesList = overlay.dataSources ?? [];
  const tableOfContentsItems = overlay.tableOfContentsItems ?? [];
  const layerStates = overlay.layerStatesByTocStaticId ?? {};
  const basemaps = basemap.basemaps;
  const selectedBasemap = basemap.selectedBasemap;

  const layersById: { [id: number]: DataLayerDetailsFragment } = {};
  for (const layer of dataLayers) {
    layersById[layer.id] = layer;
  }
  const sourcesById: { [id: string]: DataSourceDetailsFragment } = {};
  for (const source of dataSourcesList) {
    sourcesById[source.id.toString()] = source;
  }

  const visibleLayers: DataLayerDetailsFragment[] = [];
  const tocItemLabels: { [stableId: string]: { label?: string } } = {};

  for (const item of tableOfContentsItems) {
    const stableId = item.stableId;
    tocItemLabels[stableId] = { label: item.title ?? undefined };
    const state = layerStates[stableId];
    if (!state?.visible || state.hidden) continue;
    const dataLayerId = item.dataLayerId;
    if (!dataLayerId) continue;
    const layer = layersById[dataLayerId];
    if (!layer) continue;
    visibleLayers.push({
      ...layer,
      tocId: stableId,
    } as DataLayerDetailsFragment & {
      tocId: string;
    });
  }

  const resolvedBasemap = selectedBasemap
    ? basemaps.find((b) => b.id === selectedBasemap)
    : basemaps[0];

  return {
    visibleLayers,
    dataSources: sourcesById,
    basemap: resolvedBasemap,
    tocItemLabels,
  };
}

export interface MapUIProviderProps {
  children: React.ReactNode;
  /**
   * Full localStorage key for persisting showScale/showCoordinates.
   * Must include project slug to avoid cross-project leakage (e.g. myproject-homepage).
   */
  preferencesKey?: string;
  /** Default for showScale when no preference is saved (e.g. project.showScalebarByDefault) */
  defaultShowScale?: boolean;
  /** Default for showCoordinates when no preference is saved */
  defaultShowCoordinates?: boolean;
}

export default function MapUIProvider({
  children,
  preferencesKey,
  defaultShowScale = false,
  defaultShowCoordinates = false,
}: MapUIProviderProps) {
  const { manager, ready } = useContext(MapManagerContext);
  const mapOverlay = useContext(MapOverlayContext);
  const basemap = useContext(BasemapContext);
  const { getPreferences, updateSlice } = useMapPreferences(preferencesKey);

  const [bannerMessages, setBannerMessages] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<Tooltip | undefined>();
  const [fixedBlocks, setFixedBlocks] = useState<string[]>([]);
  const [sidebarPopupContent, setSidebarPopupContent] = useState<
    string | undefined
  >();
  const [sidebarPopupTitle, setSidebarPopupTitle] = useState<
    string | undefined
  >();
  const [digitizingLockState, setDigitizingLockState] = useState<
    typeof DigitizingLockState.Free
  >(DigitizingLockState.Free);
  const [digitizingLockedBy, setDigitizingLockedBy] = useState<
    string | undefined
  >();
  const [displayedMapBookmark, setDisplayedMapBookmark] =
    useState<MapUIStateContextState["displayedMapBookmark"]>();
  const [loadingOverlay, setLoadingOverlay] = useState<
    string | null | undefined
  >();
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [offlineTileSimulatorActive, setOfflineTileSimulatorActive] =
    useState(false);
  const [inaturalistCallToActions, setInaturalistCallToActions] = useState<
    MapUIStateContextState["inaturalistCallToActions"]
  >([]);

  const prefs = getPreferences();
  const [showScale, setShowScale] = useState(() =>
    typeof prefs.showScale === "boolean" ? prefs.showScale : defaultShowScale
  );
  const [showCoordinates, setShowCoordinates] = useState(() =>
    typeof prefs.showCoordinates === "boolean"
      ? prefs.showCoordinates
      : defaultShowCoordinates
  );

  const interactivityManagerRef = useRef<LayerInteractivityManager | null>(
    null
  );
  const [interactivityManager, setInteractivityManager] = useState<
    LayerInteractivityManager | undefined
  >(undefined);
  const scaleControl = useMemo(
    () => new mapboxgl.ScaleControl({ maxWidth: 250 }),
    []
  );
  const coordinatesControl = useMemo(() => new CoordinatesControl(), []);

  const onUIUpdate = useCallback((update: InteractivityUIUpdate) => {
    if (update.bannerMessages !== undefined)
      setBannerMessages(update.bannerMessages);
    // Use 'in' check so tooltip: undefined (clear) triggers setTooltip(undefined)
    if ("tooltip" in update) setTooltip(update.tooltip);
    if (update.fixedBlocks !== undefined) setFixedBlocks(update.fixedBlocks);
    // Use 'in' check so undefined (clear) triggers the setter
    if ("sidebarPopupContent" in update)
      setSidebarPopupContent(update.sidebarPopupContent);
    if ("sidebarPopupTitle" in update)
      setSidebarPopupTitle(update.sidebarPopupTitle);
  }, []);

  const toggleScale = useCallback(
    (show: boolean) => {
      setShowScale(show);
      updateSlice({ showScale: show });
      const map = manager?.map;
      if (map) {
        if (show) {
          if (!map.hasControl(scaleControl)) {
            map.addControl(scaleControl, "bottom-right");
          }
        } else {
          if (map.hasControl(scaleControl)) {
            map.removeControl(scaleControl);
          }
        }
      }
    },
    [manager?.map, scaleControl, updateSlice]
  );

  const toggleCoordinates = useCallback(
    (show: boolean) => {
      setShowCoordinates(show);
      updateSlice({ showCoordinates: show });
      const map = manager?.map;
      if (map) {
        if (show) {
          if (!map.hasControl(coordinatesControl)) {
            map.addControl(coordinatesControl, "bottom-right");
          }
        } else {
          if (map.hasControl(coordinatesControl)) {
            map.removeControl(coordinatesControl);
          }
        }
      }
    },
    [coordinatesControl, manager?.map, updateSlice]
  );

  useEffect(() => {
    if (!manager) return;
    const onUI = (update: Partial<MapUIStateContextState>) => {
      if (update.loadingOverlay !== undefined)
        setLoadingOverlay(update.loadingOverlay);
      if (update.showLoadingOverlay !== undefined)
        setShowLoadingOverlay(update.showLoadingOverlay);
      // Use 'in' check so displayedMapBookmark: undefined (clear) triggers the setter
      if ("displayedMapBookmark" in update)
        setDisplayedMapBookmark(update.displayedMapBookmark);
      if (update.offlineTileSimulatorActive !== undefined)
        setOfflineTileSimulatorActive(update.offlineTileSimulatorActive);
      if (update.inaturalistCallToActions !== undefined)
        setInaturalistCallToActions(update.inaturalistCallToActions);
    };
    manager.on("uiUpdate", onUI);
    return () => {
      manager.off("uiUpdate", onUI);
    };
  }, [manager]);

  useEffect(() => {
    if (!manager) return;
    const onLock = (payload: {
      digitizingLockState: typeof DigitizingLockState.Free;
      digitizingLockedBy?: string;
    }) => {
      setDigitizingLockState(payload.digitizingLockState);
      setDigitizingLockedBy(payload.digitizingLockedBy);
    };
    manager.on(DigitizingLockStateChangeEventType, onLock);
    return () => {
      manager.off(DigitizingLockStateChangeEventType, onLock);
    };
  }, [manager]);

  // Create InteractivityManager once when map is ready. Do NOT recreate on layer changes.
  useEffect(() => {
    if (!manager?.map || !ready) return;

    const map = manager.map;
    const im = new LayerInteractivityManager(map, onUIUpdate);
    interactivityManagerRef.current = im;
    setInteractivityManager(im);

    return () => {
      im.destroy();
      interactivityManagerRef.current = null;
      setInteractivityManager(undefined);
    };
  }, [manager?.map, ready, onUIUpdate]);

  useEffect(() => {
    const interactivityManager = interactivityManagerRef.current;
    if (!interactivityManager || !manager) return;
    const onSketchIds = (ids: string[]) => {
      interactivityManager.setSketchLayerIds(ids);
    };
    const onCustomSources = (sources: {
      [id: string]: CustomGLSource<any>;
    }) => {
      interactivityManager.setCustomSources(sources);
    };
    const onFocusedSketch = (id: number | null) => {
      interactivityManager.setFocusedSketchId(id);
    };
    const onPause = () => interactivityManager.pause();
    const onResume = () => interactivityManager.resume();

    manager.on("sketchLayerIdsChanged", onSketchIds);
    manager.on("customSourcesChanged", onCustomSources);
    manager.on("focusedSketchIdChanged", onFocusedSketch);
    manager.on("pauseInteractivity", onPause);
    manager.on("resumeInteractivity", onResume);

    // Sync initial state in case sketchLayerIdsChanged was emitted before we subscribed
    manager.emitCurrentSketchLayerIds?.();

    return () => {
      manager.off("sketchLayerIdsChanged", onSketchIds);
      manager.off("customSourcesChanged", onCustomSources);
      manager.off("focusedSketchIdChanged", onFocusedSketch);
      manager.off("pauseInteractivity", onPause);
      manager.off("resumeInteractivity", onResume);
    };
  }, [manager, interactivityManager]);

  // Update visible layers when overlay or basemap data changes, or when the
  // interactivity manager is first created (it may be created after the data
  // is already available).
  useEffect(() => {
    if (!interactivityManager) return;

    const {
      visibleLayers,
      dataSources,
      basemap: resolvedBasemap,
      tocItemLabels,
    } = buildVisibleLayers(mapOverlay, basemap);
    if (resolvedBasemap) {
      interactivityManager.setVisibleLayers(
        visibleLayers,
        dataSources,
        resolvedBasemap,
        tocItemLabels
      );
    }
  }, [
    mapOverlay.layerStatesByTocStaticId,
    mapOverlay.dataLayers,
    mapOverlay.dataSources,
    mapOverlay.tableOfContentsItems,
    basemap.selectedBasemap,
    basemap.basemaps,
    interactivityManager,
    basemap,
    mapOverlay,
  ]);

  useEffect(() => {
    const map = manager?.map;
    if (!map || !ready) return;

    if (showScale) {
      if (!map.hasControl(scaleControl)) {
        map.addControl(scaleControl, "bottom-right");
      }
    } else {
      if (map.hasControl(scaleControl)) {
        map.removeControl(scaleControl);
      }
    }

    if (showCoordinates) {
      if (!map.hasControl(coordinatesControl)) {
        map.addControl(coordinatesControl, "bottom-right");
      }
    } else {
      if (map.hasControl(coordinatesControl)) {
        map.removeControl(coordinatesControl);
      }
    }
  }, [
    manager?.map,
    ready,
    showScale,
    showCoordinates,
    scaleControl,
    coordinatesControl,
  ]);

  const value = useMemo<MapUIStateContextState>(
    () => ({
      bannerMessages,
      tooltip,
      fixedBlocks,
      sidebarPopupContent,
      sidebarPopupTitle,
      displayedMapBookmark,
      loadingOverlay,
      showLoadingOverlay,
      offlineTileSimulatorActive,
      digitizingLockState,
      digitizingLockedBy,
      showScale,
      showCoordinates,
      toggleScale,
      toggleCoordinates,
      inaturalistCallToActions: inaturalistCallToActions ?? [],
      interactivityManager,
    }),
    [
      bannerMessages,
      tooltip,
      fixedBlocks,
      sidebarPopupContent,
      sidebarPopupTitle,
      displayedMapBookmark,
      loadingOverlay,
      showLoadingOverlay,
      offlineTileSimulatorActive,
      digitizingLockState,
      digitizingLockedBy,
      showScale,
      showCoordinates,
      toggleScale,
      toggleCoordinates,
      inaturalistCallToActions,
      interactivityManager,
    ]
  );

  return (
    <MapUIStateContext.Provider value={value}>
      {children}
    </MapUIStateContext.Provider>
  );
}
