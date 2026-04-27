import clsx from "clsx";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { ReactNode } from "react";
import { ChangeLogDetailsFragment } from "../../../generated/graphql";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/Tooltip";
import ChangeLogTimelineItem from "../ChangeLogTimelineItem";
import "./FieldGroupListItemBase.css";

export interface FieldGroupListItemProps {
  changeLog: ChangeLogDetailsFragment;
  last?: boolean;
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
  const className = clsx(
    "inline-flex max-w-full align-baseline rounded px-1.5 py-0.5 font-mono text-sm leading-5",
    deleted
      ? "bg-gray-50 text-gray-500 line-through decoration-gray-500"
      : "bg-gray-100 text-gray-800",
    details &&
      "items-center gap-1 cursor-help hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
  );

  if (details) {
    return (
      <Tooltip placement="top">
        <TooltipTrigger asChild>
          <button type="button" className={className}>
            <span className="min-w-0">{children}</span>
            <QuestionMarkCircledIcon className="h-3.5 w-3.5 flex-none text-gray-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent className=" change-log-details-tooltip">
          {details}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className={className}>
      {children}
    </span>
  );
}

export default function BaseFieldGroupListItem({
  changeLog,
  last,
  icon,
  iconClassName,
  children,
  footer,
}: FieldGroupListItemProps & {
  icon: ReactNode;
  iconClassName: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <ChangeLogTimelineItem
      profile={changeLog.editorProfile}
      date={new Date((changeLog as ChangeLogWithTimestamp).lastAt)}
      icon={icon}
      iconClassName={iconClassName}
      last={last}
      summary={children}
      footer={footer}
    />
  );
}
