import { Fragment, useContext, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  MetricDependency,
  RasterOverlayAreaMetric,
  getRasterOverlayAreaOverlapCombineResult,
  getRasterOverlayAreaDisplayedClassValue,
} from "overlay-engine";
import {
  ReportWidget,
  TableHeadingsEditor,
  TooltipBooleanConfigurationOption,
} from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
} from "../../editor/TooltipMenu";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
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
import { ClassRowSettingsPopover } from "./ClassRowSettingsPopover";
import { LabeledDropdown } from "./LabeledDropdown";
import { VrmSelector } from "./VrmSelector";
import ReportLayerVisibilityCheckbox from "../components/ReportLayerVisibilityCheckbox";
import { LayersIcon } from "@radix-ui/react-icons";
import { usePrimaryGeography } from "../hooks/usePrimaryGeography";
import type { SketchClassPrimaryGeoFields } from "../hooks/usePrimaryGeography";
import { useBaseReportContext } from "../context/BaseReportContext";
import { useSubjectReportContext } from "../context/SubjectReportContext";
import { GeographySelector } from "./InlineMetric";
import * as Tooltip from "@radix-ui/react-tooltip";
import CollectionExpandableName from "./collection/CollectionExpandableName";
import SketchOverlapHint from "./collection/SketchOverlapHint";
import { sketchContributionsForClassTableRow } from "./collection/sketchContributions";
import { useCollectionSketchExpand } from "./collection/useCollectionSketchExpand";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { SketchGeometryType } from "../../generated/graphql";
import { UnitSelector } from "./UnitSelector";
import { AreaUnit } from "../utils/units";
import BufferedOverlapWarning from "./BufferedOverlapWarning";

type AreaDisplayUnit = "km" | "mi" | "acres" | "ha";

type RasterAreaCapturedTableSettings = {
  /**
   * Geography used for the "% Captured" denominator.
   * - `undefined` / `"auto"` → primary clipping geography (default; show %)
   * - `number` → that geography (show %)
   * - `null` → no % column
   */
  geographyId?: number | "auto" | null;
  sortBy?: "area" | "name";
  minimumFractionDigits?: number;
  rowsPerPage?: number;
  nameLabel?: string;
  areaLabel?: string;
  percentLabel?: string;
  /**
   * @deprecated Prefer `geographyId: null` to hide the % column. Kept for
   * saved reports that used the old "Show % of geography" toggle.
   */
  showPercentColumn?: boolean;
  showZeroRows?: boolean;
  hideColorSwatches?: boolean;
  unit?: AreaDisplayUnit;
} & ClassTableRowComponentSettings;

type AreaRow = ClassTableRow & {
  areaKm2: number;
  geographyAreaKm2: number;
  overcountMin?: number;
  overcountMax?: number;
  overcountEstimate?: number;
  naiveSum?: number;
};

const displayUnitToAreaUnit: Record<AreaDisplayUnit, AreaUnit> = {
  km: "kilometer",
  mi: "mile",
  acres: "acre",
  ha: "hectare",
};

const areaUnitToDisplayUnit: Record<AreaUnit, AreaDisplayUnit> = {
  kilometer: "km",
  mile: "mi",
  acre: "acres",
  hectare: "ha",
};

export const RasterAreaCapturedTable: ReportWidget<
  RasterAreaCapturedTableSettings
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
  const { t } = useTranslation("reports");
  const { printing } = useContext(ReportUIStateContext);

  const showPercentColumn =
    componentSettings.geographyId === null
      ? false
      : componentSettings.showPercentColumn === false
        ? false
        : true;

  // Geography metrics / % denominator. When % is off, still resolve against
  // the clipping geography so combineMetricsBySource has a valid id.
  const geographyId: number | undefined =
    componentSettings.geographyId === null ||
    componentSettings.geographyId === "auto" ||
    componentSettings.geographyId === undefined
      ? clippingGeography?.id
      : componentSettings.geographyId;

  const sortBy = componentSettings.sortBy || "name";
  const rowsPerPage = componentSettings.rowsPerPage ?? 10;
  const showZeroRows = componentSettings.showZeroRows ?? true;
  const showColorSwatches = !componentSettings.hideColorSwatches;
  const unit: AreaDisplayUnit = componentSettings.unit || "km";
  const nameLabel = componentSettings.nameLabel || t("Name");
  const areaLabel = componentSettings.areaLabel || t("Area");
  const percentLabel = componentSettings.percentLabel || t("% Captured");
  const truncateRowLabels = shouldTruncateClassTableRowLabels(componentSettings);

  const formatters = useNumberFormatters({
    unit: displayUnitToAreaUnit[unit],
    unitDisplay: "short",
    minimumFractionDigits: componentSettings.minimumFractionDigits,
  });

  const rows = useMemo<AreaRow[]>(() => {
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
        areaKm2: NaN,
        geographyAreaKm2: NaN,
      }));
    }

    if (!geographyId) {
      throw new Error("Primary geography not found.");
    }

    const combinedMetrics = combineMetricsBySource<RasterOverlayAreaMetric>(
      metrics,
      sources,
      geographyId,
      "raster_overlay_area"
    );

    let next = classRows.map((r) => {
      const combinedForSource = combinedMetrics[r.sourceId];
      const fragmentValue = combinedForSource?.fragments?.value;
      const geographyValue = combinedForSource?.geographies?.value;
      const areaKm2 = getRasterOverlayAreaDisplayedClassValue(
        fragmentValue,
        r.groupByKey
      );
      const geographyAreaKm2 =
        typeof geographyValue?.areas?.[r.groupByKey] === "number"
          ? geographyValue.areas[r.groupByKey]
          : 0;
      const combine = getRasterOverlayAreaOverlapCombineResult(fragmentValue);
      const perClass = combine?.perClass?.[r.groupByKey];
      return {
        ...r,
        areaKm2,
        geographyAreaKm2,
        overcountMin: perClass?.overcountMin,
        overcountMax: perClass?.overcountMax,
        overcountEstimate: perClass?.overcountEstimate,
        naiveSum: perClass?.naiveSum,
      };
    });

    if (sortBy === "name") {
      next = next.sort((a, b) => a.label.localeCompare(b.label));
    } else {
      next = next.sort((a, b) => b.areaKm2 - a.areaKm2);
    }

    if (!showZeroRows) {
      next = next.filter((r) => r.areaKm2 > 0);
    }

    return next;
  }, [
    metrics,
    dependencies,
    sources,
    geographyId,
    componentSettings.customRowLabels,
    componentSettings.rowLinkedStableIds,
    componentSettings.excludedRowKeys,
    componentSettings.includeAllFeaturesRowForGroupedSources,
    showZeroRows,
    sortBy,
    t,
    loading,
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
    if (!isCollection || !geographyId || loading) {
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
          geographyId,
          metricType: "raster_overlay_area",
          groupByKey: row.groupByKey,
          childSketchIds,
          geographyDenominator:
            typeof row.geographyAreaKm2 === "number" &&
            Number.isFinite(row.geographyAreaKm2)
              ? row.geographyAreaKm2
              : 0,
          sketchNameById,
          t,
        })
      );
    }
    return map;
  }, [
    isCollection,
    geographyId,
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

  const hasSwatchColumn =
    showColorSwatches && rows.some(classTableRowHasSwatch);

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
        <div className="divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
            {hasVisibilityColumn && (
              <div className="flex-none w-6 flex justify-center text-xs text-gray-600 font-semibold uppercase tracking-wide">
                <LayersIcon className="w-4 h-4 text-gray-500" aria-hidden />
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
              {areaLabel}
            </div>
            {showPercentColumn && (
              <div className="flex-none text-right text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[80px]">
                {percentLabel}
              </div>
            )}
          </div>
          {paginatedRows.map((row) => {
            const percent =
              !loading && row.geographyAreaKm2 > 0
                ? row.areaKm2 / row.geographyAreaKm2
                : 0;
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
                    row.areaKm2 === 0 ? "opacity-50" : ""
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
                  <div
                    className={`flex-none text-gray-900 tabular-nums text-sm min-w-[80px] flex items-center gap-1 ${
                      showPercentColumn ? "justify-center" : "justify-end"
                    }`}
                  >
                    {loading ? (
                      <MetricLoadingDots />
                    ) : (
                      <>
                        <span>{formatters.area(row.areaKm2)}</span>
                        {typeof row.overcountEstimate === "number" &&
                          typeof row.overcountMax === "number" &&
                          typeof row.naiveSum === "number" && (
                            <BufferedOverlapWarning
                              overcountMin={row.overcountMin ?? 0}
                              overcountMax={row.overcountMax}
                              overcountEstimate={row.overcountEstimate}
                              total={row.naiveSum}
                              formatArea={(sqKm) => formatters.area(sqKm)}
                            />
                          )}
                      </>
                    )}
                  </div>
                  {showPercentColumn && (
                    <div className="flex-none text-right text-gray-900 tabular-nums text-sm min-w-[80px]">
                      {loading ? (
                        <MetricLoadingDots />
                      ) : (
                        formatters.percent(percent)
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
                        row.areaKm2 === 0 ? "opacity-50" : ""
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
                        className={`flex-none text-gray-900 tabular-nums text-sm min-w-[80px] ${
                          showPercentColumn ? "text-center" : "text-right"
                        }`}
                      >
                        {loading ? (
                          <MetricLoadingDots />
                        ) : (
                          formatters.area(sk.primaryValue)
                        )}
                      </div>
                      {showPercentColumn && (
                        <div className="flex-none text-right text-gray-900 tabular-nums text-sm min-w-[80px]">
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
            includeColorColumn={hasSwatchColumn}
            showPercentColumn={showPercentColumn}
            numericAlign={showPercentColumn ? "center" : "right"}
          />
        </div>
        {!loading && rows.length === 0 && (
          <div className="mt-3 border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm mx-3 mb-3">
            <Trans ns="reports">No data available.</Trans>
          </div>
        )}
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

export const RasterAreaCapturedTableTooltipControls: ReportWidgetTooltipControls =
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
    const settings: RasterAreaCapturedTableSettings = useMemo(
      () => node.attrs?.componentSettings || {},
      [node.attrs?.componentSettings]
    );

    const sortBy = settings.sortBy || "name";
    const showZeroRows = settings.showZeroRows ?? true;
    const showPercentColumn =
      settings.geographyId === null
        ? false
        : settings.showPercentColumn === false
          ? false
          : true;
    const rowsPerPage = settings.rowsPerPage ?? 10;
    const unit: AreaDisplayUnit = settings.unit || "km";

    const headingsLabelKeys = useMemo(
      (): string[] =>
        showPercentColumn
          ? ["nameLabel", "areaLabel", "percentLabel"]
          : ["nameLabel", "areaLabel"],
      [showPercentColumn]
    );
    const headingsLabelDisplayNames = useMemo(
      (): string[] =>
        showPercentColumn
          ? ["Name", "Area", "% Captured"]
          : ["Name", "Area"],
      [showPercentColumn]
    );

    const { filteredSources: sources } = useOverlaySources(dependencies);

    const { geographies } = useBaseReportContext();
    const subjectReportContext = useSubjectReportContext();
    const sketchClass = subjectReportContext.data?.sketch?.sketchClass;
    const sketchClassForPrimaryGeography: SketchClassPrimaryGeoFields =
      sketchClass ?? {
        geometryType: SketchGeometryType.Polygon,
        clippingGeographies: [],
        validChildren: [],
        project: { sketchClasses: [] },
      };
    const { clippingGeography } = usePrimaryGeography(
      sketchClassForPrimaryGeography,
      geographies
    );

    const handleUpdate = (patch: Partial<RasterAreaCapturedTableSettings>) => {
      onUpdate({
        componentSettings: {
          ...settings,
          ...patch,
        },
      });
    };

    const currentVrm = useMemo(() => {
      const fragmentDep = dependencies.find(
        (d) => d.subjectType === "fragments"
      );
      return fragmentDep?.parameters?.vrm;
    }, [dependencies]);

    const handleVrmChange = (next: false | "auto" | number | undefined) => {
      onUpdateDependencyParameters((dependency) => {
        const params = { ...(dependency.parameters || {}) };
        if (dependency.subjectType !== "fragments") {
          return params;
        }
        if (next === undefined || next === "auto") {
          delete params.vrm;
        } else {
          params.vrm = next;
        }
        return params;
      });
    };

    const buffer = dependencies.find(
      (m) => m.parameters?.bufferDistanceKm !== undefined
    )?.parameters?.bufferDistanceKm;

    const handleBufferClick = () => {
      const currentValue = buffer !== undefined ? String(buffer) : "0";
      const value = window.prompt(
        t(
          "Enter buffer distance in kilometers (or 0 for none). Buffers pull in habitat outside the sketch; when neighboring sketches' buffers overlap on this layer, totals may include a small double-count — we'll flag it only when the estimated overlap is material."
        ),
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
      <Tooltip.Provider>
        <div className="flex gap-3 items-center text-sm text-gray-800">
          <UnitSelector
            unitType="area"
            value={displayUnitToAreaUnit[unit]}
            onChange={(val: AreaUnit) =>
              handleUpdate({ unit: areaUnitToDisplayUnit[val] })
            }
            unitDisplay="short"
          />
          <NumberRoundingControl
            value={settings.minimumFractionDigits}
            onChange={(minimumFractionDigits) =>
              handleUpdate({ minimumFractionDigits })
            }
          />
          <LabeledDropdown
            label={t("Sort by")}
            value={sortBy}
            options={[
              { value: "name", label: t("Name") },
              { value: "area", label: t("Area") },
            ]}
            onChange={(val) =>
              handleUpdate({ sortBy: val as "area" | "name" })
            }
          />
          <GeographySelector
            value={
              settings.geographyId === undefined
                ? settings.showPercentColumn === false
                  ? null
                  : "auto"
                : settings.geographyId
            }
            onChange={(geographyId) =>
              handleUpdate({
                geographyId,
                // Clear legacy toggle when using the None/geography dropdown.
                showPercentColumn: undefined,
              })
            }
            geographies={geographies}
            clippingGeography={clippingGeography}
            t={t}
            allowNone
          />
          <button
            type="button"
            className="text-sm text-gray-700 hover:text-gray-900 underline-offset-2 hover:underline"
            onClick={handleBufferClick}
          >
            {buffer !== undefined && buffer > 0
              ? t("Buffer {{distance}}", {
                  distance: bufferFormatter.decimal(buffer),
                })
              : t("Buffer")}
          </button>
          <ClassRowSettingsPopover
            settings={settings}
            onUpdateSettings={(patch) => handleUpdate(patch)}
            dependencies={dependencies || []}
            sources={sources}
            onUpdateDependencyParameters={onUpdateDependencyParameters}
            onUpdateAllDependencies={onUpdateAllDependencies}
            t={t}
            allowedGeometryTypes={["SingleBandRaster"]}
            showZeros={showZeroRows}
            onShowZerosChange={(next) => handleUpdate({ showZeroRows: next })}
          />
          <TableHeadingsEditor
            labelKeys={headingsLabelKeys}
            labelDisplayNames={headingsLabelDisplayNames}
            componentSettings={settings}
            onUpdate={onUpdate}
          />
          <TooltipMorePopover>
            <PaginationSetting
              rowsPerPage={rowsPerPage}
              onChange={(next) => handleUpdate({ rowsPerPage: next })}
            />
            <VrmSelector value={currentVrm} onChange={handleVrmChange} />
            <TooltipBooleanConfigurationOption
              label={t("Hide color swatches")}
              checked={!!settings.hideColorSwatches}
              onChange={(hideColorSwatches) =>
                handleUpdate({ hideColorSwatches })
              }
            />
          </TooltipMorePopover>
        </div>
      </Tooltip.Provider>
    );
  };
