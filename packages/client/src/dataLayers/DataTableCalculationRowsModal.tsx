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
  DataTableAuditReplicate,
  DataTableCalculationAudit,
  DataTableCalculationRowsResult,
  DataTableFeatureSeriesPoint,
  DataTableFilter,
  dataTableFilterLabel,
  dataTableInFilterValues,
  defaultHiddenCalculationColumns,
  filterRowsOverlappingSteps,
  isInternalWhenColumn,
  parseFilterColumnLabels,
  replicateIdentityKey,
  resolveCalculationRowsSelection,
  temporalSourceFilterColumns,
  whenBoundsForSteps,
  WHEN_END_COLUMN,
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

/** One line of the rows table: a fetched row, or a replicate subtotal. */
type AuditItem =
  | { kind: "row"; row: CalculationRow; code: string | null; groupStart: boolean }
  | { kind: "subtotal"; group: ReplicateMathGroup };

type AuditView = "replicates" | "rows";

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

type AuditReplicateView = DataTableAuditReplicate & {
  code: string;
  order: number;
  identity: string;
};

type ReplicateMathGroup = {
  code: string;
  status: DataTableAuditReplicate["status"];
  reason: string | null;
  coverageInterval: { start: string; end: string | null } | null;
  /** Engine's within-replicate value. Null when the replicate was left out. */
  reduced: number | null;
  /** Measure values from the rows on screen. Evidence, not the source. */
  values: number[];
  rowsShown: number;
  rowCount: number;
  contributingRows: number;
  verified: boolean | null;
};

type CalculationMath =
  | {
      mode: "replicates";
      within: WithinReplicateOp;
      groups: ReplicateMathGroup[];
      result: number | null;
      denominator: number | null;
    }
  | {
      mode: "simple";
      values: number[];
      sum: number;
      result: number | null;
      count: number;
    };

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

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
  const [auditState, setAuditState] = useState<{
    loading: boolean;
    error?: string;
    audit?: DataTableCalculationAudit;
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
  const [view, setView] = useState<AuditView | undefined>(undefined);
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

  const result = rowsState.result;
  const rows: CalculationRow[] = useMemo(
    () =>
      (result?.rows || []).filter(
        (row) =>
          row._excludedBy !== "subject" &&
          row._excludedBy !== "detail" &&
          row._excludedBy !== "effort" &&
          row._contributes !== false
      ),
    [result]
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
  // Time-aware when the table has row time, not only when fetched rows carry
  // `_when_*`: a step whose replicates are all zero has no matching rows,
  // and the selection must still resolve to that step.
  const hasWhen = useMemo(
    () =>
      Boolean(featureSeries && featureSeries.points.length > 0) ||
      rows.some((row) => typeof row[WHEN_START_COLUMN] === "number"),
    [featureSeries, rows]
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

  const auditedWhen = useMemo(() => {
    if (!selection || selection === "all") return null;
    const steps = selection === "window" ? currentSteps : [selection];
    return whenBoundsForSteps(steps);
  }, [currentSteps, selection]);

  useEffect(() => {
    if (!manager || !site) {
      return;
    }
    // Wait for the sparkline to name the year. Fetching the whole series
    // first returns the earliest 5,000 rows and the selected year is missing.
    if (table?.temporal && !featureSeries) {
      return;
    }
    const controller = new AbortController();
    setRowsState({ loading: true });
    setAuditState({ loading: true });
    manager
      .fetchDataTableCalculationRows(
        tocStableId,
        site,
        controller.signal,
        auditedWhen
      )
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
    manager
      .fetchDataTableCalculationAudit(
        tocStableId,
        site,
        controller.signal,
        auditedWhen
      )
      .then((auditResponse) => {
        setAuditState({ loading: false, audit: auditResponse });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAuditState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => controller.abort();
  }, [auditedWhen, featureSeries, manager, site, table?.temporal, tocStableId]);

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
    const within = withinOpForColumn(
      parseWithinReplicateOperations(table.withinReplicateOperations),
      settings.query.column
    );
    return { within };
  }, [settings?.query.column, table]);

  /**
   * Replicate identity columns, in the order the engine keys them. Rows are
   * matched to engine replicates on these columns.
   */
  const replicateIdentityColumns = useMemo(() => {
    if (!table || table.calculationMode !== "replicates") return null;
    const extra = (table.additionalReplicateIdentifiers || []).filter(
      (name): name is string => Boolean(name)
    );
    if (extra.length === 0) return null;
    return [WHEN_START_COLUMN, WHEN_END_COLUMN, table.joinColumn, ...extra];
  }, [table]);

  const audit = auditState.audit;

  /**
   * Every replicate the engine registered for this site and window, lettered
   * in survey-time order. This is the proof; rows are only evidence for it.
   */
  const auditReplicates = useMemo<AuditReplicateView[] | null>(() => {
    if (!replicateIdentityColumns || !audit?.replicates) return null;
    const sorted = [...audit.replicates].sort((a, b) => {
      const aStart = Number(a.key[WHEN_START_COLUMN] ?? 0);
      const bStart = Number(b.key[WHEN_START_COLUMN] ?? 0);
      if (aStart !== bStart) return aStart - bStart;
      for (const column of replicateIdentityColumns) {
        const c = compareCellValues(a.key[column], b.key[column]);
        if (c !== 0) return c;
      }
      return 0;
    });
    return sorted.map((replicate, index) => ({
      ...replicate,
      code: replicateCode(index),
      order: index,
      identity: replicateIdentityKey(replicate.key, replicateIdentityColumns),
    }));
  }, [audit, replicateIdentityColumns]);

  const replicateAssignments = useMemo(() => {
    if (!auditReplicates || !replicateIdentityColumns) return null;
    const byIdentity = new Map(
      auditReplicates.map((replicate) => [replicate.identity, replicate])
    );
    const columnPhrase = replicateIdentityColumns
      .filter((name) => !isInternalWhenColumn(name))
      .map((name) => dataTableFilterLabel(name, columnLabels))
      .join(", ");
    const byRow = new Map<
      { [column: string]: unknown },
      { code: string; definition: string; order: number }
    >();
    for (const row of stepFilteredRows) {
      const replicate = byIdentity.get(
        replicateIdentityKey(row, replicateIdentityColumns)
      );
      if (!replicate) continue;
      byRow.set(row, {
        code: replicate.code,
        definition: t("survey date, {{columns}}", { columns: columnPhrase }),
        order: replicate.order,
      });
    }
    return byRow;
  }, [auditReplicates, columnLabels, replicateIdentityColumns, stepFilteredRows, t]);

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

  /** Engine result for the audited window, and the terms that produced it. */
  const auditResult = useMemo(() => {
    const group = audit?.group;
    if (!group) return null;
    const value = group[op];
    const count = group.count;
    return {
      value: typeof value === "number" ? value : null,
      count: typeof count === "number" ? count : null,
      surveyed: numberOrZero(group.replicatesSurveyed),
      zero: numberOrZero(group.replicatesZero),
      noValue: numberOrZero(group.replicatesNoValue),
      notSurveyed: numberOrZero(group.replicatesNotSurveyed),
    };
  }, [audit, op]);

  const calculationMath = useMemo<CalculationMath | null>(() => {
    if (!measureColumn || !table) return null;
    if (auditReplicates && replicateRollup) {
      const rowValuesByCode = new Map<string, number[]>();
      const rowsByCode = new Map<string, number>();
      for (const row of stepFilteredRows) {
        const assignment = replicateAssignments?.get(row);
        if (!assignment) continue;
        rowsByCode.set(assignment.code, (rowsByCode.get(assignment.code) || 0) + 1);
        const value = finiteMeasure(row, measureColumn);
        if (value === null) continue;
        const list = rowValuesByCode.get(assignment.code);
        if (list) list.push(value);
        else rowValuesByCode.set(assignment.code, [value]);
      }
      const groups = auditReplicates.map((replicate) => {
        const values = rowValuesByCode.get(replicate.code) || [];
        const fromRows = values.length
          ? reduceWithin(replicateRollup.within, values)
          : null;
        return {
          code: replicate.code,
          status: replicate.status,
          reason: replicate.reason,
          coverageInterval: replicate.coverageInterval,
          reduced: replicate.value,
          values,
          rowsShown: rowsByCode.get(replicate.code) || 0,
          rowCount: replicate.rowCount,
          contributingRows: replicate.contributingRows,
          /** Rows on screen reproduce the engine's within-replicate value. */
          verified:
            replicate.status !== "counted"
              ? null
              : values.length === replicate.contributingRows &&
                fromRows !== null &&
                replicate.value !== null &&
                Math.abs(fromRows - replicate.value) < 1e-9,
        };
      });
      return {
        mode: "replicates",
        within: replicateRollup.within,
        groups,
        result: auditResult?.value ?? null,
        denominator: auditResult?.count ?? null,
      };
    }
    const values: number[] = [];
    for (const row of stepFilteredRows) {
      const value = finiteMeasure(row, measureColumn);
      if (value !== null) values.push(value);
    }
    const sum = values.reduce((total, value) => total + value, 0);
    return {
      mode: "simple",
      values,
      sum,
      result: auditResult ? auditResult.value : reduceAcross(op, values),
      count: auditResult?.count ?? values.length,
    };
  }, [
    auditReplicates,
    auditResult,
    measureColumn,
    op,
    replicateAssignments,
    replicateRollup,
    stepFilteredRows,
    table,
  ]);

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

  /**
   * What the table shows. Sorted by replicate, every engine replicate
   * appears: its rows, then its subtotal, or one line saying why it has no
   * rows here (zero, left out, or not surveyed). Sorted by any other column,
   * rows appear alone.
   */
  const auditItems = useMemo<AuditItem[]>(() => {
    const byReplicate =
      sortState?.id === REPLICATE_SORT_ID &&
      calculationMath?.mode === "replicates" &&
      replicateAssignments;
    if (!byReplicate) {
      let previousCode: string | null | undefined;
      return renderedRows.map((row) => {
        const code = replicateAssignments?.get(row)?.code ?? null;
        const groupStart = code !== null && code !== previousCode;
        previousCode = code;
        return { kind: "row", row, code, groupStart };
      });
    }
    const rowsByCode = new Map<string, CalculationRow[]>();
    for (const row of renderedRows) {
      const code = replicateAssignments.get(row)?.code;
      if (!code) continue;
      const list = rowsByCode.get(code);
      if (list) list.push(row);
      else rowsByCode.set(code, [row]);
    }
    const searching = filterText.trim().length > 0;
    const groups = sortState.desc
      ? [...calculationMath.groups].reverse()
      : calculationMath.groups;
    const items: AuditItem[] = [];
    for (const group of groups) {
      const rows = rowsByCode.get(group.code) || [];
      if (rows.length === 0) continue;
      rows.forEach((row, index) => {
        items.push({ kind: "row", row, code: group.code, groupStart: index === 0 });
      });
      if (!searching) items.push({ kind: "subtotal", group });
    }
    return items;
  }, [calculationMath, filterText, renderedRows, replicateAssignments, sortState]);

  const activeView: AuditView = view ?? "rows";

  /**
   * Formula terms and replicate table rows jump to the evidence. A replicate
   * with no rows on this page has nothing to scroll to in the observation
   * table, so it stays in the replicate table and flashes there.
   */
  const focusReplicateFromFormula = (code: string) => {
    const group =
      calculationMath?.mode === "replicates"
        ? calculationMath.groups.find((item) => item.code === code)
        : undefined;
    if (group && group.rowsShown === 0) {
      setView("replicates");
    } else {
      setView("rows");
    }
    setFocusReplicate(code);
  };

  useEffect(() => {
    if (!focusReplicate) return;
    const scroller = rowsScrollRef.current;
    const code = CSS.escape(focusReplicate);
    const total = scroller?.querySelector(`[data-replicate-total="${code}"]`);
    const start = scroller?.querySelector(`[data-replicate-start="${code}"]`);
    // The subtotal is rendered only after the group's last row. A long
    // replicate can be cut off by the render cap, so expand before scrolling.
    if (
      activeView === "rows" &&
      !total &&
      sortState?.id === REPLICATE_SORT_ID &&
      !showAllRows &&
      start
    ) {
      setShowAllRows(true);
      return;
    }
    const target = total || start;
    if (!target) {
      if (activeView === "rows" && !showAllRows) setShowAllRows(true);
      return;
    }
    setHighlightedReplicate(focusReplicate);
    target.scrollIntoView({
      block: total ? "end" : "center",
      behavior: "smooth",
    });
    setFocusReplicate(null);
  }, [activeView, focusReplicate, renderedRows, showAllRows, sortState?.id]);

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
  const replicateWord: string =
    (table?.replicateLabel === "custom" && table.replicateLabelCustom
      ? table.replicateLabelCustom
      : table?.replicateLabel) || t("replicate");
  const subjectFilterText = (settings?.query.contributionFilters || [])
    .map((filter) => describeFilter(t, filter, columnLabels))
    .join(", ");

  // The headline value being audited. The engine's answer for exactly this
  // site and window wins; the map's painted value is the fallback while the
  // audit loads. A date range uses the pooled range aggregate, never a
  // recombination of per-step bins, because a row can fall in more than one step.
  const rangeLabel = formatDataTableTooltipRange(currentSteps);
  const mapValue: number | null | undefined = activeStep
    ? activeStepPoint?.value
    : currentValue;
  const headlineValue: number | null | undefined = auditResult
    ? auditResult.value
    : mapValue;
  // Only comparable when the audit window is the map's own: one step or the
  // current range. "All steps" pools the whole series, which the map never
  // paints as one number.
  const auditMatchesMapWindow = selection !== "all";
  const engineDisagreesWithMap =
    auditMatchesMapWindow &&
    auditResult !== null &&
    typeof mapValue === "number" &&
    typeof auditResult.value === "number" &&
    Math.abs(mapValue - auditResult.value) > 1e-9;
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
        className="fixed inset-0 flex items-start justify-center px-4 py-6"
        onMouseDown={(event) => {
          // Close only on direct backdrop clicks. Clicks inside Radix
          // dropdown portals never reach this container.
          if (event.target === event.currentTarget) {
            onRequestClose();
          }
        }}
      >
        <div className="flex h-[88vh] max-h-[min(64rem,calc(100vh-3rem))] w-full flex-col overflow-hidden rounded-lg bg-white text-left shadow-xl sm:max-w-6xl lg:max-w-7xl">
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
          <div className="flex min-h-0 flex-1 flex-col">
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
                  : auditState.loading && rowsState.loading
                  ? "…"
                  : t("No data")}
              </div>
              {engineDisagreesWithMap ? (
                <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  {t(
                    "The map shows {{map}} for this selection. The engine's audit for the same window returned {{engine}}. Report this.",
                    {
                      map: formatLegendNumber(mapValue as number),
                      engine: formatLegendNumber(auditResult!.value as number),
                    }
                  )}
                </div>
              ) : null}
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
          <div className="flex min-w-0 items-center gap-3 text-sm text-gray-800">
            {calculationMath?.mode === "replicates" ? (
              <div className="flex flex-none rounded-md border border-gray-300 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  className={viewTabClass(activeView === "rows")}
                  onClick={() => setView("rows")}
                >
                  {t("{{count}} observations", { count: displayRows.length })}
                </button>
                <button
                  type="button"
                  className={viewTabClass(activeView === "replicates")}
                  onClick={() => setView("replicates")}
                >
                  {t("{{count}} {{unit}}s", {
                    count: calculationMath.groups.length,
                    unit: replicateWord,
                  })}
                </button>
              </div>
            ) : null}
            <span className="min-w-0 truncate">
              {rowsState.loading ? (
                t("Loading…")
              ) : auditingWindow ? (
                <Trans ns="homepage">
                  in <strong>{{ range }}</strong>
                </Trans>
              ) : activeStep ? (
                <Trans ns="homepage">
                  at <strong>{{ step }}</strong>
                </Trans>
              ) : (
                t("all time steps")
              )}
              {!rowsState.loading &&
              result &&
              calculationMath?.mode !== "replicates" ? (
                <span className="ml-1.5 text-gray-400">
                  {filterText
                    ? t("({{shown}} of {{total}} rows)", {
                        shown: displayRows.length,
                        total: stepFilteredRows.length,
                      })
                    : t("({{total}} rows)", { total: displayRows.length })}
                </span>
              ) : null}
              {auditResult && calculationMath?.mode === "replicates" ? (
                <span className="ml-2 text-gray-500">
                  {t(
                    "{{counted}} with observations · {{zero}} zero · {{leftOut}} left out",
                    {
                      counted: Math.max(
                        0,
                        (auditResult.count ?? 0) - auditResult.zero
                      ),
                      zero: auditResult.zero,
                      leftOut: auditResult.noValue + auditResult.notSurveyed,
                    }
                  )}
                </span>
              ) : auditState.error ? (
                <span className="ml-2 text-xs text-red-600">
                  {t("Engine audit failed. {{error}}", { error: auditState.error })}
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
            </span>
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
                    ? [
                        { id: "__replicate", label: t("Replicate") },
                        { id: "__status", label: t("Status") },
                      ]
                    : []),
                  ...columnIds.map((id) => ({
                    id,
                    label: dataTableFilterLabel(id, columnLabels),
                  })),
                ];
                const exportRows: CalculationRow[] = [];
                if (replicateAssignments && calculationMath?.mode === "replicates") {
                  const withinLabelText = opTitleLabels[calculationMath.within];
                  for (const group of calculationMath.groups) {
                    const groupRows = displayRows.filter(
                      (row) => replicateAssignments.get(row)?.code === group.code
                    );
                    for (const row of groupRows) {
                      exportRows.push({
                        ...row,
                        __replicate: group.code,
                        __status: t("counted"),
                      });
                    }
                    exportRows.push({
                      __replicate: group.code,
                      __status:
                        group.status === "counted"
                          ? t("{{within}} of {{column}} = {{value}}", {
                              within: withinLabelText,
                              column: measureLabel || measureColumn,
                              value:
                                group.reduced === null
                                  ? t("null")
                                  : formatLegendNumber(group.reduced),
                            })
                          : replicateStatusSentence(t, group, {
                              replicateWord,
                              subjectText: subjectFilterText,
                              withinLabel: withinLabelText,
                              columnLabel: measureLabel || measureColumn || "",
                            }),
                    });
                  }
                } else {
                  exportRows.push(...displayRows);
                }
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
        <div ref={rowsScrollRef} className="min-h-0 flex-1 overflow-auto bg-gray-50/70">
          {rowsState.loading || (auditState.loading && replicateIdentityColumns) ? (
            <div className="flex h-full items-center justify-center">
              <Spinner large />
            </div>
          ) : rowsState.error ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-red-600">
              {rowsState.error}
            </div>
          ) : activeView === "replicates" &&
            calculationMath?.mode === "replicates" &&
            auditReplicates ? (
            <ReplicatesTable
              groups={calculationMath.groups}
              replicates={auditReplicates}
              identityColumns={(replicateIdentityColumns || []).filter(
                (name) => !isInternalWhenColumn(name) && name !== table.joinColumn
              )}
              columnLabels={columnLabels}
              withinLabel={opTitleLabels[calculationMath.within]}
              columnLabel={measureLabel || measureColumn || ""}
              replicateWord={replicateWord}
              subjectText={subjectFilterText}
              highlighted={highlightedReplicate}
              onShowRows={(code) => {
                setView("rows");
                setFocusReplicate(code);
              }}
            />
          ) : auditItems.length === 0 ? (
            <div className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm text-gray-500">
              {auditResult && calculationMath?.mode === "replicates" && auditResult.surveyed > 0 ? (
                <>
                  <span>
                    {t(
                      "{{count}} {{unit}}s were surveyed here, and none of them had an observation matching the filters.",
                      { count: auditResult.surveyed, unit: replicateWord }
                    )}
                  </span>
                  <button
                    type="button"
                    className="text-primary-700 underline decoration-dotted"
                    onClick={() => setView("replicates")}
                  >
                    {t("See how each {{unit}} was resolved", { unit: replicateWord })}
                  </button>
                </>
              ) : activeStep ? (
                t("No rows overlap the selected time step for this site.")
              ) : auditingWindow ? (
                t("No rows overlap the selected time range for this site.")
              ) : (
                t("No rows match the active filters for this site.")
              )}
            </div>
          ) : (
            <div
              className="bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]"
              style={{ width: totalWidth, minWidth: "100%" }}
            >
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
              {auditItems.map((item, index) => {
                if (item.kind === "subtotal") {
                  return (
                    <ReplicateSubtotalLine
                      key={`subtotal-${item.group.code}`}
                      group={item.group}
                      withinLabel={
                        calculationMath?.mode === "replicates"
                          ? opTitleLabels[calculationMath.within]
                          : ""
                      }
                      columnLabel={measureLabel || measureColumn || ""}
                      width={replicateColumnWidth}
                      highlighted={highlightedReplicate === item.group.code}
                      subjectText={subjectFilterText}
                    />
                  );
                }
                const { row, code, groupStart } = item;
                return (
                <div
                  key={index}
                  data-replicate-start={groupStart && code ? code : undefined}
                  className={clsx(
                    "flex border-b border-gray-100 text-xs",
                    highlightedReplicate && code === highlightedReplicate
                      ? "replicate-flash"
                      : index % 2 === 1 && "bg-gray-50"
                  )}
                >
                  {replicateAssignments ? (
                    <div
                      style={{ width: replicateColumnWidth }}
                      className="flex-none px-3 py-1.5"
                    >
                      {code ? (
                        <span className="group relative">
                          <span
                            className="cursor-help border-b border-dotted border-gray-400 font-medium text-gray-800"
                            tabIndex={0}
                          >
                            {code}
                          </span>
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded bg-gray-900 px-2 py-1.5 text-left text-[11px] font-normal leading-snug text-white group-hover:block group-focus-within:block"
                          >
                            {t(
                              "One {{unit}} is every row that shares {{columns}}.",
                              {
                                unit: replicateWord,
                                columns:
                                  replicateAssignments.get(row)?.definition || "",
                              }
                            )}
                          </span>
                        </span>
                      ) : (
                        <span
                          className="text-gray-400"
                          title={t(
                            "The engine did not register a replicate for this row in the audited window."
                          )}
                        >
                          {/* eslint-disable-next-line i18next/no-literal-string */}
                          {"—"}
                        </span>
                      )}
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
                            ? isMeasure
                              ? t("Empty value. It does not add to the total.")
                              : undefined
                            : String(cellValue)
                        }
                      >
                        <CellValue value={cellValue} />
                      </div>
                    );
                  })}
                </div>
                );
              })}
              {!showAllRows && displayRows.length > MAX_RENDERED_ROWS ? (
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
              ) : (
                <TableEndCap
                  label={t("End of {{count}} observations", {
                    count: displayRows.length,
                  })}
                />
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
              onFocusReplicate={focusReplicateFromFormula}
              replicateWord={replicateWord}
              subjectText={subjectFilterText}
              surveyFilterText={filters
                .map((filter) => describeFilter(t, filter, columnLabels))
                .join(", ")}
              identityText={(replicateIdentityColumns || [])
                .filter((name) => !isInternalWhenColumn(name))
                .map((name) => dataTableFilterLabel(name, columnLabels))
                .join(", ")}
              coverageMode={table.coverageMode || "all_surveyed"}
              effortMarkers={(table.effortMarkerValues || []).filter(
                (value): value is string => Boolean(value)
              )}
              rowsMatched={audit?.rowsMatched ?? null}
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
  denominator,
  onFocusReplicate,
}: {
  op: DataTableAggregation;
  /** Replicates that entered the calculation: counted and zero, in letter order. */
  groups: { code: string; reduced: number | null; status: string }[];
  result: number | null;
  denominator: number | null;
  onFocusReplicate?: (code: string) => void;
}) {
  const { t } = useTranslation("homepage");
  const MAX_TERMS = 40;
  const shown = groups.length > MAX_TERMS ? groups.slice(0, 24) : groups;
  const hidden = groups.length - shown.length;
  const terms = shown.map((group, index) => (
    <span key={group.code}>
      {index > 0 ? (
        <span className="text-gray-400">
          {op === "min" || op === "max" || op === "median" ? ", " : " + "}
        </span>
      ) : null}
      <button
        type="button"
        className={clsx(
          "cursor-pointer rounded px-0.5 underline decoration-dotted hover:bg-primary-50",
          group.status === "zero"
            ? "text-gray-500 decoration-gray-300"
            : "text-primary-800 decoration-primary-300"
        )}
        title={
          group.status === "zero"
            ? t("Replicate {{code}}: surveyed, none matched", { code: group.code })
            : t("Replicate {{code}}", { code: group.code })
        }
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
      {hidden > 0 ? (
        <span
          className="text-gray-500"
          title={t("Every {{unit}} value is listed in the table above.", {
            unit: t("replicate"),
          })}
        >
          {op === "min" || op === "max" || op === "median" ? ", " : " + "}
          {t("… {{count}} more", { count: hidden })}
        </span>
      ) : null}
      {op === "mean" ? (
        <span>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {") / "}
          {denominator ?? groups.length}
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

function describeFilter(
  t: (key: string, options?: { [key: string]: unknown }) => string,
  filter: DataTableFilter,
  labels: { [column: string]: string }
): string {
  const label = dataTableFilterLabel(filter.column, labels);
  switch (filter.op) {
    case "in":
      return t("{{label}} in {{values}}", {
        label,
        values: dataTableInFilterValues(filter).join(", "),
      });
    case "notIn":
      return t("{{label}} not {{values}}", {
        label,
        values: dataTableInFilterValues(filter).join(", "),
      });
    case "isNull":
      return t("{{label}} is empty", { label });
    case "notNull":
      return t("{{label}} is not empty", { label });
    default: {
      const symbols: { [op: string]: string } = {
        eq: "=",
        neq: "\u2260",
        gt: ">",
        gte: "\u2265",
        lt: "<",
        lte: "\u2264",
      };
      return `${label} ${symbols[filter.op] || filter.op} ${filter.value ?? ""}`;
    }
  }
}

function formatCoverageInterval(
  t: (key: string, options?: { [key: string]: unknown }) => string,
  interval: { start: string; end: string | null } | null | undefined
): string {
  if (!interval) return "";
  return interval.end
    ? t("{{start}} to {{end}}", { start: interval.start, end: interval.end })
    : t("from {{start}}", { start: interval.start });
}

/** Why a replicate with no rows on screen is, or is not, part of the number. */
function replicateStatusSentence(
  t: (key: string, options?: { [key: string]: unknown }) => string,
  group: ReplicateMathGroup,
  options: {
    replicateWord: string;
    subjectText: string;
    withinLabel: string;
    columnLabel: string;
  }
): string {
  switch (group.status) {
    case "zero":
      return options.subjectText
        ? t(
            "Counts as 0. This {{unit}} was surveyed ({{rows}} rows passed the survey filters), and none of them matched {{subject}}.",
            {
              unit: options.replicateWord,
              rows: group.rowCount,
              subject: options.subjectText,
            }
          )
        : t(
            "Counts as 0. This {{unit}} was surveyed ({{rows}} rows), and none of them carried a {{column}} value.",
            {
              unit: options.replicateWord,
              rows: group.rowCount,
              column: options.columnLabel,
            }
          );
    case "noValue":
      return t(
        "Left out. No rows matched, and there is no {{within}} of nothing. This {{unit}} is not in the denominator.",
        { within: options.withinLabel.toLowerCase(), unit: options.replicateWord }
      );
    case "notSurveyed":
      return group.coverageInterval
        ? t(
            "Left out. The coverage file says {{subject}} was surveyed here {{interval}}; this {{unit}} falls outside that.",
            {
              subject: options.subjectText,
              interval: formatCoverageInterval(t, group.coverageInterval),
              unit: options.replicateWord,
            }
          )
        : t(
            "Left out. The coverage file lists no period during which {{subject}} was surveyed here, so this {{unit}} is not surveyed.",
            { subject: options.subjectText || "—", unit: options.replicateWord }
          );
    default:
      return t(
        "Counted. {{rows}} rows contributed, but none of them are on this page.",
        { rows: group.contributingRows }
      );
  }
}

function viewTabClass(active: boolean) {
  return clsx(
    "rounded px-2.5 py-1 font-medium",
    active ? "bg-primary-600 text-white" : "text-gray-600 hover:bg-gray-100"
  );
}

/** Closes a table that ends before the panel does, so the space below reads as intended. */
function TableEndCap({ label }: { label: string }) {
  return (
    <div className="sticky left-0 flex items-center gap-3 px-4 py-2 text-[11px] text-gray-400">
      <span className="h-px flex-1 bg-gray-200" />
      <span className="flex-none">{label}</span>
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

function statusBadge(
  t: (key: string, options?: { [key: string]: unknown }) => string,
  status: ReplicateMathGroup["status"]
): { label: string; className: string } {
  switch (status) {
    case "counted":
      return {
        label: t("Counted"),
        className: "bg-primary-50 text-primary-800 border-primary-200",
      };
    case "zero":
      return {
        label: t("Zero"),
        className: "bg-sky-50 text-sky-800 border-sky-200",
      };
    case "noValue":
      return {
        label: t("Left out"),
        className: "bg-gray-100 text-gray-600 border-gray-200",
      };
    default:
      return {
        label: t("Not surveyed"),
        className: "bg-gray-100 text-gray-600 border-gray-200",
      };
  }
}

/**
 * The calculation, one line per replicate: what identifies it, how many
 * rows registered it, how many matched, the engine's value, and the rule
 * that decided its status. The formula at the bottom is built from the
 * Value column.
 */
function ReplicatesTable({
  groups,
  replicates,
  identityColumns,
  columnLabels,
  withinLabel,
  columnLabel,
  replicateWord,
  subjectText,
  highlighted,
  onShowRows,
}: {
  groups: ReplicateMathGroup[];
  replicates: AuditReplicateView[];
  identityColumns: string[];
  columnLabels: { [column: string]: string };
  withinLabel: string;
  columnLabel: string;
  replicateWord: string;
  subjectText: string;
  highlighted: string | null;
  onShowRows: (code: string) => void;
}) {
  const { t } = useTranslation("homepage");
  const byCode = new Map(replicates.map((replicate) => [replicate.code, replicate]));
  const cell = "px-3 py-1.5 text-xs";
  const head = "px-3 py-1.5 text-left text-xs font-semibold text-gray-600";
  return (
    <div className="bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
    <table className="min-w-full border-collapse">
      <thead className="sticky top-0 z-10 bg-gray-100">
        <tr className="border-b">
          <th className={head}>{t("Replicate")}</th>
          <th className={head}>{t("Survey date")}</th>
          {identityColumns.map((name) => (
            <th key={name} className={head}>
              {dataTableFilterLabel(name, columnLabels)}
            </th>
          ))}
          <th
            className={clsx(head, "text-right")}
            title={t("Rows for this {{unit}} that passed the survey filters.", {
              unit: replicateWord,
            })}
          >
            {t("Rows")}
          </th>
          <th
            className={clsx(head, "text-right")}
            title={
              subjectText
                ? t("Rows matching {{subject}} with a {{column}} value.", {
                    subject: subjectText,
                    column: columnLabel,
                  })
                : t("Rows with a {{column}} value.", { column: columnLabel })
            }
          >
            {t("Matching")}
          </th>
          <th className={clsx(head, "text-right text-primary-700")}>
            {t("{{within}} of {{column}}", { within: withinLabel, column: columnLabel })}
          </th>
          <th className={head}>{t("Status")}</th>
          <th className={head} />
        </tr>
      </thead>
      <tbody>
        {groups.map((group, index) => {
          const replicate = byCode.get(group.code);
          const badge = statusBadge(t, group.status);
          const when =
            typeof replicate?.key[WHEN_START_COLUMN] === "number"
              ? new Date((replicate.key[WHEN_START_COLUMN] as number) * 1000)
                  .toISOString()
                  .slice(0, 10)
              : "";
          const leftOut =
            group.status === "noValue" || group.status === "notSurveyed";
          return (
            <tr
              key={group.code}
              data-replicate-start={group.code}
              data-replicate-total={group.code}
              className={clsx(
                "border-b border-gray-100",
                highlighted === group.code
                  ? "replicate-flash"
                  : index % 2 === 1 && "bg-gray-50",
                leftOut && "text-gray-500"
              )}
            >
              <td className={clsx(cell, "font-semibold text-gray-800")}>
                {group.code}
              </td>
              <td className={clsx(cell, "tabular-nums")}>{when}</td>
              {identityColumns.map((name) => (
                <td key={name} className={cell}>
                  <CellValue value={replicate?.key[name]} />
                </td>
              ))}
              <td className={clsx(cell, "text-right tabular-nums")}>
                {group.rowCount}
              </td>
              <td className={clsx(cell, "text-right tabular-nums")}>
                {group.contributingRows}
              </td>
              <td
                className={clsx(
                  cell,
                  "text-right font-semibold tabular-nums",
                  group.status === "zero" && "text-sky-800",
                  group.status === "counted" && "text-primary-900"
                )}
              >
                {group.reduced === null ? "—" : formatLegendNumber(group.reduced)}
              </td>
              <td className={cell}>
                <span
                  className={clsx(
                    "inline-flex cursor-help items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    badge.className
                  )}
                  title={replicateStatusSentence(t, group, {
                    replicateWord,
                    subjectText,
                    withinLabel,
                    columnLabel,
                  })}
                >
                  {badge.label}
                </span>
                {group.status === "zero" ? (
                  <span className="ml-2 text-[11px] text-gray-500">
                    {t("surveyed, none matched")}
                  </span>
                ) : group.status === "noValue" ? (
                  <span className="ml-2 text-[11px] text-gray-500">
                    {t("no {{within}} of nothing", {
                      within: withinLabel.toLowerCase(),
                    })}
                  </span>
                ) : group.status === "notSurveyed" ? (
                  <span className="ml-2 text-[11px] text-gray-500">
                    {group.coverageInterval
                      ? t("outside coverage {{interval}}", {
                          interval: formatCoverageInterval(t, group.coverageInterval),
                        })
                      : t("no coverage listed")}
                  </span>
                ) : group.verified === false ? (
                  <span className="ml-2 text-[11px] text-amber-700">
                    {t("rows on this page do not reproduce this value")}
                  </span>
                ) : null}
              </td>
              <td className={clsx(cell, "text-right")}>
                {group.rowsShown > 0 ? (
                  <button
                    type="button"
                    className="text-[11px] text-primary-700 underline decoration-dotted hover:text-primary-900"
                    onClick={() => onShowRows(group.code)}
                  >
                    {t("{{count}} rows", { count: group.rowsShown })}
                  </button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    <TableEndCap
      label={t("End of {{count}} {{unit}}s", {
        count: groups.length,
        unit: replicateWord,
      })}
    />
    </div>
  );
}

function ReplicateSubtotalLine({
  group,
  withinLabel,
  columnLabel,
  width,
  highlighted,
  subjectText,
}: {
  group: ReplicateMathGroup;
  withinLabel: string;
  columnLabel: string;
  width: number;
  highlighted: boolean;
  subjectText: string;
}) {
  const { t } = useTranslation("homepage");
  const partial = group.rowsShown < group.contributingRows;
  return (
    <div
      data-replicate-total={group.code}
      className={clsx(
        "flex scroll-mb-2 items-baseline gap-3 border-b border-primary-100 px-3 py-1.5 text-xs text-primary-900",
        highlighted ? "replicate-flash" : "bg-primary-50"
      )}
    >
      <span className="flex-none font-semibold" style={{ width }}>
        {group.code}
      </span>
      <span className="text-primary-800">
        {t("{{within}} of {{column}}", { within: withinLabel, column: columnLabel })}
      </span>
      <span className="font-semibold tabular-nums">
        {group.reduced === null ? t("null") : formatLegendNumber(group.reduced)}
      </span>
      <span className="min-w-0 truncate text-primary-700/80">
        {group.values.length <= 8
          ? group.values.map((value) => formatLegendNumber(value)).join(" + ")
          : t("{{count}} values", { count: group.values.length })}
      </span>
      {partial ? (
        <span
          className="flex-none text-amber-700"
          title={
            subjectText
              ? t("Rows that did not match {{subject}} are not fetched.", {
                  subject: subjectText,
                })
              : undefined
          }
        >
          {t("{{shown}} of {{total}} counted rows on this page", {
            shown: group.rowsShown,
            total: group.contributingRows,
          })}
        </span>
      ) : group.verified === false ? (
        <span className="flex-none text-amber-700">
          {t("Rows shown do not reproduce the engine's value.")}
        </span>
      ) : null}
    </div>
  );
}

function CalculationMathStrip({
  math,
  columnLabel,
  acrossLabel,
  op,
  onFocusReplicate,
  replicateWord,
  subjectText,
  surveyFilterText,
  identityText,
  coverageMode,
  effortMarkers,
  rowsMatched,
}: {
  math: CalculationMath;
  columnLabel: string;
  acrossLabel: string;
  op: DataTableAggregation;
  onFocusReplicate?: (code: string) => void;
  replicateWord: string;
  subjectText: string;
  surveyFilterText: string;
  identityText: string;
  coverageMode: string;
  effortMarkers: string[];
  rowsMatched: number | null;
}) {
  const { t } = useTranslation("homepage");
  const withinLabel: { [key in WithinReplicateOp]: string } = {
    sum: t("Sum"),
    mean: t("Mean"),
    min: t("Min"),
    max: t("Max"),
  };
  if (math.mode === "replicates") {
    const entered = math.groups.filter(
      (group) => group.status === "counted" || group.status === "zero"
    );
    const leftOut = math.groups.filter(
      (group) => group.status === "noValue" || group.status === "notSurveyed"
    );
    const zeroRule =
      math.within !== "sum"
        ? t(
            "A {{unit}} with no matching rows is left out, because there is no {{within}} of nothing.",
            { unit: replicateWord, within: withinLabel[math.within].toLowerCase() }
          )
        : coverageMode === "coverage_file"
        ? t(
            "A {{unit}} with no matching rows counts as 0 inside a period listed in the coverage file, and is left out (not surveyed) outside one.",
            { unit: replicateWord }
          )
        : t(
            "A {{unit}} with no matching rows counts as 0. It was surveyed, and none were seen.",
            { unit: replicateWord }
          );
    return (
      <div className="max-h-56 flex-none overflow-y-auto border-b bg-gray-50 px-6 py-2.5">
        <details className="text-[11px] text-gray-600">
          <summary className="cursor-pointer select-none text-gray-500">
            {t(
              "{{within}} {{column}} inside each {{unit}}, then {{across}} across {{count}} {{unit}} values. How this is calculated",
              {
                within: withinLabel[math.within],
                column: columnLabel,
                unit: replicateWord,
                across: acrossLabel.toLowerCase(),
                count: math.denominator ?? entered.length,
              }
            )}
          </summary>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
            <li>
              {rowsMatched !== null
                ? t(
                    "{{rows}} rows for this site pass the survey filters ({{filters}}) and fall in the audited window.",
                    { rows: rowsMatched, filters: surveyFilterText || t("none") }
                  )
                : t("Rows for this site pass the survey filters ({{filters}}).", {
                    filters: surveyFilterText || t("none"),
                  })}
            </li>
            <li>
              {t(
                "Those rows are grouped into {{unit}}s, one per survey date, {{columns}}. Every {{unit}} with at least one row counts as surveyed.",
                { unit: replicateWord, columns: identityText }
              )}
            </li>
            <li>
              {subjectText
                ? t(
                    "Inside each {{unit}}, {{within}} {{column}} over the rows where {{subject}}. Rows of other subjects register the {{unit}} but add nothing.",
                    {
                      unit: replicateWord,
                      within: withinLabel[math.within].toLowerCase(),
                      column: columnLabel,
                      subject: subjectText,
                    }
                  )
                : t("Inside each {{unit}}, {{within}} {{column}} over all its rows.", {
                    unit: replicateWord,
                    within: withinLabel[math.within].toLowerCase(),
                    column: columnLabel,
                  })}{" "}
              {t("Empty (null) {{column}} cells never add to a total.", {
                column: columnLabel,
              })}
              {effortMarkers.length > 0
                ? " " +
                  t(
                    "Rows marked {{markers}} mean “surveyed, nothing seen”. They register the {{unit}} and add nothing.",
                    { markers: effortMarkers.join(", "), unit: replicateWord }
                  )
                : ""}
            </li>
            <li>{zeroRule}</li>
            <li>
              {t("{{across}} of the {{count}} {{unit}} values that remain.", {
                across: acrossLabel,
                count: math.denominator ?? entered.length,
                unit: replicateWord,
              })}
            </li>
          </ol>
        </details>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-0.5 text-sm tabular-nums text-gray-800">
          <ReplicateExpression
            op={op}
            groups={entered}
            result={math.result}
            denominator={math.denominator}
            onFocusReplicate={onFocusReplicate}
          />
        </div>
        {leftOut.length > 0 ? (
          <p className="mt-1 text-xs text-gray-500">
            {t("Left out of the denominator")}{" "}
            {leftOut.map((group, index) => (
              <span key={group.code}>
                {index > 0 ? ", " : ""}
                <button
                  type="button"
                  className="underline decoration-dotted hover:text-gray-800"
                  onClick={() => onFocusReplicate?.(group.code)}
                  title={
                    group.status === "notSurveyed"
                      ? t("Not surveyed for this subject")
                      : t("No {{within}} of nothing", {
                          within: withinLabel[math.within].toLowerCase(),
                        })
                  }
                >
                  {group.code}
                </button>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    );
  }
  const preview = math.values.slice(0, 8).map((value) => formatLegendNumber(value));
  const more = math.values.length - preview.length;
  return (
    <div className="max-h-40 flex-none overflow-y-auto border-b bg-gray-50 px-6 py-2.5">
      <p className="text-[11px] text-gray-500">
        {t(
          "Each row is already a summary. {{op}} of {{column}} runs across every row that passes the filters; empty (null) cells are skipped.",
          {
            op: acrossLabel,
            column: columnLabel,
          }
        )}
      </p>
      <p className="mt-1 text-sm tabular-nums text-gray-800">
        {op === "mean" && math.count > 0
          ? t("{{sum}} ÷ {{count}} = {{result}}", {
              sum: formatLegendNumber(math.sum),
              count: math.count,
              result: math.result === null ? t("null") : formatLegendNumber(math.result),
            })
          : t("{{op}} of {{count}} values = {{result}}", {
              op: acrossLabel,
              count: math.count,
              result: math.result === null ? t("null") : formatLegendNumber(math.result),
            })}
        {preview.length > 0 ? (
          <span className="ml-2 text-xs text-gray-500">
            {preview.join(", ")}
            {more > 0 ? t(", +{{count}} more", { count: more }) : ""}
          </span>
        ) : null}
        {math.count !== math.values.length ? (
          <span className="ml-2 text-xs text-amber-700">
            {t("The engine counted {{count}} values; {{shown}} are on this page.", {
              count: math.count,
              shown: math.values.length,
            })}
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
    case "notIn": {
      const values = dataTableInFilterValues(filter);
      description = t("{{label}}: {{count}} ignored", {
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
