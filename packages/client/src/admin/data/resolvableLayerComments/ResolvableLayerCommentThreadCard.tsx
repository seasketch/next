import { CheckCircledIcon } from "@radix-ui/react-icons";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import ProfilePhoto from "../../users/ProfilePhoto";
import {
  DraftTableOfContentsDocument,
  GetLayerItemDocument,
  ResolvableLayerCommentCardFragment,
  useAdminsQuery,
  useCreateResolvableLayerCommentMutationMutation,
  useReopenResolvableLayerCommentMutationMutation,
  useResolveResolvableLayerCommentMutationMutation,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import ResolvableLayerCommentBody from "./ResolvableLayerCommentBody";
import ResolvableLayerCommentEditor from "./ResolvableLayerCommentEditor";
import { isLayerCommentDocEmpty } from "./commentDocEmpty";
import { CommentThread } from "./buildCommentThreads";
import {
  formatExactTimestampTooltip,
  formatRelativeTimeSince,
} from "../../changelogs/relativeTimeFormat";

function ProfileBlock({
  comment,
}: {
  comment: ResolvableLayerCommentCardFragment;
}) {
  const { t } = useTranslation("admin:data");
  const p = comment.authorProfile;
  const name = p
    ? p.nickname ||
      p.fullname ||
      p.email ||
      t("User #{{id}}", { id: comment.authorId })
    : t("User #{{id}}", { id: comment.authorId });
  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
        {p ? (
          <ProfilePhoto
            fullname={p.fullname || undefined}
            email={p.email || undefined}
            canonicalEmail={p.email || ""}
            picture={p.picture || undefined}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
            {String(comment.authorId).slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-gray-900">{name}</span>
          <time
            className="text-xs text-gray-500"
            dateTime={comment.createdAt}
            title={formatExactTimestampTooltip(comment.createdAt)}
          >
            {formatRelativeTimeSince(comment.createdAt)}
          </time>
        </div>
        <div className="mt-1 text-sm text-gray-800">
          <ResolvableLayerCommentBody
            documentJson={
              (comment.comment || {}) as Record<string, unknown> | null
            }
            className="ProseMirror"
          />
        </div>
      </div>
    </div>
  );
}

export default function ResolvableLayerCommentThreadCard(props: {
  thread: CommentThread;
  tableOfContentsItemId: number;
  disabled?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const { slug } = useParams<{ slug: string }>();
  const onError = useGlobalErrorHandler();
  const { data: adminsData } = useAdminsQuery({
    variables: { slug: slug || getSlug(), first: 500 },
  });
  const admins = adminsData?.root?.participants || [];

  const [replyDoc, setReplyDoc] = useState<Record<string, unknown> | null>(
    null
  );
  const [replyEditorKey, setReplyEditorKey] = useState(0);

  const refetch = {
    query: GetLayerItemDocument,
    variables: { id: props.tableOfContentsItemId },
  };

  const refetchDraft = {
    query: DraftTableOfContentsDocument,
    variables: { slug: slug || getSlug() },
  };

  const [resolveMut, resolveState] =
    useResolveResolvableLayerCommentMutationMutation({
      refetchQueries: [refetch, refetchDraft],
      awaitRefetchQueries: true,
      onError,
    });
  const [reopenMut, reopenState] =
    useReopenResolvableLayerCommentMutationMutation({
      refetchQueries: [refetch, refetchDraft],
      awaitRefetchQueries: true,
      onError,
    });
  const [createMut, createState] =
    useCreateResolvableLayerCommentMutationMutation({
      refetchQueries: [refetch, refetchDraft],
      awaitRefetchQueries: true,
      onError,
      onCompleted: () => {
        setReplyDoc(null);
        setReplyEditorKey((k) => k + 1);
      },
    });

  const root = props.thread.root;
  const unresolved = root.resolvedAt == null;

  const onResolve = useCallback(async () => {
    await resolveMut({
      variables: {
        input: { commentId: root.id },
      },
    });
  }, [resolveMut, root.id]);

  const onReopen = useCallback(async () => {
    await reopenMut({
      variables: {
        input: { commentId: root.id },
      },
    });
  }, [reopenMut, root.id]);

  const resolverDisplay =
    root.resolvedByProfile &&
    (root.resolvedByProfile.nickname ||
      root.resolvedByProfile.fullname ||
      root.resolvedByProfile.email ||
      t("User #{{id}}", {
        id: root.resolvedById || root.resolvedByProfile.userId,
      }));

  const onSendReply = useCallback(async () => {
    if (!replyDoc || isLayerCommentDocEmpty(replyDoc)) {
      return;
    }
    await createMut({
      variables: {
        input: {
          tableOfContentsItemId: props.tableOfContentsItemId,
          comment: replyDoc,
          parentCommentId: root.id,
        },
      },
    });
  }, [createMut, replyDoc, props.tableOfContentsItemId, root.id]);

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {!props.disabled && unresolved ? (
        <button
          type="button"
          className="absolute right-3 top-3 text-primary-600 hover:text-primary-800 disabled:opacity-40"
          title={t("Mark resolved")}
          aria-label={t("Mark resolved")}
          disabled={
            props.disabled || resolveState.loading || createState.loading
          }
          onClick={onResolve}
        >
          <CheckCircledIcon className="h-6 w-6" />
        </button>
      ) : null}

      <ProfileBlock comment={root} />

      {root.resolvedAt ? (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <CheckCircledIcon className="mr-1 inline-block h-4 w-4 align-text-bottom" />
          {t("Marked resolved {{when}}", {
            when: formatRelativeTimeSince(root.resolvedAt),
          })}
          {resolverDisplay ? (
            <span className="text-emerald-800">
              {" "}
              {t(" — {{resolver}}", { resolver: resolverDisplay })}
            </span>
          ) : null}
          {!props.disabled ? (
            <button
              type="button"
              className="ml-2 font-medium text-primary-700 underline"
              onClick={onReopen}
              disabled={reopenState.loading}
            >
              {t("Reopen")}
            </button>
          ) : null}
        </div>
      ) : null}

      {props.thread.replies.length > 0 ? (
        <ul className="mt-4 space-y-4 border-l-2 border-gray-100 pl-4">
          {props.thread.replies.map((r) => (
            <li key={r.id}>
              <ProfileBlock comment={r} />
            </li>
          ))}
        </ul>
      ) : null}

      {!props.disabled && !root.resolvedAt ? (
        <div className="mt-4">
          <ResolvableLayerCommentEditor
            key={`reply-${root.id}-${replyEditorKey}`}
            initialDoc={replyDoc || undefined}
            onChange={setReplyDoc}
            admins={admins}
            disabled={props.disabled || createState.loading}
            placeholder={t("Reply or add others with @")}
            onSubmit={onSendReply}
          />
        </div>
      ) : null}
    </div>
  );
}
