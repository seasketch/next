import { useCallback, useEffect, useState } from "react";
import StaticAssetCache, { StaticAssetCacheState } from "./StaticAssetCache";

/**
 * Simplifies use of StaticAssetCache from React, with stateful tracking of
 * cache condition including which files are cached and whether prefetching is
 * enabled. Use the supplied `togglePrefetchCaching` function to ensure accurate
 * state is reflected in the UI.
 */
export default function useStaticAssetCache() {
  const [cache] = useState(new StaticAssetCache());
  const [state, setState] = useState<{
    /** Means either the cache state is being read or it is being actively populated */
    loading: boolean;
    error?: Error;
    cacheState?: StaticAssetCacheState;
    /** Set to true after the intial state of the cache has been read */
    ready: boolean;
  }>({
    loading: true,
    ready: false,
  });

  useEffect(() => {
    if (cache) {
      cache
        .getState()
        .then((s) => {
          setState({
            cacheState: s,
            loading: false,
            ready: true,
          });
          if (
            s.precacheEnabled &&
            s.entries.filter((e) => !e.cached).length > 0
          ) {
            populateCache();
          }
        })
        .catch((error) =>
          setState({
            error,
            loading: false,
            ready: true,
          })
        );
    } else {
      setState({
        loading: false,
        ready: false,
      });
    }
  }, [cache]);

  /**
   * If enabled, SeaSketch will aggresively prefetch and cache static assets
   * included in the manifest output by webpack.
   *
   * Enabling prefetch caching will immediately trigger a process to cache all
   * outstanding assets that haven't been cached during runtime. `cacheState`
   * will be updated as files are added to the cache.
   */
  const togglePrefetchCaching = useCallback(
    (enable: boolean) => {
      if (cache) {
        cache.precacheEnabled = enable;
        setState((prev) => {
          if (prev.cacheState) {
            return {
              ...prev,
              loading: enable,
              cacheState: {
                ...prev.cacheState,
                precacheEnabled: enable,
              },
            };
          } else {
            return prev;
          }
        });
        if (enable) {
          populateCache();
        }
      }
    },
    [cache]
  );

  const clearCache = useCallback(async () => {
    await cache.clearCache();
    const cacheState = await cache.getState();
    setState((prev) => ({ ...prev, cacheState }));
  }, [cache]);

  const populateCache = useCallback(async () => {
    if (cache) {
      cache
        .populateCache((cacheState) => {
          setState({
            loading: true,
            cacheState: { ...cacheState },
            ready: true,
          });
        })
        .then((cacheState) => {
          setState({
            loading: false,
            cacheState: { ...cacheState },
            ready: true,
          });
        });
    }
  }, [cache]);

  return {
    ...state,
    togglePrefetchCaching,
    clearCache,
    populateCache,
  };
}
