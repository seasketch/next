import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  InformationCircleIcon,
  XIcon,
} from "@heroicons/react/outline";
import clsx from "clsx";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Modal from "../../components/Modal";
import Warning from "../../components/Warning";
import { BasemapContext } from "../../dataLayers/BasemapContext";
import {
  BasemapDetailsFragment,
  LayerCartographyChangesDocument,
  useLayerCartographyChangesQuery,
  useUpdateLayerMutation,
} from "../../generated/graphql";
import { CHANGE_LOG_INTRODUCTION_DATE } from "../changelogs/constants";
import { layerSettingsChangeLogRefetchQueries } from "../changelogs/layerSettingsChangeLogRefetch";
import CartographyRevisionSplitMap from "./CartographyRevisionSplitMap";
import {
  buildCartographyRevisions,
  CartographyRevision,
  hasComparableCartographyHistory,
  isCartographyComparisonSupported,
  normalizeMapboxGlStyles,
  resolveInitialLeftRevisionId,
  selectableLeftRevisions,
} from "./cartographyRevisionUtils";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const rolloutDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

function revisionAuthorName(revision: CartographyRevision) {
  return (
    revision.profile?.nickname ||
    revision.profile?.fullname ||
    revision.profile?.email
  );
}

export default function LayerCartographyRevisionModal({
  tableOfContentsItemId,
  initialChangeLogId,
  title,
  onRequestClose,
}: {
  tableOfContentsItemId: number;
  initialChangeLogId?: string | number | null;
  title?: string;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const basemapCtx = useContext(BasemapContext);

  const { data, loading, error, refetch } = useLayerCartographyChangesQuery({
    variables: { id: tableOfContentsItemId },
    fetchPolicy: "cache-and-network",
  });

  const revisions = useMemo(() => buildCartographyRevisions(data), [data]);

  const leftOptions = useMemo(
    () => selectableLeftRevisions(revisions),
    [revisions]
  );

  const toc = data?.tableOfContentsItem;
  const dataLayer = toc?.dataLayer;
  const source = dataLayer?.dataSource;

  const supportsComparison = isCartographyComparisonSupported(source?.type);
  const hasComparableHistory = hasComparableCartographyHistory(revisions);
  const currentRevision = revisions.find((r) => r.current);

  const basemap = basemapCtx.getSelectedBasemap() as
    | BasemapDetailsFragment
    | undefined;

  const [leftRevisionId, setLeftRevisionId] = useState<string>();
  const [confirmRollback, setConfirmRollback] = useState(false);
  const initialized = useRef(false);

  const sourceCreatedAt = source?.createdAt
    ? new Date(source.createdAt as string)
    : null;
  const showRolloutNote =
    !hasComparableHistory &&
    sourceCreatedAt != null &&
    sourceCreatedAt.getTime() > CHANGE_LOG_INTRODUCTION_DATE.getTime();

  useEffect(() => {
    initialized.current = false;
    setLeftRevisionId(undefined);
    setConfirmRollback(false);
  }, [tableOfContentsItemId, initialChangeLogId]);

  useEffect(() => {
    if (!leftOptions.length || initialized.current) {
      return;
    }
    initialized.current = true;
    const id = resolveInitialLeftRevisionId(
      revisions,
      toc?.cartographyChangeLogs,
      initialChangeLogId
    );
    if (id) {
      setLeftRevisionId(id);
    }
  }, [
    leftOptions.length,
    revisions,
    toc?.cartographyChangeLogs,
    initialChangeLogId,
  ]);

  const leftRevision =
    leftOptions.find((r) => r.id === leftRevisionId) ?? leftOptions[0];

  const [updateLayer, updateLayerState] = useUpdateLayerMutation({
    refetchQueries: [
      {
        query: LayerCartographyChangesDocument,
        variables: { id: tableOfContentsItemId },
      },
      ...layerSettingsChangeLogRefetchQueries(tableOfContentsItemId),
    ],
    onError,
    onCompleted: () => {
      setConfirmRollback(false);
      initialized.current = false;
      setLeftRevisionId(undefined);
      refetch();
    },
  });

  const rollbackSelectedRevision = async () => {
    if (!leftRevision || !dataLayer) {
      return;
    }
    await updateLayer({
      variables: {
        id: dataLayer.id,
        mapboxGlStyles: leftRevision.mapboxGlStyles,
      },
    });
  };

  return (
    <Modal
      title=""
      zeroPadding
      loading={loading && !data}
      onRequestClose={onRequestClose}
      disableBackdropClick
      panelClassName="sm:max-w-6xl lg:max-w-7xl w-full max-h-almost-full"
    >
      <div className="flex h-[min(88vh,calc(100vh-4rem))] max-h-[88vh] flex-col overflow-hidden bg-slate-50">
        <div className="flex flex-none items-start justify-between gap-3 border-b border-gray-200 bg-white px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <ClockIcon className="h-5 w-5 shrink-0 text-gray-500" />
              <h2 className="truncate">{title || t("Cartography history")}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {toc?.title && (
                <p className="max-w-full truncate text-sm text-gray-600">
                  {toc.title}
                </p>
              )}
              {showRolloutNote && (
                <span
                  className="inline-flex max-w-full items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs leading-snug text-gray-600"
                  title={t(
                    "Full cartography change history is recorded for edits made on or after {{date}}.",
                    {
                      date: rolloutDateFormatter.format(
                        CHANGE_LOG_INTRODUCTION_DATE
                      ),
                    }
                  )}
                >
                  <InformationCircleIcon
                    className="h-3.5 w-3.5 shrink-0 text-gray-500"
                    aria-hidden
                  />
                  <span className="max-w-[14rem] truncate sm:max-w-xs">
                    {t("History since {{date}}", {
                      date: rolloutDateFormatter.format(
                        CHANGE_LOG_INTRODUCTION_DATE
                      ),
                    })}
                  </span>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
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

        {!error && !supportsComparison && (
          <div className="p-6">
            <Warning level="warning">
              <Trans ns="admin:data">
                Cartography comparison is not available for this data source
                type.
              </Trans>
            </Warning>
          </div>
        )}

        {!error && supportsComparison && !dataLayer && (
          <div className="p-6">
            <Warning level="warning">
              <Trans ns="admin:data">
                This table of contents item does not have an associated data
                layer.
              </Trans>
            </Warning>
          </div>
        )}

        {!error && supportsComparison && dataLayer && source && (
          <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50">
            {!hasComparableHistory ? (
              <>
                <div className="flex flex-none flex-col gap-1 border-b border-gray-200 bg-white px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    <Trans ns="admin:data">Current revision</Trans>
                  </div>
                  <p className="text-xs leading-snug text-gray-600">
                    <Trans ns="admin:data">
                      No earlier cartography revisions are stored for this
                      layer. Note that the changelog system was introduced on{" "}
                      {CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString()}.
                      Changes made before this date are not available.
                    </Trans>
                  </p>
                </div>
                <div className="min-h-0 flex-1 p-3">
                  <div className="h-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <CartographyRevisionSplitMap
                      variant="single"
                      basemap={basemap}
                      dataSource={source}
                      dataLayer={dataLayer}
                      leftStyles={normalizeMapboxGlStyles(
                        currentRevision?.mapboxGlStyles
                      )}
                      tocBounds={toc?.bounds ?? null}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3 border-b border-gray-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <RevisionDropdown
                      label={t("Earlier revision")}
                      revisions={leftOptions}
                      valueId={leftRevision?.id}
                      onSelect={(id) => {
                        setConfirmRollback(false);
                        setLeftRevisionId(id);
                      }}
                    />
                  </div>
                  <div className="flex items-center" aria-hidden>
                    <div className="h-8 w-px bg-gray-300" />
                  </div>
                  <div className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        <Trans ns="admin:data">Current revision</Trans>
                      </div>
                      {currentRevision && (
                        <RevisionSummary
                          revision={currentRevision}
                          showCurrentBadge={false}
                        />
                      )}
                    </div>
                  </div>
                </div>
                {confirmRollback && leftRevision && (
                  <div className="flex flex-none items-start justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="text-sm">
                      <p className="font-medium text-amber-900">
                        <Trans ns="admin:data">
                          Roll back to this earlier style?
                        </Trans>
                      </p>
                      <p className="mt-1 text-amber-800">
                        <Trans ns="admin:data">
                          The selected style will become the current
                          cartography, creating a new revision in history.
                        </Trans>
                      </p>
                    </div>
                    <div className="flex flex-none gap-2">
                      <Button
                        small
                        primary
                        loading={updateLayerState.loading}
                        onClick={rollbackSelectedRevision}
                        label={t("Rollback")}
                      />
                      <Button
                        small
                        disabled={updateLayerState.loading}
                        onClick={() => setConfirmRollback(false)}
                        label={t("Cancel")}
                      />
                    </div>
                  </div>
                )}
                <div className="min-h-0 flex-1 p-3">
                  <div className="h-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <CartographyRevisionSplitMap
                      variant="compare"
                      basemap={basemap}
                      dataSource={source}
                      dataLayer={dataLayer}
                      leftStyles={normalizeMapboxGlStyles(
                        leftRevision?.mapboxGlStyles
                      )}
                      rightStyles={normalizeMapboxGlStyles(
                        currentRevision?.mapboxGlStyles ??
                          dataLayer?.mapboxGlStyles
                      )}
                      tocBounds={toc?.bounds ?? null}
                      leftLabel={t("Earlier")}
                      rightLabel={t("Current")}
                      leftActionLabel={t("Rollback")}
                      leftActionLoading={updateLayerState.loading}
                      leftActionDisabled={!leftRevision}
                      onLeftAction={() => setConfirmRollback(true)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RevisionDropdown({
  label,
  revisions,
  valueId,
  onSelect,
}: {
  label: string;
  revisions: CartographyRevision[];
  valueId?: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation("admin:data");
  const selected = revisions.find((r) => r.id === valueId);

  return (
    <div className="min-w-0">
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          type="button"
          className="group inline-flex w-full max-w-full items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm shadow-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label={t("Select earlier cartography revision")}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {label}
            </div>
            {selected ? (
              <RevisionSummary revision={selected} />
            ) : (
              t("Select revision")
            )}
          </div>
          <span className="mt-5 flex h-4 w-4 flex-none items-center justify-center text-gray-400 group-hover:text-gray-600">
            <ChevronDownIcon className="h-4 w-4" aria-hidden />
          </span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={6}
            align="start"
            className="z-[80] max-h-80 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl"
          >
            {revisions.map((revision) => {
              const selected = revision.id === valueId;
              return (
                <DropdownMenu.Item
                  key={revision.id}
                  className={clsx(
                    "flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-gray-50 focus:bg-gray-50",
                    selected &&
                      "bg-primary-50 text-primary-900 ring-1 ring-inset ring-primary-100 hover:bg-primary-50 focus:bg-primary-50"
                  )}
                  aria-current={selected ? "true" : undefined}
                  onSelect={() => onSelect(revision.id)}
                >
                  <span
                    className={clsx(
                      "mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full",
                      selected
                        ? "bg-primary-600 text-white"
                        : "border border-transparent"
                    )}
                    aria-hidden
                  >
                    {selected && <CheckIcon className="h-3 w-3" />}
                  </span>
                  <div
                    className={clsx("min-w-0 flex-1", selected && "font-medium")}
                  >
                    <RevisionSummary revision={revision} />
                  </div>
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function RevisionSummary({
  revision,
  compact,
  showCurrentBadge = true,
}: {
  revision: CartographyRevision;
  compact?: boolean;
  showCurrentBadge?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const date = revision.date ? new Date(revision.date) : undefined;

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="truncate font-medium text-gray-900">
          {date ? dateFormatter.format(date) : t("Unknown date")}
        </span>
        {!compact && (
          <>
            <span className="text-gray-300" aria-hidden>
              {String.fromCharCode(183)}
            </span>
            <span className="truncate text-sm text-gray-500">
              {revisionAuthorName(revision) || t("Unknown user")}
            </span>
          </>
        )}
        {revision.current && showCurrentBadge && (
          <span className="rounded-full border border-primary-300 bg-primary-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-800">
            {t("Current")}
          </span>
        )}
      </div>
    </div>
  );
}
