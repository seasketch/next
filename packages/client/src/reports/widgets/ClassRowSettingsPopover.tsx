import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Pencil2Icon, CaretDownIcon, TrashIcon } from "@radix-ui/react-icons";
import { LayerPickerDropdown, LayerPickerValue } from "./LayerPickerDropdown";
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
import { useReportContext } from "../ReportContext";
import getSlug from "../../getSlug";
import { useOverlaysForReportLayerTogglesQuery } from "../../generated/graphql";
import * as Tooltip from "@radix-ui/react-tooltip";
import { TooltipInfoIcon } from "../../editor/TooltipMenu";

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
          className="h-8 w-full truncate rounded border border-transparent hover:border-gray-300 px-2 pr-1.5 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-right"
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
      >
        <div className="max-h-64 overflow-auto space-y-1 pb-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 focus:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
              onClick={() => {
                onChange(opt.value === "__none__" ? undefined : opt.value);
                setOpen(false);
              }}
            >
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
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
};

export const ClassRowSettingsPopover = ({
  settings,
  onUpdateSettings,
  dependencies,
  sources,
  onUpdateDependencyParameters,
  onUpdateAllDependencies,
  t,
}: ClassRowSettingsPopoverProps) => {
  const overlayOptions = useOverlayOptionsForLayerToggle(t);
  const reportContext = useReportContext();
  // Hack to handle the fact that we sometimes don't have access to the titles of related table of contents items when the user adds a new source (e.g. when it hasn't been preprocessed yet)
  const [titlesByTableOfContentsItemId, setTitlesByTableOfContentsItemId] =
    useState<Record<number, string>>({});
  const { data } = useOverlaysForReportLayerTogglesQuery({
    variables: { slug: getSlug() },
  });

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
        .map((d) => d.tableOfContentsItemId)
        .filter((id): id is number => id !== undefined)
    );
  }, [dependencies]);

  // Create filtered options for LayerPickerDropdown, excluding already-used layers
  const filteredLayerOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        tableOfContentsItemId?: number;
        title: string;
        hasReportingOutput: boolean;
      }
    >();

    const items =
      data?.projectBySlug?.draftTableOfContentsItems?.filter(
        (i): i is NonNullable<typeof i> => !!i?.stableId
      ) || [];
    for (const item of items) {
      if (!item.stableId) continue;
      map.set(item.stableId, {
        tableOfContentsItemId:
          typeof item.id === "number" ? item.id : undefined,
        title: item.title || t("Unknown layer"),
        hasReportingOutput: !!item.reportingOutput,
      });
    }

    if (map.size === 0) {
      const allSources = [
        ...(reportContext.overlaySources || []),
        ...(reportContext.preprocessedOverlaySources || []),
      ];
      for (const s of allSources) {
        const sid = s.tableOfContentsItem?.stableId;
        if (!sid || map.has(sid)) continue;
        const tocId = s.tableOfContentsItemId;
        map.set(sid, {
          tableOfContentsItemId: typeof tocId === "number" ? tocId : undefined,
          title: s.tableOfContentsItem?.title || t("Unknown layer"),
          hasReportingOutput: false,
        });
      }
    }

    const options: Array<{
      stableId: string;
      title: string;
      tableOfContentsItemId?: number;
      reporting?: boolean;
    }> = [];
    for (const opt of overlayOptions) {
      const info = map.get(opt.value);
      if (!info) continue;
      // Filter out already-used layers
      if (
        info.tableOfContentsItemId &&
        currentSourceIds.has(info.tableOfContentsItemId)
      ) {
        continue;
      }
      options.push({
        stableId: opt.value,
        title: info.title,
        tableOfContentsItemId: info.tableOfContentsItemId,
        reporting: info.hasReportingOutput,
      });
    }
    return options;
  }, [
    data?.projectBySlug?.draftTableOfContentsItems,
    reportContext.overlaySources,
    reportContext.preprocessedOverlaySources,
    overlayOptions,
    currentSourceIds,
    t,
  ]);

  const handleAddSource = (layerValue: LayerPickerValue | undefined) => {
    if (!layerValue?.tableOfContentsItemId) return;
    // Don't add if already in use
    if (currentSourceIds.has(layerValue.tableOfContentsItemId)) return;
    if (!layerValue.tableOfContentsItemId) {
      return;
    }

    if (layerValue.tableOfContentsItemId) {
      setTitlesByTableOfContentsItemId((prev) => {
        const next = { ...prev };
        next[layerValue.tableOfContentsItemId!] = layerValue.title;
        return next;
      });
    }

    onUpdateAllDependencies((currentDeps) => {
      const newDeps = [...currentDeps];
      const params: Record<string, any> = {};
      if (bufferDistanceKm !== undefined) {
        params.bufferDistanceKm = bufferDistanceKm;
      }
      // Add fragments dependency
      newDeps.push({
        type: metricType,
        subjectType: "fragments",
        tableOfContentsItemId: layerValue.tableOfContentsItemId,
        parameters: params,
      });
      // Add geographies dependency
      newDeps.push({
        type: metricType,
        subjectType: "geographies",
        tableOfContentsItemId: layerValue.tableOfContentsItemId,
        parameters: params,
      });

      // add layer toggles to all sources (if not already set)
      // add custom label to the row so it doesn't just say "All features"

      const newSettings = {
        ...settings,
        rowLinkedStableIds: {
          ...settings.rowLinkedStableIds,
        },
        customRowLabels: {
          ...settings.customRowLabels,
        },
      };

      const allSources = [
        ...reportContext.overlaySources,
        ...reportContext.preprocessedOverlaySources,
      ];

      const fragmentDeps = newDeps.filter((d) => d.subjectType === "fragments");
      for (const dep of fragmentDeps) {
        if (dep.tableOfContentsItemId) {
          const relatedSource = allSources.find(
            (s) => s.tableOfContentsItemId === dep.tableOfContentsItemId
          );
          if (relatedSource && dep.parameters?.groupBy) {
            // set layer toggle for each key in the groupBy
            const values = Object.keys(
              relatedSource.geostats?.layers?.[0]?.attributes?.[
                dep.parameters?.groupBy
              ]?.values || {}
            );
            for (const value of values) {
              const rowKey = classTableRowKey(
                dep.tableOfContentsItemId!,
                value
              );
              if (!(rowKey in newSettings.rowLinkedStableIds)) {
                newSettings.rowLinkedStableIds[rowKey] =
                  relatedSource.tableOfContentsItem?.stableId;
              }
            }
          } else {
            // set layer toggle
            const stableId =
              relatedSource?.tableOfContentsItem?.stableId ||
              (layerValue.tableOfContentsItemId === dep.tableOfContentsItemId
                ? layerValue.stableId
                : undefined);
            if (stableId) {
              const rowKey = classTableRowKey(dep.tableOfContentsItemId!, "*");
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

  const handleRemoveSource = (sourceId: number) => {
    onUpdateAllDependencies((currentDeps) => {
      return currentDeps.filter((d) => d.tableOfContentsItemId !== sourceId);
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
    const allSources = [
      ...reportContext.overlaySources,
      ...reportContext.preprocessedOverlaySources,
    ];
    for (const row of rows) {
      const source = allSources.find(
        (s) => String(s.tableOfContentsItemId) === row.sourceId
      );
      const title =
        source?.tableOfContentsItem?.title ||
        titlesByTableOfContentsItemId[parseInt(row.sourceId)] ||
        t("Unknown source") ||
        "";
      if (!groups[row.sourceId]) {
        groups[row.sourceId] = { title, rows: [], source };
      }
      groups[row.sourceId].rows.push(row);
    }
    return Object.values(groups).sort((a, b) => a.title.localeCompare(b.title));
  }, [rows, sources, t]);

  const excludedSet = useMemo(
    () => new Set(settings.excludedRowKeys || []),
    [settings.excludedRowKeys]
  );

  const currentGroupByBySource = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    (dependencies || []).forEach((d) => {
      if (d.tableOfContentsItemId !== undefined) {
        map[String(d.tableOfContentsItemId)] = d.parameters?.groupBy;
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
      map[String(source.tableOfContentsItemId)] = options;
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
        className="bg-white rounded-lg shadow-lg border border-gray-200 p-0 w-[680px] max-h-128 flex flex-col"
      >
        <div className="text-xs px-3 py-3 shadow-sm z-10 grid grid-cols-3 gap-2 items-center font-semibold uppercase tracking-wide text-gray-500 bg-white border-b rounded-t-lg flex-none">
          <div className="pl-1 flex items-center gap-1">
            <button autoFocus></button>
            {t("Included Rows")}
            <TooltipInfoIcon
              content={t(
                "Uncheck any rows you would like to exclude from the table."
              )}
              ariaLabel={t("Included rows help")}
            />
          </div>
          <div className="pl-2 flex items-center gap-1">
            {t("Label")}
            <TooltipInfoIcon
              content={t(
                "Customized labels will appear in the table, replacing default values."
              )}
              ariaLabel={t("Label help")}
            />
          </div>
          <div className="pl-2 flex items-center gap-1">
            {t("Map Layer Toggle")}
            <TooltipInfoIcon
              content={t(
                "If provided, a column will appear in the table with inputs for toggling linked data layers on the map. These may be the same layer used in the analysis, or in a different derivative visualization layer of your choosing."
              )}
              ariaLabel={t("Map layer toggle help")}
            />
          </div>
        </div>
        <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
          {groupedRows.map((group) => (
            <div key={group.title}>
              <div className="px-3 py-2 font-semibold text-gray-600 bg-blue-50/20 border-b flex items-center space-x-2">
                <span className="text-sm truncate font-light text-gray-400 whitespace-nowrap flex-1">
                  {group.title}
                </span>
                <div className="w-42 flex items-center overflow-hidden space-x-2">
                  <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold flex-none ">
                    {t("Group by")}
                  </span>
                  <GroupByPicker
                    value={
                      currentGroupByBySource[
                      String(group.source?.tableOfContentsItemId)
                      ]
                    }
                    options={
                      groupByOptionsBySource[
                      String(group.source?.tableOfContentsItemId)
                      ] || [{ value: "__none__", label: t("None") }]
                    }
                    placeholder={t("None")}
                    onChange={(groupByValue) => {
                      const targetId = group.source?.tableOfContentsItemId;
                      if (!targetId) return;
                      onUpdateDependencyParameters((dependency) => {
                        const nextParams = {
                          ...(dependency.parameters || {}),
                        };
                        if (dependency.tableOfContentsItemId === targetId) {
                          nextParams.groupBy = groupByValue;
                        }
                        return nextParams;
                      });
                    }}
                  />
                </div>
                {groupedRows.length > 1 &&
                  group.source?.tableOfContentsItemId && (
                    <Tooltip.Provider delayDuration={100}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveSource(
                                group.source!.tableOfContentsItemId!
                              )
                            }
                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            side="top"
                            align="center"
                            sideOffset={6}
                            className="bg-gray-900 text-white text-[11px] px-2 py-1 rounded shadow-lg z-[60]"
                          >
                            {t("Remove source")}
                            <Tooltip.Arrow className="fill-gray-900" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  )}
              </div>

              {group.rows.map((row) => {
                const checked = !excludedSet.has(row.key);
                const linkedStableId = settings.rowLinkedStableIds?.[row.key];
                const customLabel = settings.customRowLabels?.[row.key] || "";
                const tableOfContentsItemId = row.sourceId
                  ? parseInt(row.sourceId)
                  : undefined;
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-3 gap-2 px-3 py-2 items-center"
                  // style={{
                  //   gridTemplateColumns:
                  //     "minmax(0,200px) minmax(0,200px) minmax(0,200px)",
                  // }}
                  >
                    <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={checked}
                        onChange={(e) => {
                          const nextExcluded = new Set(
                            settings.excludedRowKeys || []
                          );
                          if (e.target.checked) {
                            nextExcluded.delete(row.key);
                          } else {
                            nextExcluded.add(row.key);
                          }
                          onUpdateSettings({
                            excludedRowKeys: Array.from(nextExcluded),
                          });
                        }}
                      />
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900">
                        {row.groupByKey === "*"
                          ? t("All features")
                          : row.groupByKey}
                      </span>
                    </label>
                    <input
                      type="text"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={row.label}
                      value={customLabel}
                      onChange={(e) => {
                        onUpdateSettings({
                          customRowLabels: {
                            ...(settings.customRowLabels || {}),
                            [row.key]: e.target.value,
                          },
                        });
                      }}
                    />
                    <LayerPickerDropdown
                      suggested={
                        tableOfContentsItemId
                          ? [tableOfContentsItemId]
                          : undefined
                      }
                      value={linkedStableId}
                      onChange={(layerValue) => {
                        const next = { ...(settings.rowLinkedStableIds || {}) };
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
                      title={t("Choose a layer")}
                      description={t(
                        "An input will be shown to toggle the chosen layer on the map."
                      )}
                    >
                      <button
                        type="button"
                        className="h-8 w-full rounded border border-gray-300 px-2 pr-1.5 text-sm text-left flex items-center justify-between gap-2 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <span className="truncate flex-1 min-w-0">
                          {linkedStableId
                            ? overlayOptions.find(
                              (o) => o.value === linkedStableId
                            )?.label || linkedStableId
                            : t("None")}
                        </span>
                        <CaretDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </button>
                    </LayerPickerDropdown>
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
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 shadow-sm z-10">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            {t("Add a Source")}
          </div>
          <p className="text-xs text-gray-500 pb-2">
            {t(
              `Rows can be added to this table by using the "Group by" option, adding multiple sources, or some combination.`
            )}
          </p>
          <LayerPickerDropdown
            value={undefined}
            onChange={handleAddSource}
            required={false}
            onlyReportingLayers={false}
            hideSearch={false}
            optionsOverride={filteredLayerOptions}
          >
            <button
              type="button"
              className="h-8 rounded border border-gray-300 px-2 pr-1.5 text-sm text-left flex items-center justify-between gap-2 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-72"
            >
              <span className="truncate flex-1 text-gray-500">
                {t("Select layer to add...")}
              </span>
              <CaretDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
          </LayerPickerDropdown>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
