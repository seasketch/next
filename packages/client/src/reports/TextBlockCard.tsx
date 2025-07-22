import { lazy } from "react";
import {
  ReportCardConfiguration,
  ReportCardProps,
  ReportCardType,
} from "./cards";
import ReportCard, { ReportCardComponentProps } from "./ReportCard";
import { prosemirrorToHtml } from "./utils/prosemirrorToHtml";
import { registerReportCardType } from "./registerCard";

export type TextBlockCardConfiguration = ReportCardConfiguration<{
  presentation: "default" | "info" | "warning" | "error";
}>;

export type TextBlockCardProps = ReportCardProps<TextBlockCardConfiguration>;

export function TextBlockCard({ config }: TextBlockCardProps) {
  const { presentation } = config.componentSettings;
  const { title, body, alternateLanguageSettings } = config;

  // Convert Prosemirror JSON to HTML
  const htmlContent = prosemirrorToHtml(body);

  const { tint, backgroundTint, icon } = getTintAndIcon(presentation);

  return (
    <ReportCard
      title={title}
      tint={tint}
      backgroundTint={backgroundTint}
      icon={icon}
      alternateLanguageSettings={alternateLanguageSettings}
    >
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
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
  // adminComponent: lazy(() => import("./TextBlockCardAdmin")),
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
