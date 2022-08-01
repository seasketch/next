import { useEffect, useState } from "react";
import { BasemapCacheStatus, cacheStatusForBasemap } from "./MapTileCache";

type BasemapCacheStatusOrLoading =
  | { loading: true }
  | { loading: false; status: BasemapCacheStatus };

export function useBasemapCacheStatus(basemapId: number) {
  const [state, setState] = useState<BasemapCacheStatusOrLoading>({
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    cacheStatusForBasemap(basemapId).then((status) => {
      if (!controller.signal.aborted) {
        setState({ loading: false, status });
      }
    });
    return () => controller.abort();
  }, [basemapId]);

  return state;
}
