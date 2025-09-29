import React from "react";
import { SpatialMetricState } from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import {
  CheckboxIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlayIcon,
} from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";

export default function ReportTaskLineItem({
  title,
  state,
  progress,
  tooltip,
}: {
  title: React.ReactNode;
  state: SpatialMetricState;
  progress?: number | null;
  tooltip?: string;
}) {
  return (
    <li className="flex items-center">
      <span className="flex-1 truncate">{title}</span>
      <span className="ml-2 text-sm text-gray-600">
        {tooltip ? (
          <Tooltip.Root delayDuration={100}>
            <Tooltip.Trigger asChild>
              <span className="inline-flex">
                <StateIcon state={state} />
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="TooltipContent text-sm bg-black text-white"
                sideOffset={5}
              >
                {tooltip}
                <Tooltip.Arrow className="fill-current text-gray-800" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : (
          <StateIcon state={state} />
        )}
      </span>
      {typeof progress === "number" ? (
        <span className="ml-2 text-sm text-gray-600">{progress}%</span>
      ) : null}
    </li>
  );
}

function labelForState(state: SpatialMetricState) {
  switch (state) {
    case SpatialMetricState.Processing:
      return "Processing";
    case SpatialMetricState.Queued:
      return "Queued";
    case SpatialMetricState.Complete:
      return "Complete";
    case SpatialMetricState.Error:
      return "Error";
    case SpatialMetricState.DependencyNotReady:
      return "Awaiting Dependency";
  }
}

function StateIcon({ state }: { state: SpatialMetricState }) {
  switch (state) {
    case SpatialMetricState.Processing:
      return <Spinner />;
    case SpatialMetricState.Queued:
      return <PlayIcon className="text-blue-500" />;
    case SpatialMetricState.Complete:
      return <CheckboxIcon />;
    case SpatialMetricState.Error:
      return <ExclamationTriangleIcon className="text-red-700" />;
    case SpatialMetricState.DependencyNotReady:
      return <ClockIcon className="text-green-700" />;
  }
}
