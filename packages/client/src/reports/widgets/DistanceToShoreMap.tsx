import { useMemo } from "react";
import { Feature, LineString } from "geojson";
import {
  combineMetricsForFragments,
  DistanceToShoreMetric,
  Metric,
  subjectIsFragment,
} from "overlay-engine";
import { useTranslation } from "react-i18next";
import { SpatialMetricState } from "../../generated/graphql";
import useCurrentProjectMetadata from "../../useCurrentProjectMetadata";
import { useSubjectReportContext } from "../context/SubjectReportContext";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
} from "../../editor/TooltipMenu";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { LengthUnit } from "../utils/units";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { DistancePathMap } from "./DistancePathMap";
import { UnitSelector } from "./UnitSelector";
import { ReportWidget } from "./widgets";

type DistanceToShoreMapSettings = {
  unit?: LengthUnit;
  unitDisplay?: "long" | "short";
};

function isPathFeature(value: unknown): value is Feature<LineString> {
  if (!value || typeof value !== "object") return false;
  const geom = (value as Feature).geometry;
  return (
    geom != null &&
    geom.type === "LineString" &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length >= 2
  );
}

function sketchReportingGeojsonUrl(
  sketchId: number | undefined,
  token: string | null | undefined
): string | null {
  if (!sketchId || !token) {
    return null;
  }
  const endpoint = process.env.REACT_APP_GRAPHQL_ENDPOINT;
  if (!endpoint) {
    return null;
  }
  return endpoint.replace(
    "/graphql",
    // eslint-disable-next-line i18next/no-literal-string
    `/sketches/${sketchId}.geojson.json?reporting_access_token=${encodeURIComponent(
      token
    )}`
  );
}

export const DistanceToShoreMap: ReportWidget<DistanceToShoreMapSettings> = ({
  metrics,
  componentSettings,
  loading,
}) => {
  const { t } = useTranslation("reports");
  const { data: subject } = useSubjectReportContext();
  const { data: projectMeta } = useCurrentProjectMetadata();
  const unit = (componentSettings?.unit ?? "kilometer") as LengthUnit;
  const formatters = useNumberFormatters({
    unit,
    unitDisplay: componentSettings?.unitDisplay,
  });
  const sketchGeojsonUrl = useMemo(
    () =>
      sketchReportingGeojsonUrl(
        subject?.sketch?.id,
        projectMeta?.project?.sketchGeometryToken
      ),
    [subject?.sketch?.id, projectMeta?.project?.sketchGeometryToken]
  );

  const combined = useMemo(() => {
    if (loading) {
      return null;
    }
    const fragmentMetrics = metrics.filter(
      (m) =>
        m.type === "distance_to_shore" &&
        subjectIsFragment(m.subject) &&
        m.state === SpatialMetricState.Complete &&
        m.value != null
    ) as Pick<Metric, "type" | "value">[];
    if (fragmentMetrics.length === 0) {
      return null;
    }
    return combineMetricsForFragments(
      fragmentMetrics,
      "distance_to_shore"
    ) as DistanceToShoreMetric;
  }, [metrics, loading]);

  if (loading) {
    return (
      <div className="my-2 flex h-56 items-center justify-center rounded border border-gray-200 bg-slate-50">
        <MetricLoadingDots />
      </div>
    );
  }

  const meters = combined?.value?.meters;
  const path = combined?.value?.geojsonLine;

  if (meters === 0) {
    return (
      <DistancePathMap
        paths={[]}
        emptyMessage={t("Sketch is on land or touching the shoreline.")}
        sketchGeojsonUrl={sketchGeojsonUrl}
      />
    );
  }

  if (
    meters == null ||
    !Number.isFinite(meters) ||
    !isPathFeature(path)
  ) {
    return (
      <DistancePathMap
        paths={[]}
        emptyMessage={t("No shoreline path to display.")}
        sketchGeojsonUrl={sketchGeojsonUrl}
      />
    );
  }

  return (
    <DistancePathMap
      paths={[path]}
      emptyMessage={t("No shoreline path to display.")}
      caption={formatters.distance(meters / 1000)}
      sketchGeojsonUrl={sketchGeojsonUrl}
    />
  );
};

export const DistanceToShoreMapTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
}) => {
  const { t } = useTranslation("admin:reports");
  const componentSettings = node.attrs?.componentSettings || {};
  const unit = (componentSettings?.unit || "kilometer") as LengthUnit;
  const unitDisplay = componentSettings?.unitDisplay || "short";

  return (
    <>
      <UnitSelector
        unitType="distance"
        value={unit}
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
      <TooltipMorePopover>
        <div className="flex">
          <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
            {t("Component Type")}
          </span>
          <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
            {t("Distance to Shore Map")}
          </span>
        </div>
      </TooltipMorePopover>
    </>
  );
};
