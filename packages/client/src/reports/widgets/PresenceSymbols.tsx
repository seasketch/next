import { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CheckIcon, CircleIcon, Cross2Icon } from "@radix-ui/react-icons";
import { CheckCircleIcon } from "@heroicons/react/solid";

export type PresencePresentation =
  | "check-only"
  | "circled-check-and-empty"
  | "check-and-x"
  | "x-only"
  | "thumbs-up"
  | "thumbs-up-and-down";

export const DEFAULT_PRESENCE_PRESENTATION: PresencePresentation =
  "circled-check-and-empty";

export function PresenceCheckIcon() {
  return <CheckIcon className="w-4 h-4 text-green-600" />;
}

export function PresenceCheckCircledIcon() {
  return <CheckCircleIcon className="w-[18px] h-[18px] text-green-600" />;
}

export function PresenceEmptyCircleIcon() {
  return <CircleIcon className="w-4 h-4 text-gray-400" />;
}

export function PresenceXIcon() {
  return <Cross2Icon className="w-4 h-4 text-red-400" />;
}

// eslint-disable-next-line i18next/no-literal-string
const thumbsUpSymbol = "👍🏼";
// eslint-disable-next-line i18next/no-literal-string
const thumbsDownSymbol = "👎🏼";

export function PresenceThumbUpIcon() {
  return <span className="text-green-600">{thumbsUpSymbol}</span>;
}

export function PresenceThumbDownIcon() {
  return (
    <span className="text-gray-400 saturate-0 opacity-80">
      {thumbsDownSymbol}
    </span>
  );
}

export function PresenceSymbolGroup({
  icon,
}: {
  icon: ReactNode | ReactNode[];
}) {
  if (Array.isArray(icon)) {
    return <span className="inline-flex items-center gap-1">{icon}</span>;
  }
  return <span className="inline-flex items-center">{icon}</span>;
}

export function PresenceIconWithTooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip.Root delayDuration={100}>
      <Tooltip.Trigger asChild>
        <span className={className || "inline-flex items-center cursor-help"}>
          {children}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-900 rounded-lg shadow-xl px-2 py-1 text-xs text-white z-50"
          sideOffset={-28}
          side="right"
        >
          {label}
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function renderPresenceSymbol({
  isPresent,
  presentation = DEFAULT_PRESENCE_PRESENTATION,
  presentLabel,
  absentLabel,
  withTooltip = true,
  wrapperClassName,
}: {
  isPresent: boolean;
  presentation?: PresencePresentation;
  presentLabel: string;
  absentLabel: string;
  withTooltip?: boolean;
  wrapperClassName?: string;
}): ReactNode {
  const wrap = (icon: ReactNode, label: string) =>
    withTooltip ? (
      <PresenceIconWithTooltip
        label={label}
        className={wrapperClassName || "inline-flex items-center cursor-help"}
      >
        {icon}
      </PresenceIconWithTooltip>
    ) : wrapperClassName ? (
      <span className={wrapperClassName}>{icon}</span>
    ) : (
      icon
    );

  if (presentation === "check-only") {
    return isPresent ? wrap(<PresenceCheckIcon />, presentLabel) : "";
  }
  if (presentation === "circled-check-and-empty") {
    return isPresent
      ? wrap(<PresenceCheckCircledIcon />, presentLabel)
      : wrap(<PresenceEmptyCircleIcon />, absentLabel);
  }
  if (presentation === "check-and-x") {
    return isPresent
      ? wrap(<PresenceCheckIcon />, presentLabel)
      : wrap(<PresenceXIcon />, absentLabel);
  }
  if (presentation === "x-only") {
    return isPresent ? "" : wrap(<PresenceXIcon />, absentLabel);
  }
  if (presentation === "thumbs-up") {
    return isPresent ? wrap(<PresenceThumbUpIcon />, presentLabel) : "";
  }
  if (presentation === "thumbs-up-and-down") {
    return isPresent
      ? wrap(<PresenceThumbUpIcon />, presentLabel)
      : wrap(<PresenceThumbDownIcon />, absentLabel);
  }
  return "";
}

export function getPresencePresentationOptions(): Array<{
  value: PresencePresentation;
  label: ReactNode;
}> {
  return [
    {
      value: "check-only",
      label: <PresenceSymbolGroup icon={<PresenceCheckIcon />} />,
    },
    {
      value: "circled-check-and-empty",
      label: (
        <PresenceSymbolGroup
          icon={[
            <PresenceCheckCircledIcon key="check" />,
            <PresenceEmptyCircleIcon key="empty" />,
          ]}
        />
      ),
    },
    {
      value: "check-and-x",
      label: (
        <PresenceSymbolGroup
          icon={[<PresenceCheckIcon key="check" />, <PresenceXIcon key="x" />]}
        />
      ),
    },
    {
      value: "x-only",
      label: <PresenceSymbolGroup icon={<PresenceXIcon />} />,
    },
    {
      value: "thumbs-up",
      label: <PresenceSymbolGroup icon={<PresenceThumbUpIcon />} />,
    },
    {
      value: "thumbs-up-and-down",
      label: (
        <PresenceSymbolGroup
          icon={[
            <PresenceThumbUpIcon key="up" />,
            <PresenceThumbDownIcon key="down" />,
          ]}
        />
      ),
    },
  ];
}
