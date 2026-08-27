import { Fragment, ReactNode, useContext, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  getOverlayAreaOverlapCombineResult,
  MetricDependency,
  OverlayAreaMetric,
  OverlayAreaMetricValue,
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
import {
  applyBufferSettingsToParameters,
  BufferSelector,
  getBufferSettingsFromDependencies,
} from "./BufferSelector";
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
import {
  SketchClassPrimaryGeoFields,
  usePrimaryGeography,
} from "../hooks/usePrimaryGeography";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  OverlapDebugTooltip,
  OverlapDebugTooltipRow,
} from "./OverlapDebugTooltip";
import CollectionExpandableName from "./collection/CollectionExpandableName";
import SketchOverlapHint from "./collection/SketchOverlapHint";
import { sketchContributionsForClassTableRow } from "./collection/sketchContributions";
import { useCollectionSketchExpand } from "./collection/useCollectionSketchExpand";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import BufferedOverlapWarning, {
  bufferedOverlapWarrantsWarning,
} from "./BufferedOverlapWarning";
import { useBaseReportContext } from "../context/BaseReportContext";
import { useSubjectReportContext } from "../context/SubjectReportContext";
import { SketchGeometryType } from "../../generated/graphql";
import {
  OverlappingAreasPercentGeographyId,
  buildPercentGeographyValuesBySourceId,
  overlayAreaClassTotalFromValue,
  resolveOverlappingAreasFragmentGeographyId,
  resolveOverlappingAreasPercentGeographyId,
} from "./overlappingAreasPercentGeography";

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
  /**
   * @deprecated Prefer {@link percentGeographyId}. Kept for backwards
   * compatibility with saved reports. When `percentGeographyId` is unset,
   * `false` hides the column and `true`/absent shows it against the primary
   * clipping geography.
   */
  showPercentColumn?: boolean;
  /**
   * Which geography to report numbers against ("% Within" denominator, and
   * the geography fragments must be tagged with when summing Area). See
   * {@link resolveOverlappingAreasPercentGeographyId}.
   */
  percentGeographyId?: OverlappingAreasPercentGeographyId;
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

type OverlapRow = OverlapDebugTooltipRow & {
  overcountMin?: number;
  overcountMax?: number;
  naiveSum?: number;
};

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
  const { printing } = useContext(ReportUIStateContext);

  const unit: OverlapUnit = componentSettings.unit || "km";
  const showZero = componentSettings.showZeroOverlapCategories ?? false;
  const sortBy = componentSettings.sortBy || "overlap";
  const rowsPerPage = componentSettings.rowsPerPage ?? 10;
  const showAreaColumn = componentSettings.showAreaColumn ?? true;
  const percentGeographyId = resolveOverlappingAreasPercentGeographyId(
    componentSettings,
    primaryGeographyId
  );
  const fragmentGeographyId = resolveOverlappingAreasFragmentGeographyId(
    percentGeographyId,
    primaryGeographyId
  );
  const showPercentColumn = percentGeographyId !== undefined;
  const showColorSwatches = !componentSettings.hideColorSwatches;
  const areaColumnAlignClass =
    showAreaColumn && showPercentColumn ? "text-center" : "text-right";
  const truncateRowLabels =
    shouldTruncateClassTableRowLabels(componentSettings);
  const nameLabel = componentSettings.nameLabel || t("Name");
  const areaLabel = componentSettings.areaLabel || t("Area");
  const percentWithinLabel =
    componentSettings.percentWithinLabel || t("% Within");

  const bufferKm = useMemo(() => {
    const dep = (dependencies || []).find(
      (d) =>
        d.type === "overlay_area" &&
        typeof d.parameters?.bufferDistanceKm === "number" &&
        d.parameters.bufferDistanceKm > 0
    );
    return dep?.parameters?.bufferDistanceKm as number | undefined;
  }, [dependencies]);

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

    if (!fragmentGeographyId) {
      throw new Error("Primary geography not found.");
    }

    // Sum Area from fragments tagged with fragmentGeographyId.
    const combinedMetrics = combineMetricsBySource<OverlayAreaMetric>(
      metrics,
      sources,
      fragmentGeographyId,
      "overlay_area"
    );

    // "% Within" denominator: O(1) per row via a sourceId → geography value map.
    // Reuses combine's geography half when percent geo === fragment geo.
    const geographyValuesBySourceId =
      percentGeographyId !== undefined
        ? buildPercentGeographyValuesBySourceId({
            percentGeographyId,
            fragmentGeographyId,
            metrics,
            sources,
            combinedBySource: combinedMetrics,
          })
        : null;

    let rows = classRows.map((r) => {
      const combinedForSource = combinedMetrics[r.sourceId];
      const fragmentValue = combinedForSource?.fragments?.value as
        | OverlayAreaMetricValue
        | undefined;
      const overlapRaw = fragmentValue?.[r.groupByKey];
      const overlap = typeof overlapRaw === "number" ? overlapRaw : 0;
      const geographyTotal =
        geographyValuesBySourceId !== null
          ? overlayAreaClassTotalFromValue(
              geographyValuesBySourceId.get(r.sourceId),
              r.groupByKey
            )
          : undefined;
      const combineResult = getOverlayAreaOverlapCombineResult(fragmentValue);
      const perClass = combineResult?.perClass?.[r.groupByKey];
      return {
        ...r,
        overlap,
        geographyTotal,
        overcountMin: perClass?.overcountMin,
        overcountMax: perClass?.overcountMax,
        naiveSum: perClass?.naiveSum,
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
    fragmentGeographyId,
    percentGeographyId,
    componentSettings.customRowLabels,
    componentSettings.rowLinkedStableIds,
    componentSettings.excludedRowKeys,
    componentSettings.includeAllFeaturesRowForGroupedSources,
    showZero,
    sortBy,
    t,
    loading,
  ]);

  const cardFootnotePct = useMemo(() => {
    let maxPct = 0;
    for (const row of rows) {
      if (
        typeof row.overcountMax === "number" &&
        typeof row.naiveSum === "number" &&
        typeof row.overcountMin === "number" &&
        bufferedOverlapWarrantsWarning(
          row.overcountMin,
          row.overcountMax,
          row.naiveSum
        )
      ) {
        // Residual uncertainty after the displayed correction.
        const residual = row.overcountMax - row.overcountMin;
        maxPct = Math.max(maxPct, (residual / row.naiveSum) * 100);
      }
    }
    return maxPct > 0 ? Math.ceil(maxPct) : 0;
  }, [rows]);

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
    if (!isCollection || !fragmentGeographyId || loading) {
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
          geographyId: fragmentGeographyId,
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
        })
      );
    }
    return map;
  }, [
    isCollection,
    fragmentGeographyId,
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
            const expanded = isSketchBreakdownExpanded(row.key);
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
                        { name: row.label }
                      )}
                      expandAriaLabelCollapsed={t(
                        "Expand sketch breakdown for {{name}}",
                        { name: row.label }
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
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          {typeof row.overcountMin === "number" &&
                            typeof row.overcountMax === "number" &&
                            typeof row.naiveSum === "number" && (
                              <BufferedOverlapWarning
                                overcountMin={row.overcountMin}
                                overcountMax={row.overcountMax}
                                total={row.naiveSum}
                                formatArea={(sqKm) => formatters.area(sqKm)}
                              />
                            )}
                          {formatters.area(row.overlap)}
                        </span>
                      )}
                    </div>
                  )}
                  {showPercentColumn && (
                    <div className="flex-none text-right text-gray-700 tabular-nums text-sm min-w-[70px]">
                      {loading ? (
                        <MetricLoadingDots />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          {typeof percent === "number" &&
                            percent > 1.05 &&
                            percentGeographyId !== undefined &&
                            fragmentGeographyId !== undefined && (
                              <OverlapDebugTooltip
                                row={row}
                                percent={percent}
                                metrics={metrics}
                                sources={sources}
                                fragmentGeographyId={fragmentGeographyId}
                                percentGeographyId={percentGeographyId}
                                formatters={formatters}
                                bufferKm={bufferKm}
                                classLabel={row.label}
                              />
                            )}
                          {typeof percent === "number"
                            ? formatters.percent(percent)
                            : formatters.percent(0)}
                        </span>
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
                        row.overlap === 0 ? "opacity-50" : ""
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
        {printing && cardFootnotePct > 0 && (
          <div className="px-3 py-2 border-t border-amber-200 bg-amber-50 text-xs text-amber-900">
            <Trans
              ns="reports"
              i18nKey="bufferedOverlapCardFootnote"
              defaults="Some areas near buffered boundaries could not be fully deduplicated. Percentages next to area values are the maximum possible overestimation (highest in this table: {{pct}}%)."
              values={{ pct: cardFootnotePct }}
            />
          </div>
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
    const showColorSwatches = !settings.hideColorSwatches;

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

    const handleUpdate = (patch: Partial<OverlappingAreasTableSettings>) => {
      onUpdate({
        componentSettings: {
          ...settings,
          ...patch,
        },
      });
    };

    const percentGeographyDropdownValue = useMemo(() => {
      if (settings.percentGeographyId === null) {
        return "none";
      }
      if (settings.percentGeographyId === "primary") {
        return "primary";
      }
      if (
        typeof settings.percentGeographyId === "number" &&
        Number.isFinite(settings.percentGeographyId)
      ) {
        return String(settings.percentGeographyId);
      }
      // Legacy boolean / unset → match runtime resolve (default on → primary).
      if (settings.showPercentColumn === false) {
        return "none";
      }
      return "primary";
    }, [settings.percentGeographyId, settings.showPercentColumn]);

    const geographyOptions = useMemo(() => {
      const defaultSuffix = (
        <span className="text-gray-400"> {t("default")}</span>
      );
      const options: Array<{ value: string; label: ReactNode }> = [
        { value: "none", label: t("None") },
      ];
      if (clippingGeography) {
        options.push({
          value: "primary",
          label: (
            <span>
              {clippingGeography.name}
              {defaultSuffix}
            </span>
          ),
        });
      } else {
        options.push({
          value: "primary",
          label: (
            <span>
              {t("Primary clipping geography")}
              {defaultSuffix}
            </span>
          ),
        });
      }
      for (const g of geographies) {
        if (clippingGeography && g.id === clippingGeography.id) {
          continue;
        }
        options.push({ value: String(g.id), label: g.name });
      }
      return options;
    }, [geographies, clippingGeography, t]);

    const handlePercentGeographyChange = (value: string) => {
      if (value === "none") {
        handleUpdate({
          percentGeographyId: null,
          showPercentColumn: undefined,
        });
        return;
      }
      if (value === "primary") {
        handleUpdate({
          percentGeographyId: "primary",
          showPercentColumn: undefined,
        });
        return;
      }
      const geographyId = Number(value);
      if (!Number.isFinite(geographyId)) {
        return;
      }
      handleUpdate({
        percentGeographyId: geographyId,
        showPercentColumn: undefined,
      });
    };

    const sortOptions = [
      { value: "overlap", label: t("Overlap") },
      { value: "name", label: t("Name") },
    ];

    const selectedAreaUnit = overlapUnitToAreaUnit[unit];

    const bufferSettings = useMemo(
      () => getBufferSettingsFromDependencies(dependencies),
      [dependencies]
    );
    const showBufferGeography = useMemo(
      () => dependencies.some((d) => d.subjectType === "geographies"),
      [dependencies]
    );

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
        <LabeledDropdown
          label={t("% Geography")}
          value={percentGeographyDropdownValue}
          options={geographyOptions}
          onChange={handlePercentGeographyChange}
          getDisplayLabel={(selected) => {
            if (selected?.value === "none") {
              return t("None");
            }
            if (selected?.value === "primary") {
              return clippingGeography?.name || t("Primary clipping geography");
            }
            return selected?.label;
          }}
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
          <BufferSelector
            distanceKm={bufferSettings.distanceKm}
            bufferGeography={bufferSettings.bufferGeography}
            showBufferGeography={showBufferGeography}
            onChange={(next) => {
              onUpdateDependencyParameters((dependency) =>
                applyBufferSettingsToParameters(dependency, next)
              );
            }}
          />
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
