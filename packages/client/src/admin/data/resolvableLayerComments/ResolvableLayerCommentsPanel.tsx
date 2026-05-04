import { useCallback, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  DraftTableOfContentsDocument,
  FullAdminOverlayFragment,
  GetLayerItemDocument,
  ResolvableLayerCommentCardFragment,
  useAdminsQuery,
  useCreateResolvableLayerCommentMutationMutation,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import ResolvableLayerCommentEditor from "./ResolvableLayerCommentEditor";
import { buildCommentThreads } from "./buildCommentThreads";
import ResolvableLayerCommentThreadCard from "./ResolvableLayerCommentThreadCard";
import { isLayerCommentDocEmpty } from "./commentDocEmpty";

export default function ResolvableLayerCommentsPanel(props: {
  item: FullAdminOverlayFragment;
}) {
  const { t } = useTranslation("admin:data");
  const { slug } = useParams<{ slug: string }>();
  const onError = useGlobalErrorHandler();
  const projectSlug = slug || getSlug();

  const { data: adminsData } = useAdminsQuery({
    variables: { slug: projectSlug, first: 500 },
  });
  const admins = adminsData?.root?.participants || [];

  const nodes = (
    props.item.resolvableLayerCommentsConnection?.nodes?.filter(
      (n): n is ResolvableLayerCommentCardFragment => Boolean(n)
    ) ?? []
  );
  const threads = useMemo(() => buildCommentThreads(nodes), [nodes]);

  const unresolvedThreads = useMemo(
    () => threads.filter((th) => th.root.resolvedAt == null),
    [threads]
  );
  const resolvedThreads = useMemo(
    () => threads.filter((th) => th.root.resolvedAt != null),
    [threads]
  );

  const [showResolved, setShowResolved] = useState(false);
  const [showNewCommentComposer, setShowNewCommentComposer] = useState(false);
  const [newDoc, setNewDoc] = useState<Record<string, unknown> | null>(null);
  const [newThreadKey, setNewThreadKey] = useState(0);

  const refetch = {
    query: GetLayerItemDocument,
    variables: { id: props.item.id },
  };
  const refetchDraft = {
    query: DraftTableOfContentsDocument,
    variables: { slug: projectSlug },
  };

  const [createMut, createState] =
    useCreateResolvableLayerCommentMutationMutation({
      refetchQueries: [refetch, refetchDraft],
      awaitRefetchQueries: true,
      onError,
      onCompleted: () => {
        setNewDoc(null);
        setNewThreadKey((k) => k + 1);
        setShowNewCommentComposer(false);
      },
    });

  const onNewThread = useCallback(async () => {
    if (!newDoc || isLayerCommentDocEmpty(newDoc)) {
      return;
    }
    await createMut({
      variables: {
        input: {
          tableOfContentsItemId: props.item.id,
          comment: newDoc,
          parentCommentId: null,
        },
      },
    });
  }, [createMut, newDoc, props.item.id]);

  /** Single CTA inside dashed empty-state — underline stays visible for discoverability. */
  const emptyStateLinkClass =
    "text-sm font-medium text-primary-700 underline decoration-primary-700/35 underline-offset-2 hover:decoration-primary-900 hover:text-primary-900 disabled:opacity-50";
  /** Toolbar-style row: full underline on several adjacent links feels noisy — underline on hover only. */
  const actionRowLinkClass =
    "text-sm font-medium text-primary-700 hover:underline underline-offset-2 hover:text-primary-900 disabled:opacity-50";

  return (
    <div id="layer-comments" className="mt-8 scroll-mt-4">
      <h3 className="py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t("Comments")}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        <Trans ns="admin:data">
          Coordinate review tasks among project admins. Resolved threads stay
          visible for history.
        </Trans>
      </p>

      <div className="mt-4">
        {threads.length === 0 ? (
          <p className="mb-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-600">
            {!showNewCommentComposer ? (
              <>
                {t("No comments yet.")}{" "}
                <button
                  type="button"
                  className={emptyStateLinkClass}
                  onClick={() => setShowNewCommentComposer(true)}
                >
                  {t("Start a thread")}
                </button>{" "}
                {t("to discuss changes to this layer.")}
              </>
            ) : (
              <>
                {t("Write your comment below, or")}{" "}
                <button
                  type="button"
                  className={emptyStateLinkClass}
                  onClick={() => setShowNewCommentComposer(false)}
                >
                  {t("Cancel")}
                </button>
              </>
            )}
          </p>
        ) : null}
      </div>

      {unresolvedThreads.length > 0 ? (
        <div className="mt-6 space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("Open threads")}
          </h4>
          {unresolvedThreads.map((th) => (
            <ResolvableLayerCommentThreadCard
              key={th.root.id}
              thread={th}
              tableOfContentsItemId={props.item.id}
            />
          ))}
        </div>
      ) : null}

      {threads.length > 0 || resolvedThreads.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          {threads.length > 0 ? (
            <button
              type="button"
              className={actionRowLinkClass}
              disabled={createState.loading}
              onClick={() => setShowNewCommentComposer((open) => !open)}
            >
              {showNewCommentComposer ? t("Cancel") : t("New Comment")}
            </button>
          ) : null}
          {resolvedThreads.length > 0 ? (
            <button
              type="button"
              className={actionRowLinkClass}
              onClick={() => setShowResolved((s) => !s)}
            >
              {showResolved
                ? t("Hide {{count}} resolved thread(s)", {
                    count: resolvedThreads.length,
                  })
                : t("Show {{count}} resolved thread(s)", {
                    count: resolvedThreads.length,
                  })}
            </button>
          ) : null}
        </div>
      ) : null}

      {showNewCommentComposer ? (
        <div className="mt-4">
          <ResolvableLayerCommentEditor
            key={`new-${props.item.id}-${newThreadKey}`}
            initialDoc={newDoc || undefined}
            onChange={setNewDoc}
            admins={admins}
            disabled={createState.loading}
            placeholder={t("Add a comment or mention others with @")}
            onSubmit={onNewThread}
          />
        </div>
      ) : null}

      {showResolved && resolvedThreads.length > 0 ? (
        <div className="mt-6 space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("Resolved threads")}
          </h4>
          {resolvedThreads.map((th) => (
            <ResolvableLayerCommentThreadCard
              key={th.root.id}
              thread={th}
              tableOfContentsItemId={props.item.id}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
