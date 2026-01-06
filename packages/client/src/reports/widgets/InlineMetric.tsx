/* eslint-disable no-console */
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ColumnValuesMetric,
  CountMetric,
  DistanceToShoreMetric,
  Metric,
  MetricDependency,
  OverlayAreaMetric,
  TotalAreaMetric,
  combineMetricsForFragments,
  findPrimaryGeographyId,
  subjectIsFragment,
  subjectIsGeography,
  ColumnValueStats,
} from "overlay-engine";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
  TooltipPopoverContent,
} from "../../editor/TooltipMenu";
import { LabeledDropdown } from "./LabeledDropdown";
import { UnitSelector } from "./UnitSelector";
import { AreaUnit, LengthUnit } from "../utils/units";
import Skeleton from "../../components/Skeleton";
import { ReportWidget, TooltipBooleanConfigurationOption } from "./widgets";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { NumberRoundingControl } from "./NumberRoundingControl";
import { SketchGeometryType } from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import { useReportContext } from "../ReportContext";
import useCurrentLang from "../../useCurrentLang";
import * as Popover from "@radix-ui/react-popover";
import { Pencil2Icon } from "@radix-ui/react-icons";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";

export type PluralizedMessages = Record<string, string>;
export type PluralizedMessagesByLang = Record<string, PluralizedMessages>;
type ColumnValuesStat = Exclude<
  keyof ColumnValueStats,
  "histogram" | "totalAreaSqKm"
>;

const defaultPluralizedCountLabels = {
  en: {
    zero: "no features",
    one: "feature",
    other: "features",
  },
  es: {
    zero: "sin elementos",
    one: "elemento",
    other: "elementos",
  },
  dv: {
    zero: "ނެތް އެލިމެންޓް",
    one: "އެލިމެންޓް",
    other: "އެލިމެންޓް",
  },
  pt: {
    zero: "sem entidades",
    one: "entidade",
    other: "entidades",
  },
  "pt-br": {
    zero: "sem entidades",
    one: "entidade",
    other: "entidades",
  },
  no: {
    zero: "ingen objekter",
    one: "objekt",
    other: "objekter",
  },
  kos: {
    zero: "no features",
    one: "feature",
    other: "features",
  },
  sm: {
    zero: "no features",
    one: "feature",
    other: "features",
  },
  CHK: {
    zero: "no features",
    one: "feature",
    other: "features",
  },
  fj: {
    zero: "sega na iyaya",
    one: "iyaya",
    other: "veiyaya",
  },
  fh: {
    zero: "कोई फीचर नहीं",
    one: "फीचर",
    other: "फीचर",
  },
  haw: {
    zero: "ʻaʻohe mea",
    one: "mea",
    other: "nā mea",
  },
  fr: {
    zero: "aucune entité",
    one: "entité",
    other: "entités",
  },
  de: {
    zero: "keine Objekte",
    one: "Objekt",
    other: "Objekte",
  },
  gil: {
    zero: "no features",
    one: "feature",
    other: "features",
  },
  hr: {
    zero: "nema elemenata",
    one: "element",
    few: "elementa",
    other: "elemenata",
  },
  af: {
    zero: "geen elemente",
    one: "element",
    other: "elemente",
  },
  "zh-Hans": {
    other: "要素",
  },
  ar: {
    zero: "لا توجد ميزات",
    one: "ميزة",
    two: "ميزتان",
    few: "ميزات",
    many: "ميزات",
    other: "ميزات",
  },
  nl: {
    zero: "geen objecten",
    one: "object",
    other: "objecten",
  },
  it: {
    zero: "nessun elemento",
    one: "elemento",
    other: "elementi",
  },
  bg: {
    zero: "няма елементи",
    one: "елемент",
    other: "елементи",
  },
  "fr-be": {
    zero: "aucune entité",
    one: "entité",
    other: "entités",
  },
  el: {
    zero: "κανένα στοιχείο",
    one: "στοιχείο",
    other: "στοιχεία",
  },
  hi: {
    zero: "कोई तत्व नहीं",
    one: "तत्व",
    other: "तत्व",
  },
  id: {
    other: "fitur",
  },
  mi: {
    zero: "kāore he taonga",
    one: "taonga",
    other: "taonga",
  },
  pl: {
    zero: "brak elementów",
    one: "element",
    few: "elementy",
    many: "elementów",
    other: "elementów",
  },
  ro: {
    zero: "fără entități",
    one: "entitate",
    few: "entități",
    other: "entități",
  },
  to: {
    zero: "ʻikai ha meʻa",
    one: "meʻa",
    other: "meʻa",
  },
  zu: {
    zero: "azikho izinto",
    one: "into",
    other: "izinto",
  },
  sv: {
    zero: "inga objekt",
    one: "objekt",
    other: "objekt",
  },
  "sv-fi": {
    zero: "inga objekt",
    one: "objekt",
    other: "objekt",
  },
  et: {
    zero: "elemendid puuduvad",
    one: "element",
    other: "elementi",
  },
  lv: {
    zero: "nav elementu",
    one: "elements",
    few: "elementi",
    other: "elementu",
  },
  lt: {
    zero: "nėra elementų",
    one: "elementas",
    few: "elementai",
    many: "elementų",
    other: "elementų",
  },
  ru: {
    zero: "нет объектов",
    one: "объект",
    few: "объекта",
    many: "объектов",
    other: "объектов",
  },
  da: {
    zero: "ingen objekter",
    one: "objekt",
    other: "objekter",
  },
  yap: {
    zero: "no features",
    one: "feature",
    other: "features",
  },
  bi: {
    zero: "no features",
    one: "feature",
    other: "features",
  },
} as PluralizedMessagesByLang;

const defaultDistinctValueMessages: PluralizedMessages = {
  zero: "no distinct values",
  one: "distinct value",
  two: "distinct values",
  few: "distinct values",
  many: "distinct values",
  other: "distinct values",
};

const defaultPluralizedDistinctValueLabels = Object.fromEntries(
  Object.entries(defaultPluralizedCountLabels).map(([lang, messages]) => {
    const entries: Record<string, string> = {};
    Object.keys(messages).forEach((category) => {
      entries[category] =
        defaultDistinctValueMessages[category] ||
        defaultDistinctValueMessages.other;
    });
    return [lang, entries];
  })
) as PluralizedMessagesByLang;

export const InlineMetric: ReportWidget<{
  unit: AreaUnit | LengthUnit;
  unitDisplay?: "long" | "short";
  minimumFractionDigits: number;
  presentation:
    | "total_area"
    | "percent_area"
    | "distance_to_shore"
    | "overlay_area"
    | "count"
    | "column_values";
  stat?: ColumnValuesStat;
  hideLabelForCount?: boolean;
  pluralizedCountLabels?: PluralizedMessagesByLang;
  pluralizedDistinctValueLabels?: PluralizedMessagesByLang;
}> = ({
  metrics,
  sources,
  loading,
  errors,
  geographies,
  componentSettings,
  dependencies,
  marks,
  sketchClass,
}) => {
  const lang = useCurrentLang();
  const {
    pluralRules,
    countDefaultMessages,
    countCustomMessages,
    distinctDefaultMessages,
    distinctCustomMessages,
  } = useMemo(() => {
    const pluralRules = new Intl.PluralRules(lang.code);
    const countDefaultMessages =
      defaultPluralizedCountLabels[lang.code] ||
      defaultPluralizedCountLabels.en;
    const countCustomMessages =
      componentSettings?.pluralizedCountLabels?.[lang.code];
    const distinctDefaultMessages =
      defaultPluralizedDistinctValueLabels[lang.code] ||
      defaultPluralizedDistinctValueLabels.en;
    const distinctCustomMessages =
      componentSettings?.pluralizedDistinctValueLabels?.[lang.code];
    return {
      pluralRules,
      countDefaultMessages,
      countCustomMessages,
      distinctDefaultMessages,
      distinctCustomMessages,
    };
  }, [
    lang.code,
    componentSettings?.pluralizedCountLabels,
    componentSettings?.pluralizedDistinctValueLabels,
  ]);
  if (sketchClass.geometryType !== SketchGeometryType.Polygon) {
    throw new Error(
      "Inline metric only supports polygon geometry types currently."
    );
  }
  const formatters = useNumberFormatters({
    unit: componentSettings?.unit,
    minimumFractionDigits: componentSettings?.minimumFractionDigits,
    unitDisplay: componentSettings?.unitDisplay || "short",
  });

  const formattedValue = useMemo(() => {
    if (!dependencies.length) {
      throw new Error("No metric dependencies configured");
    }
    const presentation = componentSettings?.presentation || "total_area";
    if (errors.length > 0 || loading || metrics.length === 0) {
      return null;
    }
    switch (presentation) {
      case "total_area":
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[]
        ) as TotalAreaMetric;
        return formatters.area(combined.value);
      case "percent_area":
        const primaryGeographyId = findPrimaryGeographyId(
          metrics as Pick<Metric, "type" | "value" | "subject">[]
        );
        if (!primaryGeographyId) {
          throw new Error("Primary geography not found in metrics.");
        }
        if (
          !(sketchClass.clippingGeographies || []).some(
            (g) => g!.id === primaryGeographyId
          )
        ) {
          throw new Error(
            "Primary geography not found in sketch class clipping geographies."
          );
        }
        // Should be percent of sketch class' clipping geography
        const totalArea = combineMetricsForFragments(
          metrics.filter((m) => subjectIsFragment(m.subject)) as Pick<
            Metric,
            "type" | "value"
          >[]
        ) as TotalAreaMetric;
        const geographyAreaMetric = metrics.find(
          (m) =>
            subjectIsGeography(m.subject) && m.subject.id === primaryGeographyId
        );
        if (!geographyAreaMetric) {
          throw new Error("Primary geography not found in metrics.");
        }
        return formatters.percent(totalArea.value / geographyAreaMetric.value);
      case "distance_to_shore": {
        const distanceToShore = metrics.find(
          (m) => m.type === "distance_to_shore"
        );
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[]
        ) as DistanceToShoreMetric;
        if (!distanceToShore) {
          console.error("Distance to shore not found in metrics.", metrics);
          throw new Error("Distance to shore not found in metrics.");
        }
        return formatters.distance(combined.value.meters / 1000);
      }
      case "overlay_area": {
        const overlayMetrics = metrics.filter((m) => m.type === "overlay_area");
        if (overlayMetrics.length === 0) {
          throw new Error("Overlay area not found in metrics.");
        }
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[]
        ) as OverlayAreaMetric;

        return formatters.area(combined.value["*"]);
      }
      case "count": {
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[]
        ) as CountMetric;
        const count = combined.value["*"].count;
        if (componentSettings?.hideLabelForCount) {
          return formatters.count(count);
        } else {
          const pluralKey = pluralRules.select(count) as string;

          let label =
            countCustomMessages?.[pluralKey] || countDefaultMessages[pluralKey];
          return `${formatters.count(count)} ${label}`;
        }
      }
      case "column_values": {
        const columnValues = metrics.filter(
          (m) => m.type === "column_values" && subjectIsFragment(m.subject)
        );
        if (!columnValues.length) {
          throw new Error("Column values not found in metrics.");
        }
        const combined = combineMetricsForFragments(
          columnValues as Pick<Metric, "type" | "value">[]
        ) as ColumnValuesMetric;
        const statKey = componentSettings?.stat || "mean";
        const value = combined.value["*"]?.[statKey];
        if (componentSettings?.stat === "countDistinct") {
          const countDistinct = value ?? 0;
          const pluralKey = pluralRules.select(countDistinct) as string;
          const label =
            distinctCustomMessages?.[pluralKey] ||
            distinctDefaultMessages[pluralKey];
          return `${formatters.count(countDistinct)} ${label}`;
        }
        if (componentSettings?.stat === "count") {
          return value;
        }
        return formatters.decimal(value);
      }
      default:
        // eslint-disable-next-line i18next/no-literal-string
        errors.push(`Unsupported presentation: ${presentation}`);
    }
  }, [
    dependencies.length,
    loading,
    metrics,
    componentSettings?.presentation,
    componentSettings?.stat,
    formatters,
    sketchClass.clippingGeographies,
    errors,
    pluralRules,
    componentSettings?.hideLabelForCount,
    countDefaultMessages,
    countCustomMessages,
    distinctCustomMessages,
    distinctDefaultMessages,
  ]);

  if (loading) {
    return (
      <div className="inline-block rounded border border-blue-600/30 w-12 h-content relative -mb-[3px] bg-blue-500/20">
        <Skeleton
          strong
          className="inline-block border rounded absolute w-full h-full z-10"
        />
        <span className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20">
          <MetricLoadingDots className="" />
        </span>
        <span className="metric-loading-placeholder-for-height">20</span>
      </div>
    );
  } else if (errors.length > 0) {
    return (
      <span className="metric font-semibold rounded-sm inline-block">
        {errors.join(". \n")}
      </span>
    );
  } else {
    const underline =
      marks?.some((m) => m.type.name === "underline") ||
      marks?.some((m) => m.type.name === "link" && m.attrs?.underline);
    return (
      <span
        className={`metric font-semibold rounded-sm inline-block ${
          underline ? "underline" : ""
        }`}
        style={underline ? { textDecorationStyle: "solid" } : undefined}
      >
        {formattedValue}
      </span>
    );
  }
};

export const InlineMetricTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
  onUpdateDependencyParameters,
}) => {
  const presentation =
    node.attrs.componentSettings.presentation || "total_area";
  const componentSettings = node.attrs?.componentSettings || {};
  const unit = componentSettings.unit || "kilometer";
  const unitDisplay = componentSettings.unitDisplay || "short";
  const { t } = useTranslation("admin:reports");
  const type = formatPresentationLabel(componentSettings.presentation);
  const reportContext = useReportContext();
  const lang = useCurrentLang();
  const pluralCategories = useMemo(() => {
    return new Intl.PluralRules(lang.code).resolvedOptions().pluralCategories;
  }, [lang.code]);
  const { defaultMessages, customMessages } = useMemo(() => {
    const defaultMessages =
      defaultPluralizedCountLabels[lang.code] ||
      defaultPluralizedCountLabels.en;
    const customMessages =
      componentSettings?.pluralizedCountLabels?.[lang.code];
    return { defaultMessages, customMessages };
  }, [lang.code, componentSettings?.pluralizedCountLabels]);
  const { distinctDefaultMessages, distinctCustomMessages } = useMemo(() => {
    const distinctDefaultMessages =
      defaultPluralizedDistinctValueLabels[lang.code] ||
      defaultPluralizedDistinctValueLabels.en;
    const distinctCustomMessages =
      componentSettings?.pluralizedDistinctValueLabels?.[lang.code];
    return { distinctDefaultMessages, distinctCustomMessages };
  }, [lang.code, componentSettings?.pluralizedDistinctValueLabels]);

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

  const relatedOverlay = useMemo(() => {
    const allSources = [
      ...(reportContext.overlaySources || []),
      ...(reportContext.adminSources || []),
    ];
    const dependencies = (node.attrs.metrics || []) as MetricDependency[];
    for (const dependency of dependencies) {
      if (dependency.tableOfContentsItemId) {
        const source = allSources.find(
          (s) => s.tableOfContentsItemId === dependency.tableOfContentsItemId
        );
        if (source) {
          return source;
        }
      }
    }
    return null;
  }, [
    node.attrs.metrics,
    reportContext.overlaySources,
    reportContext.adminSources,
  ]);

  const currentValueColumn = useMemo(() => {
    const dependencies = (node.attrs?.metrics || []) as MetricDependency[];
    const depWithValueColumn = dependencies.find(
      (d) => d.parameters?.valueColumn !== undefined
    );
    return (depWithValueColumn?.parameters?.valueColumn as string) || "";
  }, [node.attrs?.metrics]);

  const { valueColumnOptions, valueColumnAttributesByName } = useMemo(() => {
    const options: Array<{ value: string; label: ReactNode }> = [];
    const valueColumnAttributesByName: Record<string, { type?: string }> = {};

    if (presentation !== "column_values") {
      return { valueColumnOptions: options, valueColumnAttributesByName };
    }

    const source = sources?.[0];
    if (!source?.geostats) {
      return { valueColumnOptions: options, valueColumnAttributesByName };
    }

    const geoLayer = isGeostatsLayer(
      (source.geostats as any)?.layers?.[0] as GeostatsLayer
    )
      ? ((source.geostats as any).layers[0] as GeostatsLayer)
      : undefined;

    if (!geoLayer?.attributes) {
      return { valueColumnOptions: options, valueColumnAttributesByName };
    }

    for (const attr of geoLayer.attributes) {
      valueColumnAttributesByName[attr.attribute] = { type: attr.type };
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

    if (
      currentValueColumn &&
      !options.some((opt) => opt.value === currentValueColumn)
    ) {
      options.unshift({
        value: currentValueColumn,
        label: (
          <div className="flex flex-col">
            <span className="font-medium">{currentValueColumn}</span>
            <span className="text-xs text-gray-500 truncate max-w-[200px]">
              {t("Current selection")}
            </span>
          </div>
        ),
      });
    }

    return { valueColumnOptions: options, valueColumnAttributesByName };
  }, [presentation, sources, currentValueColumn, t]);

  const selectedValueColumn =
    currentValueColumn || valueColumnOptions[0]?.value || "";
  const selectedValueColumnIsNumeric =
    valueColumnAttributesByName[selectedValueColumn]?.type === "number";

  const statOptions = useMemo(
    () => [
      {
        value: "mean",
        label: t("Mean"),
        disabled: !selectedValueColumnIsNumeric,
      },
      {
        value: "min",
        label: t("Minimum"),
        disabled: !selectedValueColumnIsNumeric,
      },
      {
        value: "max",
        label: t("Maximum"),
        disabled: !selectedValueColumnIsNumeric,
      },
      {
        value: "stdDev",
        label: t("Standard deviation"),
        disabled: !selectedValueColumnIsNumeric,
      },
      {
        value: "sum",
        label: t("Sum"),
        disabled: !selectedValueColumnIsNumeric,
      },
      { value: "countDistinct", label: t("Distinct values") },
    ],
    [t, selectedValueColumnIsNumeric]
  );

  const selectedStat: ColumnValuesStat = selectedValueColumnIsNumeric
    ? (componentSettings.stat as ColumnValuesStat) ||
      ("mean" as ColumnValuesStat)
    : ("countDistinct" as ColumnValuesStat);

  useEffect(() => {
    if (presentation !== "column_values") return;
    if (selectedValueColumnIsNumeric) return;
    if (componentSettings?.stat === "countDistinct") return;

    onUpdate({
      componentSettings: {
        ...componentSettings,
        stat: "countDistinct",
      },
    });
  }, [presentation, selectedValueColumnIsNumeric, componentSettings, onUpdate]);

  const handleValueColumnChange = (value: string) => {
    onUpdateDependencyParameters((dependency) => {
      if (dependency.type !== "column_values") {
        return dependency.parameters || {};
      }
      return {
        ...(dependency.parameters || {}),
        valueColumn: value,
      };
    });

    const nextValueColumnIsNumeric =
      valueColumnAttributesByName[value]?.type === "number";
    if (
      !nextValueColumnIsNumeric &&
      componentSettings?.stat !== "countDistinct"
    ) {
      onUpdate({
        componentSettings: { ...componentSettings, stat: "countDistinct" },
      });
    }
  };

  const handleStatChange = (stat: ColumnValuesStat) => {
    if (!selectedValueColumnIsNumeric && stat !== "countDistinct") {
      return;
    }
    onUpdate({
      componentSettings: { ...componentSettings, stat },
    });
  };

  const [countLabelsModalOpen, setCountLabelsModalOpen] = useState(false);
  const [distinctLabelsModalOpen, setDistinctLabelsModalOpen] = useState(false);

  // TODO: Add related geography once supported

  return (
    <>
      {["total_area", "overlay_area"].includes(presentation) && (
        <UnitSelector
          unitType="area"
          value={unit as AreaUnit}
          unitDisplay={unitDisplay}
          onChange={(value: AreaUnit) =>
            onUpdate({
              componentSettings: { ...componentSettings, unit: value },
            })
          }
          onUnitDisplayChange={(display) =>
            onUpdate({
              componentSettings: { ...componentSettings, unitDisplay: display },
            })
          }
        />
      )}
      {presentation === "distance_to_shore" && (
        <UnitSelector
          unitType="distance"
          value={unit as LengthUnit}
          unitDisplay={unitDisplay}
          onChange={(value: LengthUnit) =>
            onUpdate({
              componentSettings: { ...componentSettings, unit: value },
            })
          }
          onUnitDisplayChange={(display) =>
            onUpdate({
              componentSettings: { ...componentSettings, unitDisplay: display },
            })
          }
        />
      )}
      {presentation !== "count" && (
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
      )}
      {presentation === "column_values" && valueColumnOptions.length > 0 && (
        <LabeledDropdown
          label={t("column")}
          value={currentValueColumn || valueColumnOptions[0]?.value || ""}
          options={valueColumnOptions}
          onChange={handleValueColumnChange}
          getDisplayLabel={(selected) => selected?.value || ""}
        />
      )}
      {presentation === "column_values" && (
        <LabeledDropdown
          label={t("Stat")}
          value={selectedStat}
          options={statOptions}
          onChange={(val) => handleStatChange(val as ColumnValuesStat)}
        />
      )}
      {presentation === "column_values" && selectedStat === "countDistinct" && (
        <Popover.Root
          open={distinctLabelsModalOpen}
          onOpenChange={setDistinctLabelsModalOpen}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
            >
              <Pencil2Icon className="w-3 h-3" />
              {t("labeling")}
            </button>
          </Popover.Trigger>
          <TooltipPopoverContent>
            <div className="px-1 space-y-2 w-48">
              <p className="text-xs text-gray-500">
                {t(
                  "The following pluralized labels will be used depending on the count."
                )}
              </p>
              <div className="space-y-1">
                {pluralCategories.map((category) => (
                  <div key={category}>
                    <label className="text-xs text-gray-500">{category}</label>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      type="text"
                      value={distinctCustomMessages?.[category] || ""}
                      placeholder={distinctDefaultMessages?.[category] || ""}
                      onChange={(e) =>
                        onUpdate({
                          componentSettings: {
                            ...componentSettings,
                            pluralizedDistinctValueLabels: {
                              ...componentSettings?.pluralizedDistinctValueLabels,
                              [lang.code]: {
                                ...componentSettings
                                  ?.pluralizedDistinctValueLabels?.[lang.code],
                                [category]: e.target.value,
                              },
                            },
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </TooltipPopoverContent>
        </Popover.Root>
      )}
      {presentation === "count" && (
        <>
          <Popover.Root
            open={countLabelsModalOpen}
            onOpenChange={setCountLabelsModalOpen}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
              >
                <Pencil2Icon className="w-3 h-3" />
                {t("labeling")}
              </button>
            </Popover.Trigger>
            <TooltipPopoverContent>
              <div className="px-1 space-y-2 w-48">
                <TooltipBooleanConfigurationOption
                  label={t("show label")}
                  checked={!componentSettings?.hideLabelForCount}
                  onChange={(hideLabelForCount) =>
                    onUpdate({
                      componentSettings: {
                        ...componentSettings,
                        hideLabelForCount: !hideLabelForCount,
                      },
                    })
                  }
                />
                <div
                  className={
                    componentSettings?.hideLabelForCount
                      ? "opacity-20 pointer-events-none"
                      : ""
                  }
                >
                  <p className="text-xs text-gray-500">
                    {t(
                      "The following pluralized labels will be used depending on the count."
                    )}
                  </p>
                  <div className="space-y-1">
                    {pluralCategories.map((category) => (
                      <div key={category}>
                        <label className="text-xs text-gray-500">
                          {category}
                        </label>
                        <input
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          type="text"
                          value={customMessages?.[category] || ""}
                          placeholder={defaultMessages?.[category] || ""}
                          onChange={(e) =>
                            onUpdate({
                              componentSettings: {
                                ...componentSettings,
                                pluralizedCountLabels: {
                                  ...componentSettings?.pluralizedCountLabels,
                                  [lang.code]: {
                                    ...componentSettings
                                      ?.pluralizedCountLabels?.[lang.code],
                                    [category]: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TooltipPopoverContent>
          </Popover.Root>
        </>
      )}
      <TooltipMorePopover>
        <div className="flex">
          <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
            {t("Metric Type")}
          </span>
          <span className="text-sm font-light  whitespace-nowrap px-1 flex-1 text-right">
            {type}
          </span>
        </div>

        {relatedOverlay && (
          <>
            <div className="flex">
              <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
                {t("Layer")}
              </span>
              <span className="text-sm font-light  whitespace-nowrap px-1 flex-1 text-right  max-w-32 truncate">
                {relatedOverlay.tableOfContentsItem?.title || "Unknown"}
              </span>
            </div>
          </>
        )}
      </TooltipMorePopover>
    </>
  );
};

function formatPresentationLabel(presentation: string) {
  switch (presentation) {
    case "total_area":
      return "Total Area";
    case "percent_area":
      return "Percent Area";
    case "distance_to_shore":
      return "Distance to Shore";
    case "overlay_area":
      return "Overlay Area";
    default:
      return presentation;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LayerDetails = {
  bestLabelColumn?: string;
  labelSuitability: "good" | "poor" | "missing";
  bestCategoryColumn?: string;
  categorySuitability: "good" | "poor" | "missing";
};
