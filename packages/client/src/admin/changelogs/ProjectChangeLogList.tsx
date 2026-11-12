import { ChevronDownIcon } from "@heroicons/react/outline";
import {
  ReactNode,
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import AutoSizer from "react-virtualized-auto-sizer";
import {
  ListChildComponentProps,
  VariableSizeList,
} from "react-window";
import { ChangeLogDetailsFragment } from "../../generated/graphql";
import Spinner from "../../components/Spinner";

interface DayGroup {
  key: string;
  date: Date;
  changeLogs: ChangeLogDetailsFragment[];
}

type HeaderRow = {
  type: "header";
  key: string;
  label: string;
  count: number;
  first: boolean;
};

type EntryRow = {
  type: "entry";
  key: string;
  changeLog: ChangeLogDetailsFragment;
  firstInGroup: boolean;
  lastInGroup: boolean;
};

type FooterRow = {
  type: "footer";
  key: "footer";
};

type ChangeLogRow = HeaderRow | EntryRow | FooterRow;

function estimateSize(row: ChangeLogRow) {
  if (row.type === "header") {
    return row.first ? 40 : 68;
  }
  if (row.type === "footer") {
    return 72;
  }
  return 88;
}

function DayHeader({ label, count }: { label: string; count: number }) {
  const { t } = useTranslation("admin");
  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 sm:px-6">
      <h3 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </h3>
      <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
        {count === 1 ? t("1 change") : t("{{count}} changes", { count })}
      </span>
    </header>
  );
}

type ListData = {
  rows: ChangeLogRow[];
  setSize: (key: string, index: number, size: number) => void;
  renderEntry: (
    changeLog: ChangeLogDetailsFragment,
    lastInGroup: boolean
  ) => ReactNode;
  hasNextPage: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  beginningMessage: ReactNode;
};

const ChangeLogRowView = memo(function ChangeLogRowView({
  index,
  style,
  data,
}: ListChildComponentProps<ListData>) {
  const row = data.rows[index];
  const contentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      data.setSize(row.key, index, element.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data, index, row]);

  return (
    <div style={style}>
      <div ref={contentRef}>
        {row.type === "header" && (
          <div className={row.first ? "pt-1" : "pt-5"}>
            <DayHeader label={row.label} count={row.count} />
          </div>
        )}
        {row.type === "entry" && (
          <ul className={row.firstInGroup ? "px-4 pt-3 sm:px-6" : "px-4 sm:px-6"}>
            {data.renderEntry(row.changeLog, row.lastInGroup)}
          </ul>
        )}
        {row.type === "footer" && (
          <div className="px-4 sm:px-6">
            {data.hasNextPage ? (
              <div className="flex justify-center py-4">
                <button
                  type="button"
                  onClick={data.onLoadMore}
                  disabled={data.loadingMore}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-wait disabled:opacity-70"
                >
                  {data.loadingMore ? (
                    <Spinner mini />
                  ) : (
                    <ChevronDownIcon
                      className="h-4 w-4 text-gray-500"
                      aria-hidden
                    />
                  )}
                  <span>
                    <Trans ns="admin:data">Load older changes</Trans>
                  </span>
                </button>
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-gray-400">
                {data.beginningMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default function ProjectChangeLogList({
  dayGroups,
  formatDay,
  renderEntry,
  hasNextPage,
  loadingMore,
  onLoadMore,
  entryCount,
  beginningMessage,
}: {
  dayGroups: DayGroup[];
  formatDay: (group: DayGroup) => string;
  renderEntry: (
    changeLog: ChangeLogDetailsFragment,
    lastInGroup: boolean
  ) => ReactNode;
  hasNextPage: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  entryCount: number;
  beginningMessage: ReactNode;
}) {
  const listRef = useRef<VariableSizeList | null>(null);
  const outerElementRef = useRef<HTMLDivElement | null>(null);
  const sizeMap = useRef(new Map<string, number>());
  // Row layout effects measure before this list's ref is attached, and
  // AutoSizer mounts the list only after an earlier reset effect has already
  // run. Hold the reset until the ref exists so the first paint uses measured
  // heights instead of the estimates rows would otherwise overlap with.
  const pendingResetIndex = useRef<number | null>(null);
  const [resetVersion, setResetVersion] = useState(0);
  const [sticky, setSticky] = useState<HeaderRow | null>(null);
  const scrollOffsetRef = useRef(0);

  const syncOuterElement = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return;
      }
      // Chromium scroll anchoring jumps back to the top when virtualized
      // rows are swapped, which hides the footer.
      element.style.setProperty("overflow-anchor", "none");
      element.dataset.changelogList = "true";
      element.dataset.changelogCount = String(entryCount);
    },
    [entryCount]
  );

  // react-window invokes outerRef only when the scroller mounts. Pages that
  // append later still need the loaded-entry count written onto that node.
  useLayoutEffect(() => {
    syncOuterElement(outerElementRef.current);
  }, [syncOuterElement]);

  const rows = useMemo(() => {
    const next: ChangeLogRow[] = [];
    dayGroups.forEach((group, groupIndex) => {
      next.push({
        type: "header",
        key: group.key,
        label: formatDay(group),
        count: group.changeLogs.length,
        first: groupIndex === 0,
      });
      group.changeLogs.forEach((changeLog, index) => {
        next.push({
          type: "entry",
          key: String(changeLog.id),
          changeLog,
          firstInGroup: index === 0,
          lastInGroup: index === group.changeLogs.length - 1,
        });
      });
    });
    next.push({ type: "footer", key: "footer" });
    return next;
  }, [dayGroups, formatDay]);

  const requestReset = useCallback((index: number) => {
    const list = listRef.current;
    if (list) {
      pendingResetIndex.current = null;
      list.resetAfterIndex(index);
      return;
    }
    pendingResetIndex.current =
      pendingResetIndex.current == null
        ? index
        : Math.min(pendingResetIndex.current, index);
    setResetVersion((version) => version + 1);
  }, []);

  const setSize = useCallback(
    (key: string, index: number, size: number) => {
      if (size <= 0 || sizeMap.current.get(key) === size) {
        return;
      }
      sizeMap.current.set(key, size);
      requestReset(index);
    },
    [requestReset]
  );

  const bindList = useCallback((instance: VariableSizeList | null) => {
    listRef.current = instance;
    if (!instance || sizeMap.current.size === 0) {
      return;
    }
    pendingResetIndex.current = null;
    instance.resetAfterIndex(0);
  }, []);

  const getSize = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) {
        return 88;
      }
      return sizeMap.current.get(row.key) ?? estimateSize(row);
    },
    [rows]
  );

  const updateSticky = useCallback(
    (scrollOffset: number) => {
      scrollOffsetRef.current = scrollOffset;
      let y = 0;
      let active: HeaderRow | null = null;
      let activeY = 0;
      for (let index = 0; index < rows.length; index++) {
        if (y > scrollOffset) {
          break;
        }
        const row = rows[index];
        if (row.type === "header") {
          active = row;
          activeY = y;
        }
        y += sizeMap.current.get(row.key) ?? estimateSize(row);
      }
      const next = active && scrollOffset > activeY + 1 ? active : null;
      setSticky((current) => (current?.key === next?.key ? current : next));
    },
    [rows]
  );

  const rowKeySignature = rows.map((row) => row.key).join("\n");
  useLayoutEffect(() => {
    if (pendingResetIndex.current == null || listRef.current == null) {
      return;
    }
    const index = pendingResetIndex.current;
    pendingResetIndex.current = null;
    listRef.current.resetAfterIndex(index);
  }, [resetVersion]);

  useLayoutEffect(() => {
    listRef.current?.resetAfterIndex(0);
    updateSticky(scrollOffsetRef.current);
  }, [rowKeySignature, updateSticky]);

  const itemData = useMemo<ListData>(
    () => ({
      rows,
      setSize,
      renderEntry,
      hasNextPage,
      loadingMore,
      onLoadMore,
      beginningMessage,
    }),
    [
      rows,
      setSize,
      renderEntry,
      hasNextPage,
      loadingMore,
      onLoadMore,
      beginningMessage,
    ]
  );

  return (
    <div className="absolute inset-0">
      <AutoSizer>
        {({ height, width }) => (
          <VariableSizeList
            ref={bindList}
            height={height}
            width={width}
            itemCount={rows.length}
            itemSize={getSize}
            itemKey={(index) => rows[index]?.key ?? index}
            itemData={itemData}
            estimatedItemSize={88}
            overscanCount={8}
            onScroll={({ scrollOffset }) => updateSticky(scrollOffset)}
            outerRef={(element) => {
              outerElementRef.current = element;
              syncOuterElement(element);
            }}
          >
            {ChangeLogRowView}
          </VariableSizeList>
        )}
      </AutoSizer>
      {sticky && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
          <DayHeader label={sticky.label} count={sticky.count} />
        </div>
      )}
    </div>
  );
}
