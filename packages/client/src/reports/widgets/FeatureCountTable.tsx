import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  MetricDependency,
  subjectIsFragment,
  CountMetric,
  Metric,
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
import { SpatialMetricState } from "../../generated/graphql";
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
import {
  PaginationFooter,
  PaginationSetting,
  TablePaddingRows,
} from "./Pagination";
import { usePagination } from "../hooks/usePagination";
import { ClassRowSettingsPopover } from "./ClassRowSettingsPopover";
import ReportLayerVisibilityCheckbox from "../components/ReportLayerVisibilityCheckbox";
import { LayersIcon } from "@radix-ui/react-icons";
import { usePrimaryGeography } from "../hooks/usePrimaryGeography";

type FeatureCountTableSettings = {
  showZeroCountCategories?: boolean;
  sortBy?: "count" | "name";
  rowsPerPage?: number;
  nameLabel?: string;
  countLabel?: string;
  percentWithinLabel?: string;
  showPercentColumn?: boolean;
  bufferMeters?: number;
  hideColorSwatches?: boolean;
} & ClassTableRowComponentSettings;

type FeatureCountRow = ClassTableRow & {
  count: number;
  geographyTotal?: number;
};

export const FeatureCountTable: ReportWidget<FeatureCountTableSettings> = ({
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
  const sortBy = componentSettings.sortBy || "count";
  const rowsPerPage = componentSettings.rowsPerPage ?? 10;
  const showPercentColumn = componentSettings.showPercentColumn ?? true;
  const showColorSwatches = !componentSettings.hideColorSwatches;
  const nameLabel = componentSettings.nameLabel || t("Name");
  const countLabel = componentSettings.countLabel || t("Count");
  const percentWithinLabel =
    componentSettings.percentWithinLabel || t("% Within");

  const { clippingGeography } = usePrimaryGeography(sketchClass, geographies);
  const primaryGeographyId = clippingGeography?.id;

  const rows = useMemo<FeatureCountRow[]>(() => {
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
        m.type === "count" &&
        m.state === SpatialMetricState.Complete
    ) as Pick<Metric, "type" | "value">[];

    if (
      sources.length === 0 ||
      completedFragmentMetrics.length === 0 ||
      metrics.length === 0 ||
      loading
    ) {
      return classRows.map((r) => ({
        ...r,
        count: NaN,
        geographyTotal: NaN,
      }));
    }

    if (!primaryGeographyId) {
      throw new Error("Primary geography not found.");
    }
    const combinedMetrics = combineMetricsBySource<CountMetric>(
      metrics,
      sources,
      primaryGeographyId
    );

    let rows: FeatureCountRow[] = classRows.map((r) => {
      const combinedForSource = combinedMetrics[r.sourceId];
      const count =
        combinedForSource?.fragments?.value?.[r.groupByKey]?.count || 0;
      const geographyTotal =
        combinedForSource?.geographies?.value?.[r.groupByKey]?.count || 0;
      return {
        ...r,
        count,
        geographyTotal,
      };
    });

    if (sortBy === "name") {
      rows = rows.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      rows = rows.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    }

    if (!showZero) {
      rows = rows.filter((r) => r.count > 0);
    }

    return rows;
  }, [
    dependencies,
    sources,
    t,
    metrics,
    loading,
    sortBy,
    showZero,
    primaryGeographyId,
    componentSettings.customRowLabels,
    componentSettings.rowLinkedStableIds,
    componentSettings.excludedRowKeys,
    componentSettings.includeAllFeaturesRowForGroupedSources,
  ]);

  const displayRows = loading ? rows : rows;
  const {
    currentPage,
    setCurrentPage,
    paginatedItems: paginatedRows,
    paddingRowsCount,
    showPagination,
    totalPages,
    totalRows,
    pageBounds,
  } = usePagination(displayRows, rowsPerPage);

  const hasAnyColor = useMemo(
    () => showColorSwatches && rows.some(classTableRowHasSwatch),
    [rows, showColorSwatches]
  );
  const hasVisibilityColumn = useMemo(
    () =>
      rows.some(
        (row) =>
          row.stableId ||
          componentSettings.rowLinkedStableIds?.[row.key] ||
          (row.groupByKey
            ? componentSettings.rowLinkedStableIds?.[row.groupByKey]
            : undefined)
      ),
    [rows, componentSettings.rowLinkedStableIds]
  );

  if (!loading && !rows.length) {
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
            {countLabel}
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
              ? row.count / row.geographyTotal
              : undefined;
          const stableId =
            row.stableId ||
            componentSettings.rowLinkedStableIds?.[row.key] ||
            (row.groupByKey
              ? componentSettings.rowLinkedStableIds?.[row.groupByKey]
              : undefined);
          return (
            <div
              key={row.key}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                row.count === 0 ? "opacity-50" : ""
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
                <span
                  className="truncate block"
                  title={row.key === "*" ? t("All features") : row.key}
                >
                  {row.key === "*" ? t("All features") : row.label}
                </span>
              </div>
              <div
                className={`flex-none text-gray-900 tabular-nums text-sm min-w-[80px] ${
                  showPercentColumn ? "text-center" : "text-right"
                }`}
              >
                {loading ? <MetricLoadingDots /> : row.count.toLocaleString()}
              </div>
              {showPercentColumn && (
                <div className="flex-none text-right text-gray-700 tabular-nums text-sm min-w-[70px]">
                  {loading ? (
                    <MetricLoadingDots />
                  ) : typeof percent === "number" ? (
                    `${(percent * 100).toFixed(1)}%`
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
  );
};

export const FeatureCountTableTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
  onUpdateDependencyParameters,
  onUpdateAllDependencies,
}) => {
  const { t } = useTranslation("admin:reports");
  const dependencies = node.attrs?.metrics as MetricDependency[] | undefined;

  const settings: FeatureCountTableSettings = useMemo(
    () => node.attrs?.componentSettings || {},
    [node.attrs?.componentSettings]
  );

  const showZero = settings.showZeroCountCategories ?? false;
  const sortBy = settings.sortBy || "count";
  const rowsPerPage = settings.rowsPerPage ?? 10;
  const showPercentColumn = settings.showPercentColumn ?? true;

  const { filteredSources: sources } = useOverlaySources(dependencies || []);

  // Get current groupBy from dependencies
  const handleUpdate = (patch: Partial<FeatureCountTableSettings>) => {
    onUpdate({
      componentSettings: {
        ...settings,
        ...patch,
      },
    });
  };

  const sortOptions = [
    { value: "count", label: t("Count") },
    { value: "name", label: t("Name") },
  ];

  const buffer = ((node.attrs?.metrics || []) as MetricDependency[]).find(
    (m) => m.parameters?.bufferDistanceKm !== undefined
  )?.parameters?.bufferDistanceKm;

  const handleBufferClick = () => {
    const currentValue = buffer !== undefined ? String(buffer) : "0";
    const value = window.prompt(
      t("Enter buffer distance in kilometers (or 0 for none)"),
      currentValue
    );
    if (value === null) {
      // User cancelled
      return;
    }
    const numValue = value === "" || value === "0" ? 0 : Number(value);
    onUpdateDependencyParameters((dependency) => {
      if (dependency.subjectType === "geographies") {
        return {
          ...dependency.parameters,
          bufferDistanceKm: undefined,
        };
      } else {
        return {
          ...dependency.parameters,
          bufferDistanceKm: numValue === 0 ? undefined : numValue,
        };
      }
    });
  };

  const bufferFormatter = useNumberFormatters({
    unit: "kilometer",
    unitDisplay: "short",
  });

  return (
    <div className="flex gap-3 items-center text-sm text-gray-800">
      <LabeledDropdown
        label={t("Sort by")}
        value={sortBy}
        options={sortOptions}
        onChange={(val) => handleUpdate({ sortBy: val as "count" | "name" })}
      />
      <TableHeadingsEditor
        labelKeys={["nameLabel", "countLabel", "percentWithinLabel"]}
        labelDisplayNames={["Name", "Count", "% Within"]}
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
        showZeros={showZero}
        onShowZerosChange={(next) =>
          handleUpdate({ showZeroCountCategories: next })
        }
        showColorSwatches={!settings.hideColorSwatches}
        onShowColorSwatchesChange={(next) =>
          handleUpdate({ hideColorSwatches: next ? undefined : true })
        }
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
        <TooltipBooleanConfigurationOption
          label={t("Show % column")}
          checked={showPercentColumn}
          onChange={(next) => handleUpdate({ showPercentColumn: next })}
        />

        <PaginationSetting
          rowsPerPage={rowsPerPage}
          onChange={(next: number) => handleUpdate({ rowsPerPage: next })}
        />
        <div className="flex">
          <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
            {t("Component Type")}
          </span>
          <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
            {t("Feature Count Table")}
          </span>
        </div>
      </TooltipMorePopover>
    </div>
  );
};
