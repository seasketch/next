import { useContext, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import {
  ColumnValuesMetric,
  MetricDependency,
  NumberColumnValueStats,
  StringOrBooleanColumnValueStats,
  subjectIsFragment,
  combineNumberColumnValueStats,
} from "overlay-engine";
import {
  ReportWidget,
  TableHeadingsEditor,
  TooltipBooleanConfigurationOption,
} from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
  TooltipPopoverContent,
  TooltipInfoIcon,
} from "../../editor/TooltipMenu";
import { useReportContext } from "../ReportContext";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import { NumberRoundingControl } from "./NumberRoundingControl";
import * as Popover from "@radix-ui/react-popover";
import { Pencil2Icon } from "@radix-ui/react-icons";
import { ColumnValuesStatKey } from "./InlineMetric";
import { MapContext } from "../../dataLayers/MapContextManager";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import { useOverlayOptionsForLayerToggle } from "./LayerToggleControls";
import { LayersIcon } from "@radix-ui/react-icons";

type ColumnStatisticsTableSettings = {
  columns?: string[];
  columnSettings?: Record<
    string,
    {
      label?: string;
      stableId?: string;
    }
  >;
  displayStats?: Partial<Record<ColumnValuesStatKey, boolean>>;
  minimumFractionDigits?: number;
  columnLabel?: string;
  valueColumnLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  meanLabel?: string;
  stdDevLabel?: string;
  sumLabel?: string;
  countLabel?: string;
  countDistinctLabel?: string;
};

type ColumnStatisticsRow = {
  stats: NumberColumnValueStats | StringOrBooleanColumnValueStats;
};

const numericStatOrder: Array<ColumnValuesStatKey> = [
  "count",
  "countDistinct",
  "min",
  "max",
  "mean",
  "stdDev",
  "sum",
];

const statLabels = (
  t: (key: string, opts?: Record<string, any>) => string,
  settings?: ColumnStatisticsTableSettings
): Record<ColumnValuesStatKey, string> => ({
  min: settings?.minLabel || t("Min"),
  max: settings?.maxLabel || t("Max"),
  mean: settings?.meanLabel || t("Mean"),
  stdDev: settings?.stdDevLabel || t("Std Dev"),
  sum: settings?.sumLabel || t("Sum"),
  count: settings?.countLabel || t("Count"),
  countDistinct: settings?.countDistinctLabel || t("Distinct"),
});

export const ColumnStatisticsTable: ReportWidget<
  ColumnStatisticsTableSettings
> = ({ metrics, componentSettings, sources, loading }) => {
  const { t } = useTranslation("reports");
  const mapContext = useContext(MapContext);
  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings?.minimumFractionDigits,
  });

  const resolvedDisplayStats = useMemo(() => {
    const defaults: Partial<Record<ColumnValuesStatKey, boolean>> = {
      mean: true,
    };
    return componentSettings?.displayStats || defaults;
  }, [componentSettings?.displayStats]);

  const rows = useMemo<(ColumnStatisticsRow & { column: string })[]>(() => {
    const selectedColumns = componentSettings?.columns || [];
    const columnSettings = componentSettings?.columnSettings || {};
    const rows: (ColumnStatisticsRow & { column: string })[] = [];

    const fragmentMetrics = metrics.filter(
      (m) =>
        subjectIsFragment(m.subject) && m.type === "column_values" && m.value
    ) as unknown as ColumnValuesMetric[];

    if (!fragmentMetrics.length || loading)
      return selectedColumns.map((col) => ({
        column: col,
        stats: {
          type: "number",
          count: 0,
          min: NaN,
          max: NaN,
          mean: NaN,
          stdDev: NaN,
          sum: NaN,
          histogram: [],
          countDistinct: 0,
        },
      }));

    const statsByColumn: Record<
      string,
      Array<NumberColumnValueStats | StringOrBooleanColumnValueStats>
    > = {};

    for (const metric of fragmentMetrics) {
      const val = metric.value as ColumnValuesMetric["value"];
      for (const classKey of Object.keys(val || {})) {
        const statsByAttr = val[classKey];
        if (!statsByAttr) continue;
        for (const attr in statsByAttr) {
          const statsForColumn = statsByAttr[attr];
          if (!statsForColumn) continue;
          if (!statsByColumn[attr]) {
            statsByColumn[attr] = [];
          }
          statsByColumn[attr].push(statsForColumn);
        }
      }
    }

    const columnsToRender = selectedColumns.filter((col) => statsByColumn[col]);

    for (const column of columnsToRender) {
      const statsList = statsByColumn[column] || [];
      if (!statsList.length) continue;
      const first = statsList[0];
      let combined:
        | NumberColumnValueStats
        | StringOrBooleanColumnValueStats
        | undefined;
      if (first.type === "number") {
        combined = combineNumberColumnValueStats(
          statsList as NumberColumnValueStats[]
        ) as NumberColumnValueStats | undefined;
      } else {
        const distinctMap = new Map<string | boolean, number>();
        for (const stat of statsList as StringOrBooleanColumnValueStats[]) {
          for (const [val, count] of stat.distinctValues) {
            distinctMap.set(val, (distinctMap.get(val) || 0) + count);
          }
        }
        combined = {
          type: first.type,
          distinctValues: Array.from(distinctMap.entries()),
          countDistinct: distinctMap.size,
        } as StringOrBooleanColumnValueStats & { countDistinct: number };
      }
      if (!combined) continue;
      rows.push({
        stats: combined,
        column,
      });
    }

    rows.sort((a, b) => a.column.localeCompare(b.column));

    return rows;
  }, [metrics, componentSettings?.columns]);

  const statsToShow = useMemo(
    () => numericStatOrder.filter((stat) => resolvedDisplayStats[stat]),
    [resolvedDisplayStats]
  );

  const hasVisibilityColumn = useMemo(() => {
    const cs = componentSettings?.columnSettings || {};
    return Object.keys(cs).some((c) => !!cs[c]?.stableId);
  }, [componentSettings?.columnSettings]);

  const formatValue = (
    stat: ColumnValuesStatKey,
    stats: NumberColumnValueStats | StringOrBooleanColumnValueStats
  ) => {
    let value: number | undefined;
    if (stats.type === "number") {
      const numericStats = stats as NumberColumnValueStats;
      value = numericStats[stat as keyof NumberColumnValueStats] as
        | number
        | undefined;
    } else {
      if (stat === "countDistinct" || stat === "count") {
        value = stats.distinctValues.reduce((acc, [, c]) => acc + c, 0);
      } else {
        value = undefined;
      }
    }
    if (value === undefined || value === null || Number.isNaN(value)) {
      return "–";
    }
    if (stat === "count" || stat === "countDistinct") {
      return formatters.count(value as number);
    }
    return formatters.decimal(value as number);
  };

  if (!loading && rows.length === 0) {
    return (
      <div className="border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No statistics available.</Trans>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
      <div
        className="divide-y divide-gray-100"
        style={{
          display: "grid",
          gridTemplateColumns: `${
            hasVisibilityColumn ? "40px " : ""
          }minmax(140px,1fr) repeat(${statsToShow.length}, minmax(70px, auto))`,
        }}
      >
        <div className="contents bg-gray-50 border-b border-gray-200">
          {hasVisibilityColumn && (
            <div className="px-3 py-2 text-center text-gray-600 text-xs font-semibold uppercase tracking-wide bg-gray-100 border-b flex items-center justify-center">
              <LayersIcon className="w-4 h-4" />
            </div>
          )}
          <div className="px-3 py-2 text-gray-600 text-xs font-semibold uppercase tracking-wide truncate bg-gray-100 border-b">
            {componentSettings?.columnLabel || t("Column")}
          </div>
          {statsToShow.map((stat) => (
            <div
              key={String(stat)}
              className="px-3 py-2 text-right text-gray-600 text-xs font-semibold uppercase tracking-wide bg-gray-100 border-b truncate"
            >
              {statLabels(t, componentSettings)[stat]}
            </div>
          ))}
        </div>
        {rows.map((row, idx) => (
          <div key={idx} className="contents hover:bg-gray-50">
            {hasVisibilityColumn && (
              <div
                className={`px-3 py-2 text-center ${
                  idx % 2 === 1
                    ? "bg-gray-50/50 border-t border-b border-black/5"
                    : ""
                }`}
              >
                {componentSettings?.columnSettings?.[row.column]?.stableId ? (
                  <VisibilityCheckboxAnimated
                    id={
                      componentSettings.columnSettings?.[row.column]
                        ?.stableId || ""
                    }
                    onClick={() => {
                      const sid =
                        componentSettings.columnSettings?.[row.column]
                          ?.stableId;
                      if (!sid) return;
                      if (
                        mapContext?.layerStatesByTocStaticId?.[sid]?.visible
                      ) {
                        mapContext.manager?.hideTocItems?.([sid]);
                      } else {
                        mapContext?.manager?.showTocItems?.([sid]);
                      }
                    }}
                    disabled={!mapContext?.manager}
                    visibility={
                      !!mapContext?.layerStatesByTocStaticId?.[
                        componentSettings.columnSettings?.[row.column]
                          ?.stableId || ""
                      ]?.visible &&
                      mapContext?.layerStatesByTocStaticId?.[
                        componentSettings.columnSettings?.[row.column]
                          ?.stableId || ""
                      ]?.hidden !== true
                    }
                    loading={
                      !!mapContext?.layerStatesByTocStaticId?.[
                        componentSettings.columnSettings?.[row.column]
                          ?.stableId || ""
                      ]?.loading
                    }
                    error={
                      mapContext?.layerStatesByTocStaticId?.[
                        componentSettings.columnSettings?.[row.column]
                          ?.stableId || ""
                      ]?.error
                        ? String(
                            mapContext?.layerStatesByTocStaticId?.[
                              componentSettings.columnSettings?.[row.column]
                                ?.stableId || ""
                            ]?.error
                          )
                        : undefined
                    }
                  />
                ) : (
                  <span className="text-xs text-gray-400"></span>
                )}
              </div>
            )}
            <div
              className={`px-3 py-2 text-sm text-gray-900 truncate group- ${
                idx % 2 === 1
                  ? "bg-gray-50/50 border-t border-b border-black/5"
                  : ""
              }`}
            >
              {componentSettings?.columnSettings?.[row.column]?.label ||
                row.column}
            </div>
            {statsToShow.map((stat) => (
              <div
                key={`${row.column}-${String(stat)}`}
                className={`px-3 py-2 text-right text-sm text-gray-900 tabular-nums  ${
                  idx % 2 === 1
                    ? "bg-gray-50/50 border-t border-b border-black/5"
                    : ""
                }`}
              >
                {loading ? <MetricLoadingDots /> : formatValue(stat, row.stats)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ColumnStatisticsTableTooltipControls: ReportWidgetTooltipControls =
  ({ node, onUpdate, onUpdateAllDependencies }) => {
    const { t } = useTranslation("admin:reports");
    const reportContext = useReportContext();
    const componentSettings = node.attrs?.componentSettings || {};
    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const overlayOptions = useOverlayOptionsForLayerToggle(t);

    const dependencies = useMemo(
      () => (node.attrs?.metrics || []) as MetricDependency[],
      [node.attrs?.metrics]
    );

    const sources = useMemo(() => {
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
      dependencies,
      reportContext.overlaySources,
      reportContext.adminSources,
    ]);

    const numericColumnOptions = useMemo(() => {
      const options: Array<{
        value: string;
        examples?: string;
      }> = [];
      const source = sources?.[0];
      if (!source?.geostats) return options;
      const geoLayer = isGeostatsLayer(
        (source.geostats as any)?.layers?.[0] as GeostatsLayer
      )
        ? ((source.geostats as any).layers[0] as GeostatsLayer)
        : undefined;
      if (!geoLayer?.attributes) return options;

      for (const attr of geoLayer.attributes) {
        if (attr.type !== "number") continue;
        const exampleValues = Object.keys(attr.values || {})
          .slice(0, 3)
          .map((v) => String(v));
        const examplesText =
          exampleValues.length > 0 ? exampleValues.join(", ") : "";
        options.push({
          value: attr.attribute,
          examples: examplesText,
        });
      }
      options.sort((a, b) => a.value.localeCompare(b.value));
      return options;
    }, [sources]);

    const selectedColumns = useMemo(() => {
      return componentSettings?.columns || [];
    }, [componentSettings?.columns]);

    const handleColumnSelectionChange = (column: string, checked: boolean) => {
      const nextSelected = new Set(selectedColumns);
      if (checked) {
        nextSelected.add(column);
      } else {
        nextSelected.delete(column);
      }
      onUpdate({
        componentSettings: {
          ...componentSettings,
          columns: Array.from(nextSelected),
        },
      });
    };

    const handleSelectAll = () => {
      onUpdate({
        componentSettings: {
          ...componentSettings,
          columns: numericColumnOptions.map((opt) => opt.value),
        },
      });
    };

    const handleSelectNone = () => {
      onUpdate({
        componentSettings: {
          ...componentSettings,
          columns: [],
        },
      });
    };

    const handleLabelChange = (column: string, value: string) => {
      onUpdate({
        componentSettings: {
          ...componentSettings,
          columnSettings: {
            ...(componentSettings.columnSettings || {}),
            [column]: {
              ...(componentSettings.columnSettings || {})[column],
              label: value,
            },
          },
        },
      });
    };

    const handleStableIdChange = (column: string, stableId?: string) => {
      onUpdate({
        componentSettings: {
          ...componentSettings,
          columnSettings: {
            ...(componentSettings.columnSettings || {}),
            [column]: {
              ...(componentSettings.columnSettings || {})[column],
              stableId,
            },
          },
        },
      });
    };

    const handleToggleStat = (stat: ColumnValuesStatKey, enabled: boolean) => {
      onUpdate({
        componentSettings: {
          ...componentSettings,
          displayStats: {
            ...(componentSettings.displayStats || {}),
            [stat]: enabled,
          },
        },
      });
    };

    const statToggleList: Array<{
      key: ColumnValuesStatKey;
      label: string;
    }> = [
      { key: "min", label: t("Min") },
      { key: "max", label: t("Max") },
      { key: "mean", label: t("Mean") },
      { key: "stdDev", label: t("Std Dev") },
      { key: "sum", label: t("Sum") },
      { key: "count", label: t("Count") },
      { key: "countDistinct", label: t("Distinct values") },
    ];

    const relatedOverlay = useMemo(() => {
      const allSources = [
        ...(reportContext.overlaySources || []),
        ...(reportContext.adminSources || []),
      ];
      const dep = dependencies.find((d) => d.tableOfContentsItemId);
      if (!dep?.tableOfContentsItemId) return null;
      return allSources.find(
        (s) => s.tableOfContentsItemId === dep.tableOfContentsItemId
      );
    }, [
      dependencies,
      reportContext.overlaySources,
      reportContext.adminSources,
    ]);

    return (
      <div className="flex gap-3 items-center text-sm text-gray-800">
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
            >
              <Pencil2Icon className="w-3 h-3" />
              {t("rows")}
              <span className="text-gray-500 text-xs">
                {selectedColumns.length ? ` (${selectedColumns.length})` : ""}
              </span>
            </button>
          </Popover.Trigger>
          <TooltipPopoverContent>
            <div className="px-3 pt-2 pb-1 grid grid-cols-3 gap-2 items-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={
                    selectedColumns.length > 0 &&
                    selectedColumns.length === numericColumnOptions.length
                  }
                  ref={(el) => {
                    if (!el) return;
                    const none = selectedColumns.length === 0;
                    const some =
                      selectedColumns.length > 0 &&
                      selectedColumns.length < numericColumnOptions.length;
                    el.indeterminate = some;
                    if (none) el.checked = false;
                  }}
                  onChange={(e) => {
                    if (e.target.indeterminate || !e.target.checked) {
                      handleSelectNone();
                    } else {
                      handleSelectAll();
                    }
                  }}
                />
                <span>{t("Included Columns")}</span>
              </label>
              <div className="pl-2 flex items-center gap-1">
                {t("Label")}
                <TooltipInfoIcon
                  content={t(
                    "Custom labels can optionally be used to replace column names."
                  )}
                  ariaLabel={t("Label help")}
                />
              </div>
              <div className="pl-2 flex items-center gap-1">
                {t("Linked Layer")}
                <TooltipInfoIcon
                  content={t(
                    "If specified, controls will be shown to toggle related layers on the map."
                  )}
                  ariaLabel={t("Linked layer help")}
                />
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              <div className="divide-y divide-gray-100">
                {numericColumnOptions.map((opt) => {
                  const checked = selectedColumns.includes(opt.value);
                  const colSettings =
                    componentSettings.columnSettings?.[opt.value];
                  const layerTitle = colSettings?.stableId
                    ? overlayOptions.find(
                        (o) => o.value === colSettings?.stableId
                      )?.label
                    : "";
                  return (
                    <div
                      key={opt.value}
                      className="grid grid-cols-3 gap-2 px-3 py-2 items-center"
                      style={{
                        gridTemplateColumns:
                          "minmax(0,200px) minmax(0,200px) minmax(0,200px)",
                      }}
                    >
                      <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={checked}
                          onChange={(e) =>
                            handleColumnSelectionChange(
                              opt.value,
                              e.target.checked
                            )
                          }
                        />
                        <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900">
                          {opt.value}
                        </span>
                      </label>
                      <input
                        type="text"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder={opt.value}
                        value={colSettings?.label || ""}
                        onChange={(e) =>
                          handleLabelChange(opt.value, e.target.value)
                        }
                      />
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            className="h-8 w-full rounded border border-gray-300 px-2 text-sm text-left flex items-center justify-between gap-2 hover:bg-gray-50"
                          >
                            <span className="truncate">
                              {layerTitle || t("None")}
                            </span>
                            <Pencil2Icon className="w-3 h-3 text-gray-500" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Content
                          side="top"
                          sideOffset={6}
                          className="bg-white text-gray-900 border border-black/20 rounded shadow-lg px-2 py-2 z-50 w-56"
                        >
                          <div className="max-h-56 overflow-auto divide-y divide-gray-100">
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50"
                              onClick={() =>
                                handleStableIdChange(opt.value, undefined)
                              }
                            >
                              {t("None")}
                            </button>
                            {overlayOptions.map((o) => (
                              <button
                                key={o.value}
                                type="button"
                                className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50"
                                onClick={() =>
                                  handleStableIdChange(opt.value, o.value)
                                }
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </Popover.Content>
                      </Popover.Root>
                    </div>
                  );
                })}
                {!numericColumnOptions.length && (
                  <div className="text-xs text-gray-500 px-3 py-2">
                    {t("No numeric columns available")}
                  </div>
                )}
              </div>
            </div>
          </TooltipPopoverContent>
        </Popover.Root>
        <NumberRoundingControl
          value={componentSettings?.minimumFractionDigits}
          onChange={(minimumFractionDigits) =>
            onUpdate({
              componentSettings: {
                ...componentSettings,
                minimumFractionDigits,
              },
            })
          }
        />
        <TableHeadingsEditor
          labelKeys={[
            "columnLabel",
            ...statToggleList.map((s) => s.key + "Label"),
          ]}
          labelDisplayNames={[
            t("Column"),
            ...statToggleList.map((s) => statLabels(t)[s.key]),
          ]}
          componentSettings={componentSettings}
          onUpdate={onUpdate}
        />
        <Popover.Root open={statsModalOpen} onOpenChange={setStatsModalOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
            >
              <Pencil2Icon className="w-3 h-3" />
              {t("stats")}
            </button>
          </Popover.Trigger>
          <TooltipPopoverContent>
            <div className="px-1 space-y-1 w-48">
              {statToggleList.map((item) => (
                <TooltipBooleanConfigurationOption
                  key={item.key}
                  label={item.label}
                  checked={!!componentSettings.displayStats?.[item.key]}
                  onChange={(next) => handleToggleStat(item.key, next)}
                />
              ))}
            </div>
          </TooltipPopoverContent>
        </Popover.Root>
        <TooltipMorePopover>
          <div className="flex">
            <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
              {t("Metric Type")}
            </span>
            <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
              {t("Column statistics")}
            </span>
          </div>
          {relatedOverlay && (
            <div className="flex">
              <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
                {t("Layer")}
              </span>
              <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right max-w-32 truncate">
                {relatedOverlay.tableOfContentsItem?.title || t("Unknown")}
              </span>
            </div>
          )}
        </TooltipMorePopover>
      </div>
    );
  };
