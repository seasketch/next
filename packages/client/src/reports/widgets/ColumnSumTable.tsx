import { Fragment, useContext, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  MetricDependency,
  subjectIsFragment,
  subjectIsGeography,
  ColumnValuesMetric,
  Metric,
  isNumberColumnValueStats,
} from "overlay-engine";
import {
  ReportWidget,
  TooltipBooleanConfigurationOption,
  TableHeadingsEditor,
} from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
} from "../../editor/TooltipMenu";
import { LabeledDropdown } from "./LabeledDropdown";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { useOverlaySources } from "../hooks/useOverlaySources";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import {
  OverlaySourceDetailsFragment,
  SketchGeometryType,
  SpatialMetricState,
} from "../../generated/graphql";
import {
  ClassTableRow,
  ClassTableRowComponentSettings,
  combineMetricsBySource,
  getClassTableRows,
  hasClassTableRowVisibilityToggle,
  resolveClassTableRowStableId,
  shouldTruncateClassTableRowLabels,
} from "./ClassTableRows";
import {
  classTableRowHasSwatch,
  SwatchForClassTableRow,
} from "./SwatchForClassTableRow";
import {
  PaginationFooter,
  PaginationSetting,
  TablePaddingRows,
} from "./Pagination";
import { usePagination } from "../hooks/usePagination";
import ReportLayerVisibilityCheckbox from "../components/ReportLayerVisibilityCheckbox";
import {
  EyeClosedIcon,
  EyeOpenIcon,
  LayersIcon,
  Pencil2Icon,
} from "@radix-ui/react-icons";
import { usePrimaryGeography } from "../hooks/usePrimaryGeography";
import type { SketchClassPrimaryGeoFields } from "../hooks/usePrimaryGeography";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Popover from "@radix-ui/react-popover";
import CollectionExpandableName from "./collection/CollectionExpandableName";
import SketchOverlapHint from "./collection/SketchOverlapHint";
import { sketchContributionsForClassTableRow } from "./collection/sketchContributions";
import { useCollectionSketchExpand } from "./collection/useCollectionSketchExpand";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { useBaseReportContext } from "../context/BaseReportContext";
import { useSubjectReportContext } from "../context/SubjectReportContext";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import ColumnStatsWarning, {
  hasBufferedColumnValuesDependency,
} from "./ColumnStatsWarning";
import { NumberRoundingControl } from "./NumberRoundingControl";

function groupByOptionsFromSource(
  source: OverlaySourceDetailsFragment | undefined
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  if (!source?.geostats) return options;
  const geoLayer = isGeostatsLayer(
    (source.geostats as any)?.layers?.[0] as GeostatsLayer
  )
    ? ((source.geostats as any).layers[0] as GeostatsLayer)
    : undefined;
  if (!geoLayer?.attributes) return options;
  for (const attr of geoLayer.attributes) {
    const isString = attr.type === "string";
    const distinctCount = Object.keys(attr.values || {}).length;
    const isNumericWithFewValues = attr.type === "number" && distinctCount <= 10;
    if (isString || isNumericWithFewValues) {
      options.push({ value: attr.attribute, label: attr.attribute });
    }
  }
  options.sort((a, b) => a.value.localeCompare(b.value));
  return options;
}

type ColumnSumTableSettings = {
  column?: string;
  /**
   * Geography used as the denominator for the optional "% of geography"
   * column. When undefined / unset, that column is hidden and no geography
   * column_values dependency is required.
   */
  percentGeographyId?: number;
  showZeroCountCategories?: boolean;
  sortBy?: "sum" | "name";
  rowsPerPage?: number;
  nameLabel?: string;
  sumLabel?: string;
  percentLabel?: string;
  hideColorSwatches?: boolean;
  minimumFractionDigits?: number;
} & ClassTableRowComponentSettings;

type ColumnSumRow = ClassTableRow & {
  sum: number;
  geographyTotal?: number;
  stats?: ColumnValuesMetric["value"][string][string];
};

function columnSumFromMetric(
  metric: ColumnValuesMetric | null | undefined,
  groupByKey: string,
  column: string
): number {
  if (!metric?.value || !column) {
    return 0;
  }
  const cell = metric.value[groupByKey]?.[column];
  if (cell && isNumberColumnValueStats(cell)) {
    return typeof cell.sum === "number" && Number.isFinite(cell.sum)
      ? cell.sum
      : 0;
  }
  return 0;
}

function columnStatsFromMetric(
  metric: ColumnValuesMetric | null | undefined,
  groupByKey: string,
  column: string
) {
  if (!metric?.value || !column) {
    return undefined;
  }
  return metric.value[groupByKey]?.[column];
}

export const ColumnSumTable: ReportWidget<ColumnSumTableSettings> = ({
  metrics,
  componentSettings,
  sources,
  loading,
  sketchClass,
  geographies,
  dependencies,
}) => {
  const { t } = useTranslation("reports");
  const showZero = componentSettings.showZeroCountCategories ?? false;
  const sortBy = componentSettings.sortBy || "name";
  const rowsPerPage = componentSettings.rowsPerPage ?? 10;
  const column = componentSettings.column || "";
  const percentGeographyId = componentSettings.percentGeographyId;
  const showPercentColumn =
    typeof percentGeographyId === "number" &&
    Number.isFinite(percentGeographyId);
  const showColorSwatches = !componentSettings.hideColorSwatches;
  const nameLabel = componentSettings.nameLabel || t("Name");
  const sumLabel = componentSettings.sumLabel || column || t("Sum");
  const percentLabel = componentSettings.percentLabel || t("% of Class Total");
  const truncateRowLabels = shouldTruncateClassTableRowLabels(componentSettings);
  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings.minimumFractionDigits ?? 0,
  });

  const { clippingGeography } = usePrimaryGeography(sketchClass, geographies);
  const primaryGeographyId = clippingGeography?.id;
  const { printing } = useContext(ReportUIStateContext);

  const rows = useMemo<ColumnSumRow[]>(() => {
    const classRows = getClassTableRows({
      dependencies,
      sources,
      customLabels: componentSettings.customRowLabels,
      allFeaturesLabel: t("All features"),
      stableIds: componentSettings.rowLinkedStableIds,
      excludedRowKeys: componentSettings.excludedRowKeys,
      includeAllFeaturesRowForGroupedSources:
        componentSettings.includeAllFeaturesRowForGroupedSources,
    });

    const completedFragmentMetrics = metrics.filter(
      (m) =>
        subjectIsFragment(m.subject) &&
        m.type === "column_values" &&
        m.state === SpatialMetricState.Complete
    ) as Pick<Metric, "type" | "value">[];

    if (
      sources.length === 0 ||
      completedFragmentMetrics.length === 0 ||
      metrics.length === 0 ||
      loading ||
      !column
    ) {
      return classRows.map((r) => ({
        ...r,
        sum: NaN,
        geographyTotal: NaN,
      }));
    }

    if (!primaryGeographyId) {
      throw new Error("Primary geography not found.");
    }

    // Fragment membership is always relative to the sketch clipping
    // geography. The optional percent geography may be a different land /
    // analysis geography used only as a denominator.
    const combinedMetrics = combineMetricsBySource<ColumnValuesMetric>(
      metrics,
      sources,
      primaryGeographyId,
      "column_values"
    );

    let nextRows: ColumnSumRow[] = classRows.map((r) => {
      const combinedForSource = combinedMetrics[r.sourceId];
      const fragmentMetric = combinedForSource?.fragments;
      const sum = columnSumFromMetric(fragmentMetric, r.groupByKey, column);
      const stats = columnStatsFromMetric(
        fragmentMetric,
        r.groupByKey,
        column
      );

      let geographyTotal: number | undefined;
      if (showPercentColumn && percentGeographyId !== undefined) {
        const source = sources.find((s) => s.stableId === r.sourceId);
        const geographyMetric = metrics.find(
          (m) =>
            m.type === "column_values" &&
            m.state === SpatialMetricState.Complete &&
            subjectIsGeography(m.subject) &&
            m.subject.id === percentGeographyId &&
            (!source?.sourceUrl || m.sourceUrl === source.sourceUrl)
        ) as ColumnValuesMetric | undefined;
        geographyTotal = columnSumFromMetric(
          geographyMetric,
          r.groupByKey,
          column
        );
      }

      return {
        ...r,
        sum,
        geographyTotal,
        stats,
      };
    });

    if (sortBy === "name") {
      nextRows = nextRows.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      nextRows = nextRows.sort((a, b) => (b.sum ?? 0) - (a.sum ?? 0));
    }

    if (!showZero) {
      nextRows = nextRows.filter((r) => (r.sum ?? 0) > 0);
    }

    return nextRows;
  }, [
    dependencies,
    sources,
    t,
    metrics,
    loading,
    sortBy,
    showZero,
    primaryGeographyId,
    column,
    showPercentColumn,
    percentGeographyId,
    componentSettings.customRowLabels,
    componentSettings.rowLinkedStableIds,
    componentSettings.excludedRowKeys,
    componentSettings.includeAllFeaturesRowForGroupedSources,
  ]);

  const {
    isCollection,
    sketchNameById,
    childSketchIds,
    toggleRow,
    hideCaretExpandTooltip,
    isSketchBreakdownExpanded,
  } = useCollectionSketchExpand(sketchClass, {
    forceAllExpanded: printing,
  });

  const sketchLinesByRowKey = useMemo(() => {
    if (!isCollection || !primaryGeographyId || loading || !column) {
      return new Map<
        string,
        ReturnType<typeof sketchContributionsForClassTableRow>
      >();
    }
    const map = new Map<
      string,
      ReturnType<typeof sketchContributionsForClassTableRow>
    >();
    for (const row of rows) {
      const source = sources.find((s) => s.stableId === row.sourceId);
      if (!source) continue;
      map.set(
        row.key,
        sketchContributionsForClassTableRow({
          metrics,
          source,
          geographyId: primaryGeographyId,
          metricType: "column_values",
          groupByKey: row.groupByKey,
          childSketchIds,
          geographyDenominator:
            typeof row.geographyTotal === "number" &&
            Number.isFinite(row.geographyTotal)
              ? row.geographyTotal
              : 0,
          sketchNameById,
          t,
          valueColumn: column,
        })
      );
    }
    return map;
  }, [
    isCollection,
    primaryGeographyId,
    loading,
    column,
    rows,
    metrics,
    sources,
    childSketchIds,
    sketchNameById,
    t,
  ]);

  const {
    currentPage,
    setCurrentPage,
    paginatedItems: paginatedRows,
    paddingRowsCount,
    showPagination,
    totalPages,
    totalRows,
    pageBounds,
  } = usePagination(rows, rowsPerPage);

  const hasAnyColor = useMemo(
    () => showColorSwatches && rows.some(classTableRowHasSwatch),
    [rows, showColorSwatches]
  );
  const hasSwatchColumn =
    showColorSwatches && rows.some(classTableRowHasSwatch);

  const hasVisibilityColumn = useMemo(
    () =>
      hasClassTableRowVisibilityToggle(
        rows,
        componentSettings.rowLinkedStableIds
      ),
    [rows, componentSettings.rowLinkedStableIds]
  );

  const buffered = hasBufferedColumnValuesDependency(dependencies);

  if (!loading && !rows.length) {
    return (
      <div className="mt-3 border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No overlapping features found.</Trans>
      </div>
    );
  }

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
        <div className="divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
            {hasVisibilityColumn && (
              <div className="flex-none w-6 flex justify-center text-gray-600 text-xs font-semibold uppercase tracking-wide">
                <LayersIcon className="w-4 h-4" />
              </div>
            )}
            <div className="flex-1 min-w-0 text-gray-600 text-xs font-semibold uppercase tracking-wide">
              {nameLabel}
            </div>
            <div
              className={`flex-none text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[80px] ${
                showPercentColumn ? "text-center" : "text-right"
              }`}
            >
              {sumLabel}
            </div>
            {showPercentColumn && (
              <div className="flex-none text-right text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[120px]">
                {percentLabel}
              </div>
            )}
          </div>
          {paginatedRows.map((row) => {
            const percent =
              !loading &&
              showPercentColumn &&
              typeof row.geographyTotal === "number" &&
              row.geographyTotal > 0
                ? row.sum / row.geographyTotal
                : undefined;
            const stableId = resolveClassTableRowStableId(
              row,
              componentSettings.rowLinkedStableIds
            );
            const displayLabel =
              row.key === "*" ? t("All features") : row.label;
            const expanded = isSketchBreakdownExpanded(row.key);
            const sketchLines = sketchLinesByRowKey.get(row.key) ?? [];
            return (
              <Fragment key={row.key}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                    row.sum === 0 ? "opacity-50" : ""
                  }`}
                >
                  {hasVisibilityColumn && (
                    <div className="flex-none w-6 flex justify-center">
                      {stableId ? (
                        <ReportLayerVisibilityCheckbox stableId={stableId} />
                      ) : (
                        <span className="text-xs text-gray-400"></span>
                      )}
                    </div>
                  )}
                  {showColorSwatches && <SwatchForClassTableRow row={row} />}
                  <div className="flex-1 min-w-0 text-gray-800 text-sm">
                    <CollectionExpandableName
                      displayLabel={displayLabel}
                      truncateRowLabels={truncateRowLabels}
                      expanded={expanded}
                      onToggle={() => toggleRow(row.key)}
                      loading={loading}
                      isCollection={isCollection}
                      caretTooltipEnabled={!hideCaretExpandTooltip}
                      caretTooltipLabel={t("Expand sketch details")}
                      expandAriaLabelExpanded={t(
                        "Collapse sketch breakdown for {{name}}",
                        { name: displayLabel }
                      )}
                      expandAriaLabelCollapsed={t(
                        "Expand sketch breakdown for {{name}}",
                        { name: displayLabel }
                      )}
                    />
                  </div>
                  <div
                    className={`flex-none text-gray-900 tabular-nums text-sm min-w-[80px] inline-flex items-center justify-end gap-1 ${
                      showPercentColumn ? "justify-center" : "justify-end"
                    } ${showPercentColumn ? "text-center" : "text-right"}`}
                  >
                    {loading ? (
                      <MetricLoadingDots />
                    ) : (
                      <>
                        {formatters.decimal(row.sum)}
                        {row.stats && isNumberColumnValueStats(row.stats) && (
                          <ColumnStatsWarning
                            stats={row.stats}
                            displayedStats={["sum"]}
                            buffered={buffered}
                          />
                        )}
                      </>
                    )}
                  </div>
                  {showPercentColumn && (
                    <div className="flex-none min-w-[120px]">
                      {loading ? (
                        <div className="text-right">
                          <MetricLoadingDots />
                        </div>
                      ) : typeof percent === "number" ? (
                        <div className="text-right tabular-nums text-sm text-gray-700">
                          {formatters.percent(percent)}
                        </div>
                      ) : (
                        // eslint-disable-next-line i18next/no-literal-string
                        <div className="text-right text-gray-400 text-sm">—</div>
                      )}
                    </div>
                  )}
                </div>
                {isCollection && expanded && sketchLines.length === 0 && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/80 bg-slate-100 px-3 py-2.5 text-sm italic text-gray-600">
                    <div className="flex-none w-6" aria-hidden />
                    {hasSwatchColumn && (
                      <div className="flex-none w-4" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      {t(
                        "No individual sketches contributed to this category."
                      )}
                    </div>
                  </div>
                )}
                {isCollection &&
                  expanded &&
                  sketchLines.map((sk) => (
                    <div
                      key={`${row.key}-sketch-${sk.sketchId}`}
                      className={`flex flex-wrap items-center gap-3 border-t border-slate-200/80 bg-slate-100 px-3 py-2 hover:bg-slate-200/30 ${
                        row.sum === 0 ? "opacity-50" : ""
                      }`}
                    >
                      {hasVisibilityColumn && (
                        <div className="flex-none w-6" aria-hidden />
                      )}
                      {hasSwatchColumn && (
                        <div
                          className="flex-none w-4 flex justify-center"
                          aria-hidden
                        />
                      )}
                      <div className="flex min-w-0 flex-1 items-center gap-1 text-sm text-gray-800">
                        <span className="min-w-0">{sk.sketchName}</span>
                        <SketchOverlapHint
                          hasOverlap={sk.hasOverlap}
                          sketchDisplayName={sk.sketchName}
                          overlapPartnerSketchNames={
                            sk.overlapPartnerSketchNames
                          }
                        />
                      </div>
                      <div
                        className={`flex-none tabular-nums text-sm text-gray-900 min-w-[80px] ${
                          showPercentColumn ? "text-center" : "text-right"
                        }`}
                      >
                        {loading ? (
                          <MetricLoadingDots />
                        ) : (
                          formatters.decimal(sk.primaryValue)
                        )}
                      </div>
                      {showPercentColumn && (
                        <div className="flex-none min-w-[120px] text-right tabular-nums text-sm text-gray-700">
                          {loading ? (
                            <MetricLoadingDots />
                          ) : (
                            formatters.percent(sk.fractionOfGeography)
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </Fragment>
            );
          })}
          <TablePaddingRows
            count={paddingRowsCount}
            includeColorColumn={hasAnyColor}
            includeVisibilityColumn={hasVisibilityColumn}
            showPercentColumn={showPercentColumn}
            numericAlign={showPercentColumn ? "center" : "right"}
          />
        </div>
        {showPagination && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            totalRows={totalRows}
            pageBounds={pageBounds}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </Tooltip.Provider>
  );
};

function ColumnSumClassLabelsPopover({
  settings,
  dependencies,
  sources,
  onUpdateSettings,
  t,
}: {
  settings: ColumnSumTableSettings;
  dependencies: MetricDependency[];
  sources: OverlaySourceDetailsFragment[];
  onUpdateSettings: (patch: Partial<ColumnSumTableSettings>) => void;
  t: (key: string, opts?: Record<string, any>) => string;
}) {
  const rows = useMemo(
    () =>
      getClassTableRows({
        dependencies,
        sources,
        customLabels: settings.customRowLabels,
        allFeaturesLabel: t("All features"),
        stableIds: settings.rowLinkedStableIds,
        // Show all classes in the editor, including excluded ones.
        excludedRowKeys: undefined,
        includeAllFeaturesRowForGroupedSources:
          settings.includeAllFeaturesRowForGroupedSources,
      }),
    [
      dependencies,
      sources,
      settings.customRowLabels,
      settings.rowLinkedStableIds,
      settings.includeAllFeaturesRowForGroupedSources,
      t,
    ]
  );

  const excludedSet = useMemo(
    () => new Set(settings.excludedRowKeys || []),
    [settings.excludedRowKeys]
  );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
        >
          <Pencil2Icon className="w-3 h-3" />
          <span>{t("labels")}</span>
          <span className="text-gray-500 text-xs -mb-0.5 -ml-1">
            {rows.length ? ` (${rows.length})` : ""}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="center"
        sideOffset={6}
        className="bg-white rounded-lg shadow-lg border border-gray-200 p-0 w-[360px] max-h-[22rem] flex flex-col z-50"
      >
        <div className="px-3 py-2.5 shadow-sm z-10 border-b rounded-t-lg flex-none bg-slate-50">
          <span className="text-sm font-semibold text-gray-800">
            {t("Class Labels")}
          </span>
          <p className="text-xs text-gray-500 mt-1">
            {t("Rename or hide classes in this table.")}
          </p>
        </div>
        <div className="divide-y divide-gray-100 overflow-y-auto flex-1 overscroll-contain">
          {rows.map((row) => {
            const checked = !excludedSet.has(row.key);
            const customLabel = settings.customRowLabels?.[row.key] || "";
            const defaultLabel =
              row.groupByKey === "*" ? t("All features") : row.groupByKey;
            return (
              <div
                key={row.key}
                className={`flex gap-2 px-3 py-2 items-center transition-opacity ${
                  !checked ? "opacity-50" : ""
                }`}
              >
                <div className="flex-1 min-w-0 relative">
                  <input
                    type="text"
                    className={`w-full rounded border border-gray-300 bg-transparent px-2 py-1 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0 focus:border-gray-300 ${
                      customLabel ? "pr-24" : ""
                    } ${!checked ? "pointer-events-none" : ""}`}
                    placeholder={defaultLabel}
                    value={customLabel}
                    aria-label={t("Row label")}
                    disabled={!checked}
                    onChange={(e) => {
                      onUpdateSettings({
                        customRowLabels: {
                          ...(settings.customRowLabels || {}),
                          [row.key]: e.target.value,
                        },
                      });
                    }}
                  />
                  {customLabel && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none px-1.5 text-[11px] text-gray-800/50 font-medium truncate max-w-[100px] bg-blue-50 rounded-sm">
                      {defaultLabel}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextExcluded = new Set(settings.excludedRowKeys || []);
                    if (checked) {
                      nextExcluded.add(row.key);
                    } else {
                      nextExcluded.delete(row.key);
                    }
                    onUpdateSettings({
                      excludedRowKeys: Array.from(nextExcluded),
                    });
                  }}
                  disabled={rows.length <= 1}
                  className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${
                    checked
                      ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  }`}
                  aria-label={
                    checked
                      ? t("Hide row from table")
                      : t("Show row in table")
                  }
                >
                  {checked ? (
                    <EyeOpenIcon className="w-4 h-4" />
                  ) : (
                    <EyeClosedIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
          {!rows.length && (
            <div className="text-xs text-gray-500 px-3 py-2">
              {t("No rows available")}
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

export const ColumnSumTableTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
  onUpdateDependencyParameters,
  onUpdateAllDependencies,
}) => {
  const { t } = useTranslation("admin:reports");
  const dependencies = (node.attrs?.metrics || []) as MetricDependency[];
  const settings: ColumnSumTableSettings = useMemo(
    () => node.attrs?.componentSettings || {},
    [node.attrs?.componentSettings]
  );

  const showZero = settings.showZeroCountCategories ?? false;
  const sortBy = settings.sortBy || "name";
  const rowsPerPage = settings.rowsPerPage ?? 10;
  const { filteredSources: sources } = useOverlaySources(dependencies);
  const { geographies } = useBaseReportContext();
  const subjectReportContext = useSubjectReportContext();
  const tooltipSketchClass = subjectReportContext.data?.sketch?.sketchClass;
  const sketchClassForPrimaryGeography: SketchClassPrimaryGeoFields =
    tooltipSketchClass ?? {
      geometryType: SketchGeometryType.Polygon,
      clippingGeographies: [],
      validChildren: [],
      project: { sketchClasses: [] },
    };
  const { clippingGeography } = usePrimaryGeography(
    sketchClassForPrimaryGeography,
    geographies
  );

  const handleUpdate = (patch: Partial<ColumnSumTableSettings>) => {
    onUpdate({
      componentSettings: {
        ...settings,
        ...patch,
      },
    });
  };

  const source = sources?.[0];

  const numericColumnOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    if (!source?.geostats) return options;
    const geoLayer = isGeostatsLayer(
      (source.geostats as any)?.layers?.[0] as GeostatsLayer
    )
      ? ((source.geostats as any).layers[0] as GeostatsLayer)
      : undefined;
    if (!geoLayer?.attributes) return options;
    for (const attr of geoLayer.attributes) {
      if (attr.type !== "number") continue;
      options.push({ value: attr.attribute, label: attr.attribute });
    }
    options.sort((a, b) => a.value.localeCompare(b.value));
    return options;
  }, [source]);

  const groupByOptions = useMemo(
    () => groupByOptionsFromSource(source),
    [source]
  );

  const currentGroupBy =
    dependencies.find((d) => d.type === "column_values")?.parameters?.groupBy ||
    "";

  const syncIncludedColumns = (column: string) => {
    onUpdateDependencyParameters((dependency) =>
      dependency.type === "column_values"
        ? { ...dependency.parameters, includedColumns: [column] }
        : { ...dependency.parameters }
    );
  };

  const handleColumnChange = (column: string) => {
    handleUpdate({
      column,
      sumLabel: settings.sumLabel ? settings.sumLabel : undefined,
    });
    syncIncludedColumns(column);
  };

  const handleGroupByChange = (groupBy: string) => {
    if (!groupBy) return;
    handleUpdate({
      customRowLabels: undefined,
      excludedRowKeys: undefined,
    });
    onUpdateDependencyParameters((dependency) =>
      dependency.type === "column_values"
        ? { ...dependency.parameters, groupBy }
        : { ...dependency.parameters }
    );
  };

  const handlePercentGeographyChange = (value: string) => {
    if (value === "none") {
      handleUpdate({ percentGeographyId: undefined });
      onUpdateAllDependencies((deps) =>
        deps.filter(
          (d) =>
            !(d.type === "column_values" && d.subjectType === "geographies")
        )
      );
      return;
    }
    const geographyId = Number(value);
    if (!Number.isFinite(geographyId)) {
      return;
    }
    handleUpdate({ percentGeographyId: geographyId });
    onUpdateAllDependencies((deps) => {
      const fragment = deps.find(
        (d) => d.type === "column_values" && d.subjectType === "fragments"
      );
      if (!fragment?.stableId) {
        return deps;
      }
      const others = deps.filter(
        (d) =>
          !(d.type === "column_values" && d.subjectType === "geographies")
      );
      return [
        ...others,
        {
          type: "column_values",
          subjectType: "geographies",
          stableId: fragment.stableId,
          parameters: {
            includedColumns:
              fragment.parameters?.includedColumns ||
              (settings.column ? [settings.column] : undefined),
            groupBy: fragment.parameters?.groupBy,
          },
        },
      ];
    });
  };

  const geographyOptions = useMemo(
    () => [
      { value: "none", label: t("None") },
      ...geographies.map((g) => ({
        value: String(g.id),
        label: g.name,
      })),
    ],
    [geographies, t]
  );

  const percentGeographyValue =
    typeof settings.percentGeographyId === "number"
      ? String(settings.percentGeographyId)
      : "none";

  const sortOptions = [
    { value: "sum", label: t("Sum") },
    { value: "name", label: t("Name") },
  ];

  const buffer = dependencies.find(
    (m) => m.parameters?.bufferDistanceKm !== undefined
  )?.parameters?.bufferDistanceKm;

  const handleBufferClick = () => {
    const currentValue = buffer !== undefined ? String(buffer) : "0";
    const value = window.prompt(
      t("Enter buffer distance in kilometers (or 0 for none)"),
      currentValue
    );
    if (value === null) {
      return;
    }
    const numValue = value === "" || value === "0" ? 0 : Number(value);
    onUpdateDependencyParameters((dependency) => {
      if (dependency.subjectType === "geographies") {
        return {
          ...dependency.parameters,
          bufferDistanceKm: undefined,
        };
      }
      return {
        ...dependency.parameters,
        bufferDistanceKm: numValue === 0 ? undefined : numValue,
      };
    });
  };

  const bufferFormatter = useNumberFormatters({
    unit: "kilometer",
    unitDisplay: "short",
  });

  return (
    <div className="flex gap-3 items-center text-sm text-gray-800">
      {numericColumnOptions.length > 0 && (
        <LabeledDropdown
          label={t("column")}
          value={settings.column || ""}
          options={numericColumnOptions}
          onChange={handleColumnChange}
          getDisplayLabel={(selected) => selected?.value || ""}
        />
      )}
      {groupByOptions.length > 0 && (
        <LabeledDropdown
          label={t("Group by")}
          value={currentGroupBy}
          options={groupByOptions}
          onChange={handleGroupByChange}
          getDisplayLabel={(selected) => selected?.value || ""}
        />
      )}
      <LabeledDropdown
        label={t("% Geography")}
        value={percentGeographyValue}
        options={geographyOptions}
        onChange={handlePercentGeographyChange}
      />
      <LabeledDropdown
        label={t("Sort by")}
        value={sortBy}
        options={sortOptions}
        onChange={(val) => handleUpdate({ sortBy: val as "sum" | "name" })}
      />
      <TableHeadingsEditor
        labelKeys={["nameLabel", "sumLabel", "percentLabel"]}
        labelDisplayNames={["Name", "Sum", "% of Class Total"]}
        componentSettings={settings}
        onUpdate={onUpdate}
      />
      <NumberRoundingControl
        value={settings.minimumFractionDigits}
        onChange={(minimumFractionDigits) =>
          handleUpdate({ minimumFractionDigits })
        }
      />
      <ColumnSumClassLabelsPopover
        settings={settings}
        dependencies={dependencies || []}
        sources={sources}
        onUpdateSettings={handleUpdate}
        t={t}
      />
      <TooltipMorePopover>
        <button
          type="button"
          onClick={handleBufferClick}
          className="w-full text-left text-sm rounded hover:text-black focus:outline-none flex items-center space-x-2"
        >
          <span className="font-light text-gray-400">{t("Buffer")}</span>
          <span className="flex-1 text-right hover:ring hover:ring-blue-300/20">
            {bufferFormatter.distance(buffer ?? 0)}
          </span>
        </button>
        <PaginationSetting
          rowsPerPage={rowsPerPage}
          onChange={(next: number) => handleUpdate({ rowsPerPage: next })}
        />
        <TooltipBooleanConfigurationOption
          label={t("Show zeros")}
          checked={showZero}
          checkboxFirst
          onChange={(next) =>
            handleUpdate({ showZeroCountCategories: next })
          }
        />
        <TooltipBooleanConfigurationOption
          label={t("Show color swatches")}
          checked={!settings.hideColorSwatches}
          checkboxFirst
          onChange={(next) =>
            handleUpdate({ hideColorSwatches: next ? undefined : true })
          }
        />
        <TooltipBooleanConfigurationOption
          label={t("Truncate row labels")}
          checked={shouldTruncateClassTableRowLabels(settings)}
          checkboxFirst
          onChange={(next) =>
            handleUpdate({
              disableRowLabelTruncation: next ? undefined : true,
            })
          }
        />
        {clippingGeography && (
          <div className="flex">
            <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
              {t("Clipping Geography")}
            </span>
            <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
              {clippingGeography.name}
            </span>
          </div>
        )}
        <div className="flex">
          <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
            {t("Component Type")}
          </span>
          <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
            {t("Column Totals by Class")}
          </span>
        </div>
      </TooltipMorePopover>
    </div>
  );
};
