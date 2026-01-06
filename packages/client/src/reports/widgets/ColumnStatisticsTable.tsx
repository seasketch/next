import { useEffect, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import {
  ColumnValueStats,
  ColumnValuesMetric,
  Metric,
  MetricDependency,
  combineColumnValueStats,
  subjectIsFragment,
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

type ColumnStatisticsTableSettings = {
  displayStats?: Partial<Record<keyof ColumnValueStats, boolean>>;
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
  stats: ColumnValueStats;
};

const numericStatOrder: Array<keyof ColumnValueStats> = [
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
): Record<keyof ColumnValueStats, string> => ({
  min: settings?.minLabel || t("Min"),
  max: settings?.maxLabel || t("Max"),
  mean: settings?.meanLabel || t("Mean"),
  stdDev: settings?.stdDevLabel || t("Std Dev"),
  sum: settings?.sumLabel || t("Sum"),
  count: settings?.countLabel || t("Count"),
  countDistinct: settings?.countDistinctLabel || t("Distinct"),
  histogram: t("Histogram"),
  totalAreaSqKm: t("Area"),
});

export const ColumnStatisticsTable: ReportWidget<
  ColumnStatisticsTableSettings
> = ({ metrics, componentSettings, sources, loading }) => {
  const { t } = useTranslation("reports");
  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings?.minimumFractionDigits,
  });

  const valueColumns = useMemo(() => {
    const columns = new Set<string>();
    for (const metric of metrics.filter(
      (m) => subjectIsFragment(m.subject) && m.type === "column_values"
    )) {
      columns.add((metric.parameters as any)?.valueColumn as string);
    }
    return Array.from(columns);
  }, [metrics]);

  const allNumericColumns = useMemo(() => {
    const source = sources?.[0];
    const geoLayer = isGeostatsLayer(
      (source?.geostats as any)?.layers?.[0] as GeostatsLayer
    )
      ? ((source!.geostats as any).layers[0] as GeostatsLayer)
      : undefined;
    if (!geoLayer?.attributes) return [];
    return geoLayer.attributes
      .filter((a) => a.type === "number")
      .map((a) => a.attribute);
  }, [sources]);

  const isNumericColumn = true;

  const resolvedDisplayStats = useMemo(() => {
    const defaults: Partial<Record<keyof ColumnValueStats, boolean>> =
      isNumericColumn
        ? { min: true, max: true, mean: true }
        : { countDistinct: true };
    const merged = {
      ...defaults,
      ...(componentSettings?.displayStats || {}),
    };
    // Enforce non-numeric restriction
    if (!isNumericColumn) {
      return { countDistinct: merged.countDistinct !== false };
    }
    return merged;
  }, [componentSettings?.displayStats, isNumericColumn]);

  const rows = useMemo<(ColumnStatisticsRow & { column: string })[]>(() => {
    const rows: (ColumnStatisticsRow & { column: string })[] = [];

    const fragmentMetrics = metrics.filter(
      (m) =>
        subjectIsFragment(m.subject) && m.type === "column_values" && m.value
    ) as unknown as ColumnValuesMetric[];

    if (!fragmentMetrics.length) return [];
    const statsByColumn: Record<string, ColumnValueStats[]> = {};

    for (const metric of fragmentMetrics) {
      const columnName = (metric as any)?.parameters?.valueColumn as string;
      if (!columnName) continue;
      const val = metric.value as ColumnValuesMetric["value"];
      const allStats: ColumnValueStats[] = [];
      for (const classKey of Object.keys(val)) {
        const stats = val[classKey];
        if (!stats) continue;
        allStats.push(stats);
      }
      if (!allStats.length) continue;
      if (!statsByColumn[columnName]) {
        statsByColumn[columnName] = [];
      }
      statsByColumn[columnName].push(combineColumnValueStats(allStats)!);
    }

    for (const column of Object.keys(statsByColumn)) {
      const combined = combineColumnValueStats(statsByColumn[column]);
      if (!combined) continue;
      rows.push({
        stats: combined,
        column,
      });
    }

    return rows;
  }, [metrics]);

  const statsToShow = useMemo(
    () =>
      numericStatOrder.filter(
        (stat) =>
          resolvedDisplayStats[stat] &&
          (isNumericColumn || stat === "countDistinct" || stat === "count")
      ),
    [resolvedDisplayStats, isNumericColumn]
  );

  const formatValue = (stat: keyof ColumnValueStats, value: any) => {
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
      <div className="divide-y divide-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex-1 min-w-0 text-gray-600 text-xs font-semibold uppercase tracking-wide">
            {componentSettings?.columnLabel || t("Column")}
          </div>
          {statsToShow.map((stat) => (
            <div
              key={stat}
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
                key={stat}
                className="flex-none text-right text-sm text-gray-900 tabular-nums min-w-[90px]"
              >
                {loading ? (
                  <MetricLoadingDots />
                ) : (
                  formatValue(stat, row.stats[stat])
                )}
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
    const lang = useTranslation().i18n.language;
    const [statsModalOpen, setStatsModalOpen] = useState(false);

    const dependencies = (node.attrs?.metrics || []) as MetricDependency[];

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

    const columnValueDeps = useMemo(
      () =>
        dependencies.filter(
          (d) =>
            d.type === "column_values" &&
            (d.subjectType === "fragments" || !d.subjectType)
        ),
      [dependencies]
    );

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
      return options;
    }, [sources]);

    const selectedColumns = useMemo(() => {
      return columnValueDeps
        .map((d) => (d.parameters as any)?.valueColumn as string)
        .filter(Boolean);
    }, [columnValueDeps]);

    const applySelectedColumns = (nextSelected: Set<string>) => {
      onUpdateAllDependencies((existingDependencies) => {
        const base = existingDependencies.find(
          (d) =>
            d.type === "column_values" &&
            (d.subjectType === "fragments" || !d.subjectType)
        );
        if (!base) return existingDependencies;
        const filtered = existingDependencies.filter(
          (d) =>
            d.type !== "column_values" ||
            (d.subjectType && d.subjectType !== "fragments")
        );
        const newColumnDeps = Array.from(nextSelected).map((col) => ({
          ...base,
          parameters: { ...(base.parameters || {}), valueColumn: col },
        }));
        return [...filtered, ...newColumnDeps];
      });
    };

    const handleColumnSelectionChange = (column: string, checked: boolean) => {
      const nextSelected = new Set(selectedColumns);
      if (checked) {
        nextSelected.add(column);
      } else {
        nextSelected.delete(column);
      }
      applySelectedColumns(nextSelected);
    };

    const handleSelectAll = () => {
      applySelectedColumns(
        new Set(numericColumnOptions.map((opt) => opt.value))
      );
    };

    const handleSelectNone = () => {
      applySelectedColumns(new Set());
    };

    const handleToggleStat = (
      stat: keyof ColumnValueStats,
      enabled: boolean
    ) => {
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

    const resolvedDisplayStats = useMemo(() => {
      const defaults: Partial<Record<keyof ColumnValueStats, boolean>> = {
        min: true,
        max: true,
        mean: true,
      };
      return { ...defaults, ...(componentSettings.displayStats || {}) };
    }, [componentSettings.displayStats]);

    const statToggleList: Array<{
      key: keyof ColumnValueStats;
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
            ...statToggleList
              .filter((s) => resolvedDisplayStats[s.key])
              .map((s) => `${s.key}Label`),
          ]}
          labelDisplayNames={[
            t("Column"),
            ...statToggleList
              .filter((s) => resolvedDisplayStats[s.key])
              .map((s) => statLabels(t)[s.key]),
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
                  checked={!!resolvedDisplayStats[item.key]}
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
