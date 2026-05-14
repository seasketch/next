/**
 * Publish overlay badge popover bodies.
 *
 * Convention (matches changelog rows):
 * - For each badge, logs are filtered to one field-group family.
 * - `fromSummary` = parsed from_summary on the *oldest* changelog in the publish window.
 * - `toSummary` = parsed to_summary on the *newest* changelog (current value).
 *
 * To add a new badge type: extend `PublishBadgeKey` + grouping in `publishChangelogSummary.ts`,
 * add a `case` below, and tune `badgePopoverContentClassName` if the panel needs more width.
 */

import { useEffect, useState, ReactNode } from "react";
import { ApolloClient, useApolloClient } from "@apollo/client";
import { CheckIcon } from "@radix-ui/react-icons";
import { TFunction, Trans, useTranslation } from "react-i18next";
import Button from "../../../components/Button";
import InlineAuthor from "../../../components/InlineAuthor";
import Spinner from "../../../components/Spinner";
import {
  AuthorProfileFragment,
  ChangeLogDetailsFragment,
  ChangeLogFieldGroup,
  ResolvableLayerCommentDetailsFragment,
  ResolvableLayerCommentThreadFragment,
} from "../../../generated/graphql";
import { ResolvableLayerCommentThreadForChangelogDocument } from "../../../generated/queries";
import {
  accessTypeLabel,
  downloadLabel,
  folderTypeLabel,
  interactivityTypeLabel,
} from "../../changelogs/fieldGroups/labels";
import {
  Summary,
  valueText,
} from "../../changelogs/fieldGroups/FieldGroupListItemBase";
import { formatTimeAgo } from "../../changelogs/ChangeLogTimelineItem";
import { ResolvableCommentBody } from "../TableOfContentsItemEditor/ResolvableCommentEditor";
import { oldestChangeLogId, PublishBadgeKey } from "../publishChangelogSummary";
import {
  buildFolderMovePathSegments,
  getPublishWindowEndpoints,
} from "./endpoints";
import PublishCartographyBadgePreview from "./PublishCartographyBadgePreview";

const CHANGE_SUMMARY_ARROW = String.fromCharCode(8594);

export type PublishBadgeDetailContentProps = {
  badgeKey: PublishBadgeKey;
  logs: ChangeLogDetailsFragment[];
  isFolder: boolean;
  t: TFunction<"admin:data">;
  tableOfContentsItemId: number;
  dataLibraryTemplateId?: number | null;
  onOpenMetadata: () => void;
  onOpenCartography: () => void;
  /**
   * When true, metadata/cartography omit footer buttons; the badge itself opens the
   * full viewer on click (hover panel shows preview + instructions only).
   */
  omitInlineModalActions?: boolean;
};

function FromToLine({
  fromText,
  toText,
}: {
  fromText: string;
  toText: string;
}) {
  return (
    <p className="break-words text-sm leading-snug text-zinc-100">
      <span>{fromText}</span>
      <span className="mx-1.5 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
      <span>{toText}</span>
    </p>
  );
}

function MovePathLine({ segments }: { segments: string[] }) {
  return (
    <p className="break-words text-sm leading-snug text-zinc-100">
      {segments.map((seg, i) => (
        <span key={`${i}-${seg}`}>
          {i > 0 ? (
            <span className="mx-1.5 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
          ) : null}
          {seg}
        </span>
      ))}
    </p>
  );
}

function groupNamesFromAcl(groups: unknown): string[] {
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups
    .map((g) => valueText(g).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function AccessInlineLine({
  fromSummary,
  toSummary,
  t,
}: {
  fromSummary: Summary;
  toSummary: Summary;
  t: PublishBadgeDetailContentProps["t"];
}) {
  const fromLabel = accessTypeLabel(t, fromSummary.type);
  const toLabel = accessTypeLabel(t, toSummary.type);
  const fromGroups =
    fromSummary.type === "group"
      ? groupNamesFromAcl(fromSummary.groups).join(", ")
      : "";
  const toGroups =
    toSummary.type === "group"
      ? groupNamesFromAcl(toSummary.groups).join(", ")
      : "";

  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm leading-snug text-zinc-100">
      <span className="inline-flex min-w-0 max-w-full items-baseline gap-px">
        <span className="shrink-0 font-medium">{fromLabel}</span>
        {fromSummary.type === "group" && fromGroups ? (
          <span className="inline-flex min-w-0 max-w-[min(11rem,42vw)] items-baseline">
            <span className="shrink-0 text-zinc-400">(</span>
            <span className="min-w-0 truncate font-medium" title={fromGroups}>
              {fromGroups}
            </span>
            <span className="shrink-0 text-zinc-400">)</span>
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
      <span className="inline-flex min-w-0 max-w-full items-baseline gap-px">
        <span className="shrink-0 font-medium">{toLabel}</span>
        {toSummary.type === "group" && toGroups ? (
          <span className="inline-flex min-w-0 max-w-[min(11rem,42vw)] items-baseline">
            <span className="shrink-0 text-zinc-400">(</span>
            <span className="min-w-0 truncate font-medium" title={toGroups}>
              {toGroups}
            </span>
            <span className="shrink-0 text-zinc-400">)</span>
          </span>
        ) : null}
      </span>
    </p>
  );
}

function commentThreadIdFromMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const value =
    (meta as { parent_comment_id?: unknown }).parent_comment_id ||
    (meta as { comment_id?: unknown }).comment_id;
  return typeof value === "number" ? value : undefined;
}

function editorName(
  log: ChangeLogDetailsFragment,
  t: TFunction<"admin:data">,
  dataLibraryTemplateId?: number | null
) {
  const fromProfile =
    log.editorProfile?.fullname ||
    log.editorProfile?.nickname ||
    log.editorProfile?.email;
  if (fromProfile) {
    return fromProfile;
  }
  if (dataLibraryTemplateId != null) {
    return t("Data Library");
  }
  return t("Unknown editor");
}

function commentActionLabel(
  fieldGroup: ChangeLogFieldGroup,
  t: TFunction<"admin:data">
) {
  switch (fieldGroup) {
    case ChangeLogFieldGroup.ResolvableLayerCommentsCreated:
      return t("created a comment");
    case ChangeLogFieldGroup.ResolvableLayerCommentsResponded:
      return t("replied");
    case ChangeLogFieldGroup.ResolvableLayerCommentsResolved:
      return t("resolved");
    case ChangeLogFieldGroup.ResolvableLayerCommentsReopened:
      return t("reopened");
    default:
      return t("updated a comment");
  }
}

function CommentActivityDetails({
  logs,
  t,
  dataLibraryTemplateId,
}: {
  logs: ChangeLogDetailsFragment[];
  t: TFunction<"admin:data">;
  dataLibraryTemplateId?: number | null;
}) {
  const client = useApolloClient();
  const [threadsById, setThreadsById] = useState<
    Map<number, ResolvableLayerCommentThreadFragment | null>
  >(() => new Map());
  const byThread = new Map<string, ChangeLogDetailsFragment[]>();
  for (const log of logs) {
    const threadId = commentThreadIdFromMeta(log.meta);
    const key = threadId ? String(threadId) : log.id;
    const threadLogs = byThread.get(key) || [];
    threadLogs.push(log);
    byThread.set(key, threadLogs);
  }
  const threadGroups = Array.from(byThread.entries()).map(([key, threadLogs]) => ({
    key,
    logs: [...threadLogs].sort(
      (a, b) => new Date(a.lastAt).getTime() - new Date(b.lastAt).getTime()
    ),
    threadId: Number.isFinite(Number(key)) ? Number(key) : undefined,
  }));

  useEffect(() => {
    const threadIds = threadGroups
      .map((thread) => thread.threadId)
      .filter((id): id is number => typeof id === "number");
    const missingIds = threadIds.filter((id) => !threadsById.has(id));
    if (!missingIds.length) {
      return;
    }
    let cancelled = false;
    Promise.all(
      missingIds.map((commentId) =>
        fetchCommentThread(client, commentId).then((thread) => ({
          commentId,
          thread,
        }))
      )
    ).then((results) => {
      if (cancelled) {
        return;
      }
      setThreadsById((prev) => {
        const next = new Map(prev);
        for (const result of results) {
          next.set(result.commentId, result.thread);
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [client, threadGroups, threadsById]);

  return (
    <div className="overflow-hidden bg-white text-left text-gray-800">
      {threadGroups.length > 1 && (
        <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t("Comment activity")}
        </div>
      )}
      <div
        className={
          threadGroups.length > 1
            ? "max-h-[min(70vh,30rem)] space-y-3 overflow-y-auto p-3"
            : "max-h-[min(70vh,30rem)] overflow-y-auto"
        }
      >
        {threadGroups.map((thread, index) => (
          <div
            key={thread.key}
            className={
              threadGroups.length > 1
                ? "overflow-hidden rounded-md border border-gray-200 bg-gray-50"
                : "overflow-hidden bg-white"
            }
          >
            {threadGroups.length > 1 && (
              <div className="border-b border-gray-100 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {t("Thread {{number}}", { number: index + 1 })}
              </div>
            )}
            {thread.threadId && !threadsById.has(thread.threadId) ? (
              <div className="flex justify-center p-6">
                <Spinner />
              </div>
            ) : thread.threadId && threadsById.get(thread.threadId) ? (
              <CommentThreadCard comment={threadsById.get(thread.threadId)!} />
            ) : (
              <CommentActivityFallback
                logs={thread.logs}
                t={t}
                dataLibraryTemplateId={dataLibraryTemplateId}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

async function fetchCommentThread(
  client: ApolloClient<object>,
  commentId: number
) {
  const result = await client.query({
    query: ResolvableLayerCommentThreadForChangelogDocument,
    variables: { commentId },
    fetchPolicy: "cache-first",
  });
  return result.data.getResolvableLayerComment || null;
}

function CommentActivityFallback({
  logs,
  t,
  dataLibraryTemplateId,
}: {
  logs: ChangeLogDetailsFragment[];
  t: TFunction<"admin:data">;
  dataLibraryTemplateId?: number | null;
}) {
  return (
    <ul className="space-y-1.5 p-3">
      {logs.map((log) => (
        <li key={log.id} className="text-sm leading-snug text-gray-700">
          <span className="font-medium">
            {editorName(log, t, dataLibraryTemplateId)}
          </span>{" "}
          <span>{commentActionLabel(log.fieldGroup, t)}</span>
        </li>
      ))}
    </ul>
  );
}

function CommentThreadCard({
  comment,
}: {
  comment: ResolvableLayerCommentThreadFragment;
}) {
  const { t } = useTranslation("admin:data");
  const resolvedDate = comment.resolvedAt ? new Date(comment.resolvedAt) : null;
  return (
    <div className="bg-white">
      <div className="space-y-4 p-4">
        <CommentPreviewItem comment={comment} />
        {comment.replies?.map((reply) => (
          <CommentPreviewItem key={reply.id} comment={reply} />
        ))}
      </div>
      {resolvedDate && (
        <div className="flex items-center gap-2 border-t border-green-100 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
          <CheckIcon className="h-4 w-4" />
          {t("Marked resolved {{time}}", {
            time: formatTimeAgo(resolvedDate),
          })}
        </div>
      )}
      {!resolvedDate && (
        <div className="flex items-center gap-2 border-t border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          <CommentStatusIcon />
          {t("Unresolved comment thread")}
        </div>
      )}
    </div>
  );
}

function CommentStatusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h5A2.5 2.5 0 0 1 15 6.5v3A2.5 2.5 0 0 1 12.5 12H10l-3.25 3v-3.1A2.5 2.5 0 0 1 5 9.5v-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentPreviewItem({
  comment,
}: {
  comment: ResolvableLayerCommentDetailsFragment;
}) {
  const profile = comment.authorProfile as AuthorProfileFragment | null;
  const date = new Date(comment.createdAt);
  return (
    <div className="space-y-1">
      <div className="flex min-w-0 items-center gap-2">
        {profile && <InlineAuthor profile={profile} className="min-w-0" />}
        <time
          dateTime={date.toISOString()}
          title={date.toLocaleString()}
          className="shrink-0 text-xs text-gray-400"
        >
          {formatTimeAgo(date)}
        </time>
      </div>
      <div className="ml-8 text-sm text-gray-700">
        <ResolvableCommentBody document={comment.comment} />
      </div>
    </div>
  );
}

export default function PublishBadgeDetailContent(
  props: PublishBadgeDetailContentProps
) {
  const {
    badgeKey,
    logs,
    isFolder,
    t,
    tableOfContentsItemId,
    dataLibraryTemplateId,
    omitInlineModalActions = false,
  } = props;
  if (!logs.length) {
    return (
      <p className="text-sm text-zinc-400">
        <Trans ns="admin:data">No details available.</Trans>
      </p>
    );
  }

  const { fromSummary: fromS, toSummary: toS } = getPublishWindowEndpoints(logs);

  let main: ReactNode = null;

  switch (badgeKey) {
    case "title": {
      const from = valueText(fromS.title, t("Untitled"));
      const to = valueText(toS.title, t("Untitled"));
      main = <FromToLine fromText={from} toText={to} />;
      break;
    }
    case "attribution": {
      const from = valueText(fromS.attribution, t("null"));
      const to = valueText(toS.attribution, t("null"));
      main = <FromToLine fromText={from} toText={to} />;
      break;
    }
    case "access": {
      main = (
        <AccessInlineLine fromSummary={fromS} toSummary={toS} t={t} />
      );
      break;
    }
    case "downloads": {
      const from = downloadLabel(t, fromS.enable_download);
      const to = downloadLabel(t, toS.enable_download);
      main = <FromToLine fromText={from} toText={to} />;
      break;
    }
    case "interactivity": {
      const from = interactivityTypeLabel(t, fromS.type);
      const to = interactivityTypeLabel(t, toS.type);
      main =
        from !== to ? (
          <p className="text-sm text-zinc-100">
            <span className="font-medium">{from}</span>
            <span className="mx-1.5 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
            <span className="font-medium">{to}</span>
          </p>
        ) : (
          <p className="text-sm text-zinc-400">
            {t("Interactivity settings were updated.")}
          </p>
        );
      break;
    }
    case "moved": {
      const rootLabel = t("root");
      const path = buildFolderMovePathSegments(logs, rootLabel);
      main =
        path.length >= 2 ? (
          <MovePathLine segments={path} />
        ) : (
          <FromToLine
            fromText={valueText(fromS.folder, rootLabel)}
            toText={valueText(toS.folder, rootLabel)}
          />
        );
      break;
    }
    case "folderBehavior": {
      const from = folderTypeLabel(t, fromS.type);
      const to = folderTypeLabel(t, toS.type);
      main = (
        <p className="text-sm text-zinc-100">
          <span className="font-medium">{from}</span>
          <span className="mx-1.5 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
          <span className="font-medium">{to}</span>
        </p>
      );
      break;
    }
    case "source": {
      const fromFn = valueText(fromS.filename);
      const toFn = valueText(toS.filename);
      main = (
        <div className="space-y-2 text-sm text-zinc-100">
          {fromFn && toFn && fromFn !== toFn ? (
            <FromToLine fromText={fromFn} toText={toFn} />
          ) : (
            <p>{toFn || t("uploaded source")}</p>
          )}
        </div>
      );
      break;
    }
    case "metadata": {
      main = (
        <p className="text-xs text-zinc-400">
          <Trans ns="admin:data">Click for metadata history</Trans>
        </p>
      );
      break;
    }
    case "cartography": {
      const oldestId = oldestChangeLogId(
        logs,
        ChangeLogFieldGroup.LayerCartography
      );
      main = (
        <div className="flex flex-col gap-1">
          {!isFolder ? (
            <PublishCartographyBadgePreview
              tableOfContentsItemId={tableOfContentsItemId}
              initialChangeLogId={oldestId ?? null}
            />
          ) : null}
          <p className="text-xs text-zinc-400">
            <Trans ns="admin:data">Click for change details</Trans>
          </p>
        </div>
      );
      break;
    }
    case "comments": {
      main = (
        <CommentActivityDetails
          logs={logs}
          t={t}
          dataLibraryTemplateId={dataLibraryTemplateId}
        />
      );
      break;
    }
    default:
      main = (
        <p className="text-sm text-zinc-400">
          <Trans ns="admin:data">This setting was updated.</Trans>
        </p>
      );
  }

  const showModalFooterButtons =
    !omitInlineModalActions &&
    ((badgeKey === "metadata" && !isFolder) ||
      (badgeKey === "cartography" && !isFolder));

  const footerActions = showModalFooterButtons ? (
    badgeKey === "metadata" ? (
      <Button
        small
        label={t("View metadata history")}
        onClick={props.onOpenMetadata}
      />
    ) : (
      <Button
        small
        label={t("View cartography history")}
        onClick={props.onOpenCartography}
      />
    )
  ) : null;

  const compactPopover =
    badgeKey === "metadata" || badgeKey === "cartography";

  return (
    <div className={compactPopover ? "space-y-1.5" : "space-y-3"}>
      {main}
      {footerActions ? (
        <div
          className={
            compactPopover
              ? "flex flex-wrap gap-2 border-t border-zinc-700 pt-1.5"
              : "flex flex-wrap gap-2 border-t border-zinc-700 pt-2"
          }
        >
          {footerActions}
        </div>
      ) : null}
    </div>
  );
}
