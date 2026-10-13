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
import {
  ReportWidgetProps,
  TooltipBooleanConfigurationOption,
} from "./reportWidgetShared";
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
  DistanceToPointSearchInputs,
  useDistanceToPointSearchDraft,
} from "./DistanceToPointSearchFields";
import { FuelCostPanel } from "./FuelCostPanel";
import { LabeledDropdown } from "./LabeledDropdown";
import { TravelCostPopover } from "./TravelCostPopover";
import { UnitSelector } from "./UnitSelector";
import {
  clearFuelCostClientOverrides,
  formatTravelCost,
  fuelCostOverridesMatchSettings,
  isRecognizedCurrency,
  parseTravelCostNumber,
  readFuelCostClientOverrides,
  readTravelCost,
  travelCostForMeters,
  travelCostNumberText,
  travelCostsUsable,
  writeFuelCostClientOverrides,
} from "./travelCost";
import { ReportWidget } from "./widgets";

type DistanceToPointDisplay = "map" | "table" | "both";
type DistanceTab = "map" | "table" | "fuel";

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
  /** Author defaults for the optional Fuel assumptions tab. Omitted means off. */
  travelCost?: unknown;
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
  cardId,
}: ReportWidgetProps<DistanceToPointMapSettings> & { cardId?: number }) => {
  const { t, i18n } = useTranslation("reports");
  const { printing } = useContext(ReportUIStateContext);
  const [tab, setTab] = useState<DistanceTab>("map");
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

  const travelCost = readTravelCost(componentSettings?.travelCost);
  const fuelOn =
    travelCost != null &&
    travelCost.enabled &&
    travelCostsUsable(travelCost);
  const storedEfficiency = travelCostNumberText(travelCost?.defaultEfficiency);
  const storedPrice = travelCostNumberText(travelCost?.defaultPrice);
  const fuelUnitKey = travelCost
    ? `${travelCost.volume}|${travelCost.efficiencyMode}|${travelCost.efficiencyLength}|${travelCost.currency}`
    : "";
  const clientOverrides =
    cardId != null && travelCost ? readFuelCostClientOverrides(cardId) : null;
  const savedOverrides =
    clientOverrides != null &&
    travelCost != null &&
    fuelCostOverridesMatchSettings(clientOverrides, travelCost)
      ? clientOverrides
      : null;
  const [fuelDraft, setFuelDraft] = useState<{
    unitKey: string;
    efficiency: string;
    price: string;
  } | null>(null);
  const efficiencyText =
    fuelDraft && fuelDraft.unitKey === fuelUnitKey
      ? fuelDraft.efficiency
      : savedOverrides
      ? savedOverrides.efficiency
      : storedEfficiency;
  const priceText =
    fuelDraft && fuelDraft.unitKey === fuelUnitKey
      ? fuelDraft.price
      : savedOverrides
      ? savedOverrides.price
      : storedPrice;
  const rememberFuelInputs = (efficiency: string, price: string) => {
    setFuelDraft({ unitKey: fuelUnitKey, efficiency, price });
    if (cardId == null || travelCost == null) return;
    if (efficiency === storedEfficiency && price === storedPrice) {
      clearFuelCostClientOverrides(cardId);
      return;
    }
    writeFuelCostClientOverrides(cardId, {
      efficiency,
      price,
      volume: travelCost.volume,
      efficiencyMode: travelCost.efficiencyMode,
      efficiencyLength: travelCost.efficiencyLength,
      currency: travelCost.currency,
    });
  };
  const restoreFuelDefaults = () => {
    if (cardId != null) clearFuelCostClientOverrides(cardId);
    setFuelDraft({
      unitKey: fuelUnitKey,
      efficiency: storedEfficiency,
      price: storedPrice,
    });
  };

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
  const tabChoices: DistanceTab[] = [];
  if (display !== "table") tabChoices.push("map");
  if (display !== "map") tabChoices.push("table");
  if (fuelOn) tabChoices.push("fuel");
  const activeTab = tabChoices.includes(tab) ? tab : tabChoices[0] ?? "map";
  const showTabs = !printing && tabChoices.length > 1;
  const showMap = display !== "table" && (printing || activeTab === "map");
  const showTable = display !== "map" && (printing || activeTab === "table");
  const showFuel = fuelOn && travelCost != null && (printing || activeTab === "fuel");
  const framed = display === "both" || showTabs || (printing && fuelOn);
  const lockHeight = showTabs;
  const efficiencyValue = parseTravelCostNumber(efficiencyText);
  const priceValue = parseTravelCostNumber(priceText);
  const showCostColumn =
    fuelOn &&
    travelCost != null &&
    efficiencyValue != null &&
    priceValue != null &&
    isRecognizedCurrency(travelCost.currency);
  const formatOneWay = (meters: number): string | null => {
    if (
      !showCostColumn ||
      travelCost == null ||
      efficiencyValue == null ||
      priceValue == null
    ) {
      return null;
    }
    const estimate = travelCostForMeters(
      meters,
      travelCost,
      efficiencyValue,
      priceValue
    );
    if (!estimate) return null;
    return formatTravelCost(estimate.oneWay, travelCost.currency, i18n.language);
  };
  const tableColumns = (hideDistance ? 1 : 2) + (showCostColumn ? 1 : 0);
  const fuelGroups = groupsWithLabels.map((group) => ({
    sketchId: group.sketchId,
    sketchName: group.sketchName,
    routes: group.routes.map((route) => ({
      id: `${group.sketchId ?? "subject"}-${route.feature.__id}`,
      label: route.label,
      meters: route.feature.meters,
      distanceText: route.distanceText,
      sketchName: group.sketchName,
    })),
  }));
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
  const mapFitPaddingTop =
    showTabs && showMap ? 12 + 36 + FIT_PADDING : undefined;
  const mapFitPaddingBottom = showRange ? 8 + 28 + FIT_PADDING : undefined;

  const tabLabel = (choice: DistanceTab) =>
    choice === "map"
      ? t("Route map")
      : choice === "table"
      ? t("Table")
      : t("Fuel assumptions");

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
        {tabChoices.map((choice) => (
          <button
            key={choice}
            type="button"
            role="tab"
            aria-selected={activeTab === choice}
            className="report-tabs-tab focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => setTab(choice)}
          >
            {tabLabel(choice)}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div
      className={
        framed
          ? `relative mt-3 w-full max-w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm${
              lockHeight ? ` flex flex-col ${routeMapHeight}` : ""
            }`
          : undefined
      }
    >
      {tabs}
      <div
        className={
          showMap && framed
            ? lockHeight
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
          heightClass={lockHeight ? "h-full" : routeMapHeight}
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
            lockHeight
              ? "min-h-0 flex-1 overflow-y-auto px-3 pb-3"
              : framed
              ? "px-3 pb-2 pt-1"
              : undefined
          }
        >
          <table
            className={`w-full border-collapse text-sm ${
              framed ? "" : "my-2"
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
                {showCostColumn ? (
                  <th className="py-1.5 pl-3 text-right font-normal">
                    {t("Assumed fuel cost")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="py-2 text-gray-600" colSpan={tableColumns}>
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
                          colSpan={tableColumns}
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
                        {showCostColumn ? (
                          <td className="py-1.5 pl-3 text-right tabular-nums">
                            {formatOneWay(row.feature.meters) ?? ""}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
            {showCostColumn ? (
              <tfoot>
                <tr>
                  <td
                    colSpan={tableColumns}
                    className="pt-2 text-xs font-normal text-gray-500"
                  >
                    {t(
                      "Edit fuel use and price assumptions in the next tab. The cost is one-way."
                    )}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
      {showFuel && travelCost ? (
        <div
          className={
            lockHeight ? "min-h-0 flex-1 overflow-hidden" : undefined
          }
        >
          <FuelCostPanel
            settings={travelCost}
            groups={fuelGroups}
            efficiencyText={efficiencyText}
            priceText={priceText}
            onEfficiencyText={(value) => rememberFuelInputs(value, priceText)}
            onPriceText={(value) => rememberFuelInputs(efficiencyText, value)}
            showRestore={
              efficiencyText !== storedEfficiency || priceText !== storedPrice
            }
            onRestoreDefaults={restoreFuelDefaults}
            showHeading={printing}
          />
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
  const searchDraft = useDistanceToPointSearchDraft({
    metrics,
    onUpdateDependencyParameters,
  });
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
      <TravelCostPopover
        mapUnit={unit}
        value={componentSettings.travelCost}
        onChange={(travelCost) =>
          onUpdate({
            componentSettings: {
              ...componentSettings,
              travelCost,
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
        <DistanceToPointSearchInputs {...searchDraft} />
        <DistanceToPointResolutionField
          metrics={metrics}
          onUpdateDependencyParameters={onUpdateDependencyParameters}
        />
        <LabeledDropdown
          label={t("Show")}
          value={display}
          ariaLabel={t("Show")}
          truncateValue={false}
          modal={false}
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
