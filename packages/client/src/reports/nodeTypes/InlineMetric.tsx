import { useMemo } from "react";
import {
  Metric,
  MetricDependency,
  MetricType,
  TotalAreaMetric,
  combineMetricsForFragments,
  subjectIsFragment,
  subjectIsGeography,
} from "overlay-engine";
import { useReportContext } from "../ReportContext";
import { useReactNodeView } from "../ReactNodeView";
import { filterMetricsByDependencies } from "../utils/metricSatisfiesDependency";
import { SpatialMetricState } from "../../generated/graphql";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { useTranslation } from "react-i18next";

type InlineMetricSettings = {
  /**
   * Defaults to "total_area"
   */
  presentation?:
    | "total_area"
    | "percent_area"
    | "shortest_distance"
    | "nearest_feature"
    | "mean"
    | "max"
    | "min"
    | "distinct_values"
    | "area"
    | "feature_count";
  style?: keyof Intl.NumberFormatOptionsStyleRegistry;
  minimumFractionDigits?: number;
  column?: string;
};

export default function InlineMetric() {
  const { node } = useReactNodeView();
  const reportContext = useReportContext();
  const formatters = useNumberFormatters({
    unit: node?.attrs?.componentSettings?.unit,
    minimumFractionDigits:
      node?.attrs?.componentSettings?.minimumFractionDigits,
  });

  const { loading, error, formattedValue } = useMemo(() => {
    const overlaySourceUrls = {} as { [tableOfContentsItemId: number]: string };
    for (const overlaySource of reportContext.overlaySources) {
      if (!overlaySource.sourceUrl) {
        throw new Error(
          `Overlay source URL not provided for table of contents item ID: ${overlaySource.tableOfContentsItemId}`
        );
      }
      overlaySourceUrls[overlaySource.tableOfContentsItemId] =
        overlaySource.sourceUrl;
    }
    let blankResult = { loading: false, error: null, formattedValue: null };
    const dependencies = node?.attrs?.metrics;
    if (!dependencies.length) {
      throw new Error("No metric dependencies configured");
    }
    console.log("all metrics", reportContext.metrics);
    // First, check to see if there are any errors
    const metrics = filterMetricsByDependencies(
      reportContext.metrics,
      dependencies,
      overlaySourceUrls
    );
    if (metrics.length === 0) {
      return {
        ...blankResult,
        loading: true,
      };
    }
    if (metrics.some((m) => m.state === SpatialMetricState.Error)) {
      return {
        ...blankResult,
        error: metrics
          .filter((m) => m.state === SpatialMetricState.Error)
          .map((m) => m.errorMessage)
          .join(". \n"),
      };
    }
    // check for loading
    const loading = metrics.find(
      (m) => m.state !== SpatialMetricState.Complete
    );
    if (loading) {
      return {
        ...blankResult,
        loading: true,
      };
    }
    console.log("metrics", node?.attrs?.componentSettings, metrics);
    const presentation =
      node?.attrs?.componentSettings?.presentation || "total_area";
    switch (presentation) {
      case "total_area":
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[]
        ) as TotalAreaMetric;
        console.log(`Returning total area: ${combined.value.toString()}`);
        return {
          ...blankResult,
          formattedValue: formatters.area(combined.value),
        };
      case "percent_area":
        const totalArea = combineMetricsForFragments(
          metrics.filter((m) => subjectIsFragment(m.subject)) as Pick<
            Metric,
            "type" | "value"
          >[]
        ) as TotalAreaMetric;
        const geographyMetrics = metrics.filter((m) =>
          subjectIsGeography(m.subject)
        );
        console.log("geographyMetrics", geographyMetrics);
        const geographyArea = combineMetricsForFragments(
          metrics.filter((m) => subjectIsGeography(m.subject)) as Pick<
            Metric,
            "type" | "value"
          >[]
        ) as TotalAreaMetric;
        const percentArea = totalArea.value / geographyArea.value;
        const formattedPercentArea = Intl.NumberFormat(undefined, {
          style: "percent",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(percentArea);
        console.log(`Returning percent area: ${formattedPercentArea}`);
        return {
          ...blankResult,
          formattedValue: formattedPercentArea,
        };
      default:
        throw new Error(`Unsupported presentation: ${presentation}`);
    }
  }, [
    reportContext.metrics,
    node?.attrs?.metrics,
    node?.attrs?.componentSettings,
    reportContext.overlaySources,
  ]);

  return (
    <span className="metric font-semibold rounded-sm inline-block">
      {formattedValue}
    </span>
  );
}

export const InlineMetricTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
}) => {
  const presentation =
    node.attrs.componentSettings.presentation || "total_area";
  console.log("InlineMetricTooltipControls", presentation);
  const { t } = useTranslation("admin:reports");
  if (presentation === "total_area") {
    return (
      <>
        {/* <label className="block text-xs font-semibold text-gray-300 mb-1">
        {t("Unit")}
      </label> */}
        <select
          value={node.attrs?.componentSettings?.unit || "square-kilometer"}
          onChange={(e) =>
            onUpdate({ componentSettings: { unit: e.target.value } })
          }
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="w-auto px-4 pr-8 text-sm bg-transparent border-none text-white  rounded outline-none focus:outline-none active:outline-none focus:ring-0"
        >
          <option value="kilometer">{t("km²")}</option>
          <option value="hectare">{t("ha")}</option>
          <option value="acre">{t("acre")}</option>
          <option value="mile">{t("mi²")}</option>
        </select>
      </>
    );
  }
  return null;
};
