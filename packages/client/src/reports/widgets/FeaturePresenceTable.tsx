import { useMemo, useContext } from "react";
import { Trans, useTranslation } from "react-i18next";
import { MetricDependency, CountMetric } from "overlay-engine";
import { ReportWidget, TableHeadingsEditor } from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
} from "../../editor/TooltipMenu";
import { LabeledDropdown } from "./LabeledDropdown";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import {
  PaginationFooter,
  PaginationSetting,
  TablePaddingRows,
} from "./Pagination";
import { usePagination } from "../hooks/usePagination";
import { ClassRowSettingsPopover } from "./ClassRowSettingsPopover";
import { MapContext } from "../../dataLayers/MapContextManager";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import { LayersIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  DEFAULT_PRESENCE_PRESENTATION,
  PresencePresentation,
  getPresencePresentationOptions,
  renderPresenceSymbol,
} from "./PresenceSymbols";
import {
  ClassTableRow,
  ClassTableRowComponentSettings,
  combineMetricsBySource,
  getClassTableRows,
} from "./FeatureCountTable";
import { useOverlaySources } from "../hooks/useOverlaySources";

export type FeaturePresenceTableSettings = {
  rowsPerPage?: number;
  nameLabel?: string;
  presenceLabel?: string;
  presenceColumnPresentation?: PresencePresentation;
  bufferMeters?: number;
} & ClassTableRowComponentSettings;

type FeaturePresenceRow = ClassTableRow & {
  count: number;
};

export const FeaturePresenceTable: ReportWidget<
  FeaturePresenceTableSettings
> = ({
  metrics,
  componentSettings,
  sources,
  loading,
  sketchClass,
  dependencies,
}) => {
  const { t } = useTranslation("reports");
  const mapContext = useContext(MapContext);

  const rowsPerPage = componentSettings.rowsPerPage ?? 10;
  const nameLabel = componentSettings.nameLabel || t("Name");
  const presenceLabel = componentSettings.presenceLabel || t("Presence");

  const primaryGeographyId = sketchClass?.clippingGeographies?.[0]?.id ?? 0;

  const rows = useMemo<FeaturePresenceRow[]>(() => {
    const classRows = getClassTableRows({
      dependencies,
      sources,
      customLabels: componentSettings.customRowLabels,
      allFeaturesLabel: t("All features"),
      stableIds: componentSettings.rowLinkedStableIds,
      excludedRowKeys: componentSettings.excludedRowKeys,
    });

    if (sources.length === 0 || metrics.length === 0 || loading) {
      return classRows.map((r) => ({
        ...r,
        count: NaN,
      }));
    }

    const combinedMetrics = combineMetricsBySource<CountMetric>(
      metrics as any,
      sources as any,
      primaryGeographyId
    ) as Record<
      string,
      {
        fragments: CountMetric;
        geographies: CountMetric;
      }
    >;

    let rows: FeaturePresenceRow[] = classRows.map((r) => {
      const combinedForSource = combinedMetrics[r.sourceId];
      const count =
        combinedForSource?.fragments?.value?.[r.groupByKey]?.count || 0;
      return {
        ...r,
        count,
      };
    });

    rows = rows.sort((a, b) =>
      (a.label || a.key).localeCompare(b.label || b.key)
    );

    return rows;
  }, [
    dependencies,
    sources,
    t,
    metrics,
    loading,
    primaryGeographyId,
    componentSettings.customRowLabels,
    componentSettings.rowLinkedStableIds,
    componentSettings.excludedRowKeys,
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

  const hasAnyColor = useMemo(() => rows.some((row) => row.color), [rows]);
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
    <Tooltip.Provider>
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
            <div className="flex-none text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[80px] text-center">
              {presenceLabel}
            </div>
          </div>
          {paginatedRows.map((row) => {
            const color = row.color;
            const stableId =
              row.stableId ||
              componentSettings.rowLinkedStableIds?.[row.key] ||
              (row.groupByKey
                ? componentSettings.rowLinkedStableIds?.[row.groupByKey]
                : undefined);
            const layerState = stableId
              ? mapContext?.layerStatesByTocStaticId?.[stableId]
              : undefined;
            const isPresent = row.count > 0;
            return (
              <div
                key={row.key}
                className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50`}
              >
                {hasVisibilityColumn && (
                  <div className="flex-none w-6 flex justify-center">
                    {stableId ? (
                      <VisibilityCheckboxAnimated
                        id={stableId}
                        onClick={() => {
                          if (!mapContext?.manager) return;
                          const visible =
                            layerState?.visible && layerState?.hidden !== true;
                          if (visible) {
                            mapContext.manager.hideTocItems?.([stableId]);
                          } else {
                            mapContext.manager.showTocItems?.([stableId]);
                          }
                        }}
                        disabled={!mapContext?.manager}
                        visibility={
                          (layerState?.visible &&
                            layerState?.hidden !== true) ||
                          false
                        }
                        loading={layerState?.loading}
                        error={
                          layerState?.error
                            ? String(layerState?.error)
                            : undefined
                        }
                      />
                    ) : (
                      <span className="text-xs text-gray-400"></span>
                    )}
                  </div>
                )}
                {color && (
                  <div className="flex-none w-4 flex justify-center">
                    <span
                      className="inline-block w-4 h-4 rounded-sm border border-black/10"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-gray-800 text-sm">
                  <span
                    className="truncate block"
                    title={row.key === "*" ? t("All features") : row.key}
                  >
                    {row.key === "*" ? t("All features") : row.label}
                  </span>
                </div>
                <div className="flex-none text-gray-900 tabular-nums text-sm min-w-[80px] text-center items-center flex">
                  {loading ? (
                    <MetricLoadingDots />
                  ) : (
                    renderPresenceSymbol({
                      isPresent,
                      presentation:
                        componentSettings.presenceColumnPresentation ||
                        DEFAULT_PRESENCE_PRESENTATION,
                      presentLabel: t("Present"),
                      absentLabel: t("Absent"),
                      withTooltip: true,
                      wrapperClassName:
                        "inline-flex items-center justify-center w-full cursor-help",
                    })
                  )}
                </div>
              </div>
            );
          })}
          <TablePaddingRows
            count={paddingRowsCount}
            includeColorColumn={hasAnyColor}
            includeVisibilityColumn={hasVisibilityColumn}
            showPercentColumn={false}
            numericAlign="center"
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

export const FeaturePresenceTableTooltipControls: ReportWidgetTooltipControls =
  ({
    node,
    onUpdate,
    onUpdateDependencyParameters,
    onUpdateAllDependencies,
  }) => {
    const { t } = useTranslation("admin:reports");
    const dependencies = node.attrs?.metrics as MetricDependency[] | undefined;

    const settings: FeaturePresenceTableSettings = useMemo(
      () => node.attrs?.componentSettings || {},
      [node.attrs?.componentSettings]
    );

    const rowsPerPage = settings.rowsPerPage ?? 10;

    const { filteredSources: sources } = useOverlaySources(dependencies);

    const handleUpdate = (patch: Partial<FeaturePresenceTableSettings>) => {
      onUpdate({
        componentSettings: {
          ...settings,
          ...patch,
        },
      });
    };

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

    const presencePresentationOptions = getPresencePresentationOptions();

    return (
      <div className="flex gap-3 items-center text-sm text-gray-800">
        <LabeledDropdown
          label={t("Symbol")}
          value={
            settings.presenceColumnPresentation || DEFAULT_PRESENCE_PRESENTATION
          }
          options={presencePresentationOptions}
          onChange={(value) =>
            handleUpdate({
              presenceColumnPresentation: value as PresencePresentation,
            })
          }
        />
        <TableHeadingsEditor
          labelKeys={["nameLabel", "presenceLabel"]}
          labelDisplayNames={[t("Name"), t("Presence")]}
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
          <div className="flex">
            <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
              {t("Component Type")}
            </span>
            <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
              {t("Feature Presence Table")}
            </span>
          </div>
        </TooltipMorePopover>
      </div>
    );
  };
