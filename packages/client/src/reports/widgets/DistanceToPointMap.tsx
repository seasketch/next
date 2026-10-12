import { Fragment, useContext, useMemo, useState } from "react";
import { isGeostatsLayer } from "@seasketch/geostats-types";
import {
  MetricDependency,
  subjectIsFragment,
} from "overlay-engine";
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
import {
  distanceExtremes,
  distanceSketchGroups,
} from "./distanceToPointGroups";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { useOverlaySources } from "../hooks/useOverlaySources";
import { LengthUnit } from "../utils/units";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import {
  DistancePathBasemap,
  FIT_PADDING,
  isDistancePathBasemap,
} from "./DistancePathMap";
import { PromotedDistanceMap } from "./PromotedDistanceMap";
import {
  DistanceToPointResolutionField,
  DistanceToPointSearchFields,
} from "./DistanceToPointSearchFields";
import { LabeledDropdown } from "./LabeledDropdown";
import { UnitSelector } from "./UnitSelector";
import { ReportWidget } from "./widgets";

type DistanceToPointDisplay = "map" | "table" | "both";

type DistanceToPointMapSettings = {
  /** `"none"` hides the distance caption. Omitted defaults to kilometers. */
  unit?: LengthUnit | "none";
  unitDisplay?: "long" | "short";
  basemap?: DistancePathBasemap;
  /** Feature property shown with the distance, when present. */
  labelColumn?: string;
  /** Omitted defaults to map and table. */
  display?: DistanceToPointDisplay;
  /** Min and max distances in a small pill on the map. Off when omitted. */
  showDistanceRange?: boolean;
};

function distanceDisplay(value: unknown): DistanceToPointDisplay {
  return value === "map" || value === "table" ? value : "both";
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

function featureLabel(
  properties: Record<string, unknown> | undefined,
  labelColumn: string | undefined
): string | null {
  if (!properties) return null;
  const keys = labelColumn
    ? [labelColumn]
    : Object.keys(properties).filter((key) => !key.startsWith("__"));
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export const DistanceToPointMap: ReportWidget<DistanceToPointMapSettings> = ({
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
  const formatters = useNumberFormatters({
    unit,
    unitDisplay: componentSettings?.unitDisplay,
  });
  const lineFormatters = useNumberFormatters({
    unit,
    unitDisplay: "short",
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
      (m) =>
        m.type === "distance_to_features_over_water" &&
        subjectIsFragment(m.subject) &&
        m.state === SpatialMetricState.Complete &&
        m.value != null
    );
    return distanceSketchGroups({
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

  const groupsWithLabels = groups.map((group) => ({
    ...group,
    routes: group.routes.map((route) => ({
      ...route,
      distanceText: formatters.distance(route.feature.meters / 1000),
      label: featureLabel(
        route.feature.properties,
        componentSettings?.labelColumn
      ),
    })),
  }));
  const rows = groupsWithLabels.flatMap((group) => group.routes);
  const extremes = hideDistance ? null : distanceExtremes(groups);
  const caption = hideDistance
    ? undefined
    : rows
        .map((row) =>
          row.label
            ? t("{{distance}} from {{name}}", {
                distance: row.distanceText,
                name: row.label,
              })
            : row.distanceText
        )
        .join("\n");
  const display = distanceDisplay(componentSettings?.display);
  const showMap =
    display === "map" || (display === "both" && (printing || tab === "map"));
  const showTable =
    display === "table" ||
    (display === "both" && (printing || tab === "table"));

  const showToggle = display === "both" && !printing;
  const rangeOn =
    componentSettings?.showDistanceRange === true &&
    !hideDistance &&
    extremes != null;
  const showRange = rangeOn && showMap;
  const rangeDistance = (kind: "min" | "max") =>
    extremes
      ? formatters.distance(extremes[kind].feature.meters / 1000)
      : "";
  // With min/max on, grow the shared map/table box by the footer row so that
  // inset does not shrink the routes. The table tab keeps the same box.
  const routeMapHeight =
    rangeOn && display !== "table" ? "h-[19rem]" : "h-[16.8rem]";
  // Tab pill sits 12px from the top and is about 36px tall. The min/max pill
  // matches the other footer controls: 8px inset, 28px tall. Keep 40px of
  // route clearance past each control.
  const mapFitPaddingTop = showToggle ? 12 + 36 + FIT_PADDING : undefined;
  const mapFitPaddingBottom = showRange ? 8 + 28 + FIT_PADDING : undefined;

  const tabs = showToggle ? (
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
          {t("Route map")}
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

  return (
    <div
      className={
        display === "both"
          ? `relative mt-3 w-full max-w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm${
              showToggle ? ` flex flex-col ${routeMapHeight}` : ""
            }`
          : undefined
      }
    >
      {tabs}
      <div
        className={
          showMap && display === "both"
            ? showToggle
              ? "h-full min-h-0 [&>div]:my-0 [&>div]:h-full [&_[data-distance-map]]:h-full [&_[data-distance-map]]:rounded-none [&_[data-distance-map]]:border-0"
              : "[&>div]:my-0 [&_[data-distance-map]]:rounded-none [&_[data-distance-map]]:border-0"
            : undefined
        }
      >
        <PromotedDistanceMap
          collapsed={!showMap}
          paths={rows.map((row) => row.feature.geojsonLine)}
          labels={rows.map((row) => row.label)}
          distances={
            hideDistance
              ? undefined
              : rows.map((row) =>
                  lineFormatters.distance(row.feature.meters / 1000)
                )
          }
          emptyMessage={t("No water route to a point feature.")}
          caption={display === "map" ? caption || undefined : undefined}
          sketchGeojsonUrl={sketchGeojsonUrl}
          basemap={basemap}
          fitPaddingTop={mapFitPaddingTop}
          fitPaddingBottom={mapFitPaddingBottom}
          heightClass={showToggle ? "h-full" : routeMapHeight}
          overlay={
            showRange ? (
              <div className="pointer-events-none flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 text-[11px] leading-none shadow-sm backdrop-blur-[12px]">
                <span className="font-semibold uppercase tracking-wide text-gray-500">
                  {t("Min")}
                </span>
                <span className="font-semibold tabular-nums text-gray-900">
                  {rangeDistance("min")}
                </span>
                <span className="mx-0.5 h-3 w-px bg-black/15" aria-hidden />
                <span className="font-semibold uppercase tracking-wide text-gray-500">
                  {t("Max")}
                </span>
                <span className="font-semibold tabular-nums text-gray-900">
                  {rangeDistance("max")}
                </span>
              </div>
            ) : null
          }
          sketchId={subject?.sketch?.id ?? 0}
        />
      </div>
      {showTable ? (
        <div
          className={
            showToggle
              ? "min-h-0 flex-1 overflow-y-auto px-3 pb-3"
              : display === "both"
              ? "px-3 pb-2 pt-1"
              : undefined
          }
        >
          <table
            className={`w-full border-collapse text-sm ${
              display === "both" ? "" : "my-2"
            }`}
          >
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
              {rows.length === 0 ? (
                <tr>
                  <td className="py-2 text-gray-600" colSpan={2}>
                    {t("No water route to a point feature.")}
                  </td>
                </tr>
              ) : (
                groupsWithLabels.map((group) => (
                  <Fragment
                    key={group.sketchId ?? "subject"}
                  >
                    {isCollection ? (
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <td
                          className="py-1.5 pr-3 font-medium text-gray-900"
                          colSpan={hideDistance ? 1 : 2}
                        >
                          {group.sketchName ||
                            t("Sketch #{{id}}", { id: group.sketchId })}
                        </td>
                      </tr>
                    ) : null}
                    {group.routes.map((row) => (
                      <tr
                        key={`${group.sketchId ?? "subject"}-${row.feature.__id}`}
                        className="border-b border-gray-100 last:border-b-0"
                      >
                        <td
                          className={
                            isCollection ? "py-1.5 pr-3 pl-3" : "py-1.5 pr-3"
                          }
                        >
                          {row.label ?? ""}
                        </td>
                        {hideDistance ? null : (
                          <td className="py-1.5 text-right tabular-nums">
                            {row.distanceText}
                          </td>
                        )}
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

export const DistanceToPointMapTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
  onUpdateDependencyParameters,
}) => {
  const { t } = useTranslation("admin:reports");
  const componentSettings = node.attrs?.componentSettings || {};
  const display = distanceDisplay(componentSettings?.display);
  const storedUnit = componentSettings?.unit;
  const unit =
    storedUnit === "none" ? undefined : ((storedUnit || "kilometer") as LengthUnit);
  const unitDisplay = componentSettings?.unitDisplay || "short";
  const basemap = isDistancePathBasemap(componentSettings?.basemap)
    ? componentSettings.basemap
    : "streets";

  const metrics = (node.attrs?.metrics || []) as MetricDependency[];
  const { filteredSources: sources } = useOverlaySources(metrics);
  const labelColumnOptions = useMemo(() => {
    const source = sources?.[0];
    const layer = (source?.geostats as { layers?: unknown[] } | null)
      ?.layers?.[0];
    if (!isGeostatsLayer(layer) || !layer.attributes) return [];
    return layer.attributes
      .map((attr) => attr.attribute)
      .sort()
      .map((attr) => ({ value: attr, label: attr }));
  }, [sources]);

  return (
    <div className="flex items-center gap-3">
      <DistanceToPointSearchFields
        metrics={metrics}
        onUpdateDependencyParameters={onUpdateDependencyParameters}
      />
      {labelColumnOptions.length > 0 ? (
        <LabeledDropdown
          label={t("label column")}
          value={
            componentSettings?.labelColumn ||
            labelColumnOptions[0]?.value ||
            ""
          }
          options={labelColumnOptions}
          onChange={(value) => {
            onUpdate({
              componentSettings: {
                ...componentSettings,
                labelColumn: value,
              },
            });
            onUpdateDependencyParameters((dependency) => {
              if (dependency.type !== "distance_to_features_over_water") {
                return { ...dependency.parameters };
              }
              return {
                ...dependency.parameters,
                includedColumns: [value],
              };
            });
          }}
        />
      ) : null}
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
            {t("Distance to Point Map")}
          </span>
        </div>
        <DistanceToPointResolutionField
          metrics={metrics}
          onUpdateDependencyParameters={onUpdateDependencyParameters}
        />
        <LabeledDropdown
          label={t("Show")}
          value={display}
          ariaLabel={t("Show")}
          truncateValue={false}
          options={[
            { value: "both", label: t("Map and table") },
            { value: "map", label: t("Route map") },
            { value: "table", label: t("Table") },
          ]}
          onChange={(value) =>
            onUpdate({
              componentSettings: {
                ...componentSettings,
                display: distanceDisplay(value),
              },
            })
          }
        />
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
