import { useMemo, useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/outline";
import {
  MetricDependency,
  subjectIsFragment,
  subjectIsGeography,
} from "overlay-engine";
import {
  ReportWidget,
  TooltipBooleanConfigurationOption,
  TableHeadingsEditor,
} from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
} from "../../editor/TooltipMenu";
import { LabeledDropdown } from "./LabeledDropdown";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { UnitSelector } from "./UnitSelector";
import { AreaUnit } from "../utils/units";
import {
  extractColorForLayers,
  extractColorsForCategories,
} from "../utils/colors";
import { AnyLayer } from "mapbox-gl";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import { NumberRoundingControl } from "./NumberRoundingControl";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { useReportContext } from "../ReportContext";

// Accept both area and length style units; default to km (area).
type OverlapUnit = "km" | "mi" | "acres" | "ha";

type OverlappingAreasTableSettings = {
  unit?: OverlapUnit;
  showZeroOverlapCategories?: boolean;
  sortBy?: "overlap" | "name";
  bufferMeters?: number;
  minimumFractionDigits?: number;
  rowsPerPage?: number;
  nameLabel?: string;
  areaLabel?: string;
  percentWithinLabel?: string;
  showPercentColumn?: boolean;
};

type OverlapRow = {
  key: string;
  label: string;
  overlap: number;
  geographyTotal?: number;
  color?: string;
};

const overlapUnitToAreaUnit: Record<OverlapUnit, AreaUnit> = {
  km: "kilometer",
  mi: "mile",
  acres: "acre",
  ha: "hectare",
};

const areaUnitToOverlapUnit: Record<AreaUnit, OverlapUnit> = {
  kilometer: "km",
  mile: "mi",
  acre: "acres",
  hectare: "ha",
};

export const OverlappingAreasTable: ReportWidget<
  OverlappingAreasTableSettings
> = ({ metrics, componentSettings, sources, loading }) => {
  const { t } = useTranslation("reports");
  const [currentPage, setCurrentPage] = useState(1);

  const unit: OverlapUnit = componentSettings.unit || "km";
  const showZero = componentSettings.showZeroOverlapCategories ?? false;
  const sortBy = componentSettings.sortBy || "overlap";
  const rowsPerPage = componentSettings.rowsPerPage ?? 10;
  const showPercentColumn = componentSettings.showPercentColumn ?? true;
  const nameLabel = componentSettings.nameLabel || t("Name");
  const areaLabel = componentSettings.areaLabel || t("Area");
  const percentWithinLabel =
    componentSettings.percentWithinLabel || t("% Within");

  const formatters = useNumberFormatters({
    unit:
      unit === "km"
        ? "kilometer"
        : unit === "mi"
        ? "mile"
        : unit === "acres"
        ? "acre"
        : "hectare",
    unitDisplay: "short",
    minimumFractionDigits: componentSettings.minimumFractionDigits,
  });

  const groupBy = useMemo(() => {
    const frag = metrics.find((m) => subjectIsFragment(m.subject));
    const params = (frag?.parameters || {}) as any;
    return params.groupBy || params.group_by || undefined;
  }, [metrics]);

  const rows = useMemo<OverlapRow[]>(() => {
    const fragmentMetrics = metrics.filter((m) => subjectIsFragment(m.subject));
    const geographyMetrics = metrics.filter((m) =>
      subjectIsGeography(m.subject)
    );

    const rowMap: Record<string, OverlapRow> = {};

    for (const m of fragmentMetrics) {
      const value = m.value;
      if (value && typeof value === "object") {
        for (const [key, v] of Object.entries(
          value as Record<string, number>
        )) {
          if (!rowMap[key]) {
            rowMap[key] = { key, overlap: 0, label: key };
          }
          rowMap[key].overlap += v || 0;
        }
      } else if (typeof value === "number") {
        const key = "*";
        if (!rowMap[key]) {
          rowMap[key] = { key, overlap: 0, label: key };
        }
        rowMap[key].overlap += value;
      }
    }

    for (const gm of geographyMetrics) {
      const value = gm.value;
      if (value && typeof value === "object") {
        for (const [key, v] of Object.entries(
          value as Record<string, number>
        )) {
          if (!rowMap[key]) {
            rowMap[key] = { key, overlap: 0, label: key };
          }
          rowMap[key].geographyTotal =
            (rowMap[key].geographyTotal || 0) + (v || 0);
        }
      } else if (typeof value === "number") {
        const key = "*";
        if (!rowMap[key]) {
          rowMap[key] = { key, overlap: 0, label: key };
        }
        rowMap[key].geographyTotal = (rowMap[key].geographyTotal || 0) + value;
      }
    }

    let rows = Object.values(rowMap);
    if (rows.length === 0) return [];

    if (sortBy === "name") {
      rows = rows.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      rows = rows.sort((a, b) => (b.overlap ?? 0) - (a.overlap ?? 0));
    }

    if (!showZero) {
      rows = rows.filter((r) => r.overlap !== 0);
    }

    if (groupBy) {
      rows = rows.filter((r) => r.key !== "*");
    }

    return rows;
  }, [metrics, showZero, sortBy, groupBy]);

  const placeholderRows = useMemo<OverlapRow[]>(() => {
    if (!loading) return [];
    const source = sources?.[0];
    const geoLayer = isGeostatsLayer(
      (source?.geostats as any)?.layers?.[0] as GeostatsLayer
    )
      ? ((source!.geostats as any).layers[0] as GeostatsLayer)
      : undefined;
    const defaultKeys = ["…", "…", "…"];
    let keys: string[] = defaultKeys;
    if (groupBy && geoLayer) {
      const attr = geoLayer.attributes?.find((a) => a.attribute === groupBy);
      if (attr) {
        keys = Object.keys(attr.values || {});
      }
    }
    if (!showZero) {
      keys = keys.slice(0, 5);
    }
    if (!keys.length) {
      keys = defaultKeys;
    }
    return keys.map((k, i) => ({
      key: "placeholder-" + i,
      overlap: 0,
      label: k,
    }));
  }, [loading, sources, groupBy, showZero]);

  const colorMap = useMemo<Record<string, string>>(() => {
    const baseRows = loading ? placeholderRows : rows;
    if (!baseRows.length || !sources?.length) return {};
    const source = sources[0];
    const mapboxStyles = (source.mapboxGlStyles || []) as AnyLayer[];
    const geoLayer = isGeostatsLayer(
      (source.geostats as any)?.layers?.[0] as GeostatsLayer
    )
      ? ((source.geostats as any).layers[0] as GeostatsLayer)
      : undefined;

    const defaultColor = extractColorForLayers(mapboxStyles);

    if (groupBy && geoLayer) {
      const attr = geoLayer.attributes?.find((a) => a.attribute === groupBy);
      if (attr) {
        const colors = extractColorsForCategories(
          Object.keys(attr.values || {}),
          attr,
          mapboxStyles
        );
        const map: Record<string, string> = {};
        for (const key of Object.keys(colors)) {
          map[key] = colors[key];
        }
        map["*"] = map["*"] || defaultColor;
        return map;
      }
    }

    return { "*": defaultColor };
  }, [rows, placeholderRows, sources, groupBy, loading]);

  const displayRows = loading ? placeholderRows : rows;
  const totalRows = displayRows.length;
  const showPagination = rowsPerPage > 0 && totalRows > rowsPerPage;
  const totalPages = showPagination ? Math.ceil(totalRows / rowsPerPage) : 1;

  // Reset to page 1 when rows change or rowsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [totalRows, rowsPerPage]);

  // Calculate paginated rows
  const paginatedRows = useMemo(() => {
    if (!showPagination) return displayRows;
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return displayRows.slice(startIndex, endIndex);
  }, [displayRows, currentPage, showPagination, rowsPerPage]);

  // Calculate padding rows needed for last page
  const paddingRowsCount = useMemo(() => {
    if (!showPagination || paginatedRows.length >= rowsPerPage) return 0;
    return rowsPerPage - paginatedRows.length;
  }, [showPagination, paginatedRows.length, rowsPerPage]);

  if (!loading && !rows.length) {
    return (
      <div className="border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No overlapping features found.</Trans>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {/* Header row */}
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
          {/* <div className="flex-none w-4 flex justify-center" /> */}
          <div className="flex-1 min-w-0 text-gray-600 text-xs font-semibold uppercase tracking-wide">
            {nameLabel}
          </div>
          <div className="flex-none text-center text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[80px]">
            {areaLabel}
          </div>
          {showPercentColumn && (
            <div className="flex-none text-right text-gray-600 text-xs font-semibold uppercase tracking-wide min-w-[70px]">
              {percentWithinLabel}
            </div>
          )}
        </div>
        {paginatedRows.map((row) => {
          const color = colorMap[row.key] ?? colorMap["*"] ?? undefined;
          const percent =
            !loading &&
            typeof row.geographyTotal === "number" &&
            row.geographyTotal > 0
              ? row.overlap / row.geographyTotal
              : undefined;
          const hasColor =
            color && color !== "#00000000" && color !== "transparent";
          return (
            <div
              key={row.key}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                row.overlap === 0 ? "opacity-50" : ""
              }`}
            >
              {hasColor && (
                <div className="flex-none w-4 flex justify-center">
                  <span
                    className="inline-block w-4 h-4 rounded-sm border border-black/10"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 text-gray-800 text-sm">
                <span
                  className="truncate block"
                  title={row.key === "*" ? t("All features") : row.key}
                >
                  {row.key === "*" ? t("All features") : row.label}
                </span>
              </div>
              <div className="flex-none text-right text-gray-900 tabular-nums text-sm min-w-[80px]">
                {loading ? <MetricLoadingDots /> : formatters.area(row.overlap)}
              </div>
              {showPercentColumn && (
                <div className="flex-none text-right text-gray-700 tabular-nums text-sm min-w-[70px]">
                  {loading ? (
                    <MetricLoadingDots />
                  ) : typeof percent === "number" ? (
                    formatters.percent(percent)
                  ) : (
                    "—"
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* Padding rows to maintain consistent height */}
        {Array.from({ length: paddingRowsCount }).map((_, i) => (
          <div
            key={`padding-${i}`}
            className="flex items-center gap-3 px-3 py-2 bg-gray-50/30"
            aria-hidden="true"
          >
            <div className="flex-none w-4 flex justify-center" />
            <div className="flex-1 min-w-0 text-gray-800 text-sm">
              <span className="truncate block invisible">.</span>
            </div>
            <div className="flex-none text-right text-gray-900 tabular-nums text-sm min-w-[80px]">
              <span className="invisible">0</span>
            </div>
            {showPercentColumn && (
              <div className="flex-none text-right text-gray-700 tabular-nums text-sm min-w-[70px]">
                <span className="invisible">&nbsp;</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {showPagination && (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {t("Showing {{start}}–{{end}} of {{total}}", {
              start: (currentPage - 1) * rowsPerPage + 1,
              end: Math.min(currentPage * rowsPerPage, totalRows),
              total: totalRows,
            })}
          </div>
          <nav
            className="isolate inline-flex -space-x-px rounded-md shadow-sm"
            aria-label="Pagination"
          >
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`${
                currentPage === 1
                  ? "pointer-events-none opacity-25"
                  : "hover:bg-gray-50"
              } relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 focus:z-20 focus:outline-none`}
            >
              <span className="sr-only">{t("Previous")}</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className={`${
                currentPage === totalPages
                  ? "pointer-events-none opacity-25"
                  : "hover:bg-gray-50"
              } relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 focus:z-20 focus:outline-none`}
            >
              <span className="sr-only">{t("Next")}</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export const OverlappingAreasTableTooltipControls: ReportWidgetTooltipControls =
  ({ node, onUpdate, onUpdateDependencyParameters }) => {
    const { t } = useTranslation("admin:reports");
    const reportContext = useReportContext();
    const settings: OverlappingAreasTableSettings = useMemo(
      () => node.attrs?.componentSettings || {},
      [node.attrs?.componentSettings]
    );

    const unit: OverlapUnit = settings.unit || "km";
    const showZero = settings.showZeroOverlapCategories ?? false;
    const sortBy = settings.sortBy || "overlap";
    const rowsPerPage = settings.rowsPerPage ?? 10;
    const showPercentColumn = settings.showPercentColumn ?? true;

    // Get sources from report context
    const sources = useMemo(() => {
      const dependencies = (node.attrs?.metrics || []) as MetricDependency[];
      const allSources = [
        ...(reportContext.overlaySources || []),
        ...(reportContext.adminSources || []),
      ];
      return allSources.filter((s) =>
        dependencies.some(
          (d) => d.tableOfContentsItemId === s.tableOfContentsItemId
        )
      );
    }, [
      node.attrs?.metrics,
      reportContext.overlaySources,
      reportContext.adminSources,
    ]);

    // Get current groupBy from dependencies
    const currentGroupBy = useMemo(() => {
      const dependencies = (node.attrs?.metrics || []) as MetricDependency[];
      const dep = dependencies.find((d) => d.parameters?.groupBy !== undefined);
      return dep?.parameters?.groupBy || undefined;
    }, [node.attrs?.metrics]);

    // Get available groupBy columns from geostats
    const groupByOptions = useMemo(() => {
      const options: Array<{ value: string; label: React.ReactNode }> = [
        { value: "__none__", label: t("None") },
      ];

      const source = sources?.[0];
      if (!source?.geostats) return options;

      const geoLayer = isGeostatsLayer(
        (source.geostats as any)?.layers?.[0] as GeostatsLayer
      )
        ? ((source.geostats as any).layers[0] as GeostatsLayer)
        : undefined;

      if (!geoLayer?.attributes) return options;

      for (const attr of geoLayer.attributes) {
        const isString = attr.type === "string";
        const distinctCount = Object.keys(attr.values || {}).length;
        const isNumericWithFewValues =
          attr.type === "number" && distinctCount <= 10;

        if (isString || isNumericWithFewValues) {
          // Get example values (up to 5)
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

      return options;
    }, [sources, t]);

    const handleUpdate = (patch: Partial<OverlappingAreasTableSettings>) => {
      onUpdate({
        componentSettings: {
          ...settings,
          ...patch,
        },
      });
    };

    const buffer = ((node.attrs?.metrics || []) as MetricDependency[]).find(
      (m) => m.parameters?.bufferDistanceKm !== undefined
    )?.parameters?.bufferDistanceKm;

    const sortOptions = [
      { value: "overlap", label: t("Overlap") },
      { value: "name", label: t("Name") },
    ];

    const selectedAreaUnit = overlapUnitToAreaUnit[unit];

    const handleBufferClick = () => {
      const currentValue = buffer !== undefined ? String(buffer) : "0";
      const value = window.prompt(
        t("Enter buffer distance in kilometers (or 0 for none)"),
        currentValue
      );
      if (value === null) {
        // User cancelled
        return;
      }
      const numValue = value === "" || value === "0" ? 0 : Number(value);
      onUpdateDependencyParameters((dependency) => {
        if (dependency.subjectType === "geographies") {
          return {
            ...dependency.parameters,
            bufferDistanceKm: undefined,
          };
        } else {
          return {
            ...dependency.parameters,
            bufferDistanceKm: numValue === 0 ? undefined : numValue,
          };
        }
      });
    };

    const bufferFormatter = useNumberFormatters({
      unit: "kilometer",
      unitDisplay: "short",
    });

    return (
      <div className="flex gap-3 items-center text-sm text-gray-800">
        <UnitSelector
          unitType="area"
          value={selectedAreaUnit}
          onChange={(val: AreaUnit) =>
            handleUpdate({ unit: areaUnitToOverlapUnit[val] })
          }
          unitDisplay="short"
        />
        <NumberRoundingControl
          value={settings.minimumFractionDigits}
          onChange={(minimumFractionDigits) =>
            handleUpdate({
              minimumFractionDigits,
            })
          }
        />
        <LabeledDropdown
          label={t("Sort by")}
          value={sortBy}
          options={sortOptions}
          onChange={(val) =>
            handleUpdate({ sortBy: val as "overlap" | "name" })
          }
        />
        <TableHeadingsEditor
          labelKeys={["nameLabel", "areaLabel", "percentWithinLabel"]}
          labelDisplayNames={["Name", "Area", "% Within"]}
          componentSettings={settings}
          onUpdate={onUpdate}
        />
        <TooltipMorePopover>
          {/* <button
            type="button"
            onClick={handleBufferClick}
            className="w-full text-left text-sm rounded hover:text-black focus:outline-none flex items-center space-x-2"
          >
            <span className="font-light text-gray-400">{t("Buffer")}</span>
            <span className="flex-1 text-right hover:ring hover:ring-blue-300/20">
              {bufferFormatter.distance(buffer ?? 0)}
            </span>
          </button> */}
          <TooltipBooleanConfigurationOption
            label={t("Show zeros")}
            checked={showZero}
            onChange={(next) =>
              handleUpdate({ showZeroOverlapCategories: next })
            }
          />
          <TooltipBooleanConfigurationOption
            label={t("Show % column")}
            checked={showPercentColumn}
            onChange={(next) => handleUpdate({ showPercentColumn: next })}
          />
          <LabeledDropdown
            label={t("Group by")}
            value={currentGroupBy || "__none__"}
            options={groupByOptions}
            getDisplayLabel={(selected) => {
              if (!selected || selected.value === "__none__") {
                return t("None");
              }
              // Show just the column name in the trigger
              return selected.value;
            }}
            onChange={(val) => {
              const groupByValue = val === "__none__" ? undefined : val;
              onUpdateDependencyParameters((dependency) => {
                return {
                  ...dependency.parameters,
                  groupBy: groupByValue,
                };
              });
            }}
          />
          <LabeledDropdown
            label={t("Pagination")}
            value={rowsPerPage === 0 ? "None" : String(rowsPerPage)}
            options={[
              { value: "None", label: t("None") },
              { value: "10", label: "10 items" },
              { value: "12", label: "12 items" },
              { value: "15", label: "15 items" },
              { value: "20", label: "20 items" },
            ]}
            onChange={(val) =>
              handleUpdate({
                rowsPerPage: val === "None" ? 0 : Number(val),
              })
            }
          />
        </TooltipMorePopover>
      </div>
    );
  };
