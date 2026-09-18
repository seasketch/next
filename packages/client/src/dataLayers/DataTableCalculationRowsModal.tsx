import { useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import clsx from "clsx";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import Button from "../components/Button";
import Spinner from "../components/Spinner";
import { MapManagerContext } from "./MapContextManager";
import {
  columnStatsUrlForTable,
  useDataTableColumnStats,
} from "./useDataTableColumnStats";
import {
  DataTableAggregation,
  DataTableCalculationRowsResult,
  DataTableFeatureSeriesPoint,
  DataTableFilter,
  dataTableFilterLabel,
  dataTableInFilterValues,
  defaultHiddenCalculationColumns,
  isInternalWhenColumn,
  parseFilterColumnLabels,
  rowWhenOverlapsStep,
  temporalSourceFilterColumns,
  WHEN_START_COLUMN,
} from "./dataTableQueryApi";
import { organismColumnFromTable } from "./orgQueryApi";
import {
  DataTableSparklineSvg,
  dataTableSparklineLayout,
  formatDataTableSiteLabel,
  formatDataTableTooltipRange,
  formatStepTick,
} from "./DataTableValueTooltip";
import { formatLegendNumber } from "./legends/DataTableLegendBubble";

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
 * client-side logic that mirrors the engine is `rowWhenOverlapsStep`
 * (dataTableQueryApi.ts), the engine's row↔step assignment rule, which
 * shares `expandTemporalIso` with the engine. Keep them in lockstep.
 */

type CalculationRow = { [column: string]: unknown };

const DEFAULT_COLUMN_WIDTH = 150;
const WIDE_COLUMN_WIDTH = 185;
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
  /** A single engine step key, "all", or undefined (= pick a default). */
  const [selectedStep, setSelectedStep] = useState<string | "all" | undefined>(
    undefined
  );
  const [sortState, setSortState] = useState<{
    id: string;
    desc: boolean;
  } | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);

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

  // Default to a single step: the map's current clock step when it has data
  // for this site, otherwise the most recent observed step. When switching
  // sites, keep the selection if the new site observed that step.
  useEffect(() => {
    if (observedSteps.length === 0) {
      return;
    }
    if (
      selectedStep !== undefined &&
      (selectedStep === "all" ||
        observedSteps.some((point) => point.step === selectedStep))
    ) {
      return;
    }
    const current = [...currentSteps]
      .reverse()
      .find((step) => observedSteps.some((point) => point.step === step));
    setSelectedStep(current || observedSteps[observedSteps.length - 1].step);
  }, [observedSteps, currentSteps, selectedStep]);

  const hasSeries = observedSteps.length > 0;
  const activeStep =
    hasWhen && selectedStep && selectedStep !== "all" ? selectedStep : null;
  const activeStepPoint = activeStep
    ? observedSteps.find((point) => point.step === activeStep)
    : undefined;

  const stepFilteredRows = useMemo(() => {
    if (!activeStep) {
      return rows;
    }
    return rows.filter((row) => rowWhenOverlapsStep(row, activeStep));
  }, [rows, activeStep]);

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
    if (sortState && hiddenColumns.has(sortState.id)) {
      setSortState(null);
    }
  }, [sortState, hiddenColumns]);

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
  }, [stepFilteredRows, filterText, sortState, columnIds]);

  useEffect(() => {
    setShowAllRows(false);
  }, [site, selectedStep, filterText]);

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

  const toggleSort = (id: string) => {
    setSortState((prev) =>
      prev?.id === id
        ? prev.desc
          ? null
          : { id, desc: true }
        : { id, desc: false }
    );
  };

  const columnWidth = (id: string) =>
    id === measureColumn || filteredColumnSet.has(id)
      ? WIDE_COLUMN_WIDTH
      : DEFAULT_COLUMN_WIDTH;
  const totalWidth = columnIds.reduce((sum, id) => sum + columnWidth(id), 0);

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
  // selected step, or the value currently painted on the map.
  const headlineValue: number | null | undefined = activeStep
    ? activeStepPoint?.value
    : currentValue;
  const headlineContext = activeStep
    ? formatStepTick(activeStep)
    : hasSeries
    ? formatDataTableTooltipRange(
        seriesPoints.map((point) => point.step)
      ) || t("All time steps")
    : undefined;

  if (!settings || !table) {
    return null;
  }
  // Trans interpolation shorthand ({{step}} below).
  const step = activeStep ? formatStepTick(activeStep) : "";
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
                  selectedStep={selectedStep}
                  onSelect={setSelectedStep}
                  statTitle={statTitle}
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-gray-400">
                    {t("Click the chart to audit a different time step.")}
                  </span>
                  <button
                    type="button"
                    className={clsx(
                      "flex-none rounded-full border px-2.5 py-0.5 text-xs",
                      selectedStep === "all"
                        ? "border-primary-400 bg-primary-500/10 font-medium text-primary-800"
                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                    )}
                    onClick={() =>
                      setSelectedStep(selectedStep === "all" ? undefined : "all")
                    }
                  >
                    {t("All steps")}
                  </button>
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
            {activeStep && !rowsState.loading && result ? (
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
        <div className="min-h-0 flex-1 overflow-auto">
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
                : t("No rows match the active filters for this site.")}
            </div>
          ) : (
            <div style={{ width: totalWidth, minWidth: "100%" }}>
              <div className="sticky top-0 z-10 flex border-b bg-gray-100">
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
              {renderedRows.map((row, index) => (
                <div
                  key={index}
                  className={clsx(
                    "flex border-b border-gray-100 text-xs",
                    index % 2 === 1 && "bg-gray-50"
                  )}
                >
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
              ))}
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
          <div className="flex flex-none items-center justify-end border-t bg-gray-50 px-6 py-3">
            <Button label={t("Close")} onClick={onRequestClose} primary />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * The tooltip's sparkline, rendered wider and made interactive: clicking a
 * point selects that time step for auditing. Uses the shared
 * `DataTableSparklineSvg` renderer so it looks identical to the map hover
 * tooltip's chart.
 */
function AuditSparkline({
  points,
  selectedStep,
  onSelect,
  statTitle,
}: {
  points: DataTableFeatureSeriesPoint[];
  selectedStep: string | "all" | undefined;
  onSelect: (step: string) => void;
  statTitle: string;
}) {
  const { t } = useTranslation("homepage");
  const layout = useMemo(
    () =>
      dataTableSparklineLayout(
        points,
        selectedStep && selectedStep !== "all" ? [selectedStep] : [],
        {
          width: CHART_WIDTH,
          height: CHART_HEIGHT,
          maxPoints: CHART_MAX_POINTS,
          margins: { left: 36, bottom: 20 },
        }
      ),
    [points, selectedStep]
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
