import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  MetricDependency,
  subjectIsFragment,
  combineMetricsForFragments,
  PresenceTableMetric,
  Metric,
} from "overlay-engine";
import { ReportWidget } from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipPopoverContent,
} from "../../editor/TooltipMenu";
import { LabeledDropdown } from "./LabeledDropdown";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { useReportContext } from "../ReportContext";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import { CaretDownIcon, Pencil2Icon } from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";

type PresenceTableValue = {
  __id: number;
  [attribute: string]: any;
};
type IntersectingFeaturesListSettings = {
  labelColumn?: string;
  maxDisplayItems?: number;
  hiddenColumns?: string[];
};

const DEFAULT_MAX_DISPLAY_ITEMS = 10;

export const IntersectingFeaturesList: ReportWidget<
  IntersectingFeaturesListSettings
> = ({ metrics, componentSettings, sources, loading }) => {
  const { t } = useTranslation("reports");
  const [showAll, setShowAll] = useState(false);

  const labelColumn = componentSettings.labelColumn;
  const maxDisplayItems =
    componentSettings.maxDisplayItems ?? DEFAULT_MAX_DISPLAY_ITEMS;

  // Combine fragment metrics using combineMetricsForFragments
  const tableData = useMemo(() => {
    if (loading) {
      return { values: [], exceededLimit: false, maxResults: 25 };
    }

    const fragmentMetrics = metrics.filter(
      (m) => subjectIsFragment(m.subject) && m.type === "presence_table"
    );

    if (fragmentMetrics.length === 0) {
      return { values: [], exceededLimit: false, maxResults: 25 };
    }

    // Filter valid metrics
    const validMetrics = fragmentMetrics
      .filter((m) => {
        const value = m.value;
        return (
          value !== null &&
          value !== undefined &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          "values" in value
        );
      })
      .map((m) => ({
        type: m.type,
        value: m.value,
      })) as Pick<Metric, "type" | "value">[];

    if (validMetrics.length === 0) {
      return { values: [], exceededLimit: false, maxResults: 25 };
    }

    try {
      const combined = combineMetricsForFragments(
        validMetrics
      ) as PresenceTableMetric;

      // Get maxResults from the first metric's parameters
      const maxResults =
        (fragmentMetrics[0]?.parameters as any)?.maxResults ?? 25;

      return {
        values: combined.value.values,
        exceededLimit: combined.value.exceededLimit,
        maxResults,
      };
    } catch (error) {
      console.error("Failed to combine presence_table metrics:", error);
      return { values: [], exceededLimit: false, maxResults: 25 };
    }
  }, [metrics, loading]);

  // Get available label columns from geostats
  const availableLabelColumns = useMemo(() => {
    const source = sources?.[0];
    if (!source?.geostats) return [];

    const geoLayer = isGeostatsLayer(
      (source.geostats as any)?.layers?.[0] as GeostatsLayer
    )
      ? ((source.geostats as any).layers[0] as GeostatsLayer)
      : undefined;

    if (!geoLayer?.attributes) return [];

    // Get all unique property keys from the values
    const keys = new Set<string>();
    for (const value of tableData.values) {
      if (value && typeof value === "object") {
        for (const key in value) {
          if (key !== "__id") {
            keys.add(key);
          }
        }
      }
    }

    // Filter to only attributes that exist in both geostats and the values
    return geoLayer.attributes
      .filter((attr) => keys.has(attr.attribute))
      .map((attr) => attr.attribute)
      .sort();
  }, [sources, tableData.values]);

  // Determine the label column to use
  const effectiveLabelColumn = useMemo(() => {
    if (labelColumn && availableLabelColumns.includes(labelColumn)) {
      return labelColumn;
    }
    // Fall back to first available column, or first property in values
    if (availableLabelColumns.length > 0) {
      return availableLabelColumns[0];
    }
    // Last resort: use first property from values
    if (tableData.values.length > 0) {
      const firstValue = tableData.values[0];
      if (firstValue && typeof firstValue === "object") {
        for (const key in firstValue) {
          if (key !== "__id") {
            return key;
          }
        }
      }
    }
    return undefined;
  }, [labelColumn, availableLabelColumns, tableData.values]);

  // Get all property keys from values (for displaying in accordion)
  // Filter out hidden columns
  const allPropertyKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const value of tableData.values) {
      if (value && typeof value === "object") {
        for (const key in value) {
          if (key !== "__id") {
            keys.add(key);
          }
        }
      }
    }
    const hiddenColumns = componentSettings.hiddenColumns || [];
    return Array.from(keys)
      .filter((key) => !hiddenColumns.includes(key))
      .sort();
  }, [tableData.values, componentSettings.hiddenColumns]);

  const displayedValues = showAll
    ? tableData.values
    : tableData.values.slice(0, maxDisplayItems);
  const hasMore = tableData.values.length > maxDisplayItems;

  if (!loading && tableData.values.length === 0) {
    return (
      <div className="border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No overlapping features found.</Trans>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="space-y-1">
        {loading && displayedValues.length === 0 ? (
          <div className="px-3 py-2 bg-white border border-gray-200 rounded text-sm">
            <MetricLoadingDots />
          </div>
        ) : (
          displayedValues.map((value, index) => {
            const labelValue =
              effectiveLabelColumn && value[effectiveLabelColumn];
            const label =
              labelValue != null
                ? String(labelValue)
                : `${t("Feature")} ${index + 1}`;
            return (
              <FeatureAccordionItem
                key={value.__id ?? index}
                title={label}
                value={value}
                propertyKeys={allPropertyKeys}
              />
            );
          })
        )}
        {hasMore && !showAll && (
          <div className="w-full text-center pt-2">
            <button
              onClick={() => setShowAll(true)}
              className="px-3 py-1 rounded-full border border-gray-300 text-sm hover:bg-gray-50"
            >
              {t("Show all ({{count}})", {
                count: tableData.values.length,
              })}
            </button>
          </div>
        )}
        {hasMore && showAll && (
          <div className="w-full text-center pt-2">
            <button
              onClick={() => setShowAll(false)}
              className="px-3 py-1 rounded-full border border-gray-300 text-sm hover:bg-gray-50"
            >
              {t("Show less")}
            </button>
          </div>
        )}
      </div>
      {tableData.exceededLimit && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          <Trans ns="reports">
            Showing first {{ limit: tableData.maxResults }} results.
          </Trans>
        </div>
      )}
    </div>
  );
};

function FeatureAccordionItem({
  title,
  value,
  propertyKeys,
}: {
  title: string;
  value: PresenceTableValue;
  propertyKeys: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded text-sm border-gray-300 bg-slate-50 overflow-clip">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`px-2 py-1 text-left w-full flex items-center space-x-1 ${
          open ? "border-b border-gray-300" : ""
        }`}
      >
        <div className="flex-1 truncate">{title}</div>
        <CaretDownIcon
          className={`w-4 h-4 transition-transform ${
            open ? "transform rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto bg-white">
          <table className="w-full">
            <tbody>
              {propertyKeys.map((prop, index) => {
                const propValue = value[prop];
                return (
                  <tr
                    className={`border-b last:border-none border-slate-200 text-left ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                    key={prop}
                  >
                    <td className="font-thin p-1 px-2 text-left w-1/3 truncate">
                      {prop}
                    </td>
                    <td className="p-1 px-2">
                      {propValue != null ? String(propValue) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const IntersectingFeaturesListTooltipControls: ReportWidgetTooltipControls =
  ({ node, onUpdate }) => {
    const { t } = useTranslation("admin:reports");
    const reportContext = useReportContext();
    const settings: IntersectingFeaturesListSettings = useMemo(
      () => node.attrs?.componentSettings || {},
      [node.attrs?.componentSettings]
    );

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

    // Get available label columns from geostats
    const labelColumnOptions = useMemo(() => {
      const source = sources?.[0];
      if (!source?.geostats) return [];

      const geoLayer = isGeostatsLayer(
        (source.geostats as any)?.layers?.[0] as GeostatsLayer
      )
        ? ((source.geostats as any).layers[0] as GeostatsLayer)
        : undefined;

      if (!geoLayer?.attributes) return [];

      return geoLayer.attributes
        .map((attr) => attr.attribute)
        .sort()
        .map((attr) => ({
          value: attr,
          label: attr,
        }));
    }, [sources]);

    // Get all available columns from geostats attributes
    // These represent all possible columns that could appear in the values
    const allAvailableColumns = useMemo(() => {
      const source = sources?.[0];
      if (!source?.geostats) {
        return [];
      }

      const geoLayer = isGeostatsLayer(
        (source.geostats as any)?.layers?.[0] as GeostatsLayer
      )
        ? ((source.geostats as any).layers[0] as GeostatsLayer)
        : undefined;

      if (!geoLayer?.attributes) {
        return [];
      }

      return geoLayer.attributes.map((attr) => attr.attribute).sort();
    }, [sources]);

    const handleUpdate = (patch: Partial<IntersectingFeaturesListSettings>) => {
      onUpdate({
        componentSettings: {
          ...settings,
          ...patch,
        },
      });
    };

    const handleColumnToggle = (columnName: string, checked: boolean) => {
      const hiddenColumns = settings.hiddenColumns || [];
      if (checked) {
        // Column should be visible - remove from hiddenColumns
        const updated = hiddenColumns.filter((col) => col !== columnName);
        handleUpdate({
          hiddenColumns: updated.length > 0 ? updated : undefined,
        });
      } else {
        // Column should be hidden - add to hiddenColumns
        handleUpdate({
          hiddenColumns: [...hiddenColumns, columnName],
        });
      }
    };

    const [isColumnsPopoverOpen, setIsColumnsPopoverOpen] = useState(false);

    return (
      <div className="flex gap-3 items-center text-sm text-gray-800">
        {labelColumnOptions.length > 0 && (
          <LabeledDropdown
            label={t("label column")}
            value={settings.labelColumn || labelColumnOptions[0]?.value || ""}
            options={labelColumnOptions}
            onChange={(val) => handleUpdate({ labelColumn: val })}
          />
        )}
        <LabeledDropdown
          label={t("max displayed")}
          value={String(settings.maxDisplayItems ?? DEFAULT_MAX_DISPLAY_ITEMS)}
          options={[
            { value: "5", label: "5" },
            { value: "8", label: "8" },
            { value: "10", label: "10" },
            { value: "12", label: "12" },
            { value: "20", label: "20" },
            { value: "25", label: "25" },
          ]}
          onChange={(val) => handleUpdate({ maxDisplayItems: Number(val) })}
        />
        {allAvailableColumns.length > 0 && (
          <Popover.Root
            open={isColumnsPopoverOpen}
            onOpenChange={setIsColumnsPopoverOpen}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none"
              >
                <Pencil2Icon className="w-3 h-3" />
                {t("columns")}
              </button>
            </Popover.Trigger>
            <TooltipPopoverContent title={t("columns")}>
              <div className="space-y-2 px-1 max-h-64 overflow-y-auto">
                {allAvailableColumns.map((columnName) => {
                  const hiddenColumns = settings.hiddenColumns || [];
                  const isVisible = !hiddenColumns.includes(columnName);
                  return (
                    <label
                      key={columnName}
                      className="flex items-center text-gray-700 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-2"
                        checked={isVisible}
                        onChange={(e) =>
                          handleColumnToggle(columnName, e.target.checked)
                        }
                      />
                      <span className="flex-1">{columnName}</span>
                    </label>
                  );
                })}
              </div>
            </TooltipPopoverContent>
          </Popover.Root>
        )}
      </div>
    );
  };
