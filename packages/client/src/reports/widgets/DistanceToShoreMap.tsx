import { useMemo } from "react";
import { Feature, LineString } from "geojson";
import { shorelineLines } from "./isShorelineFeature";
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
import {
  DistancePathBasemap,
  isDistancePathBasemap,
} from "./DistancePathMap";
import { PromotedDistanceMap } from "./PromotedDistanceMap";
import { shorelineOverlapColor } from "./distancePathStyle";
import { LabeledDropdown } from "./LabeledDropdown";
import { UnitSelector } from "./UnitSelector";
import { ReportWidget } from "./widgets";

type DistanceToShoreMapSettings = {
  /** `"none"` hides the distance caption. Omitted defaults to kilometers. */
  unit?: LengthUnit | "none";
  unitDisplay?: "long" | "short";
  basemap?: DistancePathBasemap;
  /** Stroke color when the sketch overlaps the shoreline. Defaults to orange. */
  overlapColor?: string;
};

function lineSpan(line: Feature<LineString>): number {
  const coords = line.geometry.coordinates;
  let span = 0;
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i]![0] - coords[i - 1]![0];
    const dy = coords[i]![1] - coords[i - 1]![1];
    span += Math.hypot(dx, dy);
  }
  return span;
}

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
  const hideDistance = componentSettings?.unit === "none";
  const unit = (
    hideDistance ? "kilometer" : componentSettings?.unit ?? "kilometer"
  ) as LengthUnit;
  const basemap = isDistancePathBasemap(componentSettings?.basemap)
    ? componentSettings.basemap
    : "streets";
  const overlapColor = shorelineOverlapColor(componentSettings?.overlapColor);
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
    const shoreMessage = t("Touches shoreline");
    const shoreLines = shorelineLines(combined?.value?.shorelineIntersection);
    if (shoreLines.length > 0) {
      const labeled = shoreLines.reduce(
        (best, line, index) =>
          lineSpan(line) > lineSpan(shoreLines[best]!) ? index : best,
        0
      );
      return (
        <PromotedDistanceMap
          paths={shoreLines}
          labels={shoreLines.map((_, index) =>
            index === labeled ? shoreMessage : null
          )}
          endpoints={false}
          emptyMessage={shoreMessage}
          sketchGeojsonUrl={sketchGeojsonUrl}
          basemap={basemap}
          shorelineColor={overlapColor}
          sketchId={subject?.sketch?.id ?? 0}
        />
      );
    }
    return (
      <PromotedDistanceMap
        paths={[]}
        emptyMessage={shoreMessage}
        sketchGeojsonUrl={sketchGeojsonUrl}
        basemap={basemap}
        shorelineColor={overlapColor}
        sketchId={subject?.sketch?.id ?? 0}
      />
    );
  }

  if (
    meters == null ||
    !Number.isFinite(meters) ||
    !isPathFeature(path)
  ) {
    return (
      <PromotedDistanceMap
        paths={[]}
        emptyMessage={t("No shoreline path to display.")}
        sketchGeojsonUrl={sketchGeojsonUrl}
        basemap={basemap}
        shorelineColor={overlapColor}
        sketchId={subject?.sketch?.id ?? 0}
      />
    );
  }

  return (
    <PromotedDistanceMap
      paths={[path]}
      labels={
        hideDistance ? undefined : [formatters.distance(meters / 1000)]
      }
      emptyMessage={t("No shoreline path to display.")}
      sketchGeojsonUrl={sketchGeojsonUrl}
      basemap={basemap}
      shorelineColor={overlapColor}
      sketchId={subject?.sketch?.id ?? 0}
    />
  );
};

export const DistanceToShoreMapTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
}) => {
  const { t } = useTranslation("admin:reports");
  const componentSettings = node.attrs?.componentSettings || {};
  const storedUnit = componentSettings?.unit;
  const unit =
    storedUnit === "none" ? undefined : ((storedUnit || "kilometer") as LengthUnit);
  const unitDisplay = componentSettings?.unitDisplay || "short";
  const basemap = isDistancePathBasemap(componentSettings?.basemap)
    ? componentSettings.basemap
    : "streets";

  return (
    <div className="flex items-center gap-3">
      <UnitSelector
        unitType="distance"
        allowNone
        value={unit}
        unitDisplay={unitDisplay}
        onChange={(value) =>
          onUpdate({
            componentSettings: {
              ...componentSettings,
              unit: value ?? "none",
            },
          })
        }
        onUnitDisplayChange={(display) =>
          onUpdate({
            componentSettings: { ...componentSettings, unitDisplay: display },
          })
        }
      />
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <span className="font-light text-gray-400 whitespace-nowrap">
          {t("Overlap color")}
        </span>
        <input
          type="color"
          aria-label={t("Overlap color")}
          value={shorelineOverlapColor(componentSettings?.overlapColor)}
          className="h-6 w-8 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
          onChange={(event) =>
            onUpdate({
              componentSettings: {
                ...componentSettings,
                overlapColor: event.target.value,
              },
            })
          }
        />
      </label>
      <LabeledDropdown
        label={t("Basemap")}
        value={basemap}
        ariaLabel={t("Basemap")}
        title={t("Basemap")}
        options={[
          { value: "light", label: t("Light") },
          { value: "streets", label: t("Streets") },
          { value: "satellite", label: t("Satellite") },
        ]}
        onChange={(value) =>
          onUpdate({
            componentSettings: {
              ...componentSettings,
              basemap: value,
            },
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
    </div>
  );
};
