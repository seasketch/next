import { ReportCardConfiguration, ReportCardProps } from "./cards";
import ReportCard from "../ReportCard";
import {
  registerReportCardType,
  ReportCardConfigUpdateCallback,
} from "../registerCard";
import { Trans } from "react-i18next";
import { LayersIcon } from "@radix-ui/react-icons";

export type PolygonOverlapCardConfiguration = ReportCardConfiguration<{}>;

export type PolygonOverlapCardProps =
  ReportCardProps<PolygonOverlapCardConfiguration>;

export function PolygonOverlapCard({
  config,
  dragHandleProps,
  onUpdate,
}: PolygonOverlapCardProps & {
  dragHandleProps?: any;
  onUpdate?: ReportCardConfigUpdateCallback;
}) {
  return (
    <ReportCard
      dragHandleProps={dragHandleProps}
      cardId={config.id}
      onUpdate={onUpdate}
      config={config}
      className="pb-2"
      tint={config.tint}
      icon={config.icon}
    >
      <div>
        <p>
          <Trans ns="reports">
            This card will display polygon overlaps for the current sketch.
          </Trans>
        </p>
      </div>
    </ReportCard>
  );
}

const defaultComponentSettings: PolygonOverlapCardConfiguration["componentSettings"] =
  {};

const defaultBody = {
  type: "doc",
  content: [
    {
      type: "reportTitle",
      content: [
        {
          type: "text",
          text: "Polygon Overlap",
        },
      ],
    },
  ],
};

function PolygonOverlapCardIcon() {
  return (
    <div className="bg-fuchsia-100 w-full h-full text-fuchsia-600 flex justify-center items-center rounded">
      <LayersIcon className="w-5 h-5" />
    </div>
  );
}

registerReportCardType({
  type: "PolygonOverlap",
  component: PolygonOverlapCard,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Polygon Overlap</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Analyze overlap with vector layers. For example, display types of habitats
      captured along with targets for protection.
    </Trans>
  ),
  icon: PolygonOverlapCardIcon,
  order: 2,
});
