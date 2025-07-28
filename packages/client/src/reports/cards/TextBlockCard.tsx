import { ReportCardConfiguration, ReportCardProps } from "./cards";
import ReportCard, { ReportCardComponentProps } from "../ReportCard";
import { prosemirrorToHtml } from "../utils/prosemirrorToHtml";
import { registerReportCardType } from "../registerCard";
import { lazy, useContext } from "react";
import { useReportContext } from "../ReportContext";
import ReportCardBodyEditor from "../components/ReportCardBodyEditor";
import { FormLanguageContext } from "../../formElements/FormElement";

export type TextBlockCardConfiguration = ReportCardConfiguration<{
  presentation: "default" | "info" | "warning" | "error";
}>;

export type TextBlockCardProps = ReportCardProps<TextBlockCardConfiguration>;

export function TextBlockCard({
  config,
  dragHandleProps,
  cardId,
  onUpdate,
}: TextBlockCardProps & {
  dragHandleProps?: any;
  cardId?: number;
  onUpdate?: (config: TextBlockCardConfiguration) => void;
}) {
  const { presentation } = config.componentSettings;
  const { title, body, alternateLanguageSettings } = config;
  const { adminMode, selectedForEditing, setSelectedForEditing } =
    useReportContext();
  const langContext = useContext(FormLanguageContext);

  // Get localized body
  let localizedBody = body;
  if (
    langContext?.lang?.code !== "EN" &&
    alternateLanguageSettings[langContext?.lang?.code]?.body
  ) {
    localizedBody = alternateLanguageSettings[langContext.lang.code].body;
  }

  // Convert Prosemirror JSON to HTML
  const htmlContent = prosemirrorToHtml(localizedBody);

  const { tint, backgroundTint, icon } = getTintAndIcon(presentation);

  // Check if this card is being edited
  const isEditing = selectedForEditing === cardId;

  return (
    <ReportCard
      title={title}
      tint={tint}
      backgroundTint={backgroundTint}
      icon={icon}
      alternateLanguageSettings={alternateLanguageSettings}
      dragHandleProps={dragHandleProps}
      cardId={cardId}
      onUpdate={onUpdate}
      config={config}
    >
      {adminMode && isEditing ? (
        <ReportCardBodyEditor
          body={localizedBody}
          onUpdate={(newBody) => {
            if (onUpdate) {
              if (langContext?.lang?.code !== "EN") {
                // Save to alternateLanguageSettings for non-English languages
                onUpdate({
                  ...config,
                  alternateLanguageSettings: {
                    ...config.alternateLanguageSettings,
                    [langContext.lang.code]: {
                      ...config.alternateLanguageSettings[
                        langContext.lang.code
                      ],
                      body: newBody,
                    },
                  },
                });
              } else {
                // Save to main body for English
                onUpdate({
                  ...config,
                  body: newBody,
                });
              }
            }
          }}
          // className="min-h-[100px]"
        />
      ) : (
        <div
          className="ProseMirrorBody"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}
    </ReportCard>
  );
}

const defaultComponentSettings: TextBlockCardConfiguration["componentSettings"] =
  {
    presentation: "default",
  };

registerReportCardType({
  type: "TextBlock",
  title: "Text Block",
  component: TextBlockCard,
  defaultSettings: defaultComponentSettings,
  pickerSettings: {
    componentSettings: defaultComponentSettings,
    alternateLanguageSettings: {},
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Use ",
            },
            {
              type: "text",
              text: "Text Blocks",
              marks: [{ type: "strong" }],
            },
            {
              type: "text",
              text: " to add instructions or other details to your report.",
            },
          ],
        },
      ],
    },
    position: 0,
    id: 0,
    type: "TextBlock",
    title: "Text Block",
  },
  adminComponent: lazy(() => import("./TextBlockCardAdmin")),
});

// Map presentation to tint, backgroundTint and icon
function getTintAndIcon(
  presentation: TextBlockCardConfiguration["componentSettings"]["presentation"]
): {
  tint: string;
  backgroundTint: ReportCardComponentProps["backgroundTint"];
  icon: ReportCardComponentProps["icon"];
} {
  switch (presentation) {
    case "info":
      return {
        tint: "text-blue-900",
        backgroundTint: "blue",
        icon: "info",
      };
    case "warning":
      return {
        tint: "text-yellow-900",
        backgroundTint: "yellow",
        icon: "warning",
      };
    case "error":
      return {
        tint: "text-red-900",
        backgroundTint: "red",
        icon: "error",
      };
    default:
      return {
        tint: "text-gray-900",
        backgroundTint: undefined,
        icon: undefined,
      };
  }
}
