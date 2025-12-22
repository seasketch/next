/* eslint-disable no-console */
import { useMemo } from "react";
import {
  DistanceToShoreMetric,
  Metric,
  OverlayAreaMetric,
  TotalAreaMetric,
  combineMetricsForFragments,
  findPrimaryGeographyId,
  subjectIsFragment,
  subjectIsGeography,
} from "overlay-engine";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { UnitSelector } from "./UnitSelector";
import { AreaUnit, LengthUnit } from "../utils/units";
import Skeleton from "../../components/Skeleton";
import { ReportWidget } from "./widgets";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { NumberRoundingControl } from "./NumberRoundingControl";
import { SketchGeometryType } from "../../generated/graphql";

export const InlineMetric: ReportWidget<{
  unit: AreaUnit | LengthUnit;
  unitDisplay?: "long" | "short";
  minimumFractionDigits: number;
  presentation:
    | "total_area"
    | "percent_area"
    | "distance_to_shore"
    | "overlay_area";
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
      default:
        // eslint-disable-next-line i18next/no-literal-string
        errors.push(`Unsupported presentation: ${presentation}`);
    }
  }, [
    dependencies.length,
    loading,
    metrics,
    componentSettings?.presentation,
    formatters,
    sketchClass.clippingGeographies,
    errors,
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
  const componentSettings = node.attrs?.componentSettings || {};
  const unit = componentSettings.unit || "kilometer";
  const unitDisplay = componentSettings.unitDisplay || "short";

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
    </>
  );
};
