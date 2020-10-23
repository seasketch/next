import { MapDataEvent } from "mapbox-gl";
import React from "react";

interface LayerState {
  loading: boolean;
  error?: Error;
}

export interface LayerLoadingStates {
  [sourceId: string]: LayerState;
}

const LayerLoadingStateContext = React.createContext<LayerLoadingStates>({});

export function updateLoadingState(
  event: (MapDataEvent | (ErrorEvent & MapDataEvent)) & {
    sourceId?: string;
    error?: Error;
    isSourceLoaded?: boolean;
  },
  loadingStates: LayerLoadingStates
): LayerLoadingStates {
  if (event.sourceId && event.sourceId !== "composite") {
    const layerState: LayerState = loadingStates[event.sourceId] || {
      loading: true,
    };
    // @ts-ignore
    const sourceType: string | undefined = event.source?.type;
    if (event.type === "error") {
      layerState.loading = false;
      layerState.error = event.error || new Error("Unknown source error");
    } else if (event.type === "dataloading") {
      delete layerState.error;
      // @ts-ignore
      if (event.source.type === "image") {
        // layerState.loading = true;
        // setTimeout(() => {
        layerState.loading = !event.target.isSourceLoaded(event.sourceId!);
        // }, 50);
      } else {
        layerState.loading = true;
      }
    } else if (event.type === "data") {
      delete layerState.error;
      // @ts-ignore
      if (event.source.type === "image") {
        layerState.loading = event.target.isSourceLoaded(event.sourceId);
      } else {
        if (event.isSourceLoaded) {
          layerState.loading = false;
        } else {
          layerState.loading = true;
        }
      }
    } else {
      layerState.loading = false;
      layerState.error = new Error(
        "Unknown map event handled by LayerLoadingStateContext"
      );
    }
    return {
      ...loadingStates,
      [event.sourceId!]: layerState,
    };
  } else {
    return loadingStates;
  }
}

export default LayerLoadingStateContext;
