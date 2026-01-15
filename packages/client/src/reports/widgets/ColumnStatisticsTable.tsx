import { useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ColumnValuesMetric,
  MetricDependency,
  NumberColumnValueStats,
  StringOrBooleanColumnValueStats,
  subjectIsFragment,
  combineMetricsForFragments,
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
import * as Tooltip from "@radix-ui/react-tooltip";
import { CaretDownIcon, Pencil2Icon } from "@radix-ui/react-icons";
import { ColumnValuesStatKey } from "./InlineMetric";
import { MapContext } from "../../dataLayers/MapContextManager";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import { LayersIcon } from "@radix-ui/react-icons";
import { LayerPickerDropdown } from "./LayerPickerDropdown";
import { useOverlayOptionsForLayerToggle } from "./LayerToggleControls";
import {
  AreaUnit,
  getLocalizedUnitLabel,
  isAreaUnit,
  isLengthUnit,
  LengthUnit,
} from "../utils/units";
import { LabeledDropdown } from "./LabeledDropdown";
import { FormLanguageContext } from "../../formElements/FormElement";
import {
  DEFAULT_PRESENCE_PRESENTATION,
  PresencePresentation,
  getPresencePresentationOptions,
  renderPresenceSymbol,
} from "./PresenceSymbols";

type ColumnStatisticsTableSettings = {
  unit?: AreaUnit | LengthUnit | "%";
  unitDisplay?: "short" | "long";
  columns?: string[];
  columnSettings?: Record<
    string,
    {
      label?: string;
      stableId?: string;
    }
  >;
  displayStats?: Partial<Record<ColumnValuesStatKey | "presence", boolean>>;
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
  presenceLabel?: string;
  /**
   * Controls the presentation of the presence column.
   * - check-only: only show a check icon if the value is present
   * - circled-check-and-empty: show a circled check icon if the value is present
   *   and an empty circle if the value is not present
   * - check-and-x: show a check icon if the value is present, and an x icon if
   *   the value is not present
   * - x-only: only show an x icon if the value is not present
   * - thumbs-up: show a thumbs up icon if the value is present, and a thumbs
   *   down icon if the value is not present
   * - thumbs-up-and-down: show a thumbs up icon if the value is present, and a
   *   thumbs down icon if the value is not present
   *
   * Default is "check-only".
   */
  presenceColumnPresentation?: PresencePresentation;
};

type ColumnStatisticsRow = {
  stats: NumberColumnValueStats | StringOrBooleanColumnValueStats;
};

const numericStatOrder: Array<ColumnValuesStatKey | "presence"> = [
  "count",
  "countDistinct",
  "min",
  "max",
  "mean",
  "stdDev",
  "sum",
  "presence",
];

const statLabels = (
  t: (key: string, opts?: Record<string, any>) => string,
  settings?: ColumnStatisticsTableSettings
): Record<ColumnValuesStatKey | "presence", string> => ({
  min: settings?.minLabel || t("Min"),
  max: settings?.maxLabel || t("Max"),
  mean: settings?.meanLabel || t("Mean"),
  stdDev: settings?.stdDevLabel || t("Std Dev"),
  sum: settings?.sumLabel || t("Sum"),
  count: settings?.countLabel || t("Count"),
  countDistinct: settings?.countDistinctLabel || t("Distinct"),
  presence: settings?.presenceLabel || t("Presence"),
});

export const ColumnStatisticsTable: ReportWidget<
  ColumnStatisticsTableSettings
> = ({ metrics, componentSettings, sources, loading }) => {
  const { t } = useTranslation("reports");
  const mapContext = useContext(MapContext);
  const langContext = useContext(FormLanguageContext);
  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings?.minimumFractionDigits,
    unit: isLengthUnit(componentSettings?.unit || "")
      ? (componentSettings?.unit as LengthUnit)
      : undefined,
    unitDisplay: componentSettings?.unitDisplay || "short",
  });
  const unitLabel = useMemo(() => {
    const unit = componentSettings?.unit;
    if (!unit) return undefined;
    if (unit === "%") return "%";
    const isArea = isAreaUnit(unit);
    if (!isAreaUnit(unit) && !isLengthUnit(unit)) return undefined;
    const locale = langContext?.lang?.code?.toLowerCase() || "en";
    const unitDisplay = componentSettings?.unitDisplay || "short";
    return getLocalizedUnitLabel(unit, locale, isArea, unitDisplay);
  }, [
    componentSettings?.unit,
    componentSettings?.unitDisplay,
    langContext?.lang?.code,
  ]);

  const resolvedDisplayStats = useMemo(() => {
    const defaults: Partial<Record<ColumnValuesStatKey | "presence", boolean>> =
      {
        mean: true,
      };
    return componentSettings?.displayStats || defaults;
  }, [componentSettings?.displayStats]);

  const rows = useMemo<(ColumnStatisticsRow & { column: string })[]>(() => {
    const selectedColumns = componentSettings?.columns || [];
    let rows: (ColumnStatisticsRow & { column: string })[] = [];

    const fragmentMetrics = metrics.filter(
      (m) =>
        subjectIsFragment(m.subject) && m.type === "column_values" && m.value
    ) as unknown as ColumnValuesMetric[];

    if (!fragmentMetrics.length || loading) {
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
    }

    const combinedFragmentMetrics = combineMetricsForFragments(
      fragmentMetrics
    ) as ColumnValuesMetric;

    rows = selectedColumns.map((col) => ({
      column: col,
      stats: combinedFragmentMetrics.value["*"]?.[col] || {
        type: "number",
        count: 0,
        min: NaN,
        max: NaN,
        mean: NaN,
        stdDev: NaN,
        sum: NaN,
      },
    }));

    rows.sort((a, b) => a.column.localeCompare(b.column));

    return rows;
  }, [metrics, componentSettings?.columns, loading]);

  const statsToShow = useMemo(
    () => numericStatOrder.filter((stat) => resolvedDisplayStats[stat]),
    [resolvedDisplayStats]
  );

  const hasVisibilityColumn = useMemo(() => {
    const cs = componentSettings?.columnSettings || {};
    return Object.keys(cs).some((c) => !!cs[c]?.stableId);
  }, [componentSettings?.columnSettings]);

  const formatValue = (
    stat: ColumnValuesStatKey | "presence",
    stats: NumberColumnValueStats | StringOrBooleanColumnValueStats
  ) => {
    if (stat === "presence") {
      if (stats.type !== "number") return "";
      const maxValue = (stats as NumberColumnValueStats).max;
      const isPresent = !Number.isNaN(maxValue) && maxValue > 0;
      return renderPresenceSymbol({
        isPresent,
        presentation:
          componentSettings?.presenceColumnPresentation ||
          DEFAULT_PRESENCE_PRESENTATION,
        presentLabel: t("Present"),
        absentLabel: t("Absent"),
        withTooltip: true,
        wrapperClassName:
          "inline-flex items-center justify-center w-full cursor-help",
      });
    }
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
    const isUnitStat = ["min", "max", "mean", "count"].includes(stat);
    if (stat === "count" || stat === "countDistinct") {
      const formattedCount = formatters.count(value as number);
      if (isUnitStat && unitLabel) {
        return unitLabel === "%"
          ? `${formattedCount}${unitLabel}`
          : `${formattedCount} ${unitLabel}`;
      }
      return formattedCount;
    }
    const numericValue = value as number;
    if (isUnitStat && unitLabel) {
      if (isLengthUnit(componentSettings?.unit || "")) {
        return formatters.distance(numericValue);
      }
      const formattedDecimal = formatters.decimal(numericValue);
      return unitLabel === "%"
        ? `${formattedDecimal}${unitLabel}`
        : `${formattedDecimal} ${unitLabel}`;
    }
    return formatters.decimal(numericValue);
  };

  return (
    <Tooltip.Provider>
      <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
        <div
          className="divide-y divide-gray-100"
          style={{
            display: "grid",
            gridTemplateColumns: `${
              hasVisibilityColumn ? "40px " : ""
            }minmax(140px,1fr) repeat(${
              statsToShow.length
            }, minmax(70px, auto))`,
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
          {rows.map((row, idx) => {
            const layerState =
              mapContext?.layerStatesByTocStaticId?.[
                componentSettings.columnSettings?.[row.column]?.stableId || ""
              ];
            return (
              <div key={idx} className="contents hover:bg-gray-50">
                {hasVisibilityColumn && (
                  <div
                    className={`px-3 py-2 text-center ${
                      idx % 2 === 1
                        ? "bg-gray-50/50 border-t border-b border-black/5"
                        : ""
                    }`}
                  >
                    {componentSettings?.columnSettings?.[row.column]
                      ?.stableId ? (
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
                          layerState?.visible && layerState?.hidden !== true
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
                    className={`px-3 py-2 text-right text-sm text-gray-900 tabular-nums ${
                      stat === "presence" ? "flex items-center" : ""
                    } ${
                      idx % 2 === 1
                        ? "bg-gray-50/50 border-t border-b border-black/5"
                        : ""
                    }`}
                  >
                    {loading ? (
                      <MetricLoadingDots />
                    ) : (
                      formatValue(stat, row.stats)
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Tooltip.Provider>
  );
};

export const ColumnStatisticsTableTooltipControls: ReportWidgetTooltipControls =
  ({ node, onUpdate, onUpdateAllDependencies }) => {
    const { t } = useTranslation("admin:reports");
    const reportContext = useReportContext();
    const langContext = useContext(FormLanguageContext);
    const componentSettings = node.attrs?.componentSettings || {};
    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const overlayOptions = useOverlayOptionsForLayerToggle(t);
    const unit = componentSettings?.unit;
    const unitDisplay = componentSettings?.unitDisplay || "short";
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

    const handleToggleStat = (
      stat: ColumnValuesStatKey | "presence",
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

    const unitOptions = useMemo(() => {
      const locale = langContext?.lang?.code?.toLowerCase() || "en";
      const form = componentSettings?.unitDisplay || "short";
      return [
        { value: "none", label: t("None") },
        { value: "percent", label: "%" },
        {
          value: "kilometer",
          label: getLocalizedUnitLabel("kilometer", locale, false, form),
        },
        {
          value: "meter",
          label: getLocalizedUnitLabel("meter", locale, false, form),
        },
        {
          value: "mile",
          label: getLocalizedUnitLabel("mile", locale, false, form),
        },
        {
          value: "foot",
          label: getLocalizedUnitLabel("foot", locale, false, form),
        },
        {
          value: "hectare",
          label: getLocalizedUnitLabel("hectare", locale, true, form),
        },
        {
          value: "acre",
          label: getLocalizedUnitLabel("acre", locale, true, form),
        },
        {
          value: "__unitDisplay:toggle__",
          label: (
            <div className="flex items-center gap-2 space-x-2 text-gray-600 text-xs font-semibold border-t border-black/10 pt-1.5">
              <span>{t("short labels")}</span>
              <input
                type="checkbox"
                checked={unitDisplay === "short"}
                readOnly
                className="h-3 w-3 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
              />
            </div>
          ),
          preventCloseOnSelect: true,
          className:
            "px-2 py-1 text-sm flex items-center gap-2 rounded cursor-pointer hover:bg-transparent focus:bg-transparent",
        },
      ];
    }, [
      langContext?.lang?.code,
      t,
      unitDisplay,
      componentSettings?.unitDisplay,
    ]);

    const selectedUnitValue = useMemo(() => {
      if (!unit) return "none";
      if (unit === "%") return "percent";
      return unit;
    }, [unit]);

    const handleUnitChange = (nextValue: string) => {
      if (nextValue === "__unitDisplay:toggle__") {
        const nextDisplay = unitDisplay === "short" ? "long" : "short";
        onUpdate({
          componentSettings: {
            ...componentSettings,
            unitDisplay: nextDisplay,
          },
        });
        return;
      }
      if (nextValue === "none") {
        onUpdate({
          componentSettings: {
            ...componentSettings,
            unit: undefined,
          },
        });
        return;
      }
      if (nextValue === "percent") {
        onUpdate({
          componentSettings: {
            ...componentSettings,
            unit: "%",
          },
        });
        return;
      }
      if (nextValue === "hectare" || nextValue === "acre") {
        onUpdate({
          componentSettings: {
            ...componentSettings,
            unit: nextValue as AreaUnit,
          },
        });
        return;
      }
      onUpdate({
        componentSettings: {
          ...componentSettings,
          unit: nextValue as LengthUnit,
        },
      });
    };

    const statToggleList: Array<{
      key: ColumnValuesStatKey | "presence";
      label: string;
    }> = [
      { key: "min", label: t("Min") },
      { key: "max", label: t("Max") },
      { key: "mean", label: t("Mean") },
      { key: "stdDev", label: t("Std Dev") },
      { key: "sum", label: t("Sum") },
      { key: "count", label: t("Count") },
      { key: "countDistinct", label: t("Distinct values") },
      { key: "presence", label: t("Presence") },
    ];

    const presenceColumnEnabled = !!componentSettings.displayStats?.presence;
    const presencePresentationOptions = getPresencePresentationOptions();

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
      <Tooltip.Provider>
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
            <TooltipPopoverContent noPadding>
              <div className="px-3 py-3 shadow-sm grid grid-cols-3 gap-2 items-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-b rounded-t-lg">
                <label className="flex items-center gap-2">
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
                        <LayerPickerDropdown
                          value={colSettings?.stableId}
                          onChange={(layerValue) =>
                            handleStableIdChange(
                              opt.value,
                              layerValue?.stableId
                            )
                          }
                          required={false}
                          onlyReportingLayers={false}
                          hideSearch={false}
                        >
                          <button
                            type="button"
                            className="h-8 w-full rounded border border-gray-300 px-2 pr-1.5 text-sm text-left flex items-center justify-between gap-2 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <span className="truncate flex-1 min-w-0">
                              {colSettings?.stableId
                                ? overlayOptions.find(
                                    (o) => o.value === colSettings?.stableId
                                  )?.label || t("Unknown layer")
                                : t("None")}
                            </span>
                            <CaretDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        </LayerPickerDropdown>
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
          <LabeledDropdown
            label={t("Unit")}
            value={selectedUnitValue}
            options={unitOptions}
            onChange={handleUnitChange}
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
            {presenceColumnEnabled && (
              <LabeledDropdown
                label={t("Presence symbols")}
                value={
                  componentSettings?.presenceColumnPresentation ||
                  DEFAULT_PRESENCE_PRESENTATION
                }
                options={presencePresentationOptions}
                onChange={(value) =>
                  onUpdate({
                    componentSettings: {
                      ...componentSettings,
                      presenceColumnPresentation: value as PresencePresentation,
                    },
                  })
                }
              />
            )}
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
      </Tooltip.Provider>
    );
  };
