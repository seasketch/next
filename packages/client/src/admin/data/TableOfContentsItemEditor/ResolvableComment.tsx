import { CheckIcon } from "@radix-ui/react-icons";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import clsx from "clsx";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import InlineAuthor from "../../../components/InlineAuthor";
import {
  AuthorProfileFragment,
  ResolvableLayerCommentThreadFragment,
  useReopenResolvableCommentMutation,
  useResolveResolvableCommentMutation,
} from "../../../generated/graphql";
import { formatTimeAgo } from "../../changelogs/ChangeLogTimelineItem";
import NewResolvableComment from "./NewResolvableComment";
import { ResolvableCommentBody } from "./ResolvableCommentEditor";

function CommentAuthor({
  profile,
  createdAt,
  showActions,
  resolved,
  actionLoading,
  onAction,
}: {
  profile?: AuthorProfileFragment | null;
  createdAt: string;
  showActions?: boolean;
  resolved?: boolean;
  actionLoading?: boolean;
  onAction?: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const date = new Date(createdAt);
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        {profile ? (
          <InlineAuthor profile={profile} className="min-w-0" />
        ) : (
          <div className="text-sm font-semibold text-gray-900">
            {t("Unknown user")}
          </div>
        )}
        <time
          dateTime={date.toISOString()}
          title={date.toLocaleString()}
          className="ml-8 block text-sm text-gray-400"
        >
          {formatTimeAgo(date)}
        </time>
      </div>
      {showActions && (
        <RadixTooltip.Provider delayDuration={100}>
          <RadixTooltip.Root>
            <RadixTooltip.Trigger asChild>
              <button
                type="button"
                disabled={actionLoading}
                onClick={onAction}
                className={clsx(
                  "flex h-9 items-center justify-center rounded-full border border-gray-200 bg-white px-4 text-sm font-medium shadow-sm",
                  resolved
                    ? "text-green-700 hover:bg-green-50"
                    : "w-12 text-primary-500 hover:bg-primary-50",
                  actionLoading && "opacity-50"
                )}
              >
                {resolved ? (
                  <span>
                    <Trans ns="admin:data">Reopen</Trans>
                  </span>
                ) : (
                  <CheckIcon />
                )}
              </button>
            </RadixTooltip.Trigger>
            <RadixTooltip.Portal>
              <RadixTooltip.Content
                sideOffset={6}
                className="z-50 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow"
              >
                {resolved ? (
                  <Trans ns="admin:data">Reopen this comment</Trans>
                ) : (
                  <Trans ns="admin:data">Resolve this comment</Trans>
                )}
                <RadixTooltip.Arrow className="fill-gray-900" />
              </RadixTooltip.Content>
            </RadixTooltip.Portal>
          </RadixTooltip.Root>
        </RadixTooltip.Provider>
      )}
    </div>
  );
}

export default function ResolvableComment({
  comment,
  onResolved,
  onReopened,
}: {
  comment: ResolvableLayerCommentThreadFragment;
  onResolved?: (comment: ResolvableLayerCommentThreadFragment) => void;
  onReopened?: (comment: ResolvableLayerCommentThreadFragment) => void;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const onError = useGlobalErrorHandler();
  const [resolveComment, resolveState] = useResolveResolvableCommentMutation({
    onError,
  });
  const [reopenComment, reopenState] = useReopenResolvableCommentMutation({
    onError,
  });
  const resolved = Boolean(comment.resolvedAt);
  const actionLoading = resolveState.loading || reopenState.loading;

  const onAction = async () => {
    if (resolved) {
      const result = await reopenComment({
        variables: {
          commentId: comment.id,
        },
      });
      const reopened =
        result.data?.reopenResolvableLayerComment?.resolvableLayerComment;
      if (reopened) {
        onReopened?.(reopened);
      }
    } else {
      const result = await resolveComment({
        variables: {
          commentId: comment.id,
        },
      });
      const resolvedComment =
        result.data?.resolveResolvableLayerComment?.resolvableLayerComment;
      if (resolvedComment) {
        setShowReplyForm(false);
        onResolved?.(resolvedComment);
      }
    }
  };

  return (
    <div
      className={clsx(
        "mt-4 rounded-lg border p-4 shadow-sm",
        resolved
          ? "border-green-400 bg-green-50/70"
          : "border-gray-200 bg-gray-50"
      )}
    >
      <CommentAuthor
        profile={comment.authorProfile as AuthorProfileFragment | null}
        createdAt={comment.createdAt}
        showActions
        resolved={resolved}
        actionLoading={actionLoading}
        onAction={onAction}
      />
      <div className="ml-8 mt-3">
        <ResolvableCommentBody document={comment.comment} />
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 mt-4 space-y-4 border-t border-gray-200 pt-4">
          {comment.replies.map((reply) => (
            <div key={reply.id}>
              <CommentAuthor
                profile={reply.authorProfile as AuthorProfileFragment | null}
                createdAt={reply.createdAt}
              />
              <div className="ml-8 mt-3">
                <ResolvableCommentBody document={reply.comment} />
              </div>
            </div>
          ))}
        </div>
      )}
      {!resolved && showReplyForm ? (
        <div className="ml-8">
          <NewResolvableComment
            variant="reply"
            projectId={comment.projectId}
            tableOfContentsItemId={comment.tableOfContentsItemId}
            parentCommentId={comment.id}
            onCancel={() => setShowReplyForm(false)}
            onCreated={() => setShowReplyForm(false)}
          />
        </div>
      ) : !resolved ? (
        <button
          type="button"
          onClick={() => setShowReplyForm(true)}
          className="ml-8 mt-4 flex w-[calc(100%-2rem)] cursor-text items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-left text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <Trans ns="admin:data">
            Reply or click <CheckIcon className="mx-0.5 inline h-4 w-4" /> to
            resolve this comment
          </Trans>
        </button>
      ) : (
        <div className="ml-8 mt-4 rounded-full border border-green-100 bg-white/70 px-4 py-2 text-sm text-green-700">
          <Trans ns="admin:data">
            Resolved. Use the reopen button to continue this thread.
          </Trans>
        </div>
      )}
    </div>
  );
}
