import { ReportCardConfiguration, ReportCardProps } from "./cards";
import {
  registerReportCardType,
  ReportCardConfigUpdateCallback,
} from "../registerCard";
import { Trans, useTranslation } from "react-i18next";
import { TableIcon, ValueNoneIcon, CaretDownIcon } from "@radix-ui/react-icons";
import { DataSourceTypes } from "../../generated/graphql";
import Warning from "../../components/Warning";
import { lazy, useMemo, useState } from "react";
import Skeleton from "../../components/Skeleton";
import { subjectIsFragment } from "overlay-engine";
import MapLayerVisibilityControl from "../components/MapLayerVisibilityControl";
import { useReportContext } from "../ReportContext";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "react-beautiful-dnd";
import { useCardLocalizedStringAdmin } from "./cards";

export type FeatureListCardConfiguration = ReportCardConfiguration<{
  /**
   * Maximum number of results to display in the table.
   * @default 50
   */
  resultsLimit: number;
  /**
   * Optional list of property names to include as columns in the table.
   * If not provided, all available properties will be shown.
   */
  includedProperties?: string[];
  /**
   * Presentation style: "table" or "list"
   * @default "table"
   */
  presentation?: "table" | "list";
  /**
   * For list presentation, the property name to use as the title/name for each accordion item.
   * Required when presentation is "list".
   */
  titleAttribute?: string;
}>;

export type FeatureListCardProps =
  ReportCardProps<FeatureListCardConfiguration>;

// Admin component for configuring the card
const FeatureListCardAdmin = lazy(() => import("./FeatureListCardAdmin"));

export function FeatureListCard({
  config,
  metrics,
  loading,
  sources,
  errors,
  onUpdate,
}: FeatureListCardProps & {
  onUpdate?: ReportCardConfigUpdateCallback;
}) {
  const { reportingLayers } = config;
  const { adminMode, selectedForEditing } = useReportContext();
  const isSelectedForEditing = selectedForEditing === config.id;
  const { updateComponentSettings } = useCardLocalizedStringAdmin(
    config,
    onUpdate || (() => {})
  );

  // Find presence_table metrics for fragments (sketch overlaps)
  const tableData = useMemo(() => {
    if (loading || reportingLayers.length === 0) {
      return { values: [], exceededLimit: false };
    }

    const fragmentMetrics = metrics.filter(
      (m) => subjectIsFragment(m.subject) && m.type === "presence_table"
    );

    // Collect all values from all fragments
    const allValues: any[] = [];
    let exceededLimit = false;

    for (const metric of fragmentMetrics) {
      const metricValue = metric.value as {
        values?: any[];
        exceededLimit?: boolean;
      };
      if (metricValue?.values) {
        allValues.push(...metricValue.values);
      }
      if (metricValue?.exceededLimit) {
        exceededLimit = true;
      }
    }

    // Apply results limit
    const resultsLimit = config.componentSettings?.resultsLimit ?? 50;
    const limitedValues = allValues.slice(0, resultsLimit);

    return {
      values: limitedValues,
      exceededLimit: exceededLimit || allValues.length > resultsLimit,
    };
  }, [
    metrics,
    loading,
    reportingLayers,
    config.componentSettings?.resultsLimit,
  ]);

  // Get all unique property keys from the values
  const propertyKeys = useMemo(() => {
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
    return Array.from(keys).sort();
  }, [tableData.values]);

  // Filter and order properties based on includedProperties setting
  const displayProperties = useMemo(() => {
    const includedProperties = config.componentSettings?.includedProperties;

    // If includedProperties is undefined/null, show all properties
    if (includedProperties === undefined || includedProperties === null) {
      return propertyKeys;
    }

    // If includedProperties is an empty array, show nothing
    if (includedProperties.length === 0) {
      return [];
    }

    // If includedProperties has values, filter and return in that order
    return includedProperties.filter((prop) => propertyKeys.includes(prop));
  }, [propertyKeys, config.componentSettings?.includedProperties]);

  const handleHeaderDragEnd = (result: DropResult) => {
    if (
      !result.destination ||
      !adminMode ||
      !isSelectedForEditing ||
      !onUpdate
    ) {
      return;
    }

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) {
      return;
    }

    // Reorder the displayProperties
    const reordered = Array.from(displayProperties);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, removed);

    // Update includedProperties with the new order
    updateComponentSettings({
      includedProperties: reordered,
    });
  };

  const presentation = config.componentSettings?.presentation ?? "list";
  const titleAttribute = config.componentSettings?.titleAttribute;

  // For list presentation, use the same logic as table presentation
  const listDisplayProperties = useMemo(() => {
    if (presentation === "list") {
      // Use the same logic as displayProperties
      return displayProperties;
    }
    return displayProperties;
  }, [presentation, displayProperties]);

  return (
    <div>
      {config.reportingLayers.length === 0 && (
        <Warning>
          <Trans ns="reports">No layer selected.</Trans>
        </Warning>
      )}
      {loading ? (
        <Skeleton className="w-full h-4" />
      ) : (
        <div>
          {presentation === "list" ? (
            tableData.values.length > 0 ? (
              <FeatureListAccordion
                values={tableData.values}
                displayProperties={listDisplayProperties}
                titleAttribute={
                  titleAttribute || listDisplayProperties[0] || ""
                }
                resultsLimit={config.componentSettings?.resultsLimit ?? 50}
                exceededLimit={tableData.exceededLimit}
              />
            ) : (
              <div className="flex items-center space-x-2 py-2">
                <ValueNoneIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">
                  <Trans ns="reports">No overlapping features found.</Trans>
                </span>
              </div>
            )
          ) : displayProperties.length === 0 ? (
            <div className="flex items-center space-x-2 py-2">
              <ValueNoneIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">
                <Trans ns="reports">No columns selected.</Trans>
              </span>
            </div>
          ) : tableData.values.length > 0 ? (
            <div className="overflow-x-auto">
              {adminMode && isSelectedForEditing && onUpdate ? (
                <DragDropContext onDragEnd={handleHeaderDragEnd}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <Droppable droppableId="headers" direction="horizontal">
                        {(provided, snapshot) => (
                          <tr
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={
                              snapshot.isDraggingOver ? "bg-blue-50" : ""
                            }
                          >
                            {displayProperties.map((prop, index) => (
                              <Draggable
                                key={prop}
                                draggableId={prop}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <th
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    scope="col"
                                    className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap cursor-move ${
                                      snapshot.isDragging
                                        ? "bg-blue-100 shadow-lg"
                                        : "hover:bg-blue-50"
                                    }`}
                                    title="Drag to reorder"
                                  >
                                    {prop}
                                  </th>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </tr>
                        )}
                      </Droppable>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {tableData.values.map((value, index) => (
                        <tr
                          key={value.__id ?? index}
                          className="odd:bg-white even:bg-gray-50 hover:bg-gray-100"
                        >
                          {displayProperties.map((prop) => (
                            <td
                              key={prop}
                              className="px-3 py-2 text-sm text-gray-800"
                            >
                              <div className="truncate max-w-72">
                                {value[prop] != null ? String(value[prop]) : ""}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DragDropContext>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {displayProperties.map((prop) => (
                        <th
                          key={prop}
                          scope="col"
                          className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap"
                        >
                          {prop}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {tableData.values.map((value, index) => (
                      <tr
                        key={value.__id ?? index}
                        className="odd:bg-white even:bg-gray-50 hover:bg-gray-100"
                      >
                        {displayProperties.map((prop) => (
                          <td
                            key={prop}
                            className="px-3 py-2 text-sm text-gray-800"
                          >
                            <div className="truncate max-w-72">
                              {value[prop] != null ? String(value[prop]) : ""}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tableData.exceededLimit && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  <Trans ns="reports">
                    Showing first{" "}
                    {{ limit: config.componentSettings?.resultsLimit ?? 50 }}{" "}
                    results.
                  </Trans>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2 py-2">
              <ValueNoneIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">
                <Trans ns="reports">No overlapping features found.</Trans>
              </span>
            </div>
          )}
        </div>
      )}
      {config.displayMapLayerVisibilityControls !== false &&
        reportingLayers.length === 1 &&
        reportingLayers[0].tableOfContentsItem?.stableId && (
          <MapLayerVisibilityControl
            stableId={reportingLayers[0].tableOfContentsItem.stableId}
          />
        )}
    </div>
  );
}

// UI display limit - how many accordion items to show initially
const DISPLAY_LIMIT = 5;

// Accordion component for list presentation
function FeatureListAccordion({
  values,
  displayProperties,
  titleAttribute,
  resultsLimit,
  exceededLimit,
}: {
  values: any[];
  displayProperties: string[];
  titleAttribute: string;
  resultsLimit: number;
  exceededLimit: boolean;
}) {
  const { t } = useTranslation("reports");
  const [showAll, setShowAll] = useState(false);
  const displayedValues = showAll ? values : values.slice(0, DISPLAY_LIMIT);
  const hasMore = values.length > DISPLAY_LIMIT;

  return (
    <div>
      <div className="space-y-1 py-2">
        {displayedValues.map((value, index) => {
          const titleValue = value[titleAttribute];
          const title =
            titleValue != null
              ? String(titleValue)
              : `${t("Feature")} ${index + 1}`;
          return (
            <AccordionCard
              key={value.__id ?? index}
              title={title}
              value={value}
              displayProperties={displayProperties}
            />
          );
        })}
        {hasMore && !showAll && (
          <div className="w-full text-center text-gray-800 pt-2">
            <button
              onClick={() => setShowAll(true)}
              className="px-3 py-1 rounded-full border border-gray-300 text-sm hover:bg-gray-50"
            >
              {t("Show all ({{count}} more)", {
                count: values.length - DISPLAY_LIMIT,
              })}
            </button>
          </div>
        )}
        {hasMore && showAll && (
          <div className="w-full text-center text-gray-800 pt-2">
            <button
              onClick={() => setShowAll(false)}
              className="px-3 py-1 rounded-full border border-gray-300 text-sm hover:bg-gray-50"
            >
              {t("Show less")}
            </button>
          </div>
        )}
      </div>
      {exceededLimit && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          <Trans ns="reports">
            Showing first {{ limit: resultsLimit }} results.
          </Trans>
        </div>
      )}
    </div>
  );
}

function AccordionCard({
  title,
  value,
  displayProperties,
}: {
  title: string;
  value: { [key: string]: any };
  displayProperties: string[];
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
              {displayProperties.map((prop, index) => {
                const propValue = value[prop];
                return (
                  <tr
                    className={`border-b last:border-none border-slate-200 text-left ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                    key={prop}
                  >
                    <td className="font-thin p-1 px-2 text-center w-1/3">
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

const defaultComponentSettings: FeatureListCardConfiguration["componentSettings"] =
  {
    resultsLimit: 50,
    presentation: "list",
  };

const defaultBody = {
  type: "doc",
  content: [
    {
      type: "reportTitle",
      content: [
        {
          type: "text",
          text: "Feature List",
        },
      ],
    },
  ],
};

function FeatureListCardIcon() {
  return (
    <div className="bg-blue-100 w-full h-full text-blue-600 flex justify-center items-center rounded">
      <TableIcon className="w-5 h-5" />
    </div>
  );
}

registerReportCardType({
  type: "FeatureList",
  component: FeatureListCard,
  adminComponent: FeatureListCardAdmin,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Feature List</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Display a list of features from a layer that overlap with the sketch.
    </Trans>
  ),
  icon: FeatureListCardIcon,
  order: 5,
  minimumReportingLayerCount: 1,
  maximumReportingLayerCount: 1,
  supportedReportingLayerTypes: [
    DataSourceTypes.SeasketchVector,
    DataSourceTypes.SeasketchMvt,
  ],
});
