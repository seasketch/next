import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Fragment, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CaretDownIcon, LayersIcon } from "@radix-ui/react-icons";
import {
  Metric,
  combineMetricsForFragments,
  subjectIsGeography,
  subjectIsFragment,
  TotalAreaMetric,
} from "overlay-engine";
import { ReportWidget, TableHeadingsEditor } from "./widgets";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { UnitSelector } from "./UnitSelector";
import { AreaUnit } from "../utils/units";
import { NumberRoundingControl } from "./NumberRoundingControl";
import { useBaseReportContext } from "../context/BaseReportContext";
import ReportLayerVisibilityCheckbox from "../components/ReportLayerVisibilityCheckbox";
import { useOverlayOptionsForLayerToggle } from "./LayerToggleControls";
import { LayerPickerDropdown, LayerPickerValue } from "./LayerPickerDropdown";
import { CompatibleSpatialMetricDetailsFragment } from "../../generated/graphql";
import CollectionExpandableName from "./collection/CollectionExpandableName";
import SketchOverlapHint from "./collection/SketchOverlapHint";
import { sketchContributionsGeographyTotalArea } from "./collection/sketchContributions";
import type { GeographySketchContribution } from "./collection/sketchContributions";
import { useCollectionSketchExpand } from "./collection/useCollectionSketchExpand";

type GeographySizeTableSettings = {
  unit?: "hectare" | "acre" | "mile" | "kilometer";
  minimumFractionDigits?: number;
  geographyNameLabel?: string;
  areaLabel?: string;
  percentLabel?: string;
  unitDisplay?: "long" | "short";
  excludeGeographies?: number[];
  enableLayerToggles?: boolean;
  /** Per-geography stableId overrides. Keys are geography IDs (as strings). */
  geographyStableIds?: Record<string, string | null>;
};

export const GeographySizeTable: ReportWidget<GeographySizeTableSettings> = ({
  metrics,
  componentSettings,
  geographies,
  loading,
  alternateLanguageSettings,
}) => {
  const { t } = useTranslation("reports");

  const widgetUnit = componentSettings?.unit ?? "kilometer";
  const minimumFractionDigits = componentSettings?.minimumFractionDigits;
  const enableLayerToggles = componentSettings?.enableLayerToggles ?? false;

  const formatters = useNumberFormatters({
    minimumFractionDigits,
    unit: widgetUnit,
    unitDisplay: componentSettings?.unitDisplay,
  });

  const excludeSet = useMemo(
    () => new Set(componentSettings?.excludeGeographies ?? []),
    [componentSettings?.excludeGeographies]
  );

  const baseReportContext = useBaseReportContext();
  const {
    isCollection,
    sketchNameById,
    childSketchIds,
    expandedRowKeys,
    toggleRow,
    hideCaretExpandTooltip,
  } = useCollectionSketchExpand(baseReportContext.sketchClass);

  const rows: GeographySizeTableRow[] = useMemo(() => {
    return geographies
      .filter((geography) => !excludeSet.has(geography.id))
      .map((geography) => {
        const geoKey = String(geography.id);
        const geoOverrides = componentSettings?.geographyStableIds;
        const hasOverride = geoOverrides && geoKey in geoOverrides;
        const ids = geography.stableIds as (string | null)[] | null | undefined;
        const defaultStableId = ids?.[0] ?? undefined;
        const resolvedLayerStableId = hasOverride
          ? geoOverrides[geoKey] ?? undefined
          : defaultStableId;
        const stableId = enableLayerToggles ? resolvedLayerStableId : undefined;

        const sketchMetrics = metrics.filter(
          (m) =>
            subjectIsFragment(m.subject) &&
            m.subject.geographies.includes(geography.id)
        ) as Pick<Metric, "type" | "value">[];
        const geographyMetrics = metrics.filter(
          (m) => subjectIsGeography(m.subject) && m.subject.id === geography.id
        ) as Pick<Metric, "type" | "value">[];

        const geographyTotalSqKm =
          geographyMetrics.length > 0
            ? combineMetricsForFragments<TotalAreaMetric>(geographyMetrics)
                .value ?? 0
            : 0;

        const sketchContributions = isCollection
          ? sketchContributionsGeographyTotalArea(
              metrics,
              geography.id,
              geographyTotalSqKm,
              childSketchIds,
              sketchNameById,
              t
            )
          : undefined;

        if (sketchMetrics.length === 0 || geographyMetrics.length === 0) {
          return {
            geographyId: geography.id,
            geographyName: geography.name,
            areaSqKm: 0,
            fractionOfTotal: 0,
            stableId,
            sketchContributions,
          };
        }

        const areaSqKmMetric =
          combineMetricsForFragments<TotalAreaMetric>(sketchMetrics);

        const areaSqKm = areaSqKmMetric.value ?? 0;

        const fractionOfTotal =
          geographyTotalSqKm > 0 ? areaSqKm / geographyTotalSqKm : 0;

        return {
          geographyId: geography.id,
          geographyName: geography.name,
          areaSqKm,
          fractionOfTotal,
          stableId,
          sketchContributions,
        };
      });
  }, [
    metrics,
    geographies,
    excludeSet,
    enableLayerToggles,
    componentSettings?.geographyStableIds,
    isCollection,
    sketchNameById,
    childSketchIds,
    t,
  ]);

  const hasVisibilityColumn = useMemo(
    () => enableLayerToggles && rows.some((r) => r.stableId),
    [rows, enableLayerToggles]
  );

  return (
    <div className="mt-3.5 overflow-hidden rounded-md border border-gray-200">
      <Tooltip.Provider delayDuration={400}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {hasVisibilityColumn && (
                <th
                  scope="col"
                  className="w-8 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  <LayersIcon
                    className="w-4 h-4 text-gray-500 inline-block"
                    aria-hidden
                  />
                </th>
              )}
              <th
                scope="col"
                className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 ${
                  isCollection
                    ? hasVisibilityColumn
                      ? "pl-[8px]"
                      : "pl-3"
                    : ""
                }`}
              >
                {componentSettings.geographyNameLabel || t("Geography")}
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
              >
                {componentSettings.areaLabel || t("Area")}
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
              >
                {componentSettings.percentLabel || t("Percent")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => {
              const rowKey = String(row.geographyId);
              const expanded =
                isCollection && expandedRowKeys.has(rowKey);
              const contrib = row.sketchContributions ?? [];
              return (
                <Fragment key={row.geographyId}>
                  <tr
                    className={`odd:bg-white even:bg-gray-50 hover:bg-gray-100 ${
                      row.areaSqKm === 0 ? "opacity-50" : ""
                    }${isCollection && expanded ? "" : ""}`}
                  >
                    {hasVisibilityColumn && (
                      <td className="w-8 px-2 py-2 text-center">
                        {row.stableId ? (
                          <ReportLayerVisibilityCheckbox
                            stableId={row.stableId}
                          />
                        ) : null}
                      </td>
                    )}
                    <td
                      className={`px-3 py-2 text-sm text-gray-800 ${
                        isCollection
                          ? hasVisibilityColumn
                            ? "pl-0"
                            : "pl-1"
                          : ""
                      }`}
                    >
                      <CollectionExpandableName
                        displayLabel={row.geographyName}
                        truncateRowLabels={false}
                        expanded={expanded}
                        onToggle={() => toggleRow(rowKey)}
                        loading={loading}
                        isCollection={isCollection}
                        caretTooltipEnabled={!hideCaretExpandTooltip}
                        caretTooltipLabel={t("Expand sketch details")}
                        expandAriaLabelExpanded={t(
                          "Collapse sketch breakdown for {{name}}",
                          { name: row.geographyName },
                        )}
                        expandAriaLabelCollapsed={t(
                          "Expand sketch breakdown for {{name}}",
                          { name: row.geographyName },
                        )}
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-800 text-right tabular-nums">
                      {loading ? (
                        <MetricLoadingDots className="mr-1" />
                      ) : (
                        formatters.area(row.areaSqKm)
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-800 text-right tabular-nums">
                      {loading ? (
                        <MetricLoadingDots className="mr-1" />
                      ) : (
                        formatters.percent(row.fractionOfTotal)
                      )}
                    </td>
                  </tr>
                  {isCollection && expanded && contrib.length === 0 && (
                    <tr
                      className={`border-t border-slate-200/80 bg-slate-100 ${
                        row.areaSqKm === 0 ? "opacity-50" : ""
                      }`}
                    >
                      <td
                        colSpan={hasVisibilityColumn ? 4 : 3}
                        className="px-3 py-2.5 text-sm italic text-gray-600"
                      >
                        {t(
                          "No individual sketches contributed area in this geography."
                        )}
                      </td>
                    </tr>
                  )}
                  {isCollection &&
                    expanded &&
                    contrib.map((c) => (
                      <tr
                        key={`${row.geographyId}-sketch-${c.sketchId}`}
                        className={`border-t border-slate-200/80 bg-slate-100/10 hover:bg-slate-200/20 text-gray-800 ${
                          row.areaSqKm === 0 ? "opacity-50" : ""
                        }`}
                      >
                        {hasVisibilityColumn && (
                          <td className="w-8 px-2 py-2" aria-hidden />
                        )}
                        <td className="px-3 py-2.5 text-sm">
                          <div className="flex min-w-0 items-center gap-1">
                            <span className="min-w-0">{c.sketchName}</span>
                            <SketchOverlapHint
                              hasOverlap={c.hasOverlap}
                              sketchDisplayName={c.sketchName}
                              overlapPartnerSketchNames={
                                c.overlapPartnerSketchNames
                              }
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm  text-right tabular-nums">
                          {loading ? (
                            <MetricLoadingDots className="mr-1" />
                          ) : (
                            formatters.area(c.areaSqKm)
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm  text-right tabular-nums">
                          {loading ? (
                            <MetricLoadingDots className="mr-1" />
                          ) : (
                            formatters.percent(c.fractionOfTotal)
                          )}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Tooltip.Provider>
    </div>
  );
};

type GeographySizeTableRow = {
  geographyId: number;
  geographyName: string;
  areaSqKm: number;
  fractionOfTotal: number;
  stableId?: string;
  sketchContributions?: GeographySketchContribution[];
};

function GeographiesPopover({
  geographies,
  excludeGeographies,
  onUpdate,
  componentSettings,
  t,
}: {
  geographies: Pick<{ id: number; name: string }, "id" | "name">[];
  excludeGeographies: number[];
  onUpdate: (attrs: Record<string, any>) => void;
  componentSettings: Record<string, any>;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const excludedSet = new Set(excludeGeographies);
  const includedCount = geographies.length - excludeGeographies.length;

  const displayLabel =
    excludeGeographies.length === 0
      ? t("all")
      : // eslint-disable-next-line i18next/no-literal-string
        `some (${includedCount}/${geographies.length})`;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-800">
      <span className="font-light text-gray-400 whitespace-nowrap">
        {t("Geographies")}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex-1 h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none justify-end min-w-0"
          >
            <span className="truncate">{displayLabel}</span>
            <CaretDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        </Popover.Trigger>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="bg-white text-gray-900 border border-gray-200 rounded-lg shadow-xl z-50 w-56 p-1"
        >
          <div className="max-h-64 overflow-auto space-y-1 pb-1">
            {geographies.map((geography) => {
              const checked = !excludedSet.has(geography.id);
              return (
                <label
                  key={geography.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-gray-50 rounded-md cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={checked}
                    onChange={(e) => {
                      const nextExcluded = new Set(excludeGeographies);
                      if (e.target.checked) {
                        nextExcluded.delete(geography.id);
                      } else {
                        nextExcluded.add(geography.id);
                      }
                      onUpdate({
                        componentSettings: {
                          ...componentSettings,
                          excludeGeographies: Array.from(nextExcluded),
                        },
                      });
                    }}
                  />
                  <span className="flex-1 min-w-0 truncate">
                    {geography.name}
                  </span>
                </label>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}

export const GeographySizeTableTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
}) => {
  const presentation =
    node.attrs.componentSettings.presentation || "total_area";

  const componentSettings = useMemo(
    () => node.attrs?.componentSettings || {},
    [node.attrs?.componentSettings]
  );

  const { geographies } = useBaseReportContext();
  const { t } = useTranslation("admin:reports");

  if (presentation === "total_area") {
    const unit = componentSettings?.unit || "kilometer";
    const unitDisplay = componentSettings?.unitDisplay || "short";
    return (
      <>
        <GeographiesPopover
          geographies={geographies}
          excludeGeographies={componentSettings?.excludeGeographies ?? []}
          onUpdate={onUpdate}
          componentSettings={componentSettings}
          t={t}
        />
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
        <NumberRoundingControl
          value={componentSettings?.minimumFractionDigits}
          onChange={(minimumFractionDigits) =>
            onUpdate({
              componentSettings: {
                ...componentSettings,
                minimumFractionDigits,
                roundToDecimalPlaces: minimumFractionDigits,
              },
            })
          }
        />
        <LayerToggleSettingsPopover
          geographies={geographies}
          componentSettings={componentSettings}
          onUpdate={onUpdate}
          t={t}
        />
        <TableHeadingsEditor
          labelKeys={["geographyNameLabel", "areaLabel", "percentLabel"]}
          labelDisplayNames={["Geography", "Area", "Percent"]}
          componentSettings={componentSettings}
          onUpdate={onUpdate}
        />
      </>
    );
  }
  return null;
};

function LayerToggleSettingsPopover({
  geographies,
  componentSettings,
  onUpdate,
  t,
}: {
  geographies: Pick<
    { id: number; name: string; stableIds?: (string | null)[] | null },
    "id" | "name" | "stableIds"
  >[];
  componentSettings: Record<string, any>;
  onUpdate: (attrs: Record<string, any>) => void;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const enableLayerToggles = componentSettings?.enableLayerToggles ?? false;
  const geographyStableIds: Record<string, string | null> =
    componentSettings?.geographyStableIds ?? {};
  const overlayOptions = useOverlayOptionsForLayerToggle(t);

  const resolveLayerTitle = (stableId: string | undefined) => {
    if (!stableId) return t("None");
    return (
      overlayOptions.find((o) => o.value === stableId)?.label ||
      t("Unknown layer")
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
        >
          <LayersIcon className="w-3 h-3" />
          <span>
            {t("layers")}
            {/* eslint-disable-next-line i18next/no-literal-string */}
            {enableLayerToggles ? ": on" : ": off"}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="center"
        sideOffset={6}
        className="bg-white rounded-lg shadow-lg border border-gray-200 p-0 w-[420px] max-h-96 flex flex-col z-50"
      >
        <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            {t("Layer Toggles")}
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={enableLayerToggles}
              onClick={() => {
                onUpdate({
                  componentSettings: {
                    ...componentSettings,
                    enableLayerToggles: !enableLayerToggles,
                  },
                });
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                enableLayerToggles ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  enableLayerToggles ? "translate-x-[18px]" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>
        <div
          className={`divide-y divide-gray-100 overflow-y-auto flex-1 ${
            enableLayerToggles ? "" : "opacity-50 pointer-events-none"
          }`}
        >
          <div className="px-3 py-1.5 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide text-gray-500 font-semibold bg-gray-50">
            <div>{t("Geography")}</div>
            <div>{t("Map Layer")}</div>
          </div>
          {geographies.map((geography) => {
            const geoKey = String(geography.id);
            const hasOverride = geoKey in geographyStableIds;
            const defaultStableId = geography.stableIds?.[0] ?? undefined;
            const effectiveStableId = hasOverride
              ? geographyStableIds[geoKey] ?? undefined
              : defaultStableId;

            return (
              <div
                key={geography.id}
                className="px-3 py-2 grid grid-cols-2 gap-2 items-center"
              >
                <span className="text-sm text-gray-800 truncate">
                  {geography.name}
                </span>
                <LayerPickerDropdown
                  value={effectiveStableId}
                  suggested={defaultStableId ? [defaultStableId] : undefined}
                  onChange={(layerValue: LayerPickerValue | undefined) => {
                    const next = { ...geographyStableIds };
                    if (!layerValue?.stableId) {
                      next[geoKey] = null;
                    } else if (layerValue.stableId === defaultStableId) {
                      delete next[geoKey];
                    } else {
                      next[geoKey] = layerValue.stableId;
                    }
                    onUpdate({
                      componentSettings: {
                        ...componentSettings,
                        geographyStableIds: next,
                      },
                    });
                  }}
                  required={false}
                  onlyReportingLayers={false}
                  hideSearch={false}
                  title={t("Choose a layer")}
                  description={t(
                    "This layer will be toggled when the user clicks the visibility checkbox for this geography."
                  )}
                >
                  <button
                    type="button"
                    className="h-7 w-full rounded border border-transparent hover:border-gray-300 px-2 pr-1.5 text-sm text-left flex items-center justify-between gap-2 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <span className="truncate flex-1 min-w-0">
                      {effectiveStableId
                        ? resolveLayerTitle(effectiveStableId)
                        : t("None")}
                    </span>
                    <CaretDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                </LayerPickerDropdown>
              </div>
            );
          })}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
