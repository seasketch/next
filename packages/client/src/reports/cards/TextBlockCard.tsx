import { ReportCardConfiguration, ReportCardProps } from "./cards";
import ReportCard, { ReportCardComponentProps } from "../ReportCard";
import {
  registerReportCardType,
  ReportCardConfigUpdateCallback,
} from "../registerCard";
import { lazy } from "react";

export type TextBlockCardConfiguration = ReportCardConfiguration<{
  presentation: "default" | "info" | "warning" | "error";
}>;

export type TextBlockCardProps = ReportCardProps<TextBlockCardConfiguration>;

export function TextBlockCard({
  config,
  dragHandleProps,
  onUpdate,
}: TextBlockCardProps & {
  dragHandleProps?: any;
  onUpdate?: ReportCardConfigUpdateCallback;
}) {
  const { presentation } = config.componentSettings;
  const { alternateLanguageSettings } = config;

  const { tint, backgroundTint, icon } = getTintAndIcon(presentation);

  return (
    <ReportCard
      tint={tint}
      backgroundTint={backgroundTint}
      icon={icon}
      dragHandleProps={dragHandleProps}
      cardId={config.id}
      onUpdate={onUpdate}
      config={config}
      className="pb-2"
    />
  );
}

const defaultComponentSettings: TextBlockCardConfiguration["componentSettings"] =
  {
    presentation: "default",
  };

registerReportCardType({
  type: "TextBlock",
  component: TextBlockCard,
  defaultSettings: defaultComponentSettings,
  pickerSettings: {
    componentSettings: defaultComponentSettings,
    body: {
      type: "doc",
      content: [
        {
          type: "reportTitle",
          content: [
            {
              type: "text",
              text: "Text Block",
            },
          ],
        },
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
