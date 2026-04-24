import clsx from "clsx";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AuthorProfileFragment,
  UserProfileDetailsFragment,
} from "../../generated/graphql";
import InlineAuthor from "../../components/InlineAuthor";
import "./ChangeLogTimelineItem.css";

const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const DIVISIONS: {
  amount: number;
  name: "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years";
}[] = [
  { amount: 60, name: "seconds" },
  { amount: 60, name: "minutes" },
  { amount: 24, name: "hours" },
  { amount: 7, name: "days" },
  { amount: 4.34524, name: "weeks" },
  { amount: 12, name: "months" },
  { amount: Number.POSITIVE_INFINITY, name: "years" },
];

function formatTimeAgo(date: Date) {
  let duration = (date.getTime() - new Date().getTime()) / 1000;
  if (Math.abs(duration) < 60) {
    return formatter.format(0, "seconds");
  }
  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
  return formatter.format(0, "seconds");
}

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
}: {
  profile?: ChangeLogAuthorProfile | null;
  date: Date;
  icon: ReactNode;
  iconClassName?: string;
  last?: boolean;
  summary: ReactNode;
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
  }, [profile, summary]);

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
          <span
            ref={summaryRef}
            className="change-log-summary block w-max max-w-full min-w-0"
            data-wrapped={summaryWrapped}
          >
            <span>{summary}</span>
          </span>
        </div>
        <time
          className="mt-1 block text-sm text-gray-400"
          dateTime={date.toISOString()}
        >
          {formatTimeAgo(date)}
        </time>
      </div>
    </li>
  );
}
