import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { BBox } from "geojson";
import type { CameraOptions } from "mapbox-gl";
import bytes from "bytes";
import useAccessToken from "../useAccessToken";
import { useProjectRegionQuery } from "../generated/graphql";
import { BasemapContext } from "./BasemapContext";
import type { BasemapContextState } from "./BasemapContext";
import MapContextManager, {
  DigitizingLockState,
  MapManagerContext,
  SketchLayerContext,
  MapOverlayContext,
  LegendsContext,
} from "./MapContextManager";
import type {
  MapContextInterface,
  MapManagerState,
  SketchLayerContextState,
  MapOverlayContextState,
  LegendsContextState,
} from "./MapContextManager";

export interface MapManagerContextProviderProps {
  /**
   * Full localStorage key for persisting layers, camera, sketchClassLayerStates.
   * Must include project slug to avoid cross-project leakage (e.g. myproject-homepage).
   */
  preferencesKey?: string;
  cacheSize?: number;
  containerPortal?: HTMLDivElement | null;
  bounds?: BBox;
  camera?: CameraOptions;
  children: React.ReactNode;
}

/**
 * Creates MapContextManager and provides MapManagerContext, SketchLayerContext,
 * MapOverlayContext, LegendsContext. Must be nested under BasemapProvider.
 *
 * Reads BasemapContext and syncs basemap state into the manager.
 *
 * If a parent MapOverlayContext supplies dataLayers / dataSources /
 * tableOfContentsItems, this provider will pick them up, call
 * manager.reset(), and merge them into the MapOverlayContext it provides
 * to children.
 */
export default function MapManagerContextProvider({
  preferencesKey,
  cacheSize = bytes("50mb"),
  containerPortal,
  bounds,
  camera,
  children,
}: MapManagerContextProviderProps) {
  const basemapState = useContext(BasemapContext);
  const parentOverlay = useContext(MapOverlayContext);
  const { slug } = useParams<{ slug: string }>();
  const token = useAccessToken();

  let initialState: MapContextInterface = {
    layerStatesByTocStaticId: {},
    styleHash: "",
    legends: {},
    digitizingLockState: DigitizingLockState.Free,
  };

  let initialSketchState: SketchLayerContextState = {
    sketchLayerStates: {},
    sketchClassLayerStates: {},
  };

  let initialCameraOptions: CameraOptions | undefined = camera;

  if (preferencesKey) {
    try {
      const preferencesString = window.localStorage.getItem(preferencesKey);
      if (preferencesString) {
        const prefs = JSON.parse(preferencesString);
        if (prefs.layers) {
          initialState.layerStatesByTocStaticId = prefs.layers;
        }
        if (prefs.cameraOptions) {
          initialCameraOptions = prefs.cameraOptions;
        }
        if (prefs.sketchClassLayerStates) {
          initialSketchState.sketchClassLayerStates = {
            ...prefs.sketchClassLayerStates,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  const [managerState, setManagerState] = useState<MapManagerState>({
    ready: false,
    containerPortal: containerPortal || null,
  });
  const [sketchLayerState, setSketchLayerState] =
    useState<SketchLayerContextState>(initialSketchState);
  const [mapOverlayState, setMapOverlayState] =
    useState<MapOverlayContextState>({
      layerStatesByTocStaticId: initialState.layerStatesByTocStaticId,
      styleHash: initialState.styleHash,
    });

  const [legendsState, setLegendsState] = useState<LegendsContextState>({
    legends: initialState.legends,
  });

  // Sync the containerPortal prop into managerState when it becomes available
  // (it starts as null and is set via a ref callback after mount).
  useEffect(() => {
    setManagerState((prev) => {
      const next = containerPortal || null;
      if (prev.containerPortal === next) return prev;
      return { ...prev, containerPortal: next };
    });
  }, [containerPortal]);

  const managerRef = useRef<MapContextManager | null>(null);
  const { data, error } = useProjectRegionQuery({
    variables: { slug: slug || "" },
    skip: !slug,
  });

  useEffect(() => {
    const manager = new MapContextManager(
      initialState,
      initialSketchState,
      setManagerState,
      setSketchLayerState,
      setMapOverlayState,
      setLegendsState,
      initialCameraOptions,
      preferencesKey,
      cacheSize,
      bounds as [number, number, number, number]
    );
    managerRef.current = manager;
    setManagerState((prev) => ({ ...prev, manager }));
    return () => {
      managerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    managerRef.current?.setToken(token);
  }, [token]);

  useEffect(() => {
    if (error) {
      console.error(error);
      return;
    }
    if (data?.projectBySlug?.region.geojson && managerRef.current) {
      managerRef.current.setProjectBounds(data.projectBySlug.region.geojson);
    }
  }, [data?.projectBySlug, error]);

  // Bridge BasemapContext → manager
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !basemapState) return;
    manager.updateBasemapState(basemapState as BasemapContextState);
    manager.updateStyle();
  }, [basemapState]);

  // Bridge parent MapOverlayContext data → manager.reset()
  const parentDataLayers = parentOverlay.dataLayers;
  const parentDataSources = parentOverlay.dataSources;
  const parentTocItems = parentOverlay.tableOfContentsItems;
  useEffect(() => {
    const manager = managerRef.current;
    if (manager && parentDataSources && parentDataLayers && parentTocItems) {
      manager.reset(parentDataSources, parentDataLayers, parentTocItems);
    }
  }, [parentDataLayers, parentDataSources, parentTocItems]);

  // Merge manager's reactive overlay state with data from parent context
  const mergedOverlay = useMemo<MapOverlayContextState>(
    () => ({
      ...mapOverlayState,
      dataLayers: parentDataLayers ?? mapOverlayState.dataLayers,
      dataSources: parentDataSources ?? mapOverlayState.dataSources,
      tableOfContentsItems:
        parentTocItems ?? mapOverlayState.tableOfContentsItems,
    }),
    [mapOverlayState, parentDataLayers, parentDataSources, parentTocItems]
  );

  return (
    <MapManagerContext.Provider value={managerState}>
      <SketchLayerContext.Provider value={sketchLayerState}>
        <MapOverlayContext.Provider value={mergedOverlay}>
          <LegendsContext.Provider value={legendsState}>
            {children}
          </LegendsContext.Provider>
        </MapOverlayContext.Provider>
      </SketchLayerContext.Provider>
    </MapManagerContext.Provider>
  );
}
