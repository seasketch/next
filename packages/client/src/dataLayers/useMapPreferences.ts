import { useCallback, useMemo } from "react";
import debounce from "lodash.debounce";

export type MapPreferencesSlice = Partial<{
  showScale: boolean;
  showCoordinates: boolean;
  basemap: string;
  layers: Record<string, unknown>;
  cameraOptions: unknown;
  prefersTerrainEnabled: boolean;
  basemapOptionalLayerStatePreferences: Record<string, unknown>;
  basemapOptionalLayerStates: Record<string, unknown>;
  sketchClassLayerStates: Record<string, unknown>;
}>;

/**
 * Merge-based preferences for map state. Allows MapUIContext and MapContextManager
 * to each persist their slice without overwriting each other.
 */
export function useMapPreferences(preferencesKey: string | undefined) {
  const storageKey = preferencesKey || null;

  const updateSlice = useCallback(
    (slice: MapPreferencesSlice) => {
      if (!storageKey) return;
      try {
        const existing = window.localStorage.getItem(storageKey);
        const current = existing ? JSON.parse(existing) : {};
        const merged = { ...current, ...slice };
        window.localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch (e) {
        console.warn("Failed to persist map preferences", e);
      }
    },
    [storageKey]
  );

  const debouncedUpdateSlice = useMemo(
    () => debounce((slice: MapPreferencesSlice) => updateSlice(slice), 200),
    [updateSlice]
  );

  const getPreferences = useCallback((): Record<string, unknown> => {
    if (!storageKey) return {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [storageKey]);

  return { updateSlice, debouncedUpdateSlice, getPreferences };
}
