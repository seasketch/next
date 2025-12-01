import { ReportCardConfiguration, ReportCardProps } from "./cards";
import { registerReportCardType } from "../registerCard";
import { Trans } from "react-i18next";
import { CheckIcon, CrossCircledIcon } from "@radix-ui/react-icons";
import { DataSourceTypes } from "../../generated/graphql";
import Warning from "../../components/Warning";
import { lazy, useMemo } from "react";
import Skeleton from "../../components/Skeleton";
import { subjectIsFragment } from "overlay-engine";
import MapLayerVisibilityControl from "../components/MapLayerVisibilityControl";

export type PresenceCardConfiguration = ReportCardConfiguration<{}>;

export type PresenceCardProps = ReportCardProps<PresenceCardConfiguration>;

// Admin component for configuring the card
const PresenceCardAdmin = lazy(() => import("./PresenceCardAdmin"));

export function PresenceCard({
  config,
  metrics,
  loading,
  sources,
  errors,
}: PresenceCardProps) {
  const { reportingLayers } = config;

  // Determine if features are present based on fragment metrics
  const hasPresence = useMemo(() => {
    if (loading || reportingLayers.length === 0) {
      return false;
    }

    // Find presence metrics for fragments (sketch overlaps)
    const fragmentMetrics = metrics.filter(
      (m) => subjectIsFragment(m.subject) && m.type === "presence"
    );

    // Check if any fragment has presence = true
    return fragmentMetrics.some((m) => m.value === true);
  }, [metrics, loading, reportingLayers]);

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
        <div className="flex items-center space-x-2 text-gray-700">
          {/* {hasPresence ? (
            <>
              <CheckIcon className="w-4 h-4 text-green-600" />
              <span>
                <Trans ns="reports">
                  Features from this layer are present within the sketch.
                </Trans>
              </span>
            </>
          ) : (
            <>
              <CrossCircledIcon className="w-4 h-4 text-gray-400" />
              <span>
                <Trans ns="reports">
                  No features from this layer overlap with the sketch.
                </Trans>
              </span>
            </>
          )} */}
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

const defaultComponentSettings: PresenceCardConfiguration["componentSettings"] =
  {};

const defaultBody = {
  type: "doc",
  content: [
    {
      type: "reportTitle",
      content: [
        {
          type: "text",
          text: "Feature Presence",
        },
      ],
    },
  ],
};

function PresenceCardIcon() {
  return (
    <div className="bg-purple-100 w-full h-full text-purple-600 flex justify-center items-center rounded">
      <CheckIcon className="w-5 h-5" />
    </div>
  );
}

registerReportCardType({
  type: "Presence",
  component: PresenceCard,
  adminComponent: PresenceCardAdmin,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Presence / Absence Card</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Display whether features from a layer are present within the sketch.
    </Trans>
  ),
  icon: PresenceCardIcon,
  order: 4,
  minimumReportingLayerCount: 1,
  maximumReportingLayerCount: 1,
  supportedReportingLayerTypes: [
    DataSourceTypes.SeasketchVector,
    DataSourceTypes.SeasketchMvt,
  ],
});
