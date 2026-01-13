import { useContext, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { MetricDependency, OverlayAreaMetric } from "overlay-engine";
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
import { useReportContext } from "../ReportContext";
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
} from "./FeatureCountTable";
import { ClassRowSettingsPopover } from "./ClassRowSettingsPopover";
import { LabeledDropdown } from "./LabeledDropdown";
import { MapContext } from "../../dataLayers/MapContextManager";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import { LayersIcon } from "@radix-ui/react-icons";

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
  showPercentColumn?: boolean;
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

export const OverlappingAreasTable: ReportWidget<
  OverlappingAreasTableSettings
> = ({
  metrics,
  componentSettings,
  sources,
  loading,
  dependencies,
  geographies,
}) => {
  const primaryGeographyId = geographies[0]?.id;
  const { t } = useTranslation("reports");

  const unit: OverlapUnit = componentSettings.unit || "km";
  const showZero = componentSettings.showZeroOverlapCategories ?? false;
  const sortBy = componentSettings.sortBy || "overlap";
  const rowsPerPage = componentSettings.rowsPerPage ?? 10;
  const showPercentColumn = componentSettings.showPercentColumn ?? true;
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
    });

    if (sources.length === 0 || metrics.length === 0) {
      return classRows.map((r) => ({
        ...r,
        overlap: NaN,
        geographyTotal: NaN,
      }));
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
    showZero,
    sortBy,
    t,
  ]);

  const hasVisibilityColumn = useMemo(
    () => rows.some((r) => r.stableId),
    [rows]
  );
  const mapContext = useContext(MapContext);

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

  if (!loading && !rows.length) {
    return (
      <div className="border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
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
          <div className="flex-none text-center text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[80px]">
            {areaLabel}
          </div>
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
          const layerState =
            row.stableId && mapContext
              ? mapContext.layerStatesByTocStaticId?.[row.stableId] || undefined
              : undefined;
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
                    <VisibilityCheckboxAnimated
                      id={row.stableId}
                      onClick={() => {
                        const sid = row.stableId;
                        if (!sid || !mapContext?.manager) return;
                        if (
                          layerState?.visible &&
                          layerState?.hidden !== true
                        ) {
                          mapContext.manager.hideTocItems?.([sid]);
                        } else {
                          mapContext.manager.showTocItems?.([sid]);
                        }
                      }}
                      disabled={!mapContext?.manager}
                      visibility={
                        (layerState?.visible && layerState?.hidden !== true) ||
                        false
                      }
                      loading={layerState?.loading}
                      error={
                        layerState?.error
                          ? String(layerState?.error)
                          : undefined
                      }
                    />
                  ) : null}
                </div>
              )}
              {row.color && (
                <div className="flex-none w-4 flex justify-center">
                  <span
                    className="inline-block w-4 h-4 rounded-sm border border-black/10"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 text-gray-800 text-sm">
                <span className="truncate block" title={row.label}>
                  {row.label}
                </span>
              </div>
              <div className="flex-none text-right text-gray-900 tabular-nums text-sm min-w-[80px]">
                {loading ? <MetricLoadingDots /> : formatters.area(row.overlap)}
              </div>
              {showPercentColumn && (
                <div className="flex-none text-right text-gray-700 tabular-nums text-sm min-w-[70px]">
                  {loading ? (
                    <MetricLoadingDots />
                  ) : typeof percent === "number" ? (
                    formatters.percent(percent)
                  ) : (
                    "—"
                  )}
                </div>
              )}
            </div>
          );
        })}
        <TablePaddingRows
          count={paddingRowsCount}
          includeVisibilityColumn={hasVisibilityColumn}
          includeColorColumn={rows.some((row) => row.color)}
          showPercentColumn={showPercentColumn}
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
    const reportContext = useReportContext();
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
    const showPercentColumn = settings.showPercentColumn ?? true;

    // Get sources from report context
    const sources = useMemo(() => {
      const dependencies = (node.attrs?.metrics || []) as MetricDependency[];
      const allSources = [
        ...(reportContext.overlaySources || []),
        ...(reportContext.adminSources || []),
      ];
      return allSources.filter((s) =>
        dependencies.some(
          (d) => d.tableOfContentsItemId === s.tableOfContentsItemId
        )
      );
    }, [
      node.attrs?.metrics,
      reportContext.overlaySources,
      reportContext.adminSources,
    ]);

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
        <TableHeadingsEditor
          labelKeys={["nameLabel", "areaLabel", "percentWithinLabel"]}
          labelDisplayNames={["Name", "Area", "% Within"]}
          componentSettings={settings}
          onUpdate={onUpdate}
        />
        <ClassRowSettingsPopover
          settings={settings}
          onUpdateSettings={(patch) => handleUpdate(patch)}
          dependencies={dependencies || []}
          sources={sources}
          onUpdateDependencyParameters={onUpdateDependencyParameters}
          onUpdateAllDependencies={onUpdateAllDependencies}
          t={t}
        />
        <TooltipMorePopover>
          <TooltipBooleanConfigurationOption
            label={t("Show zeros")}
            checked={showZero}
            onChange={(next) =>
              handleUpdate({ showZeroOverlapCategories: next })
            }
          />
          <TooltipBooleanConfigurationOption
            label={t("Show % column")}
            checked={showPercentColumn}
            onChange={(next) => handleUpdate({ showPercentColumn: next })}
          />
          <PaginationSetting
            rowsPerPage={rowsPerPage}
            onChange={(next: number) => handleUpdate({ rowsPerPage: next })}
          />
        </TooltipMorePopover>
      </div>
    );
  };
