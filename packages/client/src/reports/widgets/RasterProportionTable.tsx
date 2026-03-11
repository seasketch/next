import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { MetricDependency, RasterStats } from "overlay-engine";
import {
  ReportWidget,
  TableHeadingsEditor,
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
} from "./FeatureCountTable";
import { ClassRowSettingsPopover } from "./ClassRowSettingsPopover";
import { LabeledDropdown } from "./LabeledDropdown";
import ReportLayerVisibilityCheckbox from "../components/ReportLayerVisibilityCheckbox";
import { LayersIcon } from "@radix-ui/react-icons";
import { useClippingGeography } from "../hooks/useClippingGeography";
import { GeographySelector } from "./InlineMetric";
import { useBaseReportContext } from "../context/BaseReportContext";

type RasterProportionTableSettings = {
  geographyId?: number | "auto";
  sortBy?: "value" | "name";
  minimumFractionDigits?: number;
  rowsPerPage?: number;
  nameLabel?: string;
  valueLabel?: string;
  showZeroRows?: boolean;
  hideColorSwatches?: boolean;
} & ClassTableRowComponentSettings;

type ProportionRow = ClassTableRow & {
  sketchSum: number;
  geographySum: number;
};

export const RasterProportionTable: ReportWidget<
  RasterProportionTableSettings
> = ({
  metrics,
  componentSettings,
  sources,
  loading,
  dependencies,
  sketchClass,
  geographies,
}) => {
  const clippingGeography = useClippingGeography(sketchClass, geographies);
  const { t } = useTranslation("reports");

  const geographyId: number | undefined =
    componentSettings.geographyId === "auto" ||
    componentSettings.geographyId === undefined
      ? clippingGeography?.id
      : componentSettings.geographyId;

  const sortBy = componentSettings.sortBy || "name";
  const rowsPerPage = componentSettings.rowsPerPage ?? 10;
  const showZeroRows = componentSettings.showZeroRows ?? true;
  const showColorSwatches = !componentSettings.hideColorSwatches;
  const nameLabel = componentSettings.nameLabel || t("Name");
  const valueLabel = componentSettings.valueLabel || t("% Captured");

  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings.minimumFractionDigits,
  });

  const rows = useMemo<ProportionRow[]>(() => {
    const classRows = getClassTableRows({
      dependencies: dependencies || [],
      sources,
      customLabels: componentSettings.customRowLabels,
      allFeaturesLabel: t("All features"),
      stableIds: componentSettings.rowLinkedStableIds,
      excludedRowKeys: componentSettings.excludedRowKeys,
    });

    if (sources.length === 0 || metrics.length === 0 || loading) {
      return classRows.map((r) => ({
        ...r,
        sketchSum: NaN,
        geographySum: NaN,
      }));
    }

    if (!geographyId) {
      throw new Error("Primary geography not found.");
    }

    const combinedMetrics = combineMetricsBySource<RasterStats>(
      metrics,
      sources,
      geographyId
    );

    let rows = classRows.map((r) => {
      const combinedForSource = combinedMetrics[r.sourceId];
      const sketchBands = combinedForSource?.fragments?.value?.bands;
      const geographyBands = combinedForSource?.geographies?.value?.bands;
      const sketchSum = sketchBands?.[0]?.sum ?? 0;
      const geographySum = geographyBands?.[0]?.sum ?? 0;
      return {
        ...r,
        sketchSum,
        geographySum,
      };
    });

    if (sortBy === "name") {
      rows = rows.sort((a, b) => a.label.localeCompare(b.label));
    } else {
      rows = rows.sort((a, b) => {
        const aPercent = a.geographySum > 0 ? a.sketchSum / a.geographySum : 0;
        const bPercent = b.geographySum > 0 ? b.sketchSum / b.geographySum : 0;
        return bPercent - aPercent;
      });
    }

    if (!showZeroRows) {
      rows = rows.filter((r) => r.sketchSum > 0);
    }

    return rows;
  }, [
    metrics,
    dependencies,
    sources,
    geographyId,
    componentSettings.customRowLabels,
    componentSettings.rowLinkedStableIds,
    componentSettings.excludedRowKeys,
    showZeroRows,
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
          <div className="flex-none text-right text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[80px]">
            {valueLabel}
          </div>
        </div>
        {paginatedRows.map((row) => {
          const percent =
            !loading && row.geographySum > 0
              ? row.sketchSum / row.geographySum
              : 0;
          return (
            <div
              key={row.key}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                row.sketchSum === 0 ? "opacity-50" : ""
              }`}
            >
              {hasVisibilityColumn && (
                <div className="flex-none w-6 flex justify-center">
                  {row.stableId ? (
                    <ReportLayerVisibilityCheckbox stableId={row.stableId} />
                  ) : null}
                </div>
              )}
              {showColorSwatches && row.color && (
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
                {loading ? (
                  <MetricLoadingDots />
                ) : (
                  formatters.percent(percent)
                )}
              </div>
            </div>
          );
        })}
        <TablePaddingRows
          count={paddingRowsCount}
          includeVisibilityColumn={hasVisibilityColumn}
          includeColorColumn={showColorSwatches && rows.some((row) => row.color)}
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
  );
};

export const RasterProportionTableTooltipControls: ReportWidgetTooltipControls =
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
    const settings: RasterProportionTableSettings = useMemo(
      () => node.attrs?.componentSettings || {},
      [node.attrs?.componentSettings]
    );

    const sortBy = settings.sortBy || "name";
    const showZeroRows = settings.showZeroRows ?? true;
    const rowsPerPage = settings.rowsPerPage ?? 10;

    const { filteredSources: sources } = useOverlaySources(dependencies);

    const { geographies, sketchClass } = useBaseReportContext();
    const clippingGeography = useClippingGeography(sketchClass, geographies);

    const handleUpdate = (patch: Partial<RasterProportionTableSettings>) => {
      onUpdate({
        componentSettings: {
          ...settings,
          ...patch,
        },
      });
    };

    const sortOptions = [
      { value: "name", label: t("Name") },
      { value: "value", label: t("% Captured") },
    ];

    return (
      <div className="flex gap-3 items-center text-sm text-gray-800">
        <GeographySelector
          geographies={geographies}
          clippingGeography={clippingGeography}
          value={settings.geographyId}
          onChange={(geographyId) => handleUpdate({ geographyId })}
          t={t}
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
          options={sortOptions}
          onChange={(val) =>
            handleUpdate({ sortBy: val as "value" | "name" })
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
          allowedGeometryTypes={["SingleBandRaster"]}
          hideGroupBy={true}
          showZeros={showZeroRows}
          onShowZerosChange={(next) => handleUpdate({ showZeroRows: next })}
          showColorSwatches={!settings.hideColorSwatches}
          onShowColorSwatchesChange={(next) =>
            handleUpdate({ hideColorSwatches: next ? undefined : true })
          }
        />
        <TableHeadingsEditor
          labelKeys={["nameLabel", "valueLabel"]}
          labelDisplayNames={["Name", "% Captured"]}
          componentSettings={settings}
          onUpdate={onUpdate}
        />
        <TooltipMorePopover>
          <PaginationSetting
            rowsPerPage={rowsPerPage}
            onChange={(next: number) => handleUpdate({ rowsPerPage: next })}
          />
        </TooltipMorePopover>
      </div>
    );
  };
