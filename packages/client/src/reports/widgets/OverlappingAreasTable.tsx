import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  MetricDependency,
  OverlayAreaMetric,
  subjectIsFragment,
  subjectIsGeography,
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
  ClassTableRow,
  ClassTableRowComponentSettings,
  combineMetricsBySource,
  getClassTableRows,
} from "./ClassTableRows";
import {
  classTableRowHasSwatch,
  SwatchForClassTableRow,
} from "./SwatchForClassTableRow";
import { ClassRowSettingsPopover } from "./ClassRowSettingsPopover";
import { LabeledDropdown } from "./LabeledDropdown";
import ReportLayerVisibilityCheckbox from "../components/ReportLayerVisibilityCheckbox";
import { ExclamationTriangleIcon, LayersIcon } from "@radix-ui/react-icons";
import { usePrimaryGeography } from "../hooks/usePrimaryGeography";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
} from "../../generated/graphql";

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

type OverlapRow = ClassTableRow & {
  overlap: number;
  geographyTotal?: number;
};

function OverlapDebugTooltip({
  row,
  percent,
  metrics,
  sources,
  primaryGeographyId,
  formatters,
}: {
  row: OverlapRow;
  percent: number;
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  primaryGeographyId: number;
  formatters: ReturnType<typeof useNumberFormatters>;
}) {
  const { t } = useTranslation("reports");
  const source = sources.find((s) => s.stableId === row.sourceId);

  const fragmentMetrics = useMemo(
    () =>
      !source
        ? []
        : metrics.filter(
            (m) =>
              m.sourceUrl === source.sourceUrl &&
              subjectIsFragment(m.subject) &&
              (m.subject as { geographies: number[] }).geographies.includes(
                primaryGeographyId
              )
          ),
    [metrics, source, primaryGeographyId]
  );

  const geographyMetric = useMemo(
    () =>
      !source
        ? undefined
        : metrics.find(
            (m) =>
              m.sourceUrl === source.sourceUrl &&
              subjectIsGeography(m.subject) &&
              (m.subject as { id: number }).id === primaryGeographyId
          ),
    [metrics, source, primaryGeographyId]
  );

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <ExclamationTriangleIcon className="w-4 h-4" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top" sideOffset={4}>
          <div className="text-xs bg-white border border-gray-200 shadow-lg rounded-md px-3 py-2 max-w-sm space-y-2">
            <p className="text-gray-700 leading-snug">
              {t(
                "The percent within exceeds 100% because the overlap area is larger than the geography total. This can happen when sketch geometries extend beyond the geography boundary."
              )}
            </p>
            <table className="w-full border-t border-gray-200">
              <tbody>
                <tr>
                  <td className="pr-4 py-0.5 text-gray-500">{t("Overlap")}</td>
                  <td className="text-right font-mono text-gray-900">
                    {formatters.area(row.overlap)}
                  </td>
                </tr>
                <tr>
                  <td className="pr-4 py-0.5 text-gray-500">
                    {t("Geography total")}
                  </td>
                  <td className="text-right font-mono text-gray-900">
                    {formatters.area(row.geographyTotal!)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="pr-4 py-0.5 text-gray-500">
                    {t("Percent within")}
                  </td>
                  <td className="text-right font-mono text-gray-900">
                    {formatters.percent(percent)}
                  </td>
                </tr>
              </tbody>
            </table>
            {geographyMetric && (
              <div className="border-t border-gray-200 pt-2">
                <p className="text-gray-500 font-semibold mb-1">
                  {t("Geography metric (id={{id}})", {
                    id: geographyMetric.id,
                  })}
                </p>
                <pre className="text-[10px] whitespace-pre-wrap break-all text-gray-900 font-mono">
                  {JSON.stringify(
                    (geographyMetric.value as Record<string, unknown>)?.[
                      row.groupByKey
                    ] ?? geographyMetric.value,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
            {fragmentMetrics.length > 0 && (
              <div className="border-t border-gray-200 pt-2">
                <p className="text-gray-500 font-semibold mb-1">
                  {t("Fragment metrics ({{count}})", {
                    count: fragmentMetrics.length,
                  })}
                </p>
                {fragmentMetrics.map((m) => (
                  <div key={m.id} className="mb-2">
                    <p className="text-gray-400 text-[10px] mb-0.5">
                      {t("id={{id}} hash={{hash}}…", {
                        id: m.id,
                        hash: subjectIsFragment(m.subject)
                          ? (m.subject as { hash: string }).hash.slice(0, 8)
                          : "",
                      })}
                    </p>
                    <pre className="text-[10px] whitespace-pre-wrap break-all text-gray-900 font-mono">
                      {JSON.stringify(
                        (m.value as Record<string, unknown>)?.[
                          row.groupByKey
                        ] ?? m.value,
                        null,
                        2
                      )}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Tooltip.Arrow className="fill-white" />
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

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
      primaryGeographyId
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

  const hasVisibilityColumn = useMemo(
    () => rows.some((r) => r.stableId),
    [rows]
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

  return (
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
          if (percent && percent > 1.05) {
            console.error(
              new Error(
                `Percent is greater than 100%. Value: ${percent * 100}%`
              )
            );
          }
          return (
            <div
              key={row.key}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                row.overlap === 0 ? "opacity-50" : ""
              }`}
            >
              {hasVisibilityColumn && (
                <div className="flex-none w-6 flex justify-center">
                  {row.stableId ? (
                    <ReportLayerVisibilityCheckbox stableId={row.stableId} />
                  ) : null}
                </div>
              )}
              {showColorSwatches && <SwatchForClassTableRow row={row} />}
              <div className="flex-1 min-w-0 text-gray-800 text-sm">
                <span className="truncate block" title={row.label}>
                  {row.label}
                </span>
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
        </TooltipMorePopover>
      </div>
    );
  };
