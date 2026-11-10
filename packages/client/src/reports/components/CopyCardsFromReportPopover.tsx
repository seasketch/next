import { useApolloClient } from "@apollo/client";
import { CheckIcon } from "@radix-ui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  BaseDraftReportContextDocument,
  CopyableReportCardsQuery,
  ReportDependenciesDocument,
  ReportOverlaySourcesDocument,
  useAddReportCardMutation,
  useDeleteReportCardMutation,
} from "../../generated/graphql";
import {
  evictReportOverlaySourcesForReport,
  evictSubjectReportCachesForSketchId,
} from "../utils/evictReportDependenciesCache";

export type ExistingCopyEntry = {
  cardId: number;
  tabTitle: string;
  /** Tab ordering position — used when re-inserting after delete. */
  position: number;
};

export function getCopiedFromCardId(settings: unknown): number | undefined {
  if (
    settings &&
    typeof settings === "object" &&
    !Array.isArray(settings) &&
    "copiedFromCardId" in settings
  ) {
    const v = (settings as { copiedFromCardId?: unknown }).copiedFromCardId;
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
  }
  return undefined;
}

function mergeComponentSettingsForCopy(
  source: unknown,
  sourceCardId: number
): Record<string, unknown> {
  if (source && typeof source === "object" && !Array.isArray(source)) {
    return {
      ...(source as Record<string, unknown>),
      copiedFromCardId: sourceCardId,
    };
  }
  return { copiedFromCardId: sourceCardId };
}

type CopyableCard = { id: number; position: number; title?: string | null };

type GroupedCopyableReport<TCard extends CopyableCard> = {
  reportId: number;
  reportTitle: string;
  hideTabTitles: boolean;
  tabs: Array<{
    tabId: number;
    tabTitle: string;
    cards: TCard[];
  }>;
};

/**
 * Reports to copy from: every draft in the project except the one open in the
 * editor. Sections are keyed by report title. Reports with no cards are omitted.
 */
export function groupCopyableReports<TCard extends CopyableCard>(
  reports:
    | ReadonlyArray<
        | {
            id: number;
            title?: string | null;
            tabs?: ReadonlyArray<
              | {
                  id: number;
                  position: number;
                  title: string;
                  cards?: ReadonlyArray<TCard | null> | null;
                }
              | null
            > | null;
          }
        | null
      >
    | null
    | undefined,
  currentReportId: number | null
): GroupedCopyableReport<TCard>[] {
  const result: GroupedCopyableReport<TCard>[] = [];

  for (const report of reports ?? []) {
    if (!report || report.id === currentReportId) {
      continue;
    }
    const tabs = [...(report.tabs ?? [])]
      .filter((tab): tab is NonNullable<typeof tab> => tab != null)
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map((tab) => ({
        tabId: tab.id,
        tabTitle: tab.title,
        cards: [...(tab.cards ?? [])]
          .filter((card): card is TCard => card != null)
          .sort((a, b) => a.position - b.position || a.id - b.id),
      }))
      .filter((tab) => tab.cards.length > 0);
    if (tabs.length === 0) {
      continue;
    }
    result.push({
      reportId: report.id,
      reportTitle: report.title?.trim() ?? "",
      hideTabTitles: tabs.length <= 1,
      tabs,
    });
  }

  result.sort((a, b) => {
    const byTitle = a.reportTitle.localeCompare(b.reportTitle, undefined, {
      sensitivity: "base",
    });
    if (byTitle !== 0) {
      return byTitle;
    }
    return a.reportId - b.reportId;
  });

  return result;
}

export function CopyCardsFromReportPopover({
  targetTabId,
  draftReportId,
  demonstrationSketchId,
  existingCopies,
  onDone,
  copyQueryData,
  copyQueryLoading,
}: {
  targetTabId: number;
  /** Draft report open in the editor. Excluded from the list, and refetched after cards change. */
  draftReportId: number | null;
  /** Demonstration sketch used by `ReportDependenciesContextProvider`. */
  demonstrationSketchId: number | null;
  existingCopies: Map<number, ExistingCopyEntry>;
  onDone: () => void;
  copyQueryData: CopyableReportCardsQuery | undefined;
  copyQueryLoading: boolean;
}) {
  const { t } = useTranslation("admin:sketching");
  const onError = useGlobalErrorHandler();
  const client = useApolloClient();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [addReportCard] = useAddReportCardMutation({ onError });
  const [deleteReportCard] = useDeleteReportCardMutation({ onError });

  const grouped = useMemo(
    () =>
      groupCopyableReports(
        copyQueryData?.project?.draftReports,
        draftReportId
      ),
    [copyQueryData?.project?.draftReports, draftReportId]
  );

  const toggleCard = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback(async () => {
    type OrderedCard = (typeof grouped)[number]["tabs"][number]["cards"][number];
    const ordered: OrderedCard[] = [];
    for (const g of grouped) {
      for (const tab of g.tabs) {
        for (const c of tab.cards) {
          if (selectedIds.has(c.id)) {
            ordered.push(c);
          }
        }
      }
    }

    if (ordered.length === 0 || !targetTabId) return;

    const needsOverwriteConfirm = ordered.some((c) => existingCopies.has(c.id));
    if (needsOverwriteConfirm) {
      const ok = window.confirm(
        t(
          "Some selected cards have already been copied into this report. Copying will replace their current contents. Continue?"
        )
      );
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      for (const src of ordered) {
        const mergedSettings = mergeComponentSettingsForCopy(
          src.componentSettings,
          src.id
        );
        const existing = existingCopies.get(src.id);
        if (existing) {
          await deleteReportCard({
            variables: { id: existing.cardId },
          });
          const { data } = await addReportCard({
            variables: {
              reportTabId: targetTabId,
              componentSettings: mergedSettings,
              body: src.body,
              cardPosition: existing.position,
              alternateLanguageSettings: src.alternateLanguageSettings,
            },
          });
          const newId = data?.addReportCard?.reportCard?.id;
          if (!newId) {
            onError(new Error("Could not recreate card after replacing copy."));
            return;
          }
        } else {
          await addReportCard({
            variables: {
              reportTabId: targetTabId,
              componentSettings: mergedSettings,
              body: src.body,
            },
          });
        }
      }

      const refetches: Promise<unknown>[] = [];
      if (draftReportId != null) {
        refetches.push(
          client.query({
            query: BaseDraftReportContextDocument,
            variables: { reportId: draftReportId },
            fetchPolicy: "network-only",
          })
        );
      }

      if (draftReportId != null && demonstrationSketchId != null) {
        evictSubjectReportCachesForSketchId(client.cache, demonstrationSketchId, {
          reportId: draftReportId,
        });
        evictReportOverlaySourcesForReport(client.cache, draftReportId);
        refetches.push(
          client.query({
            query: ReportDependenciesDocument,
            variables: {
              reportId: draftReportId,
              sketchId: demonstrationSketchId,
            },
            fetchPolicy: "network-only",
          })
        );
        refetches.push(
          client.query({
            query: ReportOverlaySourcesDocument,
            variables: {
              reportId: draftReportId,
            },
            fetchPolicy: "network-only",
          })
        );
      }

      await Promise.all(refetches);

      setSelectedIds(new Set());
      onDone();
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }, [
    addReportCard,
    client,
    demonstrationSketchId,
    deleteReportCard,
    draftReportId,
    existingCopies,
    grouped,
    onDone,
    onError,
    selectedIds,
    targetTabId,
    t,
  ]);

  if (copyQueryLoading && !copyQueryData) {
    return (
      <div className="flex min-h-[11rem] items-center justify-center px-6 py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex max-h-[min(72vh,36rem)] w-[min(26rem,calc(100vw-1.5rem))] flex-col">
      <header className="border-b border-gray-100/90 bg-gradient-to-b from-gray-50/90 to-white px-4 pb-3 pt-3.5">
        {/* <h2 className="text-[13px] font-semibold tracking-tight text-gray-900">
          {t("Copy From Another Report")}
        </h2> */}
        <p className="mt-1 max-w-[22rem] text-xs leading-relaxed text-gray-500">
          {t("Copy cards from other reports.")}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {grouped.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-gray-500">
            {t("No other reports to copy from")}
          </p>
        ) : (
          <div className="space-y-0">
            {grouped.map((g, groupIndex) => (
              <section
                key={g.reportId}
                className={
                  groupIndex > 0
                    ? "mt-4 border-t border-gray-100 pt-4"
                    : undefined
                }
              >
                <h3 className="mb-2 px-2 break-words text-[13px] font-semibold tracking-tight text-gray-800">
                  {g.reportTitle.trim() || t("Untitled report")}
                </h3>
                <div className="space-y-3">
                  {g.tabs.map((tab) => (
                    <div key={tab.tabId} className="space-y-0.5">
                      {!g.hideTabTitles && (
                        <p className="mb-1.5 px-2 text-xs font-medium text-gray-600">
                          {tab.tabTitle}
                        </p>
                      )}
                      <ul className="space-y-0.5" role="list">
                        {tab.cards.map((card) => {
                          const existing = existingCopies.get(card.id);
                          const checked = selectedIds.has(card.id);
                          const title =
                            card.title?.trim() || t("Untitled card");
                          return (
                            <li key={card.id}>
                              <label
                                className={`flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                                  checked
                                    ? "bg-blue-50/80"
                                    : "hover:bg-gray-50/90"
                                } ${existing ? "opacity-80" : ""} ${
                                  submitting
                                    ? "pointer-events-none opacity-60"
                                    : ""
                                }`}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-0"
                                  checked={checked}
                                  disabled={submitting}
                                  onChange={() => toggleCard(card.id)}
                                />
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={`grid min-w-0 gap-x-2 gap-y-0 items-start text-gray-800 leading-snug ${
                                      existing
                                        ? "grid-cols-[minmax(0,1fr)_auto]"
                                        : "grid-cols-1"
                                    }`}
                                  >
                                    <span className="min-w-0 break-words">
                                      {title}
                                    </span>
                                    {existing ? (
                                      <span
                                        title={t("Already copied")}
                                        className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md bg-emerald-50 px-1 py-[2px] pl-[3px] text-[10px] font-medium leading-none text-emerald-900 ring-1 ring-emerald-300/70"
                                      >
                                        <CheckIcon
                                          aria-hidden
                                          className="h-2.5 w-2.5 shrink-0 text-emerald-600"
                                        />
                                        {t("Copied")}
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <footer className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/95 px-4 py-3">
        <button
          type="button"
          className="rounded-md border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:opacity-50"
          disabled={submitting}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDone}
        >
          {t("Cancel")}
        </button>
        <button
          type="button"
          className="inline-flex min-w-[5.25rem] items-center justify-center gap-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitting || selectedIds.size === 0 || !targetTabId}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void handleCopy()}
        >
          {submitting ? <Spinner mini /> : null}
          {t("Copy")}
        </button>
      </footer>
    </div>
  );
}
