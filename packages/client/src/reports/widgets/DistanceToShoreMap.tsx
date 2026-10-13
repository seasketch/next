import { useContext, useMemo, useState } from "react";
import { Feature, LineString } from "geojson";
import { subjectIsFragment } from "overlay-engine";
import { useTranslation } from "react-i18next";
import { SpatialMetricState } from "../../generated/graphql";
import useCurrentProjectMetadata from "../../useCurrentProjectMetadata";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { useSubjectReportContext } from "../context/SubjectReportContext";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
} from "../../editor/TooltipMenu";
import { TooltipBooleanConfigurationOption } from "./reportWidgetShared";
import { shoreExtremes, shoreSketchGroups } from "./distanceToShoreGroups";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { LengthUnit } from "../utils/units";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import {
  DistancePathBasemap,
  FIT_PADDING,
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
  /** Min and max distances in a small pill on the map. Off when omitted. */
  showDistanceRange?: boolean;
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
  const { printing } = useContext(ReportUIStateContext);
  const [tab, setTab] = useState<"map" | "table">("map");
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
  const isCollection = Boolean(subject?.isCollection);
  const childSketches = subject?.childSketches;
  const groups = useMemo(() => {
    if (loading) return [];
    const fragmentMetrics = metrics.filter(
      (metric) =>
        metric.type === "distance_to_shore" &&
        subjectIsFragment(metric.subject) &&
        metric.state === SpatialMetricState.Complete &&
        metric.value != null
    );
    return shoreSketchGroups({
      metrics: fragmentMetrics,
      isCollection,
      childSketches: (childSketches ?? []).map((sketch) => ({
        id: sketch.id,
        name: sketch.name,
      })),
    });
  }, [metrics, loading, isCollection, childSketches]);

  if (loading) {
    return (
      <div className="my-2 flex h-56 items-center justify-center rounded border border-gray-200 bg-slate-50">
        <MetricLoadingDots />
      </div>
    );
  }

  const shoreMessage = t("Touches shoreline");
  const distanceText = (meters: number) =>
    meters === 0 ? shoreMessage : formatters.distance(meters / 1000);
  const extremes = hideDistance ? null : shoreExtremes(groups);
  const showMap = !isCollection || printing || tab === "map";
  const showTable = isCollection && (printing || tab === "table");
  const showTabs = isCollection && !printing;
  const rangeOn =
    componentSettings?.showDistanceRange === true &&
    !hideDistance &&
    extremes != null;
  const showRange = rangeOn && showMap;
  const routeMapHeight = isCollection
    ? rangeOn
      ? "h-[19rem]"
      : "h-[16.8rem]"
    : rangeOn
    ? "h-[16rem]"
    : "h-56";
  const mapFitPaddingTop = showTabs ? 12 + 36 + FIT_PADDING : undefined;
  const mapFitPaddingBottom = showRange ? 8 + 28 + FIT_PADDING : undefined;

  const mapFeatures = groups.flatMap((group) => {
    if (group.meters === 0) {
      if (group.shoreLines.length === 0) return [];
      let labeled = 0;
      for (let i = 1; i < group.shoreLines.length; i++) {
        const line = group.shoreLines[i]!;
        if (lineSpan(line) > lineSpan(group.shoreLines[labeled]!)) {
          labeled = i;
        }
      }
      return group.shoreLines.map((line, index) => ({
        line,
        label: index === labeled ? shoreMessage : null,
        endpoints: false,
      }));
    }
    if (!group.path) return [];
    return [
      {
        line: group.path,
        label: hideDistance ? null : distanceText(group.meters),
        endpoints: true,
      },
    ];
  });

  const emptyMessage =
    groups.length === 1 && groups[0]?.meters === 0
      ? shoreMessage
      : t("No shoreline path to display.");

  const tabs = showTabs ? (
    <div
      className={
        showMap
          ? "pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-3"
          : "flex shrink-0 justify-center px-3 pb-1 pt-3 print:hidden"
      }
    >
      <div
        className={`report-tabs-track pointer-events-auto${
          showMap ? " report-tabs-track-overlay" : ""
        }`}
        role="tablist"
        aria-label={t("Show")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "map"}
          className="report-tabs-tab focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onClick={() => setTab("map")}
        >
          {t("Map")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "table"}
          className="report-tabs-tab focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onClick={() => setTab("table")}
        >
          {t("Table")}
        </button>
      </div>
    </div>
  ) : null;

  const map = (
    <PromotedDistanceMap
      collapsed={!showMap}
      paths={mapFeatures.map((feature) => feature.line)}
      labels={mapFeatures.map((feature) => feature.label)}
      endpoints={mapFeatures.map((feature) => feature.endpoints)}
      emptyMessage={emptyMessage}
      sketchGeojsonUrl={sketchGeojsonUrl}
      basemap={basemap}
      shorelineColor={overlapColor}
      fitPaddingTop={mapFitPaddingTop}
      fitPaddingBottom={mapFitPaddingBottom}
      heightClass={showTabs ? "h-full" : routeMapHeight}
      overlay={
        showRange && extremes ? (
          <div className="pointer-events-none flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 text-[11px] leading-none shadow-sm backdrop-blur-[12px]">
            <span className="font-semibold uppercase tracking-wide text-gray-500">
              {t("Min")}
            </span>
            <span className="font-semibold tabular-nums text-gray-900">
              {formatters.distance(extremes.min.meters / 1000)}
            </span>
            <span className="mx-0.5 h-3 w-px bg-black/15" aria-hidden />
            <span className="font-semibold uppercase tracking-wide text-gray-500">
              {t("Max")}
            </span>
            <span className="font-semibold tabular-nums text-gray-900">
              {formatters.distance(extremes.max.meters / 1000)}
            </span>
          </div>
        ) : null
      }
      sketchId={subject?.sketch?.id ?? 0}
    />
  );

  return (
    <div
      className={
        isCollection
          ? `relative mt-3 w-full max-w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm${
              showTabs ? ` flex flex-col ${routeMapHeight}` : ""
            }`
          : undefined
      }
    >
      {tabs}
      <div
        className={
          showMap && isCollection
            ? showTabs
              ? "h-full min-h-0 [&>div]:my-0 [&>div]:h-full [&_[data-distance-map]]:h-full [&_[data-distance-map]]:rounded-none [&_[data-distance-map]]:border-0"
              : "[&>div]:my-0 [&_[data-distance-map]]:rounded-none [&_[data-distance-map]]:border-0"
            : undefined
        }
      >
        {map}
      </div>
      {showTable ? (
        <div
          className={
            showTabs
              ? "min-h-0 flex-1 overflow-y-auto px-3 pb-3"
              : "px-3 pb-2 pt-1"
          }
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-1.5 pr-3 font-normal">{t("Name")}</th>
                {hideDistance ? null : (
                  <th className="py-1.5 text-right font-normal">
                    {t("Distance")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td className="py-2 text-gray-600" colSpan={2}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr
                    key={group.sketchId ?? "subject"}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="py-1.5 pr-3">
                      {group.sketchName ||
                        t("Sketch #{{id}}", { id: group.sketchId })}
                    </td>
                    {hideDistance ? null : (
                      <td className="py-1.5 text-right tabular-nums">
                        {distanceText(group.meters)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
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
        <TooltipBooleanConfigurationOption
          label={t("Min and max distances")}
          checked={componentSettings?.showDistanceRange === true}
          checkboxFirst
          onChange={(next) =>
            onUpdate({
              componentSettings: {
                ...componentSettings,
                showDistanceRange: next ? true : undefined,
              },
            })
          }
        />
      </TooltipMorePopover>
    </div>
  );
};
