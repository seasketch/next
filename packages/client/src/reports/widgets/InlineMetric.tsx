/* eslint-disable no-console */
import { useMemo } from "react";
import {
  Metric,
  TotalAreaMetric,
  combineMetricsForFragments,
  findPrimaryGeographyId,
  subjectIsFragment,
  subjectIsGeography,
} from "overlay-engine";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { UnitSelector } from "./UnitSelector";
import Skeleton from "../../components/Skeleton";
import { ReportWidget } from "./widgets";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { NumberRoundingControl } from "./NumberRoundingControl";
import { SketchGeometryType } from "../../generated/graphql";

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
  marks,
  sketchClass,
}) => {
  if (sketchClass.geometryType !== SketchGeometryType.Polygon) {
    throw new Error(
      "Inline metric only supports polygon geometry types currently."
    );
  }
  const formatters = useNumberFormatters({
    unit: componentSettings?.unit,
    minimumFractionDigits: componentSettings?.minimumFractionDigits,
  });

  const primaryGeographyId = useMemo(() => {
    const id = findPrimaryGeographyId(
      metrics as Pick<Metric, "type" | "value" | "subject">[]
    );
    if (!sketchClass.clippingGeographies?.some((g) => g.id === id)) {
      throw new Error(
        "Primary geography not found in sketch class clipping geographies."
      );
    }
    return id;
  }, [metrics, sketchClass.clippingGeographies]);

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
    primaryGeographyId,
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
}) => {
  const presentation =
    node.attrs.componentSettings.presentation || "total_area";
  const unit = node.attrs?.componentSettings?.unit || "kilometer";

  return (
    <>
      {presentation === "total_area" && (
        <UnitSelector
          value={unit}
          onChange={(value) => onUpdate({ componentSettings: { unit: value } })}
        />
      )}
      <NumberRoundingControl
        value={node.attrs?.componentSettings?.minimumFractionDigits}
        onChange={(minimumFractionDigits) =>
          onUpdate({
            componentSettings: {
              minimumFractionDigits,
            },
          })
        }
      />
    </>
  );
};
