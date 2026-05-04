import clsx from "clsx";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AuthorProfileFragment,
  UserProfileDetailsFragment,
} from "../../generated/graphql";
import InlineAuthor from "../../components/InlineAuthor";
import {
  formatExactTimestampTooltip,
  formatRelativeTimeSince,
} from "./relativeTimeFormat";
import "./ChangeLogTimelineItem.css";

export type ChangeLogAuthorProfile = Pick<
  UserProfileDetailsFragment,
  "fullname" | "email" | "picture" | "affiliations" | "nickname" | "userId"
>;

export default function ChangeLogTimelineItem({
  profile,
  date,
  icon,
  iconClassName,
  last,
  summary,
  itemTitle,
  footer,
}: {
  profile?: ChangeLogAuthorProfile | null;
  date: Date;
  icon: ReactNode;
  iconClassName?: string;
  last?: boolean;
  summary: ReactNode;
  itemTitle?: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation("admin:data");
  const rowRef = useRef<HTMLDivElement | null>(null);
  const authorRef = useRef<HTMLSpanElement | null>(null);
  const summaryRef = useRef<HTMLSpanElement | null>(null);
  const [summaryWrapped, setSummaryWrapped] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    const author = authorRef.current;
    const summary = summaryRef.current;
    if (!row || !author || !summary) {
      return;
    }

    const updateWrappedState = () => {
      setSummaryWrapped(summary.offsetTop > author.offsetTop);
    };

    updateWrappedState();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateWrappedState);
    observer.observe(row);
    return () => observer.disconnect();
  }, [profile, summary, itemTitle, footer]);

  return (
    <li className={clsx("relative flex gap-4 pb-6", last && "pb-0")}>
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-5 top-10 bottom-0 w-px bg-gray-100"
        />
      )}
      <div
        className={clsx(
          "relative z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full",
          iconClassName || "bg-gray-50 text-gray-500"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div
          ref={rowRef}
          className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-5 text-gray-500"
        >
          <span ref={authorRef} className="flex-none">
            {profile ? (
              <InlineAuthor
                profile={profile as AuthorProfileFragment}
                className="flex-none"
              />
            ) : (
              <span className="font-semibold text-gray-900">
                {t("Unknown user")}
              </span>
            )}
          </span>
          {itemTitle && (
            <span className="flex h-6 min-w-0 items-center text-gray-500">
              <span className="min-w-0 truncate font-semibold text-gray-700">
                {itemTitle}
              </span>
            </span>
          )}
          {!itemTitle && (
            <span
              ref={summaryRef}
              className="change-log-summary block w-max max-w-full min-w-0"
              data-wrapped={summaryWrapped}
            >
              <span>{summary}</span>
            </span>
          )}
        </div>
        {itemTitle && (
          <span
            ref={summaryRef}
            className="change-log-summary mt-1 block w-max max-w-full min-w-0 text-sm leading-5 text-gray-500"
            data-wrapped={summaryWrapped}
          >
            <span>{summary}</span>
          </span>
        )}
        <time
          className="mt-1 block text-sm text-gray-400"
          dateTime={date.toISOString()}
          title={formatExactTimestampTooltip(date)}
        >
          {formatRelativeTimeSince(date)}
        </time>
        {footer != null ? <div className="mt-3 max-w-xl">{footer}</div> : null}
      </div>
    </li>
  );
}
