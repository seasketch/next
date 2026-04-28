import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Trans } from "react-i18next";
import { ChevronDownIcon } from "@heroicons/react/outline";
import {
  LayerSettingsChangeLogQuery,
  useLayerSettingsChangeLogQuery,
} from "../../generated/graphql";
import ChangeLogListItem from "./ChangeLogListItem";
import {
  hasLoadedFullHistory,
  oldestUploadMatchesCreation,
} from "./creationAnchorLogic";
import SourceCreationAnchorItem from "./SourceCreationAnchorItem";
import {
  LAYER_SETTINGS_CHANGE_LOG_EXPANDED_FIRST,
  LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE,
} from "./layerSettingsChangeLogRefetch";

function findScrollParent(from: HTMLElement | null): HTMLElement | null {
  if (!from) return null;
  let el: HTMLElement | null = from.parentElement;
  while (el) {
    const { overflowY } = window.getComputedStyle(el);
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    ) {
      if (el.scrollHeight > el.clientHeight) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return null;
}

export default function LayerSettingsChangeLogList({
  tableOfContentsItemId,
}: {
  tableOfContentsItemId: number;
}) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const scrollRestoreRef = useRef<{ el: HTMLElement; top: number } | null>(
    null
  );
  const lastTocRef = useRef<
    NonNullable<LayerSettingsChangeLogQuery["tableOfContentsItem"]> | undefined
  >(undefined);

  const variables = useMemo(
    () => ({
      id: tableOfContentsItemId,
      first: showAllHistory
        ? LAYER_SETTINGS_CHANGE_LOG_EXPANDED_FIRST
        : LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE,
    }),
    [tableOfContentsItemId, showAllHistory]
  );

  const { data, loading } = useLayerSettingsChangeLogQuery({
    variables,
    skip: !tableOfContentsItemId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const tocQuery = data?.tableOfContentsItem;
  if (tocQuery) {
    lastTocRef.current = tocQuery;
  }

  const toc =
    tocQuery ??
    (showAllHistory && loading ? lastTocRef.current : undefined) ??
    lastTocRef.current;

  const directChangeLogs = toc?.changeLogs ? [...toc.changeLogs] : [];
  const relatedPublishChangeLogs = toc?.relatedPublishChangeLogs
    ? [...toc.relatedPublishChangeLogs]
    : [];
  const changeLogs = [...directChangeLogs, ...relatedPublishChangeLogs]
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    .slice(0, variables.first);
  const rawCreatedAt = toc?.dataLayer?.dataSource?.createdAt;
  const authorProfile = toc?.dataLayer?.dataSource?.authorProfile ?? undefined;
  const createdAt = rawCreatedAt ? new Date(rawCreatedAt) : undefined;
  const isFolder = toc?.isFolder ?? false;

  const hasFullHistory = hasLoadedFullHistory(
    directChangeLogs.length,
    LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE,
    showAllHistory
  );

  const oldestLog =
    directChangeLogs.length > 0
      ? directChangeLogs[directChangeLogs.length - 1]
      : undefined;

  const uploadDocumentsCreation =
    createdAt != null &&
    hasFullHistory &&
    oldestUploadMatchesCreation({
      oldest: oldestLog,
      createdAt,
    });

  const showCreationAnchor =
    Boolean(createdAt) && hasFullHistory && !uploadDocumentsCreation;

  const itemCount = changeLogs.length + (showCreationAnchor ? 1 : 0);

  const canShowMore =
    !showAllHistory &&
    (directChangeLogs.length >= LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE ||
      relatedPublishChangeLogs.length >= LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE) &&
    itemCount > 0;

  const initialLoading = loading && !tocQuery && !showAllHistory;

  useLayoutEffect(() => {
    const pending = scrollRestoreRef.current;
    if (!pending || !showAllHistory) return;
    pending.el.scrollTop = pending.top;
    scrollRestoreRef.current = null;
  }, [showAllHistory, changeLogs.length]);

  if ((initialLoading && !toc) || itemCount === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Trans ns="admin:data">History</Trans>
      </h3>
      <ul className="mt-4">
        {changeLogs.map((changeLog, index) => (
          <ChangeLogListItem
            key={changeLog.id}
            changeLog={changeLog}
            last={index === changeLogs.length - 1 && !showCreationAnchor}
          />
        ))}
        {showCreationAnchor && createdAt && (
          <SourceCreationAnchorItem
            isFolder={isFolder}
            createdAt={createdAt}
            profile={authorProfile}
          />
        )}
      </ul>
      {canShowMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={(e) => {
              const scrollEl = findScrollParent(e.currentTarget);
              if (scrollEl) {
                scrollRestoreRef.current = {
                  el: scrollEl,
                  top: scrollEl.scrollTop,
                };
              }
              setShowAllHistory(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
          >
            <ChevronDownIcon className="h-4 w-4 text-gray-500" aria-hidden />
            <span>
              <Trans ns="admin:data">View full history</Trans>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
