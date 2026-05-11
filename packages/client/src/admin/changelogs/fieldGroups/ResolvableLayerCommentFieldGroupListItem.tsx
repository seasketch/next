import { CheckIcon, ResetIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import InlineAuthor from "../../../components/InlineAuthor";
import Spinner from "../../../components/Spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/Tooltip";
import {
  AuthorProfileFragment,
  ChangeLogFieldGroup,
  ResolvableLayerCommentDetailsFragment,
  ResolvableLayerCommentThreadFragment,
  useResolvableLayerCommentThreadForChangelogQuery,
} from "../../../generated/graphql";
import { formatTimeAgo } from "../ChangeLogTimelineItem";
import { ResolvableCommentBody } from "../../data/TableOfContentsItemEditor/ResolvableCommentEditor";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
} from "./FieldGroupListItemBase";

export default function ResolvableLayerCommentFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const fieldGroup = props.changeLog.fieldGroup;
  const resolved =
    fieldGroup === ChangeLogFieldGroup.ResolvableLayerCommentsResolved;
  const reopened =
    fieldGroup === ChangeLogFieldGroup.ResolvableLayerCommentsReopened;
  const commentId = threadCommentIdFromMeta(props.changeLog.meta);

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={
        resolved ? (
          <CheckIcon className="h-5 w-5" />
        ) : reopened ? (
          <ResetIcon className="h-5 w-5" />
        ) : (
          <CommentIcon />
        )
      }
      iconClassName={
        resolved
          ? "bg-green-50 text-green-600"
          : reopened
          ? "bg-amber-50 text-amber-600"
          : "bg-blue-50 text-blue-600"
      }
    >
      {fieldGroup === ChangeLogFieldGroup.ResolvableLayerCommentsCreated && (
        <Trans ns="admin:data">
          created a <CommentThreadPreview commentId={commentId}>comment</CommentThreadPreview>
        </Trans>
      )}
      {fieldGroup === ChangeLogFieldGroup.ResolvableLayerCommentsResponded && (
        <Trans ns="admin:data">
          responded to a{" "}
          <CommentThreadPreview commentId={commentId}>comment</CommentThreadPreview>
        </Trans>
      )}
      {resolved && (
        <Trans ns="admin:data">
          resolved a <CommentThreadPreview commentId={commentId}>comment</CommentThreadPreview>
        </Trans>
      )}
      {reopened && (
        <Trans ns="admin:data">
          reopened a <CommentThreadPreview commentId={commentId}>comment</CommentThreadPreview>
        </Trans>
      )}
    </BaseFieldGroupListItem>
  );
}

function threadCommentIdFromMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const value =
    (meta as { parent_comment_id?: unknown }).parent_comment_id ||
    (meta as { comment_id?: unknown }).comment_id;
  return typeof value === "number" ? value : undefined;
}

function CommentThreadPreview({
  commentId,
  children,
}: {
  commentId?: number;
  children: string;
}) {
  const [previewRequested, setPreviewRequested] = useState(false);
  const { t } = useTranslation("admin:data");
  const query = useResolvableLayerCommentThreadForChangelogQuery({
    variables: { commentId: commentId || -1 },
    skip: !previewRequested || !commentId,
  });

  if (!commentId) {
    return <span className="font-medium text-blue-600">{children}</span>;
  }

  return (
    <Tooltip placement="right">
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full cursor-help items-center gap-1 align-baseline text-sm font-medium leading-5 text-blue-600 underline decoration-blue-400 decoration-dotted underline-offset-4 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          onPointerEnter={() => setPreviewRequested(true)}
          onFocus={() => setPreviewRequested(true)}
          onClick={() => setPreviewRequested(true)}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className=" change-log-comment-thread-tooltip">
        {query.loading ? (
          <div className="flex w-80 justify-center p-6">
            <Spinner />
          </div>
        ) : query.data?.getResolvableLayerComment ? (
          <CommentThreadTooltipContent
            comment={query.data.getResolvableLayerComment}
          />
        ) : (
          <div className="w-80 p-4 text-sm text-gray-500">
            {t("Comment thread unavailable")}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function CommentThreadTooltipContent({
  comment,
}: {
  comment: ResolvableLayerCommentThreadFragment;
}) {
  const { t } = useTranslation("admin:data");
  const resolvedDate = comment.resolvedAt ? new Date(comment.resolvedAt) : null;
  return (
    <div className="w-96 max-w-[calc(100vw-2rem)] overflow-hidden bg-white text-left">
      <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t("Comment thread")}
      </div>
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
          <CommentIcon />
          {t("Unresolved comment thread")}
        </div>
      )}
    </div>
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

function CommentIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h5A2.5 2.5 0 0 1 15 6.5v3A2.5 2.5 0 0 1 12.5 12H10l-3.25 3v-3.1A2.5 2.5 0 0 1 5 9.5v-3Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
