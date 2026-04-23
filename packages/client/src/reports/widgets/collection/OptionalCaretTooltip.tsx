import * as Tooltip from "@radix-ui/react-tooltip";
import { Fragment } from "react";
import type { ReactElement, ReactNode } from "react";

/**
 * Wraps trigger content in a Radix tooltip when `tooltipEnabled` is true.
 * Matches GeographySizeTable / class-table widget caret UX.
 */
export default function OptionalCaretTooltip({
  tooltipEnabled,
  tooltipLabel,
  delayDuration = 400,
  children,
}: {
  tooltipEnabled: boolean;
  tooltipLabel: ReactNode;
  delayDuration?: number;
  children: ReactNode;
}): ReactElement {
  if (!tooltipEnabled) {
    return <Fragment>{children}</Fragment>;
  }
  return (
    <Tooltip.Root delayDuration={delayDuration}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="z-[60] max-w-xs rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-white shadow-lg"
          side="left"
          sideOffset={4}
        >
          {tooltipLabel}
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
