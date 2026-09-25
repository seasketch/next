import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import clsx from "clsx";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
} from "@radix-ui/react-icons";
import Button from "../components/Button";
import Spinner from "../components/Spinner";
import { MapManagerContext } from "./MapContextManager";
import {
  parseWithinReplicateOperations,
  withinOpForColumn,
  WithinReplicateOp,
} from "./dataTableQueryApi";
import {
  columnStatsUrlForTable,
  useDataTableColumnStats,
} from "./useDataTableColumnStats";
import {
  CalculationRowsSelection,
  DataTableAggregation,
  DataTableCalculationRowsResult,
  DataTableFeatureSeriesPoint,
  DataTableFilter,
  dataTableFilterLabel,
  dataTableInFilterValues,
  defaultHiddenCalculationColumns,
  filterRowsOverlappingSteps,
  isInternalWhenColumn,
  parseFilterColumnLabels,
  resolveCalculationRowsSelection,
  temporalSourceFilterColumns,
  WHEN_START_COLUMN,
} from "./dataTableQueryApi";
import {
  calculationRowsExportFilename,
  calculationRowsToCsv,
  downloadCalculationRowsCsv,
} from "./dataTableCalculationRowsExport";
import { organismColumnFromTable } from "./orgQueryApi";
import {
  DataTableSparklineSvg,
  dataTableSparklineLayout,
  formatDataTableSiteLabel,
  formatDataTableTooltipRange,
  formatStepTick,
} from "./DataTableValueTooltip";
import { formatLegendNumber } from "./legends/DataTableLegendBubble";

/** A, B, … Z, AA, AB, … so a long replicate list stays unambiguous. */
const REPLICATE_SORT_ID = "__replicate";

function replicateCode(index: number): string {
  let n = index + 1;
  let code = "";
  while (n > 0) {
    n -= 1;
    code = String.fromCharCode(65 + (n % 26)) + code;
    n = Math.floor(n / 26);
  }
  return code;
}

function reduceWithin(op: WithinReplicateOp, values: number[]): number {
  if (op === "sum") return values.reduce((total, value) => total + value, 0);
  if (op === "mean") {
    return values.reduce((total, value) => total + value, 0) / values.length;
  }
  if (op === "min") return Math.min(...values);
  return Math.max(...values);
}

function reduceAcross(op: DataTableAggregation, values: number[]): number | null {
  if (values.length === 0) return null;
  if (op === "count") return values.length;
  if (op === "sum") return values.reduce((total, value) => total + value, 0);
  if (op === "min") return Math.min(...values);
  if (op === "max") return Math.max(...values);
  if (op === "median") {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function finiteMeasure(row: { [column: string]: unknown }, column: string): number | null {
  const raw = row[column];
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * QA/QC modal listing every row involved in calculating the statistics shown
 * on the map for one site (join-column value), with the currently active
 * filters and map clock applied.
 *
 * CONSISTENCY: the rows displayed here are fetched through
 * `MapContextManager.fetchDataTableCalculationRows`, which derives the
 * raw-row request from the *same* clock-resolved query object used to paint
 * the map (see `DataTableQueryManager.fetchCalculationRows`). The statistics
 * in the header come from the engine's own aggregate responses — this
 * component never recomputes statistics client-side. The one piece of
 * client-side logic that mirrors the engine is `rowWhenOverlapsStep` /
 * `filterRowsOverlappingSteps` (dataTableQueryApi.ts), the engine's
 * row↔step assignment rule, which shares `expandTemporalIso` with the
 * engine. Keep them in lockstep. A map clock that spans multiple steps
 * audits that whole window — the same range aggregate painted on the map —
 * instead of collapsing to the latest year.
 */

type CalculationRow = { [column: string]: unknown };

const HEADER_FONT = "600 12px Inter, ui-sans-serif, system-ui, sans-serif";
const CELL_FONT = "400 12px Inter, ui-sans-serif, system-ui, sans-serif";
/** `px-3` on the header and cells. */
const COLUMN_PAD_X = 24;
/** Room for the sort arrow drawn after the header label. */
const SORT_MARK = 18;
/** Long cell values can still ellipsize. Headers never do. */
const MAX_CELL_COLUMN_WIDTH = 280;

let measureCanvas: HTMLCanvasElement | null = null;

function textWidth(text: string, font: string): number {
  if (typeof document === "undefined") {
    return text.length * 8;
  }
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
  const context = measureCanvas.getContext("2d");
  if (!context) {
    return text.length * 8;
  }
  context.font = font;
  return context.measureText(text).width;
}

/** Column is at least as wide as its full header, and wider when the values need it. */
function fitColumnWidth(label: string, samples: string[]): number {
  const header =
    Math.ceil(textWidth(label, HEADER_FONT)) + COLUMN_PAD_X + SORT_MARK + 4;
  let data = 0;
  for (const sample of samples) {
    data = Math.max(
      data,
      Math.ceil(textWidth(sample, CELL_FONT)) + COLUMN_PAD_X
    );
  }
  return Math.max(header, Math.min(data, MAX_CELL_COLUMN_WIDTH));
}
/**
 * Naive (non-virtualized) rendering keeps scrolling instant, but very large
 * result sets would create hundreds of thousands of cells. Cap the rendered
 * rows and offer a "show all" escape hatch.
 */
const MAX_RENDERED_ROWS = 500;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 150;
const CHART_MAX_POINTS = 240;

const HIDDEN_COLUMNS_STORAGE_PREFIX =
  // eslint-disable-next-line i18next/no-literal-string
  "seasketch:dataTableCalculationRows:hiddenColumns:";

function loadStoredHiddenColumns(
  tableStableId?: string | null
): Set<string> | null {
  if (!tableStableId || typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(
      HIDDEN_COLUMNS_STORAGE_PREFIX + tableStableId
    );
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return new Set(
      parsed.filter((value): value is string => typeof value === "string")
    );
  } catch {
    return null;
  }
}

function storeHiddenColumns(
  tableStableId: string | undefined | null,
  hidden: Set<string>
) {
  if (!tableStableId || typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      HIDDEN_COLUMNS_STORAGE_PREFIX + tableStableId,
      JSON.stringify([...hidden])
    );
  } catch {
    // Storage may be full or blocked; hiding still works for this session.
  }
}

/** Most relevant columns first: time, measure, active filters, then rest. */
export function orderCalculationColumns(
  all: string[],
  options: {
    temporalSourceColumns: string[];
    measureColumn?: string;
    filterColumns: string[];
    joinColumn: string;
  }
): string[] {
  const available = all.filter((name) => !isInternalWhenColumn(name));
  const availableSet = new Set(available);
  const ordered: string[] = [];
  const push = (name?: string) => {
    if (name && availableSet.has(name) && ordered.indexOf(name) === -1) {
      ordered.push(name);
    }
  };
  for (const name of options.temporalSourceColumns) {
    push(name);
  }
  push(options.measureColumn);
  for (const name of options.filterColumns) {
    push(name);
  }
  const rest = available.filter(
    (name) => ordered.indexOf(name) === -1 && name !== options.joinColumn
  );
  return [...ordered, ...rest, options.joinColumn].filter((name) =>
    availableSet.has(name)
  );
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined;
}

/** Nulls sort last regardless of direction; numbers numerically. */
function compareCellValues(a: unknown, b: unknown): number {
  if (isEmptyValue(a)) return isEmptyValue(b) ? 0 : 1;
  if (isEmptyValue(b)) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function CellValue({ value }: { value: unknown }) {
  const { t } = useTranslation("homepage");
  if (isEmptyValue(value)) {
    // Distinguishing true nulls from zeros is a core purpose of this tool.
    return (
      <span className="italic text-gray-400" title={t("No value (null)")}>
        {t("null")}
      </span>
    );
  }
  const text = String(value);
  return (
    <span className={typeof value === "number" ? "tabular-nums" : undefined}>
      {text}
    </span>
  );
}

export default function DataTableCalculationRowsModal({
  tocStableId,
  initialSite,
  onRequestClose,
}: {
  tocStableId: string;
  /** Join-column value of the clicked feature, when known. */
  initialSite?: string;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("homepage");
  const { manager } = useContext(MapManagerContext);
  // getDataTableCalculationSettings builds a fresh object per call. Capture it
  // once so downstream useMemo chains stay stable; the modal blocks
  // interaction, so settings can't change while it is open.
  const settings = useMemo(
    () => manager?.getDataTableCalculationSettings(tocStableId),
    [manager, tocStableId]
  );
  const table = settings?.table;
  const { columnStats } = useDataTableColumnStats(
    table ? columnStatsUrlForTable(table) : undefined
  );

  const [site, setSite] = useState<string | undefined>(initialSite);
  const [rowsState, setRowsState] = useState<{
    loading: boolean;
    error?: string;
    result?: DataTableCalculationRowsResult;
  }>({ loading: true });
  const [filterText, setFilterText] = useState("");
  /**
   * Explicit audit target. Undefined means "the map clock": a date range
   * stays the whole window, and an instant clock picks that one step.
   * See {@link resolveCalculationRowsSelection}.
   */
  const [chosenStep, setChosenStep] = useState<
    CalculationRowsSelection | undefined
  >(undefined);
  /** Undefined keeps the mode default (replicate ascending, or unsorted). */
  const [sortOverride, setSortOverride] = useState<
    { id: string; desc: boolean } | null | undefined
  >(undefined);
  const [showAllRows, setShowAllRows] = useState(false);
  const [focusReplicate, setFocusReplicate] = useState<string | null>(null);
  const [highlightedReplicate, setHighlightedReplicate] = useState<string | null>(
    null
  );
  const rowsScrollRef = useRef<HTMLDivElement>(null);

  const joinColumn = table?.joinColumn;
  const sites = useMemo(() => {
    if (!columnStats || !joinColumn) {
      return [];
    }
    const column = columnStats.columns.find(
      (entry) => entry.attribute === joinColumn
    );
    return Object.keys(column?.values || {}).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [columnStats, joinColumn]);

  // Sidebar popups don't know which feature was clicked; default to the
  // first site once the join values load.
  useEffect(() => {
    if (!site && sites.length > 0) {
      setSite(sites[0]);
    }
  }, [site, sites]);

  useEffect(() => {
    if (!manager || !site) {
      return;
    }
    const controller = new AbortController();
    setRowsState({ loading: true });
    manager
      .fetchDataTableCalculationRows(tocStableId, site, controller.signal)
      .then((result) => {
        setRowsState({ loading: false, result });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setRowsState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => controller.abort();
  }, [manager, tocStableId, site]);

  const result = rowsState.result;
  const rows: CalculationRow[] = useMemo(() => result?.rows || [], [result]);
  const hasWhen = useMemo(
    () => rows.some((row) => typeof row[WHEN_START_COLUMN] === "number"),
    [rows]
  );

  const columnLabels = useMemo(
    () => parseFilterColumnLabels(table?.filterColumnLabels),
    [table?.filterColumnLabels]
  );
  const settingsFilters = settings?.query.filters;
  const filters = useMemo(() => settingsFilters || [], [settingsFilters]);
  const measureColumn = settings?.query.column;
  const op: DataTableAggregation = Array.isArray(settings?.query.op)
    ? settings!.query.op[0]
    : settings?.query.op || "mean";

  // Engine-computed statistics for this site: the same cached series that
  // paints the map / hover sparkline.
  const featureSeries = useMemo(
    () =>
      manager && site
        ? manager.getDataTableFeatureSeries(tocStableId, site)
        : null,
    [manager, tocStableId, site]
  );
  const seriesPoints = useMemo(
    () => featureSeries?.points || [],
    [featureSeries]
  );
  const observedSteps = useMemo(
    () => seriesPoints.filter((point) => point.value !== null),
    [seriesPoints]
  );
  const currentSteps = useMemo(
    () => featureSeries?.currentSteps || [],
    [featureSeries]
  );
  const currentValue =
    manager && site
      ? manager.getDataTableFeatureCurrentValue(tocStableId, site)
      : undefined;

  // Derived, not stored in an effect: writing the default after the series
  // arrives used to collapse a date range onto its most recent year once the
  // rows request settled.
  const selection = useMemo(
    () =>
      resolveCalculationRowsSelection(
        chosenStep,
        observedSteps.map((point) => point.step),
        currentSteps
      ),
    [chosenStep, observedSteps, currentSteps]
  );

  const hasSeries = observedSteps.length > 0;
  const activeStep =
    hasWhen && selection && selection !== "all" && selection !== "window"
      ? selection
      : null;
  const activeStepPoint = activeStep
    ? observedSteps.find((point) => point.step === activeStep)
    : undefined;
  const auditingWindow = selection === "window" && currentSteps.length > 1;
  const filterSteps = useMemo(() => {
    if (!hasWhen) {
      return null;
    }
    if (activeStep) {
      return [activeStep];
    }
    if (auditingWindow) {
      return currentSteps;
    }
    return null;
  }, [hasWhen, activeStep, auditingWindow, currentSteps]);

  const stepFilteredRows = useMemo(() => {
    if (!filterSteps) {
      return rows;
    }
    return filterRowsOverlappingSteps(rows, filterSteps);
  }, [rows, filterSteps]);
  const highlightSteps = useMemo(
    () => (auditingWindow ? currentSteps : activeStep ? [activeStep] : []),
    [auditingWindow, currentSteps, activeStep]
  );

  const temporalColumns = useMemo(
    () => temporalSourceFilterColumns(table?.temporal),
    [table?.temporal]
  );
  const organismColumn = useMemo(
    () => organismColumnFromTable(table as { organism?: unknown } | null),
    [table]
  );

  const orderedColumnNames = useMemo(() => {
    const fromStats = (columnStats?.columns || []).map(
      (column) => column.attribute
    );
    const fromRows = rows.length > 0 ? Object.keys(rows[0]) : [];
    const all = fromStats.length > 0 ? fromStats : fromRows;
    if (all.length === 0 || !joinColumn) {
      return [];
    }
    return orderCalculationColumns(all, {
      temporalSourceColumns: temporalColumns,
      measureColumn,
      filterColumns: filters.map((filter) => filter.column),
      joinColumn,
    });
  }, [columnStats, rows, joinColumn, temporalColumns, measureColumn, filters]);

  const filteredColumnSet = useMemo(
    () => new Set(filters.map((filter) => filter.column)),
    [filters]
  );

  // Column visibility: constant-valued columns start hidden (except those
  // central to the calculation); the user can override via the dropdown.
  const defaultHidden = useMemo(
    () =>
      defaultHiddenCalculationColumns(orderedColumnNames, rows, {
        filterColumns: [...filteredColumnSet],
        temporalSourceColumns: temporalColumns,
        organismColumn,
        measureColumn,
      }),
    [
      orderedColumnNames,
      rows,
      filteredColumnSet,
      temporalColumns,
      organismColumn,
      measureColumn,
    ]
  );
  // User overrides persist per table across modal opens.
  const [manualHidden, setManualHidden] = useState<Set<string> | null>(() =>
    loadStoredHiddenColumns(table?.stableId)
  );
  const hiddenColumns = manualHidden ?? defaultHidden;
  const toggleColumnHidden = (name: string) => {
    const next = new Set(hiddenColumns);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setManualHidden(next);
    storeHiddenColumns(table?.stableId, next);
  };

  const columnIds = useMemo(
    () => orderedColumnNames.filter((name) => !hiddenColumns.has(name)),
    [orderedColumnNames, hiddenColumns]
  );

  // Stop sorting by a column once it is hidden.
  useEffect(() => {
    if (
      sortOverride &&
      sortOverride.id !== REPLICATE_SORT_ID &&
      hiddenColumns.has(sortOverride.id)
    ) {
      setSortOverride(null);
    }
  }, [sortOverride, hiddenColumns]);

  const replicateRollup = useMemo(() => {
    if (!table || table.calculationMode !== "replicates" || !settings?.query.column) {
      return null;
    }
    const ids = (table.additionalReplicateIdentifiers || []).filter(
      (name): name is string => Boolean(name)
    );
    if (ids.length === 0) return null;
    const column = settings.query.column;
    const within = withinOpForColumn(
      parseWithinReplicateOperations(table.withinReplicateOperations),
      column
    );
    const groups = new Map<string, number[]>();
    for (const row of stepFilteredRows) {
      const key = ids.map((id) => String(row[id] ?? "")).join("\u0000");
      const raw = row[column];
      const value = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(value)) continue;
      const bucket = groups.get(key);
      if (bucket) bucket.push(value);
      else groups.set(key, [value]);
    }
    const reduced = [...groups.values()].map((values) =>
      reduceWithin(within, values)
    );
    return { count: reduced.length, within };
  }, [settings?.query.column, stepFilteredRows, table]);

  const replicateAssignments = useMemo(() => {
    if (!table || table.calculationMode !== "replicates") {
      return null;
    }
    const extra = (table.additionalReplicateIdentifiers || []).filter(
      (name): name is string => Boolean(name)
    );
    if (extra.length === 0 || stepFilteredRows.length === 0) {
      return null;
    }
    const present = new Set(Object.keys(stepFilteredRows[0]));
    const identity = [
      ...temporalSourceFilterColumns(table.temporal),
      table.joinColumn,
      ...extra,
    ].filter((name, index, all) => name && present.has(name) && all.indexOf(name) === index);
    if (identity.length === 0) return null;
    const keyFor = (row: { [column: string]: unknown }) =>
      identity.map((name) => String(row[name] ?? "")).join("\u0000");
    const unique = [...new Set(stepFilteredRows.map(keyFor))].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0
    );
    const codeByKey = new Map(
      unique.map((key, index) => [key, replicateCode(index)])
    );
    const orderByKey = new Map(unique.map((key, index) => [key, index]));
    const columnPhrase = identity
      .map((name) => dataTableFilterLabel(name, columnLabels))
      .join(", ");
    const byRow = new Map<
      { [column: string]: unknown },
      { code: string; definition: string; order: number }
    >();
    for (const row of stepFilteredRows) {
      byRow.set(row, {
        code: codeByKey.get(keyFor(row)) || "A",
        definition: columnPhrase,
        order: orderByKey.get(keyFor(row)) ?? 0,
      });
    }
    return byRow;
  }, [columnLabels, stepFilteredRows, table]);

  const sortState = useMemo(
    () =>
      sortOverride === undefined
        ? replicateAssignments
          ? { id: REPLICATE_SORT_ID, desc: false }
          : null
        : sortOverride?.id === REPLICATE_SORT_ID && !replicateAssignments
          ? null
          : sortOverride,
    [replicateAssignments, sortOverride]
  );

  const calculationMath = useMemo(() => {
    if (!measureColumn || !table) return null;
    if (replicateAssignments) {
      const within = withinOpForColumn(
        parseWithinReplicateOperations(table.withinReplicateOperations),
        measureColumn
      );
      const byCode = new Map<
        string,
        { code: string; order: number; values: number[] }
      >();
      for (const row of stepFilteredRows) {
        const assignment = replicateAssignments.get(row);
        if (!assignment) continue;
        let group = byCode.get(assignment.code);
        if (!group) {
          group = { code: assignment.code, order: assignment.order, values: [] };
          byCode.set(assignment.code, group);
        }
        const value = finiteMeasure(row, measureColumn);
        if (value !== null) group.values.push(value);
      }
      const groups = [...byCode.values()]
        .sort((a, b) => a.order - b.order)
        .map((group) => ({
          ...group,
          reduced: group.values.length
            ? reduceWithin(within, group.values)
            : null,
        }));
      const reducedValues = groups
        .map((group) => group.reduced)
        .filter((value): value is number => value !== null);
      return {
        mode: "replicates" as const,
        within,
        groups,
        result: reduceAcross(op, reducedValues),
      };
    }
    const values: number[] = [];
    for (const row of stepFilteredRows) {
      const value = finiteMeasure(row, measureColumn);
      if (value !== null) values.push(value);
    }
    const sum = values.reduce((total, value) => total + value, 0);
    return {
      mode: "simple" as const,
      values,
      sum,
      result: reduceAcross(op, values),
    };
  }, [measureColumn, op, replicateAssignments, stepFilteredRows, table]);

  const displayRows = useMemo(() => {
    let out = stepFilteredRows;
    const needle = filterText.trim().toLowerCase();
    if (needle) {
      out = out.filter((row) =>
        columnIds.some((name) => {
          const value = row[name];
          return (
            value !== null &&
            value !== undefined &&
            String(value).toLowerCase().includes(needle)
          );
        })
      );
    }
    if (sortState) {
      const key = sortState.id;
      const desc = sortState.desc;
      out = [...out].sort((a, b) => {
        if (key === REPLICATE_SORT_ID) {
          const ao = replicateAssignments?.get(a)?.order ?? 0;
          const bo = replicateAssignments?.get(b)?.order ?? 0;
          return desc ? bo - ao : ao - bo;
        }
        const av = a[key];
        const bv = b[key];
        // Nulls last in both directions.
        if (isEmptyValue(av) || isEmptyValue(bv)) {
          return compareCellValues(av, bv);
        }
        const c = compareCellValues(av, bv);
        return desc ? -c : c;
      });
    }
    return out;
  }, [stepFilteredRows, filterText, sortState, columnIds, replicateAssignments]);

  useEffect(() => {
    setShowAllRows(false);
  }, [site, selection, filterText]);

  // Bespoke modal shell (not components/Modal): headlessui's Dialog treats
  // Radix portals (the hidden-columns dropdown) as outside clicks and closes
  // the whole modal. Escape defers to any open Radix menu.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      if (document.querySelector("[data-radix-popper-content-wrapper]")) {
        return;
      }
      onRequestClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onRequestClose]);

  const renderedRows = showAllRows
    ? displayRows
    : displayRows.slice(0, MAX_RENDERED_ROWS);

  useEffect(() => {
    if (!focusReplicate) return;
    const scroller = rowsScrollRef.current;
    const code = CSS.escape(focusReplicate);
    const total = scroller?.querySelector(`[data-replicate-total="${code}"]`);
    const start = scroller?.querySelector(`[data-replicate-start="${code}"]`);
    // The subtotal is rendered only after the group's last row. A long
    // replicate can be cut off by the render cap, so expand before scrolling.
    if (!total && sortState?.id === REPLICATE_SORT_ID && !showAllRows && start) {
      setShowAllRows(true);
      return;
    }
    const target = total || start;
    if (!target) {
      if (!showAllRows) setShowAllRows(true);
      return;
    }
    setHighlightedReplicate(focusReplicate);
    target.scrollIntoView({
      block: total ? "end" : "center",
      behavior: "smooth",
    });
    setFocusReplicate(null);
  }, [focusReplicate, renderedRows, showAllRows, sortState?.id]);

  useEffect(() => {
    const scroller = rowsScrollRef.current;
    if (!highlightedReplicate || !scroller) return;
    let settled: number | null = null;
    const arm = () => {
      settled = scroller.scrollTop;
    };
    const onScroll = () => {
      if (settled === null) return;
      if (Math.abs(scroller.scrollTop - settled) > 56) {
        setHighlightedReplicate(null);
      }
    };
    scroller.addEventListener("scrollend", arm);
    const fallback = window.setTimeout(arm, 800);
    scroller.addEventListener("scroll", onScroll);
    return () => {
      window.clearTimeout(fallback);
      scroller.removeEventListener("scrollend", arm);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [highlightedReplicate]);

  const toggleSort = (id: string) => {
    setSortOverride((prev) => {
      const current =
        prev === undefined
          ? replicateAssignments
            ? { id: REPLICATE_SORT_ID, desc: false }
            : null
          : prev;
      if (current?.id === id) {
        return current.desc ? null : { id, desc: true };
      }
      return { id, desc: false };
    });
  };

  const columnWidths = useMemo(() => {
    const sample = stepFilteredRows.slice(0, 120);
    const widths = new Map<string, number>();
    for (const id of columnIds) {
      const texts = sample.map((row) => {
        const raw = row[id];
        return raw === null || raw === undefined || raw === ""
          ? "null"
          : String(raw);
      });
      widths.set(id, fitColumnWidth(dataTableFilterLabel(id, columnLabels), texts));
    }
    return widths;
  }, [columnIds, columnLabels, stepFilteredRows]);
  const columnWidth = (id: string) => columnWidths.get(id) ?? 96;
  const replicateColumnWidth = fitColumnWidth(t("Replicate"), ["W"]);
  const totalWidth =
    columnIds.reduce((sum, id) => sum + columnWidth(id), 0) +
    (replicateAssignments ? replicateColumnWidth : 0);

  const opTitleLabels: { [key in DataTableAggregation]: string } = {
    mean: t("Mean"),
    sum: t("Sum"),
    count: t("Count"),
    min: t("Min"),
    max: t("Max"),
    median: t("Median"),
  };
  const opTitle = opTitleLabels[op] || op;
  const measureLabel = measureColumn
    ? dataTableFilterLabel(measureColumn, columnLabels)
    : undefined;
  const statTitle = measureLabel
    ? t("{{op}} of {{column}}", { op: opTitle, column: measureLabel })
    : opTitle;

  const truncated = Boolean(result && result.rowsMatched > result.rows.length);

  // The headline value being audited: the engine's statistic for the
  // selected step, or the value currently painted on the map. A date range
  // uses that painted value — per-step bins are not recombined here, because
  // a row can fall in more than one step.
  const rangeLabel = formatDataTableTooltipRange(currentSteps);
  const headlineValue: number | null | undefined = activeStep
    ? activeStepPoint?.value
    : currentValue;
  const headlineContext = activeStep
    ? formatStepTick(activeStep)
    : auditingWindow
    ? rangeLabel
    : hasSeries
    ? formatDataTableTooltipRange(
        seriesPoints.map((point) => point.step)
      ) || t("All time steps")
    : undefined;

  if (!settings || !table) {
    return null;
  }
  // Trans interpolation shorthand ({{step}} / {{range}} below).
  const step = activeStep ? formatStepTick(activeStep) : "";
  const range = rangeLabel || "";
  const tableName = table.name;
  const joinLabel = joinColumn
    ? dataTableFilterLabel(joinColumn, columnLabels)
    : "";
  const siteTitle = formatDataTableSiteLabel(site) || site || "";

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t("Rows in calculation")}
    >
      <style>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {`@keyframes replicate-flash {
          0% { background-color: #fcd34d; }
          40% { background-color: #fde68a; }
          100% { background-color: #fffbeb; }
        }
        .replicate-flash { animation: replicate-flash 1.1s ease-out forwards; }`}
      </style>
      <div className="fixed inset-0 bg-gray-500/75" aria-hidden="true" />
      <div
        className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-8"
        onMouseDown={(event) => {
          // Close only on direct backdrop clicks. Clicks inside Radix
          // dropdown portals never reach this container.
          if (event.target === event.currentTarget) {
            onRequestClose();
          }
        }}
      >
        <div className="flex w-full flex-col overflow-hidden rounded-lg bg-white text-left shadow-xl sm:max-w-6xl lg:max-w-7xl">
          <div className="flex-none border-b px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-gray-900">
                  {t("Rows in calculation")}
                </div>
                <div className="mt-0.5 truncate text-sm font-normal text-gray-500">
                  {tableName}
                </div>
              </div>
              <label className="flex flex-none items-center gap-2 text-sm font-normal text-gray-700">
                <span>{joinLabel}</span>
                <select
                  className="max-w-[16rem] truncate rounded border-gray-300 py-1 pl-2 pr-8 text-sm focus:border-primary-500 focus:ring-primary-500"
                  value={site || ""}
                  onChange={(event) => setSite(event.target.value)}
                >
                  {site && sites.indexOf(site) === -1 ? (
                    <option value={site}>{site}</option>
                  ) : null}
                  {sites.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="flex h-[min(80vh,calc(100vh-14rem))] min-h-0 flex-col">
        {/* The claim under audit: engine statistic + series */}
        <div className="flex-none border-b bg-white px-6 pt-4 pb-3">
          <div className="flex items-start gap-8">
            <div className="w-64 flex-none">
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                {statTitle}
              </div>
              <div className="mt-1 text-3xl font-light tabular-nums tracking-tight text-gray-900">
                {typeof headlineValue === "number"
                  ? formatLegendNumber(headlineValue)
                  : t("No data")}
              </div>
              <div className="mt-1 truncate text-sm text-gray-600">
                {siteTitle}
                {headlineContext ? (
                  <span className="text-gray-400">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    {" · "}
                    {headlineContext}
                  </span>
                ) : null}
              </div>
              {filters.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {filters.map((filter, index) => (
                    <FilterChip
                      key={`${filter.column}-${index}`}
                      filter={filter}
                      labels={columnLabels}
                    />
                  ))}
                </div>
              )}
            </div>
            {hasSeries && (
              <div className="min-w-0 flex-1">
                <AuditSparkline
                  points={seriesPoints}
                  highlightSteps={highlightSteps}
                  onSelect={setChosenStep}
                  statTitle={statTitle}
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-gray-400">
                    {t("Click the chart to audit a different time step.")}
                  </span>
                  <span className="flex flex-none items-center gap-1.5">
                    {rangeLabel ? (
                      <button
                        type="button"
                        className={stepPillClass(selection === "window")}
                        onClick={() => setChosenStep("window")}
                      >
                        {rangeLabel}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={stepPillClass(selection === "all")}
                      onClick={() =>
                        setChosenStep(selection === "all" ? undefined : "all")
                      }
                    >
                      {t("All steps")}
                    </button>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rows toolbar */}
        <div className="flex flex-none items-center justify-between gap-3 border-b bg-gray-50 px-6 py-2">
          <div className="min-w-0 text-sm text-gray-800">
            {rowsState.loading ? (
              t("Loading rows…")
            ) : auditingWindow ? (
              <Trans ns="homepage">
                Rows in <strong>{{ range }}</strong>
              </Trans>
            ) : activeStep ? (
              <Trans ns="homepage">
                Rows at <strong>{{ step }}</strong>
              </Trans>
            ) : (
              t("All rows")
            )}
            {!rowsState.loading && result ? (
              <span className="ml-1.5 text-gray-400">
                {filterText
                  ? t("({{shown}} of {{total}})", {
                      shown: displayRows.length,
                      total: stepFilteredRows.length,
                    })
                  : t("({{total}})", { total: displayRows.length })}
              </span>
            ) : null}
            {replicateRollup ? (
              <span className="ml-2 text-gray-500">
                {t("{{count}} {{unit}} totals ({{within}} within each)", {
                  count: replicateRollup.count,
                  unit: table?.replicateLabel === "custom" && table.replicateLabelCustom
                    ? table.replicateLabelCustom
                    : table?.replicateLabel || t("replicate"),
                  within: replicateRollup.within,
                })}
              </span>
            ) : null}
            {(activeStep || auditingWindow) &&
            !rowsState.loading &&
            result &&
            stepFilteredRows.length !== rows.length ? (
              <span className="ml-2 text-xs text-gray-400">
                {t("{{total}} rows across all steps", { total: rows.length })}
              </span>
            ) : null}
            {truncated && result ? (
              <span className="ml-2 text-xs text-amber-600">
                {t("Only the first {{shown}} of {{total}} matching rows were fetched.", {
                  shown: result.rows.length,
                  total: result.rowsMatched,
                })}
              </span>
            ) : null}
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              className="flex flex-none items-center gap-1.5 rounded border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={rowsState.loading || displayRows.length === 0}
              title={t("Download these rows as CSV")}
              onClick={() => {
                const columns = [
                  ...(replicateAssignments
                    ? [{ id: "__replicate", label: t("Replicate") }]
                    : []),
                  ...columnIds.map((id) => ({
                    id,
                    label: dataTableFilterLabel(id, columnLabels),
                  })),
                ];
                const exportRows = replicateAssignments
                  ? displayRows.map((row) => ({
                      ...row,
                      __replicate: replicateAssignments.get(row)?.code ?? "",
                    }))
                  : displayRows;
                const context = auditingWindow
                  ? range
                  : activeStep
                  ? step
                  : t("All steps");
                downloadCalculationRowsCsv(
                  calculationRowsExportFilename([
                    table.name,
                    site || "",
                    context,
                  ]),
                  calculationRowsToCsv(columns, exportRows)
                );
              }}
            >
              <DownloadIcon className="h-3.5 w-3.5 text-gray-500" />
              {t("Export CSV")}
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex flex-none items-center gap-1.5 rounded border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t("{{count}} Hidden Columns", {
                    count: hiddenColumns.size,
                  })}
                  <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  className="z-[60] max-h-80 w-64 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg"
                >
                  {orderedColumnNames.map((name) => {
                    const visible = !hiddenColumns.has(name);
                    return (
                      <DropdownMenu.CheckboxItem
                        key={name}
                        checked={visible}
                        onCheckedChange={() => toggleColumnHidden(name)}
                        onSelect={(event) => event.preventDefault()}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 focus:bg-gray-100 focus:outline-none"
                      >
                        <span
                          className={clsx(
                            "flex h-3.5 w-3.5 flex-none items-center justify-center rounded border",
                            visible
                              ? "border-primary-500 bg-primary-500 text-white"
                              : "border-gray-300 bg-white"
                          )}
                        >
                          <DropdownMenu.ItemIndicator>
                            <CheckIcon className="h-3 w-3" />
                          </DropdownMenu.ItemIndicator>
                        </span>
                        <span className="truncate">
                          {dataTableFilterLabel(name, columnLabels)}
                        </span>
                      </DropdownMenu.CheckboxItem>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <input
              type="text"
              className="w-56 flex-none rounded border-gray-300 py-1 px-2 text-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder={t("Search rows…")}
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
            />
          </div>
        </div>

        {/* Rows table */}
        <div ref={rowsScrollRef} className="min-h-0 flex-1 overflow-auto">
          {rowsState.loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner large />
            </div>
          ) : rowsState.error ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-red-600">
              {rowsState.error}
            </div>
          ) : displayRows.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-gray-500">
              {activeStep
                ? t("No rows overlap the selected time step for this site.")
                : auditingWindow
                ? t("No rows overlap the selected time range for this site.")
                : t("No rows match the active filters for this site.")}
            </div>
          ) : (
            <div style={{ width: totalWidth, minWidth: "100%" }}>
              <div className="sticky top-0 z-10 flex border-b bg-gray-100">
                {replicateAssignments ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(REPLICATE_SORT_ID)}
                    style={{ width: replicateColumnWidth }}
                    className="flex-none cursor-pointer truncate px-3 py-1.5 text-left text-xs font-semibold text-gray-600 hover:bg-gray-200"
                    title={t("Sort by this column")}
                  >
                    {t("Replicate")}
                    {sortState?.id === REPLICATE_SORT_ID && (
                      <span className="ml-1 text-gray-400" aria-hidden>
                        {sortState.desc ? "\u2193" : "\u2191"}
                      </span>
                    )}
                  </button>
                ) : null}
                {columnIds.map((id) => {
                  const sorted = sortState?.id === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleSort(id)}
                      style={{ width: columnWidth(id) }}
                      className={clsx(
                        "flex-none cursor-pointer truncate px-3 py-1.5 text-left text-xs font-semibold hover:bg-gray-200",
                        id === measureColumn
                          ? "text-primary-700"
                          : "text-gray-600"
                      )}
                      title={
                        id === measureColumn
                          ? t("Values aggregated for the map")
                          : filteredColumnSet.has(id)
                          ? t("A filter is applied to this column")
                          : t("Sort by this column")
                      }
                    >
                      {dataTableFilterLabel(id, columnLabels)}
                      {filteredColumnSet.has(id) && (
                        <span className="ml-1 text-gray-400" aria-hidden>
                          {/* eslint-disable-next-line i18next/no-literal-string */}
                          {"\u25BD"}
                        </span>
                      )}
                      {sorted && (
                        <span className="ml-1 text-gray-400" aria-hidden>
                          {sortState!.desc ? "\u2193" : "\u2191"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {renderedRows.map((row, index) => {
                const replicate = replicateAssignments?.get(row);
                const nextRow = renderedRows[index + 1];
                const nextCode = nextRow
                  ? replicateAssignments?.get(nextRow)?.code
                  : undefined;
                const displayIndex = displayRows.indexOf(row);
                const following = displayRows[displayIndex + 1];
                const groupEnded =
                  sortState?.id === REPLICATE_SORT_ID &&
                  replicate &&
                  replicate.code !== nextCode &&
                  (!following ||
                    replicateAssignments?.get(following)?.code !== replicate.code);
                const groupMath =
                  groupEnded && calculationMath?.mode === "replicates"
                    ? calculationMath.groups.find(
                        (group) => group.code === replicate.code
                      )
                    : undefined;
                const previous = renderedRows[index - 1];
                const groupStart =
                  !!replicate &&
                  replicateAssignments?.get(previous)?.code !== replicate.code;
                return (
                <div key={index}>
                <div
                  data-replicate-start={groupStart ? replicate.code : undefined}
                  className={clsx(
                    "flex border-b border-gray-100 text-xs",
                    highlightedReplicate &&
                      replicate?.code === highlightedReplicate
                      ? "replicate-flash"
                      : index % 2 === 1 && "bg-gray-50"
                  )}
                >
                  {replicateAssignments?.get(row) ? (
                    <div
                      style={{ width: replicateColumnWidth }}
                      className="flex-none px-3 py-1.5"
                    >
                      <span className="group relative">
                        <span
                          className="cursor-help border-b border-dotted border-gray-400 font-medium text-gray-800"
                          tabIndex={0}
                        >
                          {replicateAssignments.get(row)!.code}
                        </span>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded bg-gray-900 px-2 py-1.5 text-left text-[11px] font-normal leading-snug text-white group-hover:block group-focus-within:block"
                        >
                          {t(
                            "A replicate is every row that shares {{columns}}.",
                            {
                              columns:
                                replicateAssignments.get(row)!.definition,
                            }
                          )}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {columnIds.map((id) => {
                    const isMeasure = id === measureColumn;
                    const cellValue = row[id];
                    return (
                      <div
                        key={id}
                        style={{ width: columnWidth(id) }}
                        className={clsx(
                          "flex-none truncate px-3 py-1.5",
                          isMeasure && "bg-primary-500/5 font-medium"
                        )}
                        title={
                          isEmptyValue(cellValue)
                            ? undefined
                            : String(cellValue)
                        }
                      >
                        <CellValue value={cellValue} />
                      </div>
                    );
                  })}
                </div>
                {groupMath && groupMath.reduced !== null ? (
                  <div
                    data-replicate-total={groupMath.code}
                    className={clsx(
                      "flex scroll-mb-2 items-baseline gap-3 border-b border-primary-100 px-3 py-1.5 text-xs text-primary-900",
                      highlightedReplicate === groupMath.code
                        ? "replicate-flash"
                        : "bg-primary-50"
                    )}
                  >
                    <span
                      className="flex-none font-semibold"
                      style={{ width: replicateColumnWidth }}
                    >
                      {groupMath.code}
                    </span>
                    <span className="text-primary-800">
                      {t("{{within}} of {{column}}", {
                        within:
                          calculationMath?.mode === "replicates"
                            ? opTitleLabels[calculationMath.within]
                            : "",
                        column: measureLabel || measureColumn,
                      })}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatLegendNumber(groupMath.reduced)}
                    </span>
                    <span className="min-w-0 truncate text-primary-700/80">
                      {groupMath.values.length <= 8
                        ? groupMath.values.map((value) => formatLegendNumber(value)).join(" + ")
                        : t("{{count}} values", { count: groupMath.values.length })}
                    </span>
                  </div>
                ) : null}
                </div>
                );
              })}
              {!showAllRows && displayRows.length > MAX_RENDERED_ROWS && (
                <div className="flex items-center justify-center border-b border-gray-100 py-3">
                  <button
                    type="button"
                    className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowAllRows(true)}
                  >
                    {t("Show all {{total}} rows", {
                      total: displayRows.length,
                    })}
                  </button>
                </div>
              )}
            </div>
          )}
            </div>
          </div>
          {calculationMath ? (
            <CalculationMathStrip
              math={calculationMath}
              columnLabel={measureLabel || measureColumn || ""}
              acrossLabel={opTitle}
            op={op}
            onFocusReplicate={setFocusReplicate}
          />
          ) : null}
          <div className="flex flex-none items-center justify-end border-t bg-gray-50 px-6 py-3">
            <Button label={t("Close")} onClick={onRequestClose} primary />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ReplicateExpression({
  op,
  groups,
  result,
  onFocusReplicate,
}: {
  op: DataTableAggregation;
  groups: { code: string; reduced: number | null }[];
  result: number | null;
  onFocusReplicate?: (code: string) => void;
}) {
  const { t } = useTranslation("homepage");
  const terms = groups.map((group, index) => (
    <span key={group.code}>
      {index > 0 ? (
        <span className="text-gray-400">
          {op === "min" || op === "max" || op === "median" ? ", " : " + "}
        </span>
      ) : null}
      <button
        type="button"
        className="cursor-pointer rounded px-0.5 text-primary-800 underline decoration-dotted decoration-primary-300 hover:bg-primary-50"
        title={t("Replicate {{code}}", { code: group.code })}
        onClick={() => onFocusReplicate?.(group.code)}
      >
        {group.reduced === null ? t("null") : formatLegendNumber(group.reduced)}
      </button>
    </span>
  ));
  const resultText = result === null ? t("null") : formatLegendNumber(result);
  return (
    <>
      {op === "mean" ? (
        // eslint-disable-next-line i18next/no-literal-string
        <span>(</span>
      ) : null}
      {op === "min" ? (
        <span>
          {t("min")}
          {/* eslint-disable-next-line i18next/no-literal-string */}
          (
        </span>
      ) : null}
      {op === "max" ? (
        <span>
          {t("max")}
          {/* eslint-disable-next-line i18next/no-literal-string */}
          (
        </span>
      ) : null}
      {op === "median" ? (
        <span>
          {t("median")}
          {/* eslint-disable-next-line i18next/no-literal-string */}
          (
        </span>
      ) : null}
      {terms}
      {op === "mean" ? (
        <span>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {") / "}
          {groups.length}
        </span>
      ) : null}
      {op === "min" || op === "max" || op === "median" ? (
        // eslint-disable-next-line i18next/no-literal-string
        <span>)</span>
      ) : null}
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <span className="mx-1 text-gray-400">=</span>
      <span className="font-semibold text-gray-900">{resultText}</span>
    </>
  );
}

function CalculationMathStrip({
  math,
  columnLabel,
  acrossLabel,
  op,
  onFocusReplicate,
}: {
  math:
    | {
        mode: "replicates";
        within: WithinReplicateOp;
        groups: {
          code: string;
          values: number[];
          reduced: number | null;
        }[];
        result: number | null;
      }
    | {
        mode: "simple";
        values: number[];
        sum: number;
        result: number | null;
      };
  columnLabel: string;
  acrossLabel: string;
  op: DataTableAggregation;
  onFocusReplicate?: (code: string) => void;
}) {
  const { t } = useTranslation("homepage");
  const withinLabel: { [key in WithinReplicateOp]: string } = {
    sum: t("Sum"),
    mean: t("Mean"),
    min: t("Min"),
    max: t("Max"),
  };
  if (math.mode === "replicates") {
    return (
      <div className="flex-none border-b bg-gray-50 px-6 py-2.5">
        <p className="text-[11px] text-gray-500">
          {t(
            "{{within}} {{column}} inside each replicate, then {{across}} those {{count}} replicate values.",
            {
              within: withinLabel[math.within],
              column: columnLabel,
              across: acrossLabel,
              count: math.groups.length,
            }
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-0.5 text-sm tabular-nums text-gray-800">
          <ReplicateExpression
            op={op}
            groups={math.groups}
            result={math.result}
            onFocusReplicate={onFocusReplicate}
          />
        </div>
      </div>
    );
  }
  const preview = math.values.slice(0, 8).map((value) => formatLegendNumber(value));
  const more = math.values.length - preview.length;
  return (
    <div className="flex-none border-b bg-gray-50 px-6 py-2.5">
      <p className="text-[11px] text-gray-500">
        {t("Each row is one observation. {{op}} of {{column}} uses every value below.", {
          op: acrossLabel,
          column: columnLabel,
        })}
      </p>
      <p className="mt-1 text-sm tabular-nums text-gray-800">
        {op === "mean" && math.values.length > 0
          ? t("{{sum}} ÷ {{count}} = {{result}}", {
              sum: formatLegendNumber(math.sum),
              count: math.values.length,
              result: math.result === null ? t("null") : formatLegendNumber(math.result),
            })
          : t("{{op}} of {{count}} values = {{result}}", {
              op: acrossLabel,
              count: math.values.length,
              result: math.result === null ? t("null") : formatLegendNumber(math.result),
            })}
        {preview.length > 0 ? (
          <span className="ml-2 text-xs text-gray-500">
            {preview.join(", ")}
            {more > 0 ? t(", +{{count}} more", { count: more }) : ""}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * The tooltip's sparkline, rendered wider and made interactive: clicking a
 * point selects that time step for auditing. Uses the shared
 * `DataTableSparklineSvg` renderer so it looks identical to the map hover
 * tooltip's chart.
 */
function stepPillClass(active: boolean) {
  return clsx(
    "flex-none rounded-full border px-2.5 py-0.5 text-xs",
    active
      ? "border-primary-400 bg-primary-500/10 font-medium text-primary-800"
      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
  );
}

function AuditSparkline({
  points,
  highlightSteps,
  onSelect,
  statTitle,
}: {
  points: DataTableFeatureSeriesPoint[];
  highlightSteps: string[];
  onSelect: (step: string) => void;
  statTitle: string;
}) {
  const { t } = useTranslation("homepage");
  const layout = useMemo(
    () =>
      dataTableSparklineLayout(points, highlightSteps, {
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
        maxPoints: CHART_MAX_POINTS,
        margins: { left: 36, bottom: 20 },
      }),
    [points, highlightSteps]
  );
  const sliceWidth =
    layout.samples.length > 1
      ? layout.samples[1].x - layout.samples[0].x
      : layout.plot.width;
  const plotLeft = layout.plot.x;
  const plotRight = layout.plot.x + layout.plot.width;
  const bandFor = (x: number) => {
    const width = Math.max(sliceWidth, 6);
    const left = Math.max(plotLeft, Math.min(x - width / 2, plotRight - width));
    return { x: left, width };
  };

  return (
    <DataTableSparklineSvg
      layout={layout}
      className="block h-auto w-full"
      fontSize={10}
      dotRadius={2}
    >
      {layout.samples.map((sample) => {
        const observed = sample.value !== null;
        const band = bandFor(sample.x);
        return (
          <rect
            key={sample.step}
            x={band.x}
            y={layout.plot.y}
            width={band.width}
            height={layout.plot.height}
            className={
              observed
                ? "cursor-pointer fill-transparent hover:fill-gray-500/10"
                : "fill-transparent"
            }
            onClick={observed ? () => onSelect(sample.step) : undefined}
          >
            <title>
              {observed
                ? t("{{step}} — {{stat}}: {{value}} (n = {{n}})", {
                    step: formatStepTick(sample.step),
                    stat: statTitle,
                    value: formatLegendNumber(sample.value!),
                    n: String(sample.count ?? "?"),
                  })
                : t("{{step}} — no data", {
                    step: formatStepTick(sample.step),
                  })}
            </title>
          </rect>
        );
      })}
    </DataTableSparklineSvg>
  );
}

function FilterChip({
  filter,
  labels,
}: {
  filter: DataTableFilter;
  labels: { [column: string]: string };
}) {
  const { t } = useTranslation("homepage");
  const label = dataTableFilterLabel(filter.column, labels);
  let description: string;
  let title: string | undefined;
  switch (filter.op) {
    case "in": {
      const values = dataTableInFilterValues(filter);
      description = t("{{label}}: {{count}} selected", {
        label,
        count: values.length,
      });
      title = values.join(", ");
      break;
    }
    case "isNull":
      description = t("{{label}} is empty", { label });
      break;
    case "notNull":
      description = t("{{label}} is not empty", { label });
      break;
    default: {
      const symbols: { [op: string]: string } = {
        eq: "=",
        neq: "\u2260",
        gt: ">",
        gte: "\u2265",
        lt: "<",
        lte: "\u2264",
      };
      // eslint-disable-next-line i18next/no-literal-string
      description = `${label} ${symbols[filter.op] || filter.op} ${
        filter.value ?? ""
      }`;
    }
  }
  return (
    <span
      className="inline-flex max-w-xs items-center truncate rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700"
      title={title}
    >
      {description}
    </span>
  );
}
