import { ReportCardConfiguration, ReportCardProps } from "./cards";
import ReportCard, { ReportCardComponentProps } from "../ReportCard";
import {
  registerReportCardType,
  ReportCardConfigUpdateCallback,
} from "../registerCard";
import { lazy } from "react";
import { Trans } from "react-i18next";
import { DocumentTextIcon } from "@heroicons/react/outline";

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

  // TODO: bring back presentation settings
  return <div></div>;

  // return (
  //   <ReportCard
  //     tint={tint}
  //     backgroundTint={backgroundTint}
  //     icon={icon}
  //     dragHandleProps={dragHandleProps}
  //     cardId={config.id}
  //     onUpdate={onUpdate}
  //     config={config}
  //     className="pb-2"
  //     metrics={[]}
  //     sources={[]}
  //   />
  // );
}

const defaultComponentSettings: TextBlockCardConfiguration["componentSettings"] =
  {
    presentation: "default",
  };

const defaultBody = {
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
};

function TextBlockCardIcon() {
  return (
    <div className="bg-blue-900 w-full h-full font-bold text-center flex justify-center items-center text-white">
      {/*eslint-disable-next-line i18next/no-literal-string*/}
      <span className="text-2xl">¶</span>
    </div>
  );
}

registerReportCardType({
  type: "TextBlock",
  component: TextBlockCard,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Text Block</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Add instructions, descriptions, or other text content to your report.
    </Trans>
  ),
  icon: TextBlockCardIcon,
  adminComponent: lazy(() => import("./TextBlockCardAdmin")),
  order: 3,
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
