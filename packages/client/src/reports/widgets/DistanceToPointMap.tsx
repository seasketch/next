import { useContext, useMemo, useState } from "react";
import { Feature, LineString } from "geojson";
import { isGeostatsLayer } from "@seasketch/geostats-types";
import {
  combineMetricsForFragments,
  DistanceToFeaturesOverWaterMetric,
  Metric,
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
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { useOverlaySources } from "../hooks/useOverlaySources";
import { LengthUnit } from "../utils/units";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import {
  DistancePathBasemap,
  DistancePathMap,
  isDistancePathBasemap,
} from "./DistancePathMap";
import { DistanceToPointSearchFields } from "./DistanceToPointSearchFields";
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
};

function distanceDisplay(value: unknown): DistanceToPointDisplay {
  return value === "map" || value === "table" ? value : "both";
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

  const combined = useMemo(() => {
    if (loading) {
      return null;
    }
    const fragmentMetrics = metrics.filter(
      (m) =>
        m.type === "distance_to_features_over_water" &&
        subjectIsFragment(m.subject) &&
        m.state === SpatialMetricState.Complete &&
        m.value != null
    ) as Pick<Metric, "type" | "value">[];
    if (fragmentMetrics.length === 0) {
      return null;
    }
    return combineMetricsForFragments(
      fragmentMetrics,
      "distance_to_features_over_water"
    ) as DistanceToFeaturesOverWaterMetric;
  }, [metrics, loading]);

  if (loading) {
    return (
      <div className="my-2 flex h-56 items-center justify-center rounded border border-gray-200 bg-slate-50">
        <MetricLoadingDots />
      </div>
    );
  }

  const ranked = (combined?.value?.features ?? []).filter(
    (feature) =>
      Number.isFinite(feature.meters) && isPathFeature(feature.geojsonLine)
  );
  const rows = ranked.map((feature) => {
    const distanceText = formatters.distance(feature.meters / 1000);
    const label = featureLabel(
      feature.properties,
      componentSettings?.labelColumn
    );
    return { feature, distanceText, label };
  });
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
  // h-56 is 14rem. This map is 20% taller, and the table view uses the same box.
  const routeMapHeight = "h-[16.8rem]";
  // Pill sits 12px from the top and is about 36px tall. Fit the routes below
  // that, keeping the same 40px inset the other edges use.
  const mapFitPaddingTop = showToggle ? 12 + 36 + 40 : undefined;

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
      {showMap ? tabs : null}
      {showMap ? (
        <div
          className={
            display === "both"
              ? showToggle
                ? "h-full min-h-0 [&>div]:my-0 [&>div]:h-full [&>div>div]:h-full [&>div>div]:rounded-none [&>div>div]:border-0"
                : "[&>div]:my-0 [&>div>div]:rounded-none [&>div>div]:border-0"
              : undefined
          }
        >
          <DistancePathMap
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
            heightClass={showToggle ? "h-full" : routeMapHeight}
          />
        </div>
      ) : null}
      {showMap ? null : tabs}
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
                rows.map((row) => (
                  <tr
                    key={row.feature.__id}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="py-1.5 pr-3">{row.label ?? ""}</td>
                    {hideDistance ? null : (
                      <td className="py-1.5 text-right tabular-nums">
                        {row.distanceText}
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
      <LabeledDropdown
        label={t("Show")}
        value={display}
        ariaLabel={t("Show")}
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
      </TooltipMorePopover>
    </div>
  );
};
