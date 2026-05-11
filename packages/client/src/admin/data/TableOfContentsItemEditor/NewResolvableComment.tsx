import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import Button from "../../../components/Button";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import InlineAuthor from "../../../components/InlineAuthor";
import ProfilePhoto from "../../users/ProfilePhoto";
import {
  AuthorProfileFragment,
  ChangeLogsSinceLastPublishDocument,
  ResolvableLayerCommentThreadFragment,
  useCreateResolvableCommentMutation,
  useMeQuery,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import { layerSettingsChangeLogRefetchQueries } from "../../changelogs/layerSettingsChangeLogRefetch";
import {
  emptyResolvableCommentDoc,
  isResolvableCommentJsonEmpty,
} from "./ResolvableCommentEditor";
import ResolvableCommentEditor from "./ResolvableCommentEditor";
import { formatTimeAgo } from "../../changelogs/ChangeLogTimelineItem";

export interface NewResolvableCommentCreatedResult {
  createdComment?: any;
  resolvedThread?: ResolvableLayerCommentThreadFragment;
  resolvedWithReply: boolean;
}

export default function NewResolvableComment({
  projectId,
  tableOfContentsItemId,
  parentCommentId,
  onCancel,
  onCreated,
  variant = "thread",
}: {
  projectId: number;
  tableOfContentsItemId: number;
  parentCommentId?: number;
  onCancel: () => void;
  onCreated: (result?: NewResolvableCommentCreatedResult) => void;
  variant?: "thread" | "reply";
}) {
  const { t } = useTranslation("admin:data");
  const auth0 = useAuth0();
  const onError = useGlobalErrorHandler();
  const { data } = useMeQuery({ fetchPolicy: "cache-first" });
  const [comment, setComment] = useState<any>(() =>
    emptyResolvableCommentDoc()
  );
  const [empty, setEmpty] = useState(true);
  const refetchQueries = useMemo(
    () => [
      {
        query: ChangeLogsSinceLastPublishDocument,
        variables: { slug: getSlug() },
      },
      ...layerSettingsChangeLogRefetchQueries(tableOfContentsItemId),
    ],
    [tableOfContentsItemId]
  );
  const [mutate, mutationState] = useCreateResolvableCommentMutation({
    onError,
    refetchQueries,
  });
  const createdAt = useMemo(() => new Date(), []);
  const profile = data?.me?.profile;
  const isReply = variant === "reply";
  const submit = async (resolveWithReply: boolean) => {
    const result = await mutate({
      variables: {
        projectId,
        tableOfContentsItemId,
        comment,
        parentCommentId,
        setResolved: isReply ? resolveWithReply : undefined,
      },
    });
    if (result.data?.createResolvableLayerComment?.resolvableLayerComment) {
      const createdComment =
        result.data.createResolvableLayerComment.resolvableLayerComment;
      const resolvedThread = resolveWithReply
        ? result.data.createResolvableLayerComment.tableOfContentsItem?.resolvedCommentThreads?.find(
            (thread) => thread.id === parentCommentId
          )
        : undefined;
      onCreated({
        createdComment,
        resolvedThread: resolvedThread || undefined,
        resolvedWithReply: Boolean(resolveWithReply),
      });
    }
  };
  const submitDisabled =
    mutationState.loading || empty || isResolvableCommentJsonEmpty(comment);

  return (
    <div
      className={
        isReply
          ? "mt-4 rounded-lg border border-gray-200 bg-white p-3"
          : "mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm"
      }
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          {profile ? (
            <InlineAuthor
              profile={profile as AuthorProfileFragment}
              className="min-w-0"
            />
          ) : (
            <div className="flex items-center">
              <div className="h-6 w-6 flex-none">
                <ProfilePhoto
                  canonicalEmail={auth0.user?.email || ""}
                  email={auth0.user?.email}
                  fullname={auth0.user?.name}
                  picture={auth0.user?.picture}
                  defaultImg="mm"
                />
              </div>
              <span className="ml-2 truncate text-sm font-semibold text-gray-900">
                {auth0.user?.name || auth0.user?.email || t("You")}
              </span>
            </div>
          )}
          <time
            dateTime={createdAt.toISOString()}
            title={createdAt.toLocaleString()}
            className="ml-8 block text-sm text-gray-400"
          >
            {formatTimeAgo(createdAt)}
          </time>
        </div>
      </div>
      <div className="ml-8 mt-3">
        <ResolvableCommentEditor
          value={comment}
          autoFocus
          placeholder={isReply ? t("Write a reply") : t("Write a comment")}
          onChange={(value, isEmpty) => {
            setComment(value);
            setEmpty(isEmpty);
          }}
        />
      </div>
      <div
        className="ml-8 mt-4 flex items-center justify-end gap-3"
        data-prosemirror-ignore-clear-selection="true"
      >
        <Button
          small
          disabled={mutationState.loading}
          onClick={onCancel}
          label={<Trans ns="admin:data">Cancel</Trans>}
        />
        <Button
          small
          primary
          disabled={submitDisabled}
          loading={mutationState.loading}
          onClick={() => submit(false)}
          label={
            isReply ? (
              <Trans ns="admin:data">Reply</Trans>
            ) : (
              <Trans ns="admin:data">Comment</Trans>
            )
          }
        />
      </div>
    </div>
  );
}
