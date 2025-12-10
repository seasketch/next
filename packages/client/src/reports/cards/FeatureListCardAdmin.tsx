import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { useMemo, useEffect } from "react";
import { GeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";
import { useCardLocalizedStringAdmin } from "./cards";
import MapLayerVisibilityControlsAdmin from "../components/MapLayerVisibilityControlsAdmin";
import AttributeSelect from "../../admin/data/styleEditor/AttributeSelect";

type AdminConfig = ReportCardConfiguration<{
  resultsLimit: number;
  includedProperties?: string[];
  presentation?: "table" | "list";
  titleAttribute?: string;
}>;

export default function FeatureListCardAdmin({
  config,
  onUpdate,
}: {
  config: AdminConfig;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  const { t } = useTranslation("admin:sketching");
  const { updateComponentSettings } = useCardLocalizedStringAdmin(
    config,
    onUpdate
  );

  const updateSettings = (
    newSettings: Partial<NonNullable<AdminConfig["componentSettings"]>>
  ) => {
    updateComponentSettings(newSettings);
  };

  // Get available properties from geostats
  const availableProperties = useMemo(() => {
    return [];
    // if (config.reportingLayers.length === 0) {
    //   return [];
    // }

    // const layer = config.reportingLayers[0];
    // const meta = undefined;
    // // layer.tableOfContentsItem?.dataLayer?.dataSource?.geostats;
    // if (!meta || isRasterInfo(meta)) {
    //   return [];
    // }

    // const geostats = meta.layers[0] as GeostatsLayer;
    // return geostats.attributes.map((attr) => attr.attribute).sort();
  }, [config.reportingLayers]);

  // Get geostats attributes for AttributeSelect component
  const geostatsAttributes = useMemo(() => {
    if (config.reportingLayers.length === 0) {
      return [];
    }

    const layer = config.reportingLayers[0];
    const meta = undefined;
    // layer.tableOfContentsItem?.dataLayer?.dataSource?.geostats;
    if (!meta || isRasterInfo(meta)) {
      return [];
    }

    // const geostats = meta.layers[0] as GeostatsLayer;
    // return [...geostats.attributes].sort((a, b) =>
    //   a.attribute.localeCompare(b.attribute)
    // );
    return [];
  }, [config.reportingLayers]);

  const resultsLimit = config.componentSettings?.resultsLimit ?? 50;
  const includedProperties = config.componentSettings?.includedProperties;
  const presentation = config.componentSettings?.presentation ?? "list";
  const titleAttribute = config.componentSettings?.titleAttribute;

  // Determine if a property is included
  // If includedProperties is undefined/null, all are included
  // If includedProperties is [], none are included
  // If includedProperties has values, only those are included
  const isPropertyIncluded = (prop: string) => {
    if (includedProperties === undefined || includedProperties === null) {
      return true; // All included when unset
    }
    return includedProperties.includes(prop);
  };

  // Auto-select first property as titleAttribute if not set and presentation is list
  // useEffect(() => {
  //   if (
  //     presentation === "list" &&
  //     !titleAttribute &&
  //     geostatsAttributes.length > 0
  //   ) {
  //     updateComponentSettings({
  //       titleAttribute: geostatsAttributes[0].attribute,
  //     });
  //   }
  // }, [
  //   presentation,
  //   titleAttribute,
  //   geostatsAttributes,
  //   updateComponentSettings,
  // ]);

  const handlePresentationChange = (newPresentation: "table" | "list") => {
    // const updates: any = { presentation: newPresentation };
    // // If switching to list and no titleAttribute is set, use first property
    // if (
    //   newPresentation === "list" &&
    //   !titleAttribute &&
    //   geostatsAttributes.length > 0
    // ) {
    //   updates.titleAttribute = geostatsAttributes[0].attribute;
    // }
    // updateSettings(updates);
  };

  const handleToggleAll = () => {
    const allIncluded =
      includedProperties === undefined ||
      includedProperties === null ||
      includedProperties.length === availableProperties.length;

    if (allIncluded) {
      // All are selected (or unset means all), unselect all
      updateSettings({ includedProperties: [] });
    } else {
      // Not all are selected, select all (set to undefined to show all)
      updateSettings({ includedProperties: undefined });
    }
  };

  const handleToggleProperty = (prop: string, checked: boolean) => {
    // If currently unset (undefined/null), start with all properties
    const currentIncluded =
      includedProperties === undefined || includedProperties === null
        ? availableProperties
        : includedProperties;

    if (checked) {
      // Add to includedProperties if not already there
      if (!currentIncluded.includes(prop)) {
        updateSettings({
          includedProperties: [...currentIncluded, prop],
        });
      }
    } else {
      // Remove from includedProperties
      const newIncluded = currentIncluded.filter((p) => p !== prop);
      // If removing the last one, set to empty array
      // If removing from "all", set to array without this property
      updateSettings({
        includedProperties: newIncluded.length === 0 ? [] : newIncluded,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("Presentation Style")}
        </label>
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => handlePresentationChange("table")}
            className={`w-full px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
              presentation === "table"
                ? "border-blue-500 bg-blue-50 ring outline-blue-500"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t("Table")}
          </button>
          <button
            onClick={() => handlePresentationChange("list")}
            className={`w-full px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
              presentation === "list"
                ? "border-blue-500 bg-blue-50 ring outline-blue-500"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t("List")}
          </button>
        </div>
      </div>

      {presentation === "list" && geostatsAttributes.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-900 block mb-2">
            {t("Title Column")}
          </label>
          <p className="text-xs text-gray-500 mb-3">
            {t(
              "Used as the list item title. Users can click on the item to expand all columns."
            )}
          </p>
          <AttributeSelect
            appearance="light"
            attributes={geostatsAttributes}
            value={titleAttribute}
            onChange={(value) => {
              updateSettings({ titleAttribute: value || undefined });
            }}
            placeholder={t("Select a property...")}
          />
        </div>
      )}

      <div>
        <label
          htmlFor="resultsLimit"
          className="text-sm font-medium text-gray-900 block mb-2"
        >
          {t("Results Limit")}
        </label>
        <p className="text-xs text-gray-500 mb-3">
          {t(
            "Maximum number of features to return when querying the data layer."
          )}
        </p>
        <input
          id="resultsLimit"
          type="number"
          min="1"
          value={resultsLimit}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value > 0) {
              updateSettings({ resultsLimit: value });
            }
          }}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      {availableProperties.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-900 block mb-2">
            {t("Included Columns")}
          </label>
          <p className="text-xs text-gray-500 mb-2">
            {presentation === "table"
              ? t(
                  "Select which columns to display. Drag column headers in the table to reorder."
                )
              : t(
                  "Select which properties to display in the accordion items. Properties are shown in the order selected."
                )}
          </p>
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline mb-3"
          >
            {includedProperties === undefined ||
            includedProperties === null ||
            includedProperties.length === availableProperties.length
              ? t("Deselect All")
              : t("Select All")}
          </button>
          <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
            {availableProperties.map((prop) => {
              const isChecked = isPropertyIncluded(prop);
              return (
                <div key={prop} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`prop-${prop}`}
                    checked={isChecked}
                    onChange={(e) =>
                      handleToggleProperty(prop, e.target.checked)
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor={`prop-${prop}`}
                    className="ml-2 text-sm text-gray-700 cursor-pointer"
                  >
                    {prop}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <MapLayerVisibilityControlsAdmin config={config} onUpdate={onUpdate} />
    </div>
  );
}
