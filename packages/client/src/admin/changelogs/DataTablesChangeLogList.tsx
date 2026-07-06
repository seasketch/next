import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ChevronDownIcon } from "@heroicons/react/outline";
import {
  DataTableChangeLogQuery,
  useDataTableChangeLogQuery,
} from "../../generated/graphql";
import ChangeLogListItem from "./ChangeLogListItem";
import {
  DATA_TABLE_CHANGE_LOG_EXPANDED_FIRST,
  DATA_TABLE_CHANGE_LOG_PAGE_SIZE,
} from "./dataTableChangeLogRefetch";

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

export default function DataTablesChangeLogList({
  tableOfContentsItemId,
}: {
  tableOfContentsItemId: number;
}) {
  const { t } = useTranslation("admin:data");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const scrollRestoreRef = useRef<{ el: HTMLElement; top: number } | null>(
    null,
  );
  const lastTocRef = useRef<
    NonNullable<DataTableChangeLogQuery["tableOfContentsItem"]> | undefined
  >(undefined);

  const variables = useMemo(
    () => ({
      id: tableOfContentsItemId,
      first: showAllHistory
        ? DATA_TABLE_CHANGE_LOG_EXPANDED_FIRST
        : DATA_TABLE_CHANGE_LOG_PAGE_SIZE,
    }),
    [tableOfContentsItemId, showAllHistory],
  );

  const { data, loading } = useDataTableChangeLogQuery({
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

  const changeLogs = toc?.dataTableChangeLogs ? [...toc.dataTableChangeLogs] : [];
  const activeTables = (toc?.overlayDataTables || []).map((table) => ({
    id: table.id,
    version: table.version,
  }));

  const canShowMore =
    !showAllHistory &&
    changeLogs.length >= DATA_TABLE_CHANGE_LOG_PAGE_SIZE &&
    changeLogs.length > 0;

  const initialLoading = loading && !tocQuery && !showAllHistory;

  useLayoutEffect(() => {
    const pending = scrollRestoreRef.current;
    if (!pending || !showAllHistory) return;
    pending.el.scrollTop = pending.top;
    scrollRestoreRef.current = null;
  }, [showAllHistory, changeLogs.length]);

  if ((initialLoading && !toc) || changeLogs.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="py-1 text-sm font-medium text-gray-700">
        <Trans ns="admin:data">History</Trans>
      </h3>
      <ul className="mt-4">
        {changeLogs.map((changeLog, index) => (
          <ChangeLogListItem
            key={changeLog.id}
            changeLog={changeLog}
            last={index === changeLogs.length - 1}
            dataTableActions={{
              tableOfContentsItemId,
              activeTables,
            }}
          />
        ))}
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
