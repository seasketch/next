import { useTranslation } from "react-i18next";
import { SketchAttributesCardConfiguration } from "./SketchAttributesCard";
import Switch from "../../components/Switch";
import { useReportContext } from "../../reports/ReportContext";
import { useContext } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";
import { ReportCardConfigUpdateCallback } from "../registerCard";

interface SketchAttributesCardAdminProps {
  config: SketchAttributesCardConfiguration;
  onUpdate: ReportCardConfigUpdateCallback;
}

export default function SketchAttributesCardAdmin({
  config,
  onUpdate,
}: SketchAttributesCardAdminProps) {
  const { t } = useTranslation("admin:sketching");
  const { sketchClass } = useReportContext();
  const langContext = useContext(FormLanguageContext);

  // Get form elements from sketch class
  const formElements = sketchClass?.form?.formElements || [];
  const allFormElements = formElements
    .filter((element) => element.typeId !== "FeatureName")
    .filter((element) => element.isInput)
    .sort((a, b) => a.position - b.position);

  const updateSettings = (
    newSettings: Partial<typeof config.componentSettings>
  ) => {
    onUpdate((prevState) => ({
      ...prevState,
      componentSettings: {
        ...config.componentSettings,
        ...newSettings,
      },
    }));
  };

  const toggleFiltering = (enabled: boolean) => {
    if (enabled && !config.componentSettings.selectedAttributeIds) {
      // When enabling filtering for the first time, pre-check all available attributes
      const allAttributeIds = allFormElements.map((element) => element.id);
      updateSettings({
        filterAttributes: true,
        selectedAttributeIds: allAttributeIds,
      });
    } else {
      updateSettings({ filterAttributes: enabled });
    }
  };

  const toggleAttribute = (attributeId: number) => {
    const currentSelected = config.componentSettings.selectedAttributeIds || [];
    const newSelected = currentSelected.includes(attributeId)
      ? currentSelected.filter((id) => id !== attributeId)
      : [...currentSelected, attributeId];

    updateSettings({ selectedAttributeIds: newSelected });
  };

  const getAttributeLabel = (element: any) => {
    let label = element.generatedLabel;
    if (
      langContext?.lang?.code !== "EN" &&
      element.alternateLanguageSettings[langContext?.lang?.code]?.body
    ) {
      // Extract text from ProseMirror body for localized label
      label = collectTextFromProsemirrorBodyForLabel(
        element.alternateLanguageSettings[langContext?.lang?.code]?.body
      );
    }
    return label || t("Field {{id}}", { id: element.id });
  };

  /**
   * Extracts text from a ProseMirror body JSON for use as a label
   */
  function collectTextFromProsemirrorBodyForLabel(body: any): string {
    let output = "";

    if (body && typeof body === "object" && body.text) {
      output += body.text;
    }

    if (
      body &&
      typeof body === "object" &&
      body.type &&
      body.type !== "paragraph" &&
      body.content
    ) {
      for (const item of body.content) {
        if (output.length > 32) {
          return output;
        }

        if (
          item &&
          typeof item === "object" &&
          item.type &&
          item.type !== "paragraph"
        ) {
          output += collectTextFromProsemirrorBodyForLabel(item);
        }
      }
    }

    return output;
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          {t("Attribute Selection")}
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-gray-700">
                {t("Filter Attributes")}
              </label>
              <p className="text-xs text-gray-500">
                {t("Limit the attributes displayed to a specified list")}
              </p>
            </div>
            <Switch
              isToggled={config.componentSettings.filterAttributes}
              onClick={toggleFiltering}
            />
          </div>

          {config.componentSettings.filterAttributes && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">
                {t("Select Attributes to Display")}
              </h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allFormElements.map((element) => {
                  const isSelected = (
                    config.componentSettings.selectedAttributeIds || []
                  ).includes(element.id);
                  const label = getAttributeLabel(element);

                  return (
                    <div
                      key={element.id}
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="checkbox"
                        id={`attr-${element.id}`}
                        checked={isSelected}
                        onChange={() => toggleAttribute(element.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor={`attr-${element.id}`}
                        className="text-sm text-gray-700 cursor-pointer flex-1"
                      >
                        {label}
                      </label>
                    </div>
                  );
                })}
              </div>
              {allFormElements.length === 0 && (
                <p className="text-xs text-gray-500 italic">
                  {t("No attributes available")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
