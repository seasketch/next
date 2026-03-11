import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Pencil2Icon,
  CaretDownIcon,
  TrashIcon,
  MixerHorizontalIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  CheckCircledIcon,
  CircleIcon,
  QuestionMarkCircledIcon,
  LayersIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { LayerPickerDropdown } from "./LayerPickerDropdown";
// Old single-select dropdown (commented out in favour of ReportLayerMultiPicker)
// import {
//   ReportSourceLayerDropdown,
//   ReportSourceLayerValue,
//   ReportSourceGeometryType,
// } from "./ReportSourceLayerDropdown";
import {
  ReportLayerMultiPicker,
  ReportSourceLayerValue,
  ReportSourceGeometryType,
} from "./ReportLayerMultiPicker";
import { useOverlayOptionsForLayerToggle } from "./LayerToggleControls";
import {
  ClassTableRow,
  ClassTableRowComponentSettings,
  classTableRowKey,
  getClassTableRows,
} from "./FeatureCountTable";
import { MetricDependency } from "overlay-engine";
import { OverlaySourceDetailsFragment } from "../../generated/graphql";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import { useOverlaySources } from "../hooks/useOverlaySources";
import * as Tooltip from "@radix-ui/react-tooltip";

function GroupByPicker({
  value,
  options,
  onChange,
  placeholder,
}: {
  value?: string;
  options: Array<{ value: string; label: React.ReactNode }>;
  onChange: (next?: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="h-8 w-full rounded border border-gray-300 px-2 pr-1.5 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-left"
        >
          <span className="truncate flex-1 min-w-0">
            {(() => {
              const selected =
                options.find((o) => o.value === (value || "__none__")) ||
                options.find((o) => o.value === "__none__");
              if (!selected) return placeholder;
              if (selected.value === "__none__") return placeholder;
              return typeof selected.label === "string"
                ? selected.label
                : selected.value;
            })()}
          </span>
          <CaretDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Content
        side="bottom"
        sideOffset={6}
        className="bg-white text-gray-900 border border-gray-200 rounded-lg shadow-xl z-50 w-56 p-1"
        data-group-by-picker-content
      >
        <div className="max-h-64 overflow-auto space-y-0.5 pb-1">
          {options.map((opt) => {
            const isSelected = opt.value === (value || "__none__");
            return (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "bg-transparent hover:bg-gray-50 focus:bg-gray-50 text-gray-900"
                }`}
                onClick={() => {
                  onChange(opt.value === "__none__" ? undefined : opt.value);
                  setOpen(false);
                }}
              >
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

type ClassRowSettingsPopoverProps = {
  settings: ClassTableRowComponentSettings;
  onUpdateSettings: (patch: Partial<ClassTableRowComponentSettings>) => void;
  dependencies: MetricDependency[];
  sources: OverlaySourceDetailsFragment[];
  onUpdateDependencyParameters: (
    updater: (dependency: MetricDependency) => Record<string, any>
  ) => void;
  onUpdateAllDependencies: (
    updater: (dependencies: MetricDependency[]) => MetricDependency[]
  ) => void;
  t: (key: string, opts?: Record<string, any>) => string;
  /** When set, only layers matching these geometry/types can be added. Omit to allow all. */
  allowedGeometryTypes?: ReportSourceGeometryType[];
  /** Show the "Show zeros" toggle in the footer. */
  showZeros?: boolean;
  onShowZerosChange?: (value: boolean) => void;
  /** Show the "Show color swatches" toggle in the footer. */
  showColorSwatches?: boolean;
  onShowColorSwatchesChange?: (value: boolean) => void;
  /** Hide the "Group by" section (for raster sources that have no attribute columns). */
  hideGroupBy?: boolean;
};

export const ClassRowSettingsPopover = ({
  settings,
  onUpdateSettings,
  dependencies,
  sources,
  onUpdateDependencyParameters,
  onUpdateAllDependencies,
  t,
  allowedGeometryTypes,
  showZeros,
  onShowZerosChange,
  showColorSwatches,
  onShowColorSwatchesChange,
  hideGroupBy,
}: ClassRowSettingsPopoverProps) => {
  const overlayOptions = useOverlayOptionsForLayerToggle(t);
  const { allSources: overlaySources } = useOverlaySources();
  // Hack to handle the fact that we sometimes don't have access to the titles of related table of contents items when the user adds a new source (e.g. when it hasn't been preprocessed yet)
  const [titlesByStableId, setTitlesByStableId] = useState<
    Record<string, string>
  >({});
  // Determine metric type from existing dependencies
  const metricType = useMemo(() => {
    return dependencies?.[0]?.type || "count";
  }, [dependencies]);

  // Get bufferDistanceKm from existing dependencies if present
  const bufferDistanceKm = useMemo(() => {
    return dependencies?.find(
      (d) => d.parameters?.bufferDistanceKm !== undefined
    )?.parameters?.bufferDistanceKm;
  }, [dependencies]);

  // Get tableOfContentsItemIds that are already in use
  const currentSourceIds = useMemo(() => {
    return new Set(
      dependencies
        .map((d) => d.stableId)
        .filter((id): id is string => id !== undefined)
    );
  }, [dependencies]);

  const handleAddSources = (layers: ReportSourceLayerValue[]) => {
    const validLayers = layers.filter(
      (lv) => lv.stableId && !currentSourceIds.has(lv.stableId)
    );
    if (validLayers.length === 0) return;

    setTitlesByStableId((prev) => {
      const next = { ...prev };
      for (const lv of validLayers) {
        next[lv.stableId] = lv.title;
      }
      return next;
    });

    onUpdateAllDependencies((currentDeps) => {
      const newDeps = [...currentDeps];
      const params: Record<string, any> = {};
      if (bufferDistanceKm !== undefined) {
        params.bufferDistanceKm = bufferDistanceKm;
      }

      for (const layerValue of validLayers) {
        newDeps.push({
          type: metricType,
          subjectType: "fragments",
          stableId: layerValue.stableId,
          parameters: params,
        });
        newDeps.push({
          type: metricType,
          subjectType: "geographies",
          stableId: layerValue.stableId,
          parameters: params,
        });
      }

      const newSettings = {
        ...settings,
        rowLinkedStableIds: {
          ...settings.rowLinkedStableIds,
        },
        customRowLabels: {
          ...settings.customRowLabels,
        },
      };

      const fragmentDeps = newDeps.filter((d) => d.subjectType === "fragments");
      for (const dep of fragmentDeps) {
        if (dep.stableId) {
          const relatedSource = overlaySources.find(
            (s) => s.stableId === dep.stableId
          );
          if (relatedSource && dep.parameters?.groupBy) {
            const values = Object.keys(
              relatedSource.geostats?.layers?.[0]?.attributes?.[
                dep.parameters?.groupBy
              ]?.values || {}
            );
            for (const value of values) {
              const rowKey = classTableRowKey(dep.stableId!, value);
              if (!(rowKey in newSettings.rowLinkedStableIds)) {
                newSettings.rowLinkedStableIds[rowKey] = relatedSource.stableId;
              }
            }
          } else {
            const stableId =
              relatedSource?.tableOfContentsItem?.stableId || dep.stableId;
            if (stableId) {
              const rowKey = classTableRowKey(dep.stableId!, "*");
              if (!(rowKey in newSettings.rowLinkedStableIds)) {
                newSettings.rowLinkedStableIds[rowKey] = stableId;
              }
            }
          }
        }
      }
      setTimeout(() => {
        onUpdateSettings(newSettings);
      }, 1);

      return newDeps;
    });
  };

  const handleRemoveSource = (sourceId: string) => {
    onUpdateAllDependencies((currentDeps) => {
      return currentDeps.filter((d) => d.stableId !== sourceId);
    });
  };

  const rows = useMemo(() => {
    return getClassTableRows({
      dependencies: dependencies || [],
      sources,
      customLabels: {},
      allFeaturesLabel: t("All features"),
      stableIds: settings.rowLinkedStableIds,
    });
  }, [dependencies, sources, settings.rowLinkedStableIds, t]);

  const groupedRows = useMemo(() => {
    const groups: Record<
      string,
      {
        title: string;
        rows: ClassTableRow[];
        source?: OverlaySourceDetailsFragment;
      }
    > = {};
    for (const row of rows) {
      const source = overlaySources.find((s) => s.stableId === row.sourceId);
      const title =
        source?.tableOfContentsItem?.title ||
        titlesByStableId[row.sourceId] ||
        t("Unknown source") ||
        "";
      if (!groups[row.sourceId]) {
        groups[row.sourceId] = { title, rows: [], source };
      }
      groups[row.sourceId].rows.push(row);
    }
    return Object.values(groups).sort((a, b) => a.title.localeCompare(b.title));
  }, [rows, overlaySources, titlesByStableId, t]);

  const excludedSet = useMemo(
    () => new Set(settings.excludedRowKeys || []),
    [settings.excludedRowKeys]
  );

  const currentGroupByBySource = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    (dependencies || []).forEach((d) => {
      if (d.stableId !== undefined) {
        map[String(d.stableId)] = d.parameters?.groupBy;
      }
    });
    return map;
  }, [dependencies]);

  const overlappingFeaturesBySource = useMemo(() => {
    const map: Record<string, boolean> = {};
    (dependencies || []).forEach((d) => {
      if (
        d.stableId !== undefined &&
        d.parameters?.sourceHasOverlappingFeatures
      ) {
        map[String(d.stableId)] = true;
      }
    });
    return map;
  }, [dependencies]);

  const groupByOptionsBySource = useMemo(() => {
    const map: Record<
      string,
      Array<{ value: string; label: React.ReactNode }>
    > = {};
    for (const source of sources) {
      const options: Array<{ value: string; label: React.ReactNode }> = [
        { value: "__none__", label: t("None") },
      ];
      const geoLayer = isGeostatsLayer(
        (source.geostats as any)?.layers?.[0] as GeostatsLayer
      )
        ? ((source.geostats as any).layers[0] as GeostatsLayer)
        : undefined;
      if (geoLayer?.attributes) {
        for (const attr of geoLayer.attributes) {
          const isString = attr.type === "string";
          const distinctCount = Object.keys(attr.values || {}).length;
          const isNumericWithFewValues =
            attr.type === "number" && distinctCount <= 10;
          if (isString || isNumericWithFewValues) {
            const exampleValues = Object.keys(attr.values || {})
              .slice(0, 5)
              .map((v) => String(v));
            const examplesText =
              exampleValues.length > 0 ? exampleValues.join(", ") : "";
            options.push({
              value: attr.attribute,
              label: (
                <div className="flex flex-col">
                  <span className="font-medium">{attr.attribute}</span>
                  {examplesText && (
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">
                      {examplesText}
                    </span>
                  )}
                </div>
              ),
            });
          }
        }
      }
      map[source.stableId] = options;
    }
    return map;
  }, [sources, t]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
        >
          <Pencil2Icon className="w-3 h-3" />
          <span>{t("rows")}</span>
          <span className="text-gray-500 text-xs -mb-0.5 -ml-1">
            {rows.length ? ` (${rows.length})` : ""}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="center"
        sideOffset={6}
        className="bg-white rounded-lg shadow-lg border border-gray-200 p-0 w-[680px] max-h-[22rem] flex flex-col"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (
            target?.closest?.(
              "[data-report-source-layer-dropdown], [data-source-options-popover], [data-group-by-picker-content], [data-report-layer-multi-picker]"
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <div className="px-3 py-2.5 shadow-sm z-10 border-b rounded-t-lg flex-none bg-slate-50">
          <span className="text-sm font-semibold text-gray-800">
            {t("Row and Source Layer Settings")}
          </span>
          <p className="text-xs text-gray-500 mt-1">
            {t(
              `Use the inputs below to configure how data sources appear as rows in the table.`
            )}
          </p>
        </div>
        <Tooltip.Provider delayDuration={100}>
          <div className="divide-y divide-gray-100 overflow-y-auto flex-1 overscroll-contain">
            {groupedRows.map((group) => (
              <div key={group.title}>
                <div className="px-3 py-2 font-semibold text-gray-600 bg-blue-50/20 border-b flex items-center justify-between gap-2">
                  <span className="text-sm truncate font-medium text-gray-700 min-w-0">
                    {group.title}
                  </span>
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-blue-100/50 border border-transparent hover:border-blue-200 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:border-blue-300"
                        aria-label={t("Source options")}
                      >
                        <MixerHorizontalIcon className="w-3.5 h-3.5" />
                        <span>{t("Source options")}</span>
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        side="bottom"
                        align="end"
                        sideOffset={6}
                        collisionPadding={8}
                        data-source-options-popover
                        onInteractOutside={(e) => {
                          const target = e.target as HTMLElement;
                          if (
                            target?.closest?.("[data-group-by-picker-content]")
                          ) {
                            e.preventDefault();
                          }
                        }}
                        className="bg-white text-gray-900 border border-gray-200 rounded-lg shadow-xl z-[60] w-80 p-0 overflow-hidden"
                      >
                        {/* <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/80">
                          <h3 className="text-sm font-semibold text-gray-800">
                            {group.title}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {t(
                              "Configure how this data source appears in the table."
                            )}
                          </p>
                        </div> */}
                        <div className="divide-y divide-gray-100">
                          {!hideGroupBy && (
                          <div className="px-3 py-3">
                            <h4 className="text-xs font-semibold text-gray-700 mb-1">
                              {t("Group by")}
                            </h4>
                            <p className="text-xs text-gray-500 mb-2">
                              {t(
                                "Split this source into multiple rows based on column values."
                              )}
                            </p>
                            <GroupByPicker
                              value={
                                currentGroupByBySource[group.source?.stableId!]
                              }
                              options={
                                groupByOptionsBySource[
                                  group.source?.stableId!
                                ] || [{ value: "__none__", label: t("None") }]
                              }
                              placeholder={t("None")}
                              onChange={(groupByValue) => {
                                const targetId = group.source?.stableId;
                                if (!targetId) return;
                                onUpdateDependencyParameters((dependency) => {
                                  const nextParams = {
                                    ...(dependency.parameters || {}),
                                  };
                                  if (dependency.stableId === targetId) {
                                    nextParams.groupBy = groupByValue;
                                  }
                                  return nextParams;
                                });
                              }}
                            />
                          </div>
                          )}
                          {metricType === "overlay_area" &&
                            group.source?.stableId && (
                              <div className="px-3 py-3">
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">
                                  {t("Calculation method")}
                                </h4>
                                <p className="text-xs text-gray-500 mb-2">
                                  {t(
                                    "SeaSketch can calculate area much faster if it can assumes polygons in this source do not overlap each other. If they do, a slower, more precise method must be used."
                                  )}
                                </p>
                                <div className="space-y-1">
                                  {([false, true] as const).map(
                                    (overlapValue) => {
                                      const isSelected =
                                        !!overlappingFeaturesBySource[
                                          group.source!.stableId!
                                        ] === overlapValue;
                                      const sourceRecommends =
                                        !!group.source!
                                          .containsOverlappingFeatures ===
                                        overlapValue;
                                      return (
                                        <button
                                          key={String(overlapValue)}
                                          type="button"
                                          onClick={() => {
                                            const targetId =
                                              group.source!.stableId;
                                            if (!targetId) return;
                                            onUpdateDependencyParameters(
                                              (dependency) => {
                                                if (
                                                  dependency.stableId ===
                                                  targetId
                                                ) {
                                                  return {
                                                    ...(dependency.parameters ||
                                                      {}),
                                                    sourceHasOverlappingFeatures:
                                                      overlapValue || undefined,
                                                  };
                                                }
                                                return (
                                                  dependency.parameters || {}
                                                );
                                              }
                                            );
                                          }}
                                          className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors flex items-start gap-2 ${
                                            isSelected
                                              ? "border-gray-300 bg-gray-50"
                                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                          }`}
                                        >
                                          <span className="mt-0 flex-shrink-0">
                                            {isSelected ? (
                                              <CheckCircledIcon className="w-4 h-4 text-gray-700" />
                                            ) : (
                                              <CircleIcon className="w-4 h-4 text-gray-400" />
                                            )}
                                          </span>
                                          <span className="flex-1 min-w-0">
                                            <span
                                              className={`text-xs block ${
                                                isSelected
                                                  ? "font-medium text-gray-900"
                                                  : "text-gray-700"
                                              }`}
                                            >
                                              {overlapValue
                                                ? t(
                                                    "Polygons are known to overlap"
                                                  )
                                                : t(
                                                    "Assume no overlap (faster)"
                                                  )}
                                            </span>
                                            {sourceRecommends && (
                                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 bg-blue-100 rounded">
                                                {t(
                                                  "Recommended for this layer"
                                                )}
                                                <Tooltip.Root>
                                                  <Tooltip.Trigger asChild>
                                                    <button
                                                      type="button"
                                                      className="inline-flex text-gray-400 hover:text-gray-600"
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                      onMouseDown={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                    >
                                                      <QuestionMarkCircledIcon className="w-3 h-3" />
                                                    </button>
                                                  </Tooltip.Trigger>
                                                  <Tooltip.Portal>
                                                    <Tooltip.Content
                                                      side="top"
                                                      sideOffset={4}
                                                      className="bg-gray-900 text-white text-xs px-2 py-1.5 rounded shadow-lg z-[80] max-w-[240px] leading-snug"
                                                    >
                                                      {t(
                                                        "SeaSketch analyzes a sample of polygons during data preparation in order to make this recommendation. It does not analyze all polygons, so there may be undetected instances of overlap."
                                                      )}
                                                      <Tooltip.Arrow className="fill-gray-900" />
                                                    </Tooltip.Content>
                                                  </Tooltip.Portal>
                                                </Tooltip.Root>
                                              </span>
                                            )}
                                          </span>
                                        </button>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}
                          {groupedRows.length > 1 && group.source?.stableId && (
                            <div className="px-3 py-3">
                              <h4 className="text-xs font-semibold text-gray-700 mb-1">
                                {t("Remove source")}
                              </h4>
                              <p className="text-xs text-gray-500 mb-2">
                                {t(
                                  "Remove this data source from the table. Rows and metrics for this source will no longer appear."
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  handleRemoveSource(group.source!.stableId!);
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-red-700 hover:text-red-800 hover:bg-red-50 rounded-md border border-red-200 transition-colors"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                                {t("Remove this source")}
                              </button>
                            </div>
                          )}
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </div>

                {group.rows.map((row) => {
                  const checked = !excludedSet.has(row.key);
                  const linkedStableId = settings.rowLinkedStableIds?.[row.key];
                  const customLabel = settings.customRowLabels?.[row.key] || "";
                  const stableId = row.sourceId ? row.sourceId : undefined;
                  const defaultLabel =
                    row.groupByKey === "*" ? group.title : row.groupByKey;
                  const chipLabel =
                    row.groupByKey === "*" ? t("All features") : row.groupByKey;
                  return (
                    <div
                      key={row.key}
                      className={`flex gap-2 px-3 py-2 items-center transition-opacity ${
                        !checked ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <div
                        className={`flex-[2] min-w-0 relative ${
                          !checked ? "pointer-events-none" : ""
                        }`}
                      >
                        <input
                          type="text"
                          className={`w-full rounded border border-gray-300 bg-transparent px-2 py-1 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0 focus:border-gray-300 ${
                            customLabel ? "pr-28" : ""
                          }`}
                          placeholder={defaultLabel}
                          value={customLabel}
                          aria-label={t("Row label")}
                          onChange={(e) => {
                            onUpdateSettings({
                              customRowLabels: {
                                ...(settings.customRowLabels || {}),
                                [row.key]: e.target.value,
                              },
                            });
                          }}
                        />
                        {customLabel && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none px-1.5 text-[11px] text-gray-800/50 font-medium truncate max-w-[120px] bg-blue-50 rounded-sm ">
                            {chipLabel}
                          </span>
                        )}
                      </div>
                      <div
                        className={`flex-1 min-w-0 ${
                          !checked ? "pointer-events-none" : ""
                        }`}
                        aria-hidden={!checked}
                      >
                        <LayerPickerDropdown
                          suggested={stableId ? [stableId] : undefined}
                          value={linkedStableId}
                          title={t("Choose a layer")}
                          onChange={(layerValue) => {
                            const next = {
                              ...(settings.rowLinkedStableIds || {}),
                            };
                            if (!layerValue?.stableId) {
                              delete next[row.key];
                            } else {
                              next[row.key] = layerValue.stableId;
                            }
                            onUpdateSettings({ rowLinkedStableIds: next });
                          }}
                          required={false}
                          onlyReportingLayers={false}
                          hideSearch={false}
                          description={t(
                            "If specified, an input will be shown in the table to toggle the associated layer on the map."
                          )}
                        >
                          <button
                            type="button"
                            className="h-8 w-full rounded border border-gray-300 px-2 pr-1.5 text-sm text-left flex items-center gap-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                          >
                            <LayersIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span className="truncate flex-1 min-w-0">
                              {linkedStableId
                                ? overlayOptions.find(
                                    (o) => o.value === linkedStableId
                                  )?.label || linkedStableId
                                : t("No layer toggle")}
                            </span>
                            <CaretDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        </LayerPickerDropdown>
                      </div>
                      {group.rows.length > 1 ? (
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                const nextExcluded = new Set(
                                  settings.excludedRowKeys || []
                                );
                                if (checked) {
                                  nextExcluded.add(row.key);
                                } else {
                                  nextExcluded.delete(row.key);
                                }
                                onUpdateSettings({
                                  excludedRowKeys: Array.from(nextExcluded),
                                });
                              }}
                              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 flex-shrink-0 ${
                                checked
                                  ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                              }`}
                              aria-label={
                                checked
                                  ? t("Hide row from table")
                                  : t("Show row in table")
                              }
                            >
                              {checked ? (
                                <EyeOpenIcon className="w-4 h-4" />
                              ) : (
                                <EyeClosedIcon className="w-4 h-4" />
                              )}
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              side="right"
                              sideOffset={4}
                              className="bg-gray-900 text-white text-xs px-2 py-1.5 rounded shadow-lg z-[70] max-w-[200px]"
                            >
                              {checked
                                ? t("Click to hide this row from the table")
                                : t("Click to show this row in the table")}
                              <Tooltip.Arrow className="fill-gray-900" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      ) : (
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <span
                              className="flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 text-gray-300 cursor-not-allowed"
                              role="button"
                              aria-disabled="true"
                              aria-label={t("Row visibility (disabled)")}
                            >
                              <EyeOpenIcon className="w-4 h-4" />
                            </span>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              side="right"
                              sideOffset={4}
                              className="bg-gray-900 text-white text-xs px-2 py-1.5 rounded shadow-lg z-[70] max-w-[220px]"
                            >
                              {t(
                                "Row visibility can only be changed when this source has multiple rows. If you wish to remove this source entirely, click 'Source options'."
                              )}
                              <Tooltip.Arrow className="fill-gray-900" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {!groupedRows.length && (
              <div className="text-xs text-gray-500 px-3 py-2">
                {t("No rows available")}
              </div>
            )}
          </div>
        </Tooltip.Provider>
        <div className="px-3 py-2.5 border-t border-gray-200 bg-slate-50 rounded-b-lg flex-none">
          <div className="flex items-center gap-6">
            <ReportLayerMultiPicker
              onAdd={handleAddSources}
              excludeStableIds={currentSourceIds}
              allowedGeometryTypes={allowedGeometryTypes}
              side="left"
              align="center"
              sideOffset={18}
            >
              <button
                type="button"
                className="h-7 rounded bg-blue-600 hover:bg-blue-700 px-2.5 text-xs text-left flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 flex-shrink-0"
              >
                <PlusIcon className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
                <span className="text-white font-medium whitespace-nowrap">
                  {t("Add source(s)")}
                </span>
              </button>
            </ReportLayerMultiPicker>
            {onShowZerosChange !== undefined && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!showZeros}
                  onChange={(e) => onShowZerosChange(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                {t("Show rows with zero overlap")}
              </label>
            )}
            {onShowColorSwatchesChange !== undefined && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showColorSwatches ?? true}
                  onChange={(e) => onShowColorSwatchesChange(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                {t("Show color swatches")}
              </label>
            )}
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
