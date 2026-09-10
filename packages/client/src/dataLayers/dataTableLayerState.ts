import {
  DataTableAggregation,
  DataTableFilter,
} from "./dataTableQueryApi";

/**
 * Active data-table intent for a single overlay layer.
 * Identifies the table by overlay_data_tables.stable_id (survives replace).
 * Last-used column/op/filters for other tables live in
 * `dataTableSettingsMemory` (max 6, persisted with map prefs).
 */
export interface LayerDataTableState {
  stableId: string;
  column?: string;
  op?: DataTableAggregation;
  filters?: DataTableFilter[];
}

/** Minimal layer fields needed for prefs/bookmark helpers. */
export interface LayerStateWithDataTable {
  visible: boolean;
  opacity?: number;
  zOrderOverride?: number;
  loading?: boolean;
  error?: Error;
  hidden?: boolean;
  dataTable?: LayerDataTableState;
}

/** Bookmark / API payload: TOC stableId → table viz intent. */
export type DataTableStatesMap = {
  [tocStableId: string]: LayerDataTableState;
};

/**
 * Only one overlay may show a data-table visualization at a time.
 * If several are present, keep `keepTocStableId` when it has a table,
 * otherwise the last entry in the map.
 */
export function exclusiveDataTableStates(
  dataTableStates: DataTableStatesMap | null | undefined,
  keepTocStableId?: string
): DataTableStatesMap {
  const states = dataTableStates || {};
  const ids = Object.keys(states).filter((id) => states[id]?.stableId);
  if (ids.length === 0) {
    return {};
  }
  const keep =
    keepTocStableId && states[keepTocStableId]?.stableId
      ? keepTocStableId
      : ids[ids.length - 1];
  return { [keep]: { ...states[keep] } };
}

/**
 * Build bookmark/API dataTableStates from overlay layer states.
 * Only includes visible layers that have an active data table.
 */
export function buildDataTableStatesFromLayers(
  layerStates: { [tocStableId: string]: LayerStateWithDataTable }
): DataTableStatesMap {
  const out: DataTableStatesMap = {};
  for (const [tocStableId, state] of Object.entries(layerStates)) {
    if (!state?.visible || !state.dataTable?.stableId) {
      continue;
    }
    out[tocStableId] = { ...state.dataTable };
  }
  return out;
}

/**
 * Merge bookmark dataTableStates onto a copy of layer states.
 * At most one visualization is kept. Clears dataTable on every other layer,
 * including layers absent from the bookmark map.
 * Does not add layers that are missing from `layers`.
 */
export function applyDataTableStatesToLayerStates<
  T extends LayerStateWithDataTable
>(
  layers: { [tocStableId: string]: T },
  dataTableStates: DataTableStatesMap | null | undefined
): { [tocStableId: string]: T } {
  const next: { [tocStableId: string]: T } = {};
  const states = exclusiveDataTableStates(dataTableStates);
  for (const [tocStableId, state] of Object.entries(layers)) {
    const dataTable = states[tocStableId];
    if (dataTable?.stableId) {
      next[tocStableId] = {
        ...state,
        dataTable: { ...dataTable },
      };
    } else if (state.dataTable) {
      const { dataTable: _removed, ...rest } = state;
      next[tocStableId] = rest as T;
    } else {
      next[tocStableId] = state;
    }
  }
  return next;
}

/**
 * Strip ephemeral LayerState fields before persisting to localStorage.
 * Keeps dataTable (user intent) and visibility/opacity/z/hidden.
 */
export function layerStatesForPreferences(
  layerStates: { [tocStableId: string]: LayerStateWithDataTable }
): { [tocStableId: string]: Partial<LayerStateWithDataTable> } {
  const out: { [tocStableId: string]: Partial<LayerStateWithDataTable> } = {};
  for (const [tocStableId, state] of Object.entries(layerStates)) {
    const next: Partial<LayerStateWithDataTable> = {
      visible: state.visible,
      loading: false,
    };
    if (state.opacity !== undefined) {
      next.opacity = state.opacity;
    }
    if (state.zOrderOverride !== undefined) {
      next.zOrderOverride = state.zOrderOverride;
    }
    if (state.hidden !== undefined) {
      next.hidden = state.hidden;
    }
    if (state.dataTable?.stableId) {
      next.dataTable = { ...state.dataTable };
    }
    out[tocStableId] = next;
  }
  return out;
}
