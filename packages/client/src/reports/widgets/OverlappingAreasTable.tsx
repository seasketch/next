import { Fragment, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  MetricDependency,
  OverlayAreaMetric,
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
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { UnitSelector } from "./UnitSelector";
import { AreaUnit } from "../utils/units";
import { NumberRoundingControl } from "./NumberRoundingControl";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { useOverlaySources } from "../hooks/useOverlaySources";
import {
  PaginationFooter,
  PaginationSetting,
  TablePaddingRows,
} from "./Pagination";
import { usePagination } from "../hooks/usePagination";
import {
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
import { ClassRowSettingsPopover } from "./ClassRowSettingsPopover";
import { LabeledDropdown } from "./LabeledDropdown";
import ReportLayerVisibilityCheckbox from "../components/ReportLayerVisibilityCheckbox";
import { LayersIcon } from "@radix-ui/react-icons";
import { usePrimaryGeography } from "../hooks/usePrimaryGeography";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  OverlapDebugTooltip,
  OverlapDebugTooltipRow,
} from "./OverlapDebugTooltip";
import CollectionExpandableName from "./collection/CollectionExpandableName";
import SketchOverlapHint from "./collection/SketchOverlapHint";
import { sketchContributionsForClassTableRow } from "./collection/sketchContributions";
import { useCollectionSketchExpand } from "./collection/useCollectionSketchExpand";

// Accept both area and length style units; default to km (area).
type OverlapUnit = "km" | "mi" | "acres" | "ha";

type OverlappingAreasTableSettings = {
  unit?: OverlapUnit;
  showZeroOverlapCategories?: boolean;
  sortBy?: "overlap" | "name";
  bufferMeters?: number;
  minimumFractionDigits?: number;
  rowsPerPage?: number;
  nameLabel?: string;
  areaLabel?: string;
  percentWithinLabel?: string;
  showAreaColumn?: boolean;
  showPercentColumn?: boolean;
  hideColorSwatches?: boolean;
} & ClassTableRowComponentSettings;

const overlapUnitToAreaUnit: Record<OverlapUnit, AreaUnit> = {
  km: "kilometer",
  mi: "mile",
  acres: "acre",
  ha: "hectare",
};

const areaUnitToOverlapUnit: Record<AreaUnit, OverlapUnit> = {
  kilometer: "km",
  mile: "mi",
  acre: "acres",
  hectare: "ha",
};

type OverlapRow = OverlapDebugTooltipRow;

export const OverlappingAreasTable: ReportWidget<
  OverlappingAreasTableSettings
> = ({
  metrics,
  componentSettings,
  sources,
  loading,
  dependencies,
  sketchClass,
  geographies,
}) => {
  const { clippingGeography } = usePrimaryGeography(sketchClass, geographies);
  const primaryGeographyId = clippingGeography?.id;
  const { t } = useTranslation("reports");

  const unit: OverlapUnit = componentSettings.unit || "km";
  const showZero = componentSettings.showZeroOverlapCategories ?? false;
  const sortBy = componentSettings.sortBy || "overlap";
  const rowsPerPage = componentSettings.rowsPerPage ?? 10;
  const showAreaColumn = componentSettings.showAreaColumn ?? true;
  const showPercentColumn = componentSettings.showPercentColumn ?? true;
  const showColorSwatches = !componentSettings.hideColorSwatches;
  const areaColumnAlignClass =
    showAreaColumn && showPercentColumn ? "text-center" : "text-right";
  const truncateRowLabels = shouldTruncateClassTableRowLabels(componentSettings);
  const nameLabel = componentSettings.nameLabel || t("Name");
  const areaLabel = componentSettings.areaLabel || t("Area");
  const percentWithinLabel =
    componentSettings.percentWithinLabel || t("% Within");

  const formatters = useNumberFormatters({
    unit:
      unit === "km"
        ? "kilometer"
        : unit === "mi"
        ? "mile"
        : unit === "acres"
        ? "acre"
        : "hectare",
    unitDisplay: "short",
    minimumFractionDigits: componentSettings.minimumFractionDigits,
  });

  const rows = useMemo<OverlapRow[]>(() => {
    const classRows = getClassTableRows({
      dependencies: dependencies || [],
      sources,
      customLabels: componentSettings.customRowLabels,
      allFeaturesLabel: t("All features"),
      stableIds: componentSettings.rowLinkedStableIds,
      excludedRowKeys: componentSettings.excludedRowKeys,
      includeAllFeaturesRowForGroupedSources:
        componentSettings.includeAllFeaturesRowForGroupedSources,
    });

    if (sources.length === 0 || metrics.length === 0 || loading) {
      return classRows.map((r) => ({
        ...r,
        overlap: NaN,
        geographyTotal: NaN,
      }));
    }

    if (!primaryGeographyId) {
      throw new Error("Primary geography not found.");
    }

    const combinedMetrics = combineMetricsBySource<OverlayAreaMetric>(
      metrics,
      sources,
      primaryGeographyId,
      "overlay_area"
    );

    let rows = classRows.map((r) => {
      const combinedForSource = combinedMetrics[r.sourceId];
      const overlap = combinedForSource?.fragments?.value?.[r.groupByKey] ?? 0;
      const geographyTotal =
        combinedForSource?.geographies?.value?.[r.groupByKey] ?? 0;
      return {
        ...r,
        overlap,
        geographyTotal,
      };
    });

    if (sortBy === "name") {
      rows = rows.sort((a, b) => a.label.localeCompare(b.label));
    } else {
      rows = rows.sort((a, b) => (b.overlap ?? 0) - (a.overlap ?? 0));
    }

    if (!showZero) {
      rows = rows.filter((r) => r.overlap > 0);
    }

    return rows;
  }, [
    metrics,
    dependencies,
    sources,
    primaryGeographyId,
    componentSettings.customRowLabels,
    componentSettings.rowLinkedStableIds,
    componentSettings.excludedRowKeys,
    componentSettings.includeAllFeaturesRowForGroupedSources,
    showZero,
    sortBy,
    t,
    loading,
  ]);

  const {
    isCollection,
    sketchNameById,
    childSketchIds,
    expandedRowKeys,
    toggleRow,
    hideCaretExpandTooltip,
  } = useCollectionSketchExpand(sketchClass);

  const sketchLinesByRowKey = useMemo(() => {
    if (!isCollection || !primaryGeographyId || loading) {
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
          metricType: "overlay_area",
          groupByKey: row.groupByKey,
          childSketchIds,
          geographyDenominator:
            typeof row.geographyTotal === "number" &&
            Number.isFinite(row.geographyTotal)
              ? row.geographyTotal
              : 0,
          sketchNameById,
          t,
        }),
      );
    }
    return map;
  }, [
    isCollection,
    primaryGeographyId,
    loading,
    rows,
    metrics,
    sources,
    childSketchIds,
    sketchNameById,
    t,
  ]);

  const hasVisibilityColumn = useMemo(
    () =>
      hasClassTableRowVisibilityToggle(
        rows,
        componentSettings.rowLinkedStableIds
      ),
    [rows, componentSettings.rowLinkedStableIds]
  );

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

  // loading = true;

  if (
    !loading &&
    !rows.length &&
    !componentSettings.showZeroOverlapCategories
  ) {
    return (
      <div className="mt-3 border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No overlapping features found.</Trans>
      </div>
    );
  }

  const hasSwatchColumn =
    showColorSwatches && rows.some(classTableRowHasSwatch);

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {/* Header row */}
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
          {hasVisibilityColumn && (
            <div className="flex-none w-6 flex justify-center text-xs text-gray-600 font-semibold uppercase tracking-wide">
              <LayersIcon className="w-4 h-4 text-gray-500" aria-hidden />
            </div>
          )}
          <div className="flex-1 min-w-0 text-gray-600 text-xs font-semibold uppercase tracking-wide">
            {nameLabel}
          </div>
          {showAreaColumn && (
            <div
              className={`flex-none ${areaColumnAlignClass} text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[80px]`}
            >
              {areaLabel}
            </div>
          )}
          {showPercentColumn && (
            <div className="flex-none text-right text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[70px]">
              {percentWithinLabel}
            </div>
          )}
        </div>
        {paginatedRows.map((row) => {
          const percent =
            !loading &&
            typeof row.geographyTotal === "number" &&
            row.geographyTotal > 0
              ? row.overlap / row.geographyTotal
              : undefined;
          const stableId = resolveClassTableRowStableId(
            row,
            componentSettings.rowLinkedStableIds
          );
          const expanded =
            isCollection && expandedRowKeys.has(row.key);
          const sketchLines = sketchLinesByRowKey.get(row.key) ?? [];
          return (
            <Fragment key={row.key}>
            <div
              className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                row.overlap === 0 ? "opacity-50" : ""
              }`}
            >
              {hasVisibilityColumn && (
                <div className="flex-none w-6 flex justify-center">
                  {stableId ? (
                    <ReportLayerVisibilityCheckbox stableId={stableId} />
                  ) : null}
                </div>
              )}
              {showColorSwatches && <SwatchForClassTableRow row={row} />}
              <div className="flex-1 min-w-0 text-gray-800 text-sm">
                <CollectionExpandableName
                  displayLabel={row.label}
                  truncateRowLabels={truncateRowLabels}
                  expanded={expanded}
                  onToggle={() => toggleRow(row.key)}
                  loading={loading}
                  isCollection={isCollection}
                  caretTooltipEnabled={!hideCaretExpandTooltip}
                  caretTooltipLabel={t("Expand sketch details")}
                  expandAriaLabelExpanded={t(
                    "Collapse sketch breakdown for {{name}}",
                    { name: row.label },
                  )}
                  expandAriaLabelCollapsed={t(
                    "Expand sketch breakdown for {{name}}",
                    { name: row.label },
                  )}
                />
              </div>
              {showAreaColumn && (
                <div
                  className={`flex-none ${areaColumnAlignClass} text-gray-900 tabular-nums text-sm min-w-[80px]`}
                >
                  {loading ? (
                    <MetricLoadingDots />
                  ) : (
                    formatters.area(row.overlap)
                  )}
                </div>
              )}
              {showPercentColumn && (
                <div className="flex-none text-right text-gray-700 tabular-nums text-sm min-w-[70px]">
                  {typeof percent === "number" &&
                    percent > 1.05 &&
                    primaryGeographyId !== undefined && (
                      <OverlapDebugTooltip
                        row={row}
                        percent={percent}
                        metrics={metrics}
                        sources={sources}
                        primaryGeographyId={primaryGeographyId}
                        formatters={formatters}
                      />
                    )}
                  {loading ? (
                    <MetricLoadingDots />
                  ) : typeof percent === "number" ? (
                    formatters.percent(percent)
                  ) : (
                    formatters.percent(0)
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
                    "No individual sketches contributed to this category.",
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
                    row.overlap === 0 ? "opacity-50" : ""
                  }`}
                >
                  {hasVisibilityColumn && (
                    <div className="flex-none w-6" aria-hidden />
                  )}
                  {hasSwatchColumn && (
                    <div className="flex-none w-4 flex justify-center" aria-hidden />
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
                  {showAreaColumn && (
                    <div
                      className={`flex-none ${areaColumnAlignClass} tabular-nums text-sm text-gray-900 min-w-[80px]`}
                    >
                      {loading ? (
                        <MetricLoadingDots />
                      ) : (
                        formatters.area(sk.primaryValue)
                      )}
                    </div>
                  )}
                  {showPercentColumn && (
                    <div className="flex-none min-w-[70px] text-right tabular-nums text-sm text-gray-700">
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
          includeVisibilityColumn={hasVisibilityColumn}
          includeColorColumn={
            showColorSwatches && rows.some(classTableRowHasSwatch)
          }
          showAreaColumn={showAreaColumn}
          showPercentColumn={showPercentColumn}
          numericAlign={
            showAreaColumn && showPercentColumn ? "center" : "right"
          }
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

export const OverlappingAreasTableTooltipControls: ReportWidgetTooltipControls =
  ({
    node,
    onUpdate,
    onUpdateDependencyParameters,
    onUpdateAllDependencies,
  }) => {
    const { t } = useTranslation("admin:reports");
    const dependencies = useMemo(
      () => (node.attrs?.metrics || []) as MetricDependency[],
      [node.attrs?.metrics]
    );
    const settings: OverlappingAreasTableSettings = useMemo(
      () => node.attrs?.componentSettings || {},
      [node.attrs?.componentSettings]
    );

    const unit: OverlapUnit = settings.unit || "km";
    const showZero = settings.showZeroOverlapCategories ?? false;
    const sortBy = settings.sortBy || "overlap";
    const rowsPerPage = settings.rowsPerPage ?? 10;
    const showAreaColumn = settings.showAreaColumn ?? true;
    const showPercentColumn = settings.showPercentColumn ?? true;
    const showColorSwatches = !settings.hideColorSwatches;

    const { filteredSources: sources } = useOverlaySources(dependencies);

    const handleUpdate = (patch: Partial<OverlappingAreasTableSettings>) => {
      onUpdate({
        componentSettings: {
          ...settings,
          ...patch,
        },
      });
    };

    const sortOptions = [
      { value: "overlap", label: t("Overlap") },
      { value: "name", label: t("Name") },
    ];

    const selectedAreaUnit = overlapUnitToAreaUnit[unit];

    return (
      <div className="flex gap-3 items-center text-sm text-gray-800">
        <UnitSelector
          unitType="area"
          value={selectedAreaUnit}
          onChange={(val: AreaUnit) =>
            handleUpdate({ unit: areaUnitToOverlapUnit[val] })
          }
          unitDisplay="short"
        />
        <NumberRoundingControl
          value={settings.minimumFractionDigits}
          onChange={(minimumFractionDigits) =>
            handleUpdate({
              minimumFractionDigits,
            })
          }
        />
        <LabeledDropdown
          label={t("Sort by")}
          value={sortBy}
          options={sortOptions}
          onChange={(val) =>
            handleUpdate({ sortBy: val as "overlap" | "name" })
          }
        />

        <ClassRowSettingsPopover
          settings={settings}
          onUpdateSettings={(patch) => handleUpdate(patch)}
          dependencies={dependencies || []}
          sources={sources}
          onUpdateDependencyParameters={onUpdateDependencyParameters}
          onUpdateAllDependencies={onUpdateAllDependencies}
          t={t}
          allowedGeometryTypes={["Polygon", "MultiPolygon"]}
          showZeros={showZero}
          onShowZerosChange={(next) =>
            handleUpdate({ showZeroOverlapCategories: next })
          }
        />
        <TableHeadingsEditor
          labelKeys={["nameLabel", "areaLabel", "percentWithinLabel"]}
          labelDisplayNames={["Name", "Area", "% Within"]}
          componentSettings={settings}
          onUpdate={onUpdate}
        />
        <TooltipMorePopover>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {t("Show columns")}
            </div>
            <TooltipBooleanConfigurationOption
              label={t("Color swatches")}
              checked={showColorSwatches}
              checkboxFirst
              onChange={(next) =>
                handleUpdate({ hideColorSwatches: next ? undefined : true })
              }
            />
            <TooltipBooleanConfigurationOption
              label={t("Area")}
              checked={showAreaColumn}
              checkboxFirst
              onChange={(next) =>
                handleUpdate({
                  showAreaColumn: next ? undefined : false,
                })
              }
            />
            <TooltipBooleanConfigurationOption
              label={t("% of geography")}
              checked={showPercentColumn}
              checkboxFirst
              onChange={(next) =>
                handleUpdate({
                  showPercentColumn: next ? undefined : false,
                })
              }
            />
          </div>
          <PaginationSetting
            rowsPerPage={rowsPerPage}
            onChange={(next: number) => handleUpdate({ rowsPerPage: next })}
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
        </TooltipMorePopover>
      </div>
    );
  };
