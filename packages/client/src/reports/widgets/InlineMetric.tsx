/* eslint-disable no-console */
import { useMemo } from "react";
import {
  Metric,
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
import Skeleton from "../../components/Skeleton";
import { useTranslation } from "react-i18next";
import { ReportWidget } from "./widgets";
import { MetricLoadingDots } from "../components/MetricLoadingDots";

export const InlineMetric: ReportWidget<{
  unit: "hectare" | "acre" | "mile" | "kilometer";
  minimumFractionDigits: number;
  presentation: "total_area" | "percent_area";
}> = ({
  metrics,
  sources,
  loading,
  errors,
  geographies,
  componentSettings,
  dependencies,
}) => {
  const formatters = useNumberFormatters({
    unit: componentSettings?.unit,
    minimumFractionDigits: componentSettings?.minimumFractionDigits,
  });

  const formattedValue = useMemo(() => {
    if (!dependencies.length) {
      throw new Error("No metric dependencies configured");
    }
    if (errors.length > 0 || loading || metrics.length === 0) {
      return null;
    }
    const presentation = componentSettings?.presentation || "total_area";
    switch (presentation) {
      case "total_area":
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[]
        ) as TotalAreaMetric;
        return formatters.area(combined.value);
      case "percent_area":
        const totalArea = combineMetricsForFragments(
          metrics.filter((m) => subjectIsFragment(m.subject)) as Pick<
            Metric,
            "type" | "value"
          >[]
        ) as TotalAreaMetric;
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
        return formattedPercentArea;
      default:
        throw new Error(`Unsupported presentation: ${presentation}`);
    }
  }, [
    dependencies.length,
    errors.length,
    loading,
    metrics,
    componentSettings?.presentation,
    formatters,
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
    return (
      <span className="metric font-semibold rounded-sm inline-block">
        {formattedValue}
      </span>
    );
  }
};

export const InlineMetricTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
}) => {
  const presentation =
    node.attrs.componentSettings.presentation || "total_area";
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
