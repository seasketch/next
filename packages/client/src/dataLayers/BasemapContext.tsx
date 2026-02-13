import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type {
  BasemapDetailsFragment,
  OptionalBasemapLayer,
} from "../generated/graphql";
import { OptionalBasemapLayersGroupType } from "../generated/graphql";

/**
 * Value for an optional basemap layer setting.
 * - `boolean` for toggle layers (groupType None): visibility on/off
 * - `string` for select/radio layers: the selected option's `name`
 */
export type OptionalBasemapLayerValue = boolean | string;

/**
 * Basemap context: selection, terrain, and optional layer visibility.
 *
 * Provides {@link BasemapContext} and {@link BasemapContextProvider}. Use for
 * any component that needs to read or change basemap selection, terrain, or
 * optional layers (e.g. EEZ boundaries). Preferences can be persisted via
 * `preferencesKey`.
 */

/**
 * State and actions for basemap selection, terrain, and optional layer
 * visibility. Provided by {@link BasemapContextProvider}. Changes when the
 * selected basemap changes.
 */
export interface BasemapContextState {
  /**
   * `true` when basemaps have been loaded and the context is ready to use.
   * `false` during initial load. BasemapContextProvider will set this state to
   * true once an array of basemaps are provided via the basemaps prop.
   */
  ready: boolean;
  /**
   * Numeric id of the currently selected basemap, or `undefined` if none
   * selected.
   */
  selectedBasemap?: number;
  /** Whether 3D terrain is currently enabled for the selected basemap. */
  terrainEnabled: boolean;
  /**
   * User's preferred terrain setting (persisted when `preferencesKey` is set).
   */
  prefersTerrainEnabled?: boolean;
  /**
   * Resolved visibility/selection state for each optional basemap layer
   * (e.g. EEZ boundaries). Keyed by layer id.
   */
  basemapOptionalLayerStates: Record<string, OptionalBasemapLayerValue>;
  /**
   * User preferences for optional layers (persisted when `preferencesKey` is
   * set). Keyed by layer name.
   */
  basemapOptionalLayerStatePreferences?: Record<
    string,
    OptionalBasemapLayerValue
  >;
  /**
   * Available basemaps. Empty array until loaded; use `ready` to distinguish
   * loading from no basemaps.
   */
  basemaps: BasemapDetailsFragment[];
  /** Select a basemap by id. */
  setSelectedBasemap: (id: number) => void;
  /** Toggle terrain on or off for the current basemap. */
  toggleTerrain: () => void;
  /**
   * Update a single optional basemap layer's setting (visibility or selected
   * option).
   */
  updateOptionalBasemapSetting: (
    layer: Pick<OptionalBasemapLayer, "id" | "options" | "groupType" | "name">,
    value: OptionalBasemapLayerValue
  ) => void;
  /** Reset all optional basemap layer settings to their defaults. */
  clearOptionalBasemapSettings: () => void;
  /**
   * Reset terrain preference to default (based on basemap's
   * `terrainVisibilityDefault`).
   */
  clearTerrainSettings: () => void;
  /**
   * Returns the full basemap object for the current selection, or `undefined`
   * if none selected.
   */
  getSelectedBasemap: () => BasemapDetailsFragment | undefined;
}

const noop = () => {};

/**
 * React context for basemap selection, terrain, and optional layer state.
 * Consume via `useContext(BasemapContext)`.
 * Must be provided by {@link BasemapContextProvider} (typically inside your
 * app's provider tree).
 */
export const BasemapContext = createContext<BasemapContextState>({
  ready: false,
  terrainEnabled: false,
  basemapOptionalLayerStates: {},
  basemaps: [],
  setSelectedBasemap: noop,
  toggleTerrain: noop,
  updateOptionalBasemapSetting: noop,
  clearOptionalBasemapSettings: noop,
  clearTerrainSettings: noop,
  getSelectedBasemap: () => undefined,
});

/**
 * Computes the resolved visibility/selection state for each optional basemap
 * layer, merging saved preferences with basemap defaults.
 *
 * @param basemap - The basemap whose optional layers define the schema. If
 *   null/undefined, returns empty object.
 * @param preferences - Optional saved preferences keyed by layer name.
 * @returns Object mapping optional layer id to its resolved value (boolean
 *   for toggle, string for select/radio).
 */
function computeOptionalLayerStates(
  basemap: BasemapDetailsFragment | null | undefined,
  preferences?: Record<string, OptionalBasemapLayerValue>
): Record<string, OptionalBasemapLayerValue> {
  const states: Record<string, OptionalBasemapLayerValue> = {};
  if (basemap) {
    for (const layer of basemap.optionalBasemapLayers) {
      const preference =
        preferences && layer.name in preferences
          ? preferences[layer.name]
          : undefined;
      if (layer.groupType === OptionalBasemapLayersGroupType.None) {
        states[layer.id] = preference ?? layer.defaultVisibility;
      } else if (layer.groupType === OptionalBasemapLayersGroupType.Select) {
        states[layer.id] = preference ?? (layer.options || [])[0]?.name;
      } else {
        states[layer.id] = preference ?? (layer.options || [])[0]?.name;
      }
    }
  }
  return states;
}

/**
 * Determines whether terrain should be enabled based on basemap support and
 * user preference.
 *
 * @param basemap - The basemap to check. Must have `terrainUrl` for terrain to
 *   be possible.
 * @param prefersTerrainEnabled - User's saved preference. If basemap has
 *   `terrainOptional`, this overrides the default.
 * @returns `true` if terrain should be shown, `false` otherwise.
 */
function shouldEnableTerrain(
  basemap: BasemapDetailsFragment | null | undefined,
  prefersTerrainEnabled?: boolean
): boolean {
  if (!basemap || !basemap.terrainUrl) {
    return false;
  }
  if (basemap.terrainOptional) {
    if (prefersTerrainEnabled === true) return true;
    if (prefersTerrainEnabled === false) return false;
    return basemap.terrainVisibilityDefault || false;
  }
  return true;
}

/**
 * Props for {@link BasemapContextProvider}.
 */
export interface BasemapContextProviderProps {
  /**
   * Available basemaps. Pass `undefined` while loading; the provider will
   * expose `ready: false` and `basemaps: []` until data arrives.
   */
  basemaps: BasemapDetailsFragment[] | undefined;
  /**
   * Base key for persisting basemap preferences (selected basemap, terrain,
   * optional layers). Stored under `{preferencesKey}-basemap-prefs`. Must
   * include project slug to avoid cross-project leakage (e.g. myproject-homepage).
   */
  preferencesKey?: string;
  children: React.ReactNode;
}

/**
 * Provides basemap selection, terrain, and optional layer state to the
 * component tree. Must wrap any component that consumes {@link BasemapContext}.
 *
 * Selection is reconciled in this order: current state > saved preferences >
 * first basemap. When `preferencesKey` is set, preferences are loaded on mount
 * and persisted when they change.
 *
 * @param props - See {@link BasemapContextProviderProps}.
 */
export default function BasemapContextProvider({
  basemaps,
  preferencesKey,
  children,
}: BasemapContextProviderProps) {
  const savedPrefs = useMemo(() => {
    if (!preferencesKey) return undefined;
    try {
      const raw = window.localStorage.getItem(
        // eslint-disable-next-line i18next/no-literal-string
        `${preferencesKey}-basemap-prefs`
      );
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return undefined;
  }, [preferencesKey]);

  const basemapsById = useMemo(() => {
    if (!basemaps) return {};
    const map: { [id: number]: BasemapDetailsFragment } = {};
    for (const b of basemaps) map[b.id] = b;
    return map;
  }, [basemaps]);

  /**
   * Normalizes stored id to number; handles legacy string values from
   * localStorage.
   */
  const toBasemapId = useCallback(
    (x: string | number | undefined): number | undefined => {
      if (x === undefined || x === null) return undefined;
      if (typeof x === "number") return Number.isInteger(x) ? x : undefined;
      const n = parseInt(String(x), 10);
      return Number.isNaN(n) ? undefined : n;
    },
    []
  );

  const [state, setState] = useState<{
    selectedBasemap?: number;
    terrainEnabled: boolean;
    prefersTerrainEnabled?: boolean;
    basemapOptionalLayerStates: Record<string, OptionalBasemapLayerValue>;
    basemapOptionalLayerStatePreferences?: Record<
      string,
      OptionalBasemapLayerValue
    >;
  }>({
    selectedBasemap: undefined,
    terrainEnabled: false,
    basemapOptionalLayerStates: {},
    prefersTerrainEnabled: savedPrefs?.prefersTerrainEnabled,
    basemapOptionalLayerStatePreferences:
      savedPrefs?.basemapOptionalLayerStatePreferences,
  });

  /**
   * Reconcile selection when basemaps load: current state > saved prefs >
   * first basemap.
   */
  useEffect(() => {
    if (!basemaps) return;
    setState((prev) => {
      // Pick selection: current state > saved prefs > first basemap
      const candidates = [
        prev.selectedBasemap,
        toBasemapId(savedPrefs?.selectedBasemap),
      ];
      let selectedBasemap: number | undefined;
      for (const id of candidates) {
        if (id !== undefined && basemapsById[id]) {
          selectedBasemap = id;
          break;
        }
      }
      if (selectedBasemap === undefined && basemaps.length > 0) {
        selectedBasemap = basemaps[0].id;
      }
      const selected = selectedBasemap
        ? basemapsById[selectedBasemap]
        : undefined;
      return {
        ...prev,
        selectedBasemap,
        terrainEnabled: shouldEnableTerrain(
          selected,
          prev.prefersTerrainEnabled
        ),
        basemapOptionalLayerStates: computeOptionalLayerStates(
          selected,
          prev.basemapOptionalLayerStatePreferences
        ),
      };
    });
  }, [basemaps, basemapsById, savedPrefs, toBasemapId]);

  /**
   * Persist preferences to localStorage when basemaps are loaded and
   * preferencesKey is set.
   */
  useEffect(() => {
    if (!preferencesKey || !basemaps) return;
    const prefs = {
      selectedBasemap: state.selectedBasemap,
      prefersTerrainEnabled: state.prefersTerrainEnabled,
      basemapOptionalLayerStatePreferences:
        state.basemapOptionalLayerStatePreferences,
    };
    window.localStorage.setItem(
      // eslint-disable-next-line i18next/no-literal-string
      `${preferencesKey}-basemap-prefs`,
      JSON.stringify(prefs)
    );
  }, [
    preferencesKey,
    basemaps,
    state.selectedBasemap,
    state.prefersTerrainEnabled,
    state.basemapOptionalLayerStatePreferences,
  ]);

  const setSelectedBasemap = useCallback(
    (id: number) => {
      setState((prev) => {
        const basemap = basemapsById[id];
        return {
          ...prev,
          selectedBasemap: id,
          terrainEnabled: shouldEnableTerrain(
            basemap,
            prev.prefersTerrainEnabled
          ),
          basemapOptionalLayerStates: computeOptionalLayerStates(
            basemap,
            prev.basemapOptionalLayerStatePreferences
          ),
        };
      });
    },
    [basemapsById]
  );

  const toggleTerrain = useCallback(() => {
    setState((prev) => {
      const on = !prev.terrainEnabled;
      return {
        ...prev,
        terrainEnabled: on,
        prefersTerrainEnabled: on,
      };
    });
  }, []);

  const updateOptionalBasemapSetting = useCallback(
    (
      layer: Pick<
        OptionalBasemapLayer,
        "id" | "options" | "groupType" | "name"
      >,
      value: OptionalBasemapLayerValue
    ) => {
      const key = layer.name;
      setState((prev) => {
        const newPrefs = {
          ...prev.basemapOptionalLayerStatePreferences,
          [key]: value,
        };
        const selected = prev.selectedBasemap
          ? basemapsById[prev.selectedBasemap]
          : undefined;
        return {
          ...prev,
          basemapOptionalLayerStatePreferences: newPrefs,
          basemapOptionalLayerStates: computeOptionalLayerStates(
            selected,
            newPrefs
          ),
        };
      });
    },
    [basemapsById]
  );

  const clearOptionalBasemapSettings = useCallback(() => {
    setState((prev) => {
      const selected = prev.selectedBasemap
        ? basemapsById[prev.selectedBasemap]
        : undefined;
      return {
        ...prev,
        basemapOptionalLayerStatePreferences: undefined,
        basemapOptionalLayerStates: computeOptionalLayerStates(selected, {}),
      };
    });
  }, [basemapsById]);

  const clearTerrainSettings = useCallback(() => {
    setState((prev) => {
      const selected = prev.selectedBasemap
        ? basemapsById[prev.selectedBasemap]
        : undefined;
      return {
        ...prev,
        prefersTerrainEnabled: undefined,
        terrainEnabled: shouldEnableTerrain(selected, undefined),
      };
    });
  }, [basemapsById]);

  const getSelectedBasemap = useCallback(() => {
    return state.selectedBasemap
      ? basemapsById[state.selectedBasemap]
      : undefined;
  }, [state.selectedBasemap, basemapsById]);

  const ready = !!basemaps;
  const contextValue: BasemapContextState = useMemo(
    () => ({
      ...state,
      ready,
      basemaps: basemaps ?? [],
      setSelectedBasemap,
      toggleTerrain,
      updateOptionalBasemapSetting,
      clearOptionalBasemapSettings,
      clearTerrainSettings,
      getSelectedBasemap,
    }),
    [
      state,
      ready,
      basemaps,
      setSelectedBasemap,
      toggleTerrain,
      updateOptionalBasemapSetting,
      clearOptionalBasemapSettings,
      clearTerrainSettings,
      getSelectedBasemap,
    ]
  );

  return (
    <BasemapContext.Provider value={contextValue}>
      {children}
    </BasemapContext.Provider>
  );
}
