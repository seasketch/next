import {
  DataTableAggregation,
  DataTableFilter,
} from "./dataTableQueryApi";

/**
 * Persisted / bookmarked data-table intent for a single overlay layer.
 * Identifies the table by overlay_data_tables.stable_id (not row id).
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

export function resolveTableByStableId<
  T extends { id: number; stableId?: string | null }
>(tables: T[] | null | undefined, stableId: string): T | undefined {
  if (!tables?.length) {
    return undefined;
  }
  return tables.find((table) => table.stableId === stableId);
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
 * Clears dataTable on layers not present in the bookmark map.
 * Does not add layers that are missing from `layers`.
 */
export function applyDataTableStatesToLayerStates<
  T extends LayerStateWithDataTable
>(
  layers: { [tocStableId: string]: T },
  dataTableStates: DataTableStatesMap | null | undefined
): { [tocStableId: string]: T } {
  const next: { [tocStableId: string]: T } = {};
  const states = dataTableStates || {};
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
