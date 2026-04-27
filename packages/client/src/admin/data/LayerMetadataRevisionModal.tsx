import clsx from "clsx";
import { ClockIcon, RefreshIcon, XIcon } from "@heroicons/react/outline";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Modal from "../../components/Modal";
import Warning from "../../components/Warning";
import MetadataDocumentView from "../../dataLayers/MetadataDocumentView";
import InlineAuthor from "../../components/InlineAuthor";
import {
  AuthorProfileFragment,
  ChangeLogFieldGroup,
  GetMetadataDocument,
  LayerMetadataChangesDocument,
  LayerMetadataChangesQuery,
  useLayerMetadataChangesQuery,
  useUpdateMetadataMutation,
} from "../../generated/graphql";
import { layerSettingsChangeLogRefetchQueries } from "../changelogs/layerSettingsChangeLogRefetch";

type MetadataRevision = {
  id: string;
  changeLogId?: string;
  metadataValue: any;
  previewDocument?: any;
  date?: string;
  profile?: AuthorProfileFragment | null;
  current?: boolean;
  original?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function LayerMetadataRevisionModal({
  tableOfContentsItemId,
  initialChangeLogId,
  title,
  onRequestClose,
  onRollbackComplete,
}: {
  tableOfContentsItemId: number;
  initialChangeLogId?: string | number;
  title?: string;
  onRequestClose: () => void;
  onRollbackComplete?: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const { data, loading, error, refetch } = useLayerMetadataChangesQuery({
    variables: { id: tableOfContentsItemId },
    fetchPolicy: "cache-and-network",
  });

  const revisions = useMemo(() => buildRevisions(data), [data]);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>();
  const [confirmRestore, setConfirmRestore] = useState(false);
  const selectedRevision =
    revisions.find((revision) => revision.id === selectedRevisionId) ||
    revisions[0];

  useEffect(() => {
    if (!revisions.length || selectedRevisionId) {
      return;
    }
    const initialId =
      initialChangeLogId == null ? undefined : String(initialChangeLogId);
    const initialRevision = initialId
      ? revisions.find((revision) => revision.changeLogId === initialId)
      : undefined;
    setSelectedRevisionId((initialRevision || revisions[0]).id);
  }, [initialChangeLogId, revisions, selectedRevisionId]);

  const [updateMetadata, updateMetadataState] = useUpdateMetadataMutation({
    refetchQueries: [
      {
        query: LayerMetadataChangesDocument,
        variables: { id: tableOfContentsItemId },
      },
      {
        query: GetMetadataDocument,
        variables: { itemId: tableOfContentsItemId },
      },
      ...layerSettingsChangeLogRefetchQueries(tableOfContentsItemId),
    ],
    onError,
    onCompleted: () => {
      refetch();
      if (onRollbackComplete) {
        onRollbackComplete();
      }
    },
  });

  const selectedIsCurrent = Boolean(selectedRevision?.current);

  const restoreSelectedRevision = async () => {
    if (!selectedRevision || selectedIsCurrent) {
      return;
    }
    setConfirmRestore(true);
  };

  const confirmRestoreSelectedRevision = async () => {
    if (!selectedRevision || selectedIsCurrent) {
      return;
    }
    await updateMetadata({
      variables: {
        itemId: tableOfContentsItemId,
        metadata: selectedRevision.metadataValue,
      },
    });
    setConfirmRestore(false);
    setSelectedRevisionId("current");
  };

  return (
    <Modal
      title=""
      zeroPadding
      loading={loading && !data}
      onRequestClose={onRequestClose}
      panelClassName="sm:max-w-6xl lg:max-w-6xl w-full max-h-almost-full"
    >
      <div
        className="flex max-h-full flex-col overflow-hidden bg-white"
        style={{ height: "min(82vh, 48rem)" }}
      >
        <div className="flex flex-none items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <ClockIcon className="h-5 w-5 text-gray-500" />
              <h2>{title || t("Metadata history")}</h2>
            </div>
            {/* <p className="mt-1 text-sm text-gray-500">
              <Trans ns="admin:data">
                Review previous layer metadata revisions and restore one if
                needed.
              </Trans>
            </p> */}
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label={t("Close")}
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-5">
            <Warning level="error">{error.message}</Warning>
          </div>
        )}

        {!error && (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside className="w-80 flex-none overflow-y-auto border-r border-gray-200 bg-gray-50 p-3">
              {revisions.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">
                  {t("No metadata revisions found")}
                </p>
              ) : (
                <ol className="space-y-2">
                  {revisions.map((revision) => (
                    <RevisionListItem
                      key={revision.id}
                      revision={revision}
                      selected={revision.id === selectedRevision?.id}
                      onClick={() => {
                        setConfirmRestore(false);
                        setSelectedRevisionId(revision.id);
                      }}
                    />
                  ))}
                </ol>
              )}
            </aside>

            <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {selectedRevision && (
                <div className="flex h-12 flex-none items-center justify-between gap-4 border-b border-gray-200 px-5">
                  <RevisionHeaderAuthor revision={selectedRevision} />
                  {!selectedIsCurrent && (
                    <div className="flex w-40 justify-end">
                      <Button
                        small
                        loading={updateMetadataState.loading}
                        onClick={restoreSelectedRevision}
                        label={
                          <span className="inline-flex items-center">
                            <RefreshIcon className="mr-1.5 h-4 w-4" />
                            {t("Restore revision")}
                          </span>
                        }
                      />
                    </div>
                  )}
                  {selectedIsCurrent && <div className="w-40 flex-none" />}
                </div>
              )}
              {confirmRestore && selectedRevision && (
                <div className="flex flex-none items-start justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-3">
                  <div className="text-sm">
                    <p className="font-medium text-amber-900">
                      <Trans ns="admin:data">
                        Restore this metadata revision?
                      </Trans>
                    </p>
                    <p className="mt-1 text-amber-800">
                      <Trans ns="admin:data">
                        The current layer metadata will be replaced with the
                        selected revision.
                      </Trans>
                    </p>
                  </div>
                  <div className="flex flex-none gap-2">
                    <Button
                      small
                      primary
                      loading={updateMetadataState.loading}
                      onClick={confirmRestoreSelectedRevision}
                      label={t("Restore")}
                    />
                    <Button
                      small
                      disabled={updateMetadataState.loading}
                      onClick={() => setConfirmRestore(false)}
                      label={t("Cancel")}
                    />
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="metadata mx-auto max-w-3xl">
                  <MetadataDocumentView
                    document={selectedRevision?.previewDocument}
                    className="ProseMirror"
                    emptyMessage={
                      <p className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                        <Trans ns="admin:data">
                          This revision uses dynamic service metadata and has no
                          saved custom metadata document.
                        </Trans>
                      </p>
                    }
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RevisionListItem({
  revision,
  selected,
  onClick,
}: {
  revision: MetadataRevision;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const date = revision.date ? new Date(revision.date) : undefined;
  const name = revisionAuthorName(revision, t);

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={clsx(
          "w-full cursor-pointer rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary-500",
          selected
            ? "border-primary-300 bg-white shadow-sm"
            : "border-transparent hover:border-gray-200 hover:bg-white"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900">
            {date ? dateFormatter.format(date) : t("Unknown date")}
          </span>
          {revision.current && (
            <span className="rounded-full border border-primary-300 bg-primary-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-800 shadow-sm">
              {t("Current")}
            </span>
          )}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          <span>{name}</span>
        </div>
      </div>
    </li>
  );
}

function RevisionHeaderAuthor({ revision }: { revision: MetadataRevision }) {
  const { t } = useTranslation("admin:data");
  const date = revision.date ? new Date(revision.date) : undefined;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      {revision.profile ? (
        <InlineAuthor profile={revision.profile} className="min-w-0" />
      ) : (
        <span className="font-semibold text-gray-900">
          {t("Unknown user")}
        </span>
      )}
      {date && (
        <time
          className="min-w-0 text-xs text-gray-500"
          dateTime={date.toISOString()}
          title={dateFormatter.format(date)}
        >
          {dateFormatter.format(date)}
        </time>
      )}
    </div>
  );
}

function revisionAuthorName(
  revision: MetadataRevision,
  t: (key: string) => string
) {
  return (
    revision.profile?.fullname ||
    revision.profile?.nickname ||
    revision.profile?.email ||
    t("Unknown user")
  );
}

function buildRevisions(data?: LayerMetadataChangesQuery): MetadataRevision[] {
  const toc = data?.tableOfContentsItem;
  if (!toc) {
    return [];
  }

  const metadataLogs = (toc.changeLogs || [])
    .filter((log) => Boolean(log))
    .filter((log) => log.fieldGroup === ChangeLogFieldGroup.LayerMetadata)
    .sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );

  const revisions: MetadataRevision[] = [
    {
      id: "current",
      changeLogId: metadataLogs[0] ? String(metadataLogs[0].id) : undefined,
      metadataValue: toc.metadata,
      previewDocument: toc.metadata || toc.computedMetadata,
      date: metadataLogs[0]?.lastAt,
      profile: metadataLogs[0]?.editorProfile || null,
      current: true,
    },
  ];

  metadataLogs.slice(1).forEach((log) => {
    revisions.push({
      // eslint-disable-next-line i18next/no-literal-string
      id: `revision-${log.id}`,
      changeLogId: String(log.id),
      metadataValue: log.toBlob,
      previewDocument: log.toBlob,
      date: log.lastAt,
      profile: log.editorProfile || null,
    });
  });

  const oldestLog = metadataLogs[metadataLogs.length - 1];
  if (oldestLog) {
    revisions.push({
      // eslint-disable-next-line i18next/no-literal-string
      id: `original-${oldestLog.id}`,
      metadataValue: oldestLog.fromBlob,
      previewDocument: oldestLog.fromBlob,
      date: oldestLog.startedAt,
      profile: oldestLog.editorProfile || null,
      original: true,
    });
  }

  return revisions;
}


