import clsx from "clsx";
import { ReactNode } from "react";
import { ExternalLinkIcon } from "@heroicons/react/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ChangeLogDetailsFragment } from "../../../generated/graphql";
import ChangeLogTimelineItem from "../ChangeLogTimelineItem";
import "./FieldGroupListItemBase.css";

export const CHANGE_LOG_TOOLTIP_DELAY_MS = 120;
export const CHANGE_LOG_TOOLTIP_SKIP_DELAY_MS = 300;

export interface FieldGroupListItemProps {
  changeLog: ChangeLogDetailsFragment;
  last?: boolean;
  itemTitle?: ReactNode;
  /** When the change log has no editor profile, show this instead of "Unknown user". */
  missingProfileLabel?: string;
  /** When set, replacement entries may offer rollback in a details tooltip. */
  dataTableActions?: {
    tableOfContentsItemId: number;
    activeTables: { id: number; version: number }[];
  };
}

export type Summary = Record<string, unknown>;

type ChangeLogWithTimestamp = ChangeLogDetailsFragment & { lastAt: string };

export function summary(value: unknown): Summary {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Summary)
    : {};
}

export function valueText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    if (value.length) {
      return value;
    } else {
      return fallback;
    }
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => valueText(v))
      .filter(Boolean)
      .join(", ");
  }
  return fallback;
}

export function groupsText(value: unknown, fallback: string): string {
  const text = valueText(value);
  return text || fallback;
}

export function ChangeValue({
  children,
  deleted,
  details,
}: {
  children: ReactNode;
  deleted?: boolean;
  details?: ReactNode;
}) {
  const className = details
    ? clsx(
        "inline-flex max-w-full cursor-help items-center gap-1 align-baseline text-sm font-medium leading-5 text-blue-600 underline decoration-blue-400 decoration-dotted underline-offset-4 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 data-[state=open]:text-blue-700",
        deleted && "line-through decoration-blue-400"
      )
    : clsx(
        "inline-flex min-h-[1.625rem] max-w-full items-center align-middle rounded px-1.5 py-0.5 font-mono text-sm leading-5",
        deleted
          ? "bg-gray-50 text-gray-500 line-through decoration-gray-500"
          : "bg-gray-100 text-gray-800"
      );

  if (details) {
    return (
      <Tooltip.Root delayDuration={CHANGE_LOG_TOOLTIP_DELAY_MS}>
        <Tooltip.Trigger asChild>
          <button type="button" className={className}>
            <span className="min-w-0">{children}</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={8}
          className="change-log-details-tooltip z-[999999]"
        >
          {details}
        </Tooltip.Content>
      </Tooltip.Root>
    );
  }

  return <span className={className}>{children}</span>;
}

export function ModalDetailPill({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 align-baseline text-sm font-medium leading-5 text-blue-600 hover:bg-blue-100 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      aria-label={ariaLabel}
    >
      <span className="min-w-0 truncate">{children}</span>
      <ExternalLinkIcon className="h-3.5 w-3.5 flex-none" aria-hidden />
    </button>
  );
}

export default function BaseFieldGroupListItem({
  changeLog,
  last,
  icon,
  iconClassName,
  itemTitle,
  missingProfileLabel,
  children,
  footer,
}: FieldGroupListItemProps & {
  icon: ReactNode;
  iconClassName: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Tooltip.Provider
      delayDuration={CHANGE_LOG_TOOLTIP_DELAY_MS}
      skipDelayDuration={CHANGE_LOG_TOOLTIP_SKIP_DELAY_MS}
    >
      <ChangeLogTimelineItem
        profile={changeLog.editorProfile}
        missingProfileLabel={missingProfileLabel}
        date={new Date((changeLog as ChangeLogWithTimestamp).lastAt)}
        icon={icon}
        iconClassName={iconClassName}
        last={last}
        itemTitle={itemTitle}
        summary={children}
        footer={footer}
      />
    </Tooltip.Provider>
  );
}
