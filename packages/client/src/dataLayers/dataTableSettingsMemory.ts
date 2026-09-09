import {
  DATA_TABLE_AGGREGATIONS,
  DataTableAggregation,
  DataTableFilter,
  DataTableFilterOperator,
} from "./dataTableQueryApi";
import { LayerDataTableState } from "./dataTableLayerState";

/** Max remembered table settings (LRU). Oldest entries drop first. */
export const DATA_TABLE_SETTINGS_MEMORY_LIMIT = 6;

const FILTER_OPS: DataTableFilterOperator[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "isNull",
  "notNull",
];

export interface RememberedDataTableSettings {
  stableId: string;
  column?: string;
  op?: DataTableAggregation;
  filters?: DataTableFilter[];
  updatedAt: number;
}

function isDataTableAggregation(value: unknown): value is DataTableAggregation {
  return (
    typeof value === "string" &&
    (DATA_TABLE_AGGREGATIONS as string[]).includes(value)
  );
}

function isDataTableFilter(value: unknown): value is DataTableFilter {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (!("column" in value) || !("op" in value)) {
    return false;
  }
  if (typeof value.column !== "string" || !value.column) {
    return false;
  }
  if (typeof value.op !== "string" || (FILTER_OPS as string[]).indexOf(value.op) === -1) {
    return false;
  }
  if ("value" in value && value.value !== undefined && typeof value.value !== "string") {
    return false;
  }
  if ("values" in value && value.values !== undefined) {
    if (!Array.isArray(value.values)) {
      return false;
    }
    for (const item of value.values) {
      if (typeof item !== "string") {
        return false;
      }
    }
  }
  return true;
}

function isRememberedDataTableSettings(
  value: unknown
): value is RememberedDataTableSettings {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (!("stableId" in value) || typeof value.stableId !== "string" || !value.stableId) {
    return false;
  }
  if (
    "column" in value &&
    value.column !== undefined &&
    typeof value.column !== "string"
  ) {
    return false;
  }
  if ("op" in value && value.op !== undefined && !isDataTableAggregation(value.op)) {
    return false;
  }
  if ("filters" in value && value.filters !== undefined) {
    if (!Array.isArray(value.filters)) {
      return false;
    }
    for (const filter of value.filters) {
      if (!isDataTableFilter(filter)) {
        return false;
      }
    }
  }
  if (
    "updatedAt" in value &&
    value.updatedAt !== undefined &&
    (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt))
  ) {
    return false;
  }
  return true;
}

/**
 * Parse persisted data-table settings memory from untrusted JSON.
 */
export function parseDataTableSettingsMemory(
  value: unknown
): RememberedDataTableSettings[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const next: RememberedDataTableSettings[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRememberedDataTableSettings(entry)) {
      continue;
    }
    if (seen.has(entry.stableId)) {
      continue;
    }
    seen.add(entry.stableId);
    next.push({
      stableId: entry.stableId,
      column: typeof entry.column === "string" ? entry.column : undefined,
      op: entry.op,
      filters: entry.filters ? [...entry.filters] : undefined,
      updatedAt:
        typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
          ? entry.updatedAt
          : 0,
    });
    if (next.length >= DATA_TABLE_SETTINGS_MEMORY_LIMIT) {
      break;
    }
  }
  return next;
}

export function lookupDataTableSettings(
  memory: RememberedDataTableSettings[],
  stableId: string
): RememberedDataTableSettings | undefined {
  return memory.find((entry) => entry.stableId === stableId);
}

export function rememberDataTableSettings(
  memory: RememberedDataTableSettings[],
  settings: Pick<LayerDataTableState, "stableId" | "column" | "op" | "filters">,
  now = Date.now(),
  limit = DATA_TABLE_SETTINGS_MEMORY_LIMIT
): RememberedDataTableSettings[] {
  if (!settings.stableId) {
    return memory;
  }
  const entry: RememberedDataTableSettings = {
    stableId: settings.stableId,
    column: settings.column,
    op: settings.op,
    filters: settings.filters ? [...settings.filters] : undefined,
    updatedAt: now,
  };
  const next = [
    entry,
    ...memory.filter((item) => item.stableId !== settings.stableId),
  ];
  return next.slice(0, Math.max(1, limit));
}

/** True when the caller only named a table (switch / first activate). */
export function isDataTableActivationOnly(
  state: LayerDataTableState
): boolean {
  return (
    Boolean(state.stableId) &&
    state.column === undefined &&
    state.op === undefined &&
    state.filters === undefined
  );
}

/**
 * Resolve a layer data-table change against per-table memory.
 * Activation-only (`{ stableId }`) restores that table's last settings.
 * Explicit column/op/filters replace memory for that table.
 */
export function resolveLayerDataTableChange(
  previous: LayerDataTableState | undefined,
  incoming: LayerDataTableState | null,
  memory: RememberedDataTableSettings[]
): {
  next: LayerDataTableState | null;
  memory: RememberedDataTableSettings[];
} {
  let nextMemory = memory;
  if (previous?.stableId) {
    nextMemory = rememberDataTableSettings(nextMemory, previous);
  }
  if (incoming === null || !incoming.stableId) {
    return { next: null, memory: nextMemory };
  }
  if (isDataTableActivationOnly(incoming)) {
    const remembered = lookupDataTableSettings(nextMemory, incoming.stableId);
    if (!remembered) {
      return { next: { stableId: incoming.stableId }, memory: nextMemory };
    }
    const restored: LayerDataTableState = {
      stableId: incoming.stableId,
      column: remembered.column,
      op: remembered.op,
      filters: remembered.filters ? [...remembered.filters] : undefined,
    };
    return {
      next: restored,
      memory: rememberDataTableSettings(nextMemory, restored),
    };
  }
  const next: LayerDataTableState = { ...incoming };
  return {
    next,
    memory: rememberDataTableSettings(nextMemory, next),
  };
}
