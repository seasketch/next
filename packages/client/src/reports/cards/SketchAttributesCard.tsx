import { ReportCardConfiguration, ReportCardProps } from "./cards";
import ReportCard from "../ReportCard";
import {
  registerReportCardType,
  ReportCardConfigUpdateCallback,
} from "../registerCard";
import { useContext } from "react";
import { useReportContext } from "../ReportContext";
import { FormLanguageContext } from "../../formElements/FormElement";
import { Trans, useTranslation } from "react-i18next";
import { lazy } from "react";

export type SketchAttributesCardConfiguration = ReportCardConfiguration<{
  filterAttributes?: boolean;
  selectedAttributeIds?: number[];
}>;

export type SketchAttributesCardProps =
  ReportCardProps<SketchAttributesCardConfiguration>;

// Admin component for configuring the card
const SketchAttributesCardAdmin = lazy(
  () => import("./SketchAttributesCardAdmin")
);

export function SketchAttributesCard({
  config,
  dragHandleProps,
  cardId,
  onUpdate,
}: SketchAttributesCardProps & {
  dragHandleProps?: any;
  cardId?: number;
  onUpdate?: ReportCardConfigUpdateCallback;
}) {
  const { sketchClass, sketch, adminMode } = useReportContext();

  const langContext = useContext(FormLanguageContext);
  const { t } = useTranslation("admin:sketching");

  // Get form elements from sketch class
  const formElements = sketchClass?.form?.formElements || [];

  const values = sketch?.properties || {};

  // Filter and sort form elements
  const allFormElements = formElements
    .filter((element) => element.typeId !== "FeatureName")
    .filter((element) => element.isInput) // Only show input elements
    .sort((a, b) => a.position - b.position); // Sort by position

  // Apply filtering based on configuration
  const sortedFormElements = config.componentSettings.filterAttributes
    ? allFormElements.filter((element) =>
        (config.componentSettings.selectedAttributeIds || []).includes(
          element.id
        )
      )
    : allFormElements;

  const nameOnly =
    formElements.length === 1 && formElements[0].typeId === "FeatureName";

  if (nameOnly && !adminMode) {
    return null;
  }

  return (
    <ReportCard
      alternateLanguageSettings={config.alternateLanguageSettings}
      dragHandleProps={dragHandleProps}
      cardId={cardId}
      onUpdate={onUpdate}
      backgroundTint={nameOnly ? "yellow" : undefined}
      config={config}
    >
      {nameOnly ? (
        <>
          <p>
            <Trans ns="admin:sketching">
              This sketch class has no attributes other than the name field, so
              this card will be hidden when shown to end-users.
            </Trans>
          </p>
        </>
      ) : (
        <div className="space-y-3">
          {sortedFormElements.length === 0 ? (
            <p className="text-gray-500 italic">{t("No attributes found")}</p>
          ) : (
            <div className="space-y-3 mt-2">
              {sortedFormElements.map((element) => {
                let label = element.generatedLabel;
                if (
                  langContext?.lang?.code !== "EN" &&
                  element.alternateLanguageSettings[langContext?.lang?.code]
                    ?.body
                ) {
                  label = collectTextFromProsemirrorBodyForLabel(
                    element.alternateLanguageSettings[langContext?.lang?.code]
                      ?.body
                  );
                }
                const value = values[element.id];
                const displayType = ["TextArea", "ShortText"].includes(
                  element.typeId
                )
                  ? "block"
                  : "inline";
                return (
                  <div
                    key={element.id}
                    className={
                      displayType === "block"
                        ? "flex flex-col w-full"
                        : "flex w-full"
                    }
                  >
                    <div className="flex-none font-medium">{label}</div>
                    <div
                      className={`flex-1 truncate text-gray-700 ${
                        displayType === "inline" ? "text-right" : ""
                      }`}
                    >
                      {formatValue(value, element.typeId)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ReportCard>
  );
}

function formatValue(value: any, typeId: string) {
  if (Array.isArray(value)) {
    return value.join(", ");
  } else if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  } else if (typeof value === "object") {
    return JSON.stringify(value);
  } else if (typeof value === "number") {
    return value.toFixed(2);
  } else if (typeof value === "string") {
    return value;
  }

  return value;
}

/**
 * Extracts text from a ProseMirror body JSON for use as a label
 * Based on the PostgreSQL function collect_text_from_prosemirror_body_for_label
 */
function collectTextFromProsemirrorBodyForLabel(body: any): string {
  let output = "";

  // If body has direct text, add it
  if (body && typeof body === "object" && body.text) {
    output += body.text;
  }

  // If body has type and content, and type is not paragraph, process content
  if (
    body &&
    typeof body === "object" &&
    body.type &&
    body.type !== "paragraph" &&
    body.content
  ) {
    for (const item of body.content) {
      // Stop if we've collected more than 32 characters
      if (output.length > 32) {
        return output;
      }

      // If item has type and is not paragraph, recursively process it
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

const defaultComponentSettings: SketchAttributesCardConfiguration["componentSettings"] =
  {
    filterAttributes: false,
    selectedAttributeIds: [],
  };

// Register the card type
registerReportCardType({
  type: "Attributes",
  title: "Sketch Attributes",
  component: SketchAttributesCard,
  adminComponent: SketchAttributesCardAdmin,
  defaultSettings: defaultComponentSettings,
  pickerSettings: {
    id: 0,
    type: "Attributes",
    body: {
      type: "doc",
      content: [
        {
          type: "reportTitle",
          content: [{ type: "text", text: "Sketch Attributes" }],
        },
      ],
    },
    alternateLanguageSettings: {},
    componentSettings: defaultComponentSettings,
    position: 0,
  },
});
