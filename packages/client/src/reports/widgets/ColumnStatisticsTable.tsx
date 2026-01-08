import { useMemo, useState } from "react";
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
} from "../../editor/TooltipMenu";
import { useReportContext } from "../ReportContext";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import { NumberRoundingControl } from "./NumberRoundingControl";
import * as Popover from "@radix-ui/react-popover";
import { Pencil2Icon } from "@radix-ui/react-icons";
import { ColumnValuesStatKey } from "./InlineMetric";

type ColumnStatisticsTableSettings = {
  columns?: string[];
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
  console.log("componentSettings", componentSettings);
  const { t } = useTranslation("reports");
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
    const rows: (ColumnStatisticsRow & { column: string })[] = [];

    const fragmentMetrics = metrics.filter(
      (m) =>
        subjectIsFragment(m.subject) && m.type === "column_values" && m.value
    ) as unknown as ColumnValuesMetric[];

    if (!fragmentMetrics.length) return [];
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

    const selectedColumns = componentSettings?.columns;
    const columnsToRender =
      selectedColumns?.filter((col) => statsByColumn[col]) || [];

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

  console.log(
    "statLabel mean",
    componentSettings,
    statLabels(t, componentSettings)["mean"]
  );

  return (
    <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex-1 min-w-0 text-gray-600 text-xs font-semibold uppercase tracking-wide">
            {componentSettings?.columnLabel || t("Column")}
          </div>
          {statsToShow.map((stat) => (
            <div
              key={String(stat)}
              className="flex-none text-right text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[90px]"
            >
              {statLabels(t, componentSettings)[stat]}
            </div>
          ))}
        </div>
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50"
          >
            <div className="flex-1 min-w-0 text-sm text-gray-900 truncate">
              {row.column}
            </div>
            {statsToShow.map((stat) => (
              <div
                key={`${row.column}-${String(stat)}`}
                className="flex-none text-right text-sm text-gray-900 tabular-nums min-w-[90px]"
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
        label: React.ReactNode;
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
          .slice(0, 5)
          .map((v) => String(v));
        const examplesText =
          exampleValues.length > 0 ? exampleValues.join(", ") : "";
        options.push({
          value: attr.attribute,
          label: (
            <div className="flex flex-col">
              <span className="font-medium">{attr.attribute}</span>
              {examplesText && (
                <span className="text-xs text-gray-500 truncate max-w-[200px]">
                  {examplesText}
                </span>
              )}
            </div>
          ),
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
              {t("columns")}
              <span className="text-gray-500 text-xs">
                {selectedColumns.length ? ` (${selectedColumns.length})` : ""}
              </span>
            </button>
          </Popover.Trigger>
          <TooltipPopoverContent>
            <div className="px-1 pb-2 flex items-center justify-end gap-2">
              <button
                type="button"
                className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                onClick={handleSelectAll}
                disabled={!numericColumnOptions.length}
              >
                {t("Select all")}
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                onClick={handleSelectNone}
              >
                {t("Select none")}
              </button>
            </div>
            <div className="px-1 space-y-1 w-56 max-h-72 overflow-auto">
              {numericColumnOptions.map((opt) => {
                const checked = selectedColumns.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={checked}
                      onChange={(e) =>
                        handleColumnSelectionChange(opt.value, e.target.checked)
                      }
                    />
                    <span className="flex-1 min-w-0 truncate">{opt.value}</span>
                  </label>
                );
              })}
              {!numericColumnOptions.length && (
                <div className="text-xs text-gray-500 px-1">
                  {t("No numeric columns available")}
                </div>
              )}
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
