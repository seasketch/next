import * as Menubar from "@radix-ui/react-menubar";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { CopyableReportCardsQuery } from "../generated/graphql";
import {
  BaseDraftReportContextDocument,
  ReportTabDetailsFragment,
  Sketch,
  useAddReportCardMutation,
  useCopyableReportCardsQuery,
} from "../generated/graphql";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import {
  MenuBarContent,
  MenuBarItem,
  MenuBarLabel,
  MenuBarSeparator,
  MenubarTrigger,
} from "../components/Menubar";
import {
  CopyCardsFromReportPopover,
  getCopiedFromCardId,
} from "./components/CopyCardsFromReportPopover";
import { DemonstrationSketchDropdown } from "./components/DemonstrationSketchDropdown";
import {
  MoveCardToTabModal,
  useMoveCardToTabState,
} from "./components/MoveCardToTabModal";
import { useCalculationDetailsModalState } from "./components/CalculationDetailsModal";
import { BaseReportContext } from "./context/BaseReportContext";
import { useSubjectReportContext } from "./context/SubjectReportContext";
import { ReportUIStateContext } from "./context/ReportUIStateContext";
import { ReportDependenciesContext } from "./context/ReportDependenciesContext";
import ReportFullPrintBridge from "./ReportFullPrintBridge";
import { ReportTabManagementModal } from "./ReportTabManagementModal";
import { ReportTabs } from "./ReportTabs";
import { SortableReportContent } from "./SortableReportContent";
import {
  collectCardExportSections,
  packageSectionsAsCsvBlob,
} from "./widgets/exports";
import { download } from "../download";
import { collectReportCardTitle } from "../admin/sketchClasses/SketchClassReportsAdmin";

type CopyableSketchClassRow = NonNullable<
  NonNullable<CopyableReportCardsQuery["project"]>["sketchClasses"]
>[number];

function slugifyFilenamePart(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** New cards are appended at the end of the tab; scroll the list to the bottom. */
function scrollContainerToBottom(
  scrollContainer: HTMLElement,
  behavior: ScrollBehavior = "smooth"
) {
  const top = Math.max(
    0,
    scrollContainer.scrollHeight - scrollContainer.clientHeight
  );
  scrollContainer.scrollTo({ top, behavior });
}

/**
 * ProseMirror (and focus) can change card height after first paint; wait until
 * after layout so scrollHeight reflects the real bottom.
 */
function scrollContainerToBottomAfterLayout(
  scrollContainer: HTMLElement,
  behavior: ScrollBehavior = "smooth"
) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollContainerToBottom(scrollContainer, behavior);
    });
  });
}

export default function ReportEditor({
  demonstrationSketches,
  selectedSketchId,
  setSelectedSketchId,
  sketchClassLabelsById,
  recentSketchIdsStorageKey,
  reportAssociatedSketchClassIds,
  adminPublishChrome,
}: {
  demonstrationSketches: Pick<
    Sketch,
    "id" | "name" | "sketchClassId" | "createdAt"
  >[];
  selectedSketchId: number | null;
  setSelectedSketchId: (sketchId: number | null) => void;
  sketchClassLabelsById?: Record<number, string>;
  recentSketchIdsStorageKey?: string;
  reportAssociatedSketchClassIds?: number[];
  /** Publish button + last-published text (project reports admin). */
  adminPublishChrome?: ReactNode;
}) {
  const baseContext = useContext(BaseReportContext);
  const subjectContext = useSubjectReportContext();
  const deps = useContext(ReportDependenciesContext);
  const [selectedTabId, setSelectedTabId] = useState<number | undefined>(
    baseContext.data?.report?.tabs?.[0]?.id || undefined
  );

  const [editing, _setEditing] = useState<number | null>(null);
  const [preselectTitle, setPreselectTitle] = useState<boolean>(false);
  const setEditing = useCallback(
    (editing: number | null, preselectTitle?: boolean) => {
      setPreselectTitle(preselectTitle || false);
      _setEditing(editing);
    },
    [_setEditing, setPreselectTitle]
  );

  const moveCardModalState = useMoveCardToTabState();
  const calcDetailsModalState = useCalculationDetailsModalState();
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const onBeforePrint = () => setPrinting(true);
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);
  const [manageTabsOpen, setManageTabsOpen] = useState(false);
  const openManageTabs = useCallback(() => setManageTabsOpen(true), []);
  const closeManageTabs = useCallback(() => setManageTabsOpen(false), []);
  const onError = useGlobalErrorHandler();

  const projectId = subjectContext.data?.sketch?.sketchClass?.projectId;
  const copyCardsQuery = useCopyableReportCardsQuery({
    variables: { projectId: projectId! },
    skip: !projectId,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const eligibleSketchClassCount = useMemo(() => {
    const classes = copyCardsQuery.data?.project?.sketchClasses ?? [];
    return classes.filter(
      (sc: CopyableSketchClassRow) =>
        sc.previewNewReports || sc.isGeographyClippingEnabled
    ).length;
  }, [copyCardsQuery.data?.project?.sketchClasses]);

  const existingCopies = useMemo(() => {
    const map = new Map<
      number,
      { cardId: number; tabTitle: string; position: number }
    >();
    const tabs = baseContext.data?.report?.tabs ?? [];
    for (const tab of tabs) {
      for (const card of tab.cards) {
        const sourceId = getCopiedFromCardId(card.componentSettings);
        if (sourceId != null) {
          map.set(sourceId, {
            cardId: card.id,
            tabTitle: tab.title,
            position: card.position,
          });
        }
      }
    }
    return map;
  }, [baseContext.data?.report?.tabs]);

  // Track a newly created card that needs to be scrolled into view and focused
  const [pendingNewCardId, setPendingNewCardId] = useState<number | null>(null);
  const pendingNewCardIdRef = useRef<number | null>(null);
  pendingNewCardIdRef.current = pendingNewCardId;
  const cardsScrollAreaRef = useRef<HTMLDivElement>(null);
  const reportPrintControlsRef = useRef<{ runPrint: () => void } | null>(null);

  // Get all card IDs from the current tabs data
  const allCardIds = useMemo(() => {
    return new Set(
      baseContext.data?.report?.tabs?.flatMap((tab) =>
        tab.cards.map((card) => card.id)
      ) || []
    );
  }, [baseContext.data?.report?.tabs]);

  // When a card is new in the GraphQL cache but `editing` is set before that card
  // is in `tabs[].cards`, every existing card gets `editing && !isSelectedForEditing`
  // and the UI blurs the whole body with no editor. Only enter edit mode once the
  // new id appears in Apollo data; refetch BaseDraftReportContext on add to avoid
  // cache-merge gaps in production.
  useLayoutEffect(() => {
    if (!pendingNewCardId || !allCardIds.has(pendingNewCardId)) return;

    const cardId = pendingNewCardId;
    if (editing !== cardId) {
      setEditing(cardId, true);
    }
    // eslint-disable-next-line i18next/no-literal-string
    const cardSelector = `[data-rbd-draggable-id="${cardId}"]`;

    const scrollArea = cardsScrollAreaRef.current;
    if (scrollArea) {
      scrollContainerToBottom(scrollArea, "smooth");
    }

    const cardElement = document.querySelector(cardSelector);
    if (!scrollArea && cardElement) {
      (cardElement as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [pendingNewCardId, allCardIds, editing, setEditing]);

  useLayoutEffect(() => {
    const el = cardsScrollAreaRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [selectedTabId]);

  const [addReportCard] = useAddReportCardMutation({
    awaitRefetchQueries: true,
    onError,
  });

  const addACard = useCallback(async () => {
    const currentTabId =
      selectedTabId ?? baseContext.data?.report?.tabs?.[0]?.id;
    if (!currentTabId) {
      console.error("No tab selected");
      return;
    }

    const body = {
      type: "doc",
      content: [
        {
          type: "reportTitle",
          content: [
            {
              type: "text",
              text: "Card title",
            },
          ],
        },
      ],
    };

    const reportId = baseContext.data?.report?.id;
    try {
      const { data } = await addReportCard({
        variables: {
          reportTabId: currentTabId,
          componentSettings: {
            type: "textBlock",
          },
          body,
        },
        refetchQueries: reportId
          ? [
              {
                query: BaseDraftReportContextDocument,
                variables: { reportId },
              },
            ]
          : [],
      });
      const newCardId = data?.addReportCard?.reportCard?.id || null;
      if (!newCardId) {
        console.error("No new card id");
        return;
      }
      setPendingNewCardId(newCardId);
    } catch (error) {
      // Error is handled by onError
    }
  }, [addReportCard, selectedTabId, baseContext.data]);

  const { t } = useTranslation("admin:sketching");

  const setShowCalcDetails = useCallback(
    (cardId: number | undefined) => {
      if (!cardId) {
        calcDetailsModalState.closeModal();
      } else {
        calcDetailsModalState.openModal(cardId);
      }
    },
    [calcDetailsModalState]
  );

  const onEditorReadyForFocus = useCallback(
    (cardId: number, focus: () => void) => {
      // Ref avoids a race where context still holds a callback from before
      // pendingNewCardId was set (same tick as ProseMirror init in production).
      if (cardId === pendingNewCardIdRef.current) {
        pendingNewCardIdRef.current = null;
        setPendingNewCardId(null);
        focus();
        const scrollArea = cardsScrollAreaRef.current;
        if (scrollArea) {
          scrollContainerToBottomAfterLayout(scrollArea, "smooth");
        }
      }
    },
    []
  );

  const requestFullReportPrint = useCallback(() => {
    reportPrintControlsRef.current?.runPrint();
  }, []);

  const reportDataReady =
    !!baseContext.data &&
    !!subjectContext.data &&
    !deps.loading &&
    !deps.dependenciesAwaitingRefresh;

  const exportReport = useCallback(
    async (format: "csv" | "json") => {
      if (!baseContext.data || !subjectContext.data) {
        return;
      }
      const sketchClassForExport = subjectContext.data.sketch.sketchClass;
      if (!sketchClassForExport) {
        return;
      }

      const metricById = new Map(deps.metrics.map((m) => [m.id, m]));
      const sourceByStableId = new Map(
        deps.overlaySources
          .filter((s) => !!s.stableId)
          .map((s) => [s.stableId as string, s])
      );

      const sections: ReturnType<typeof collectCardExportSections> = [];
      const cards: Array<{
        tabId: number;
        tabTitle: string;
        cardId: number;
        cardTitle: string;
        sections: ReturnType<typeof collectCardExportSections>;
      }> = [];

      const sortedTabs = [...(baseContext.data.report.tabs || [])].sort(
        (a, b) => a.position - b.position
      );
      for (const tab of sortedTabs) {
        const sortedCards = [...(tab.cards || [])].sort(
          (a, b) => a.position - b.position
        );
        for (const card of sortedCards) {
          const list = deps.cardDependencyLists.find((l) => l.cardId === card.id);
          const cardMetrics = (list?.metrics || [])
            .map((metricId) => metricById.get(metricId))
            .filter((m): m is NonNullable<typeof m> => m != null);
          const cardSources = (list?.overlaySources || [])
            .map((stableId) => sourceByStableId.get(stableId))
            .filter((s): s is NonNullable<typeof s> => s != null);
          const cardTitle =
            collectReportCardTitle(card.body) || `${t("Card")} ${card.id}`;
          const cardSections = collectCardExportSections({
            reportId: baseContext.data.report.id,
            cardId: card.id,
            cardTitle,
            body: card.body as any,
            metrics: cardMetrics,
            sources: cardSources,
            geographies: baseContext.data.geographies,
            sketchClass: sketchClassForExport,
            subject: {
              sketchId: subjectContext.data.sketch.id,
              sketchName: subjectContext.data.sketch.name,
              isCollection: subjectContext.data.isCollection,
              childSketches: (subjectContext.data.childSketches || []).map((c) => ({
                id: c.id,
                name: c.name,
              })),
            },
            relatedFragments: (subjectContext.data.relatedFragments || []).map(
              (f) => ({
                hash: f.hash,
                geographies: f.geographies,
                sketches: f.sketches,
              })
            ),
            primaryGeographyId: undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            t: ((k: string) => k) as any,
          });

          sections.push(
            ...cardSections.map((section, index) => ({
              ...section,
              /* eslint-disable i18next/no-literal-string */
              id:
                `${slugifyFilenamePart(cardTitle) || "card"}-` +
                `${slugifyFilenamePart(section.title) || "section"}-` +
                `t${tab.id}-c${card.id}-s${index + 1}`,
              /* eslint-enable i18next/no-literal-string */
              // eslint-disable-next-line i18next/no-literal-string
              title:
                `${cardTitle} / ${section.title}` +
                ` (${t("Tab")} ${tab.id}, ${t("Card")} ${card.id}, ${t(
                  "Section"
                )} ${index + 1})`,
            }))
          );
          cards.push({
            tabId: tab.id,
            tabTitle: tab.title,
            cardId: card.id,
            cardTitle,
            sections: cardSections,
          });
        }
      }

      const filenameBase =
        // eslint-disable-next-line i18next/no-literal-string
        `${subjectContext.data.sketch.id}-` +
        `${
          slugifyFilenamePart(subjectContext.data.sketch.name) ||
          subjectContext.data.sketch.id
        }` +
        // eslint-disable-next-line i18next/no-literal-string
        `-report-${baseContext.data.report.id}`;

      if (format === "json") {
        const body = {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          format: "seasketch-report-export",
          meta: {
            reportId: baseContext.data.report.id,
            subjectSketchId: subjectContext.data.sketch.id,
            subjectSketchName: subjectContext.data.sketch.name,
            isCollection: subjectContext.data.isCollection,
          },
          cards,
        };
        const blob = new Blob([JSON.stringify(body, null, 2)], {
          // eslint-disable-next-line i18next/no-literal-string
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        // eslint-disable-next-line i18next/no-literal-string
        download(url, `${filenameBase}.json`);
        URL.revokeObjectURL(url);
        return;
      }

      const { blob } = await packageSectionsAsCsvBlob(sections);
      const url = URL.createObjectURL(blob);
      // eslint-disable-next-line i18next/no-literal-string
      download(url, `${filenameBase}.zip`);
      URL.revokeObjectURL(url);
    },
    [
      baseContext.data,
      subjectContext.data,
      deps.metrics,
      deps.overlaySources,
      deps.cardDependencyLists,
      deps.loading,
      deps.dependenciesAwaitingRefresh,
      t,
    ]
  );

  const uiStateContextValue = useMemo(() => {
    return {
      selectedTabId: selectedTabId,
      setSelectedTabId: setSelectedTabId,
      editing: editing,
      setEditing: setEditing,
      adminMode: true,
      preselectTitle: preselectTitle,
      showCalcDetails: calcDetailsModalState.state.cardId ?? undefined,
      setShowCalcDetails: setShowCalcDetails,
      onEditorReadyForFocus,
      printing,
      setPrinting,
      requestFullReportPrint,
    };
  }, [
    selectedTabId,
    setSelectedTabId,
    editing,
    setEditing,
    preselectTitle,
    calcDetailsModalState.state.cardId,
    setShowCalcDetails,
    onEditorReadyForFocus,
    printing,
    requestFullReportPrint,
  ]);

  if (baseContext.loading) {
    return <div>{t("Loading report data...")}</div>;
  }

  const editMenuDisabled = editing != null;

  return (
    <ReportUIStateContext.Provider value={uiStateContextValue}>
      <ReportFullPrintBridge
        controlsRef={reportPrintControlsRef}
        adminModeForCards
      />
      <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
        <header className="w-full z-20 flex-none border-b shadow-sm bg-gray-100 text-sm border-t border-black border-opacity-5 px-1">
          <div className="flex items-center w-full min-h-[2.125rem] gap-1 py-0.5">
            <Menubar.Root className="flex p-1 py-0.5 rounded-md z-50 items-center shrink-0">
              <Menubar.Menu>
                <MenubarTrigger>{t("Edit")}</MenubarTrigger>
                <Menubar.Portal>
                  <MenuBarContent>
                    <MenuBarItem
                      disabled={editMenuDisabled}
                      onClick={() => {
                        if (!editMenuDisabled) {
                          void addACard();
                        }
                      }}
                    >
                      {t("Add Card")}
                    </MenuBarItem>
                    <MenuBarItem
                      disabled={editMenuDisabled}
                      onClick={() => {
                        if (!editMenuDisabled) {
                          openManageTabs();
                        }
                      }}
                    >
                      {t("Manage Tabs")}
                    </MenuBarItem>
                    {eligibleSketchClassCount > 1 && projectId ? (
                      <>
                        <MenuBarSeparator />
                        <MenuBarLabel>{t("Copy content")}</MenuBarLabel>
                        <Menubar.Sub>
                          <Menubar.SubTrigger
                            disabled={editMenuDisabled}
                            className="RadixDropdownItem text-sm leading-none rounded flex items-center h-6 px-2 relative select-none pl-5 outline-none data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
                          >
                            <span>{t("Copy From Another Report")}</span>
                            <div className="ml-auto pl-3 flex items-center">
                              <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                            </div>
                          </Menubar.SubTrigger>
                          <Menubar.Portal>
                            <Menubar.SubContent
                              className="z-[60] overflow-hidden rounded-lg border border-black border-opacity-10 bg-white p-0 shadow-xl outline-none min-w-[min(26rem,var(--radix-menubar-content-available-width))] max-w-[92vw]"
                              style={{ backdropFilter: "blur(6px)" }}
                              sideOffset={6}
                              alignOffset={-4}
                              collisionPadding={16}
                            >
                              <CopyCardsFromReportPopover
                                targetTabId={
                                  selectedTabId ??
                                  baseContext.data!.report?.tabs?.[0]?.id ??
                                  0
                                }
                                currentSketchClassId={
                                  subjectContext.data?.sketch?.sketchClass?.id ??
                                  -1
                                }
                                draftReportId={baseContext.data!.report?.id ?? null}
                                demonstrationSketchId={selectedSketchId}
                                existingCopies={existingCopies}
                                onDone={() => {}}
                                copyQueryData={copyCardsQuery.data}
                                copyQueryLoading={copyCardsQuery.loading}
                              />
                            </Menubar.SubContent>
                          </Menubar.Portal>
                        </Menubar.Sub>
                      </>
                    ) : null}
                  </MenuBarContent>
                </Menubar.Portal>
              </Menubar.Menu>
              <Menubar.Menu>
                <MenubarTrigger>{t("Export")}</MenubarTrigger>
                <Menubar.Portal>
                  <MenuBarContent>
                    <MenuBarItem
                      disabled={editMenuDisabled}
                      onClick={() => {
                        if (!editMenuDisabled) {
                          requestFullReportPrint();
                        }
                      }}
                    >
                      {t("Print report")}
                    </MenuBarItem>
                    <MenuBarSeparator />
                    <MenuBarItem
                      disabled={!reportDataReady}
                      onClick={() => void exportReport("csv")}
                    >
                      {t("Export results (CSV)")}
                    </MenuBarItem>
                    <MenuBarItem
                      disabled={!reportDataReady}
                      onClick={() => void exportReport("json")}
                    >
                      {t("Export results (JSON)")}
                    </MenuBarItem>
                  </MenuBarContent>
                </Menubar.Portal>
              </Menubar.Menu>
            </Menubar.Root>
            <div className="flex-1 min-w-0" />
            {adminPublishChrome ? (
              <div className="flex items-center gap-3 shrink-0 pr-2">
                {adminPublishChrome}
              </div>
            ) : null}
          </div>
        </header>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden p-8">
          <div className="w-128 mx-auto flex flex-col flex-1 min-h-0 rounded-lg shadow-xl border border-t-black/5 border-l-black/10 border-r-black/15 border-b-black/20 z-10 bg-gray-100 overflow-hidden">
            {/* report header */}
            <div className="p-4 border-b flex items-center bg-white gap-2 rounded-t-lg">
              <h1 className="flex-1 truncate text-lg">
                <DemonstrationSketchDropdown
                  demonstrationSketches={demonstrationSketches}
                  selectedSketchId={selectedSketchId}
                  setSelectedSketchId={setSelectedSketchId}
                  sketchClassLabelsById={sketchClassLabelsById}
                  recentSketchIdsStorageKey={recentSketchIdsStorageKey}
                  reportAssociatedSketchClassIds={reportAssociatedSketchClassIds}
                />
              </h1>
            </div>
            {/* report tabs */}
            <div className="shrink-0 overflow-hidden bg-white">
              <ReportTabs />
            </div>
          {/* report cards */}
          <div
            ref={cardsScrollAreaRef}
            className="relative flex-1 min-h-0 overflow-y-auto overscroll-none"
          >
            {(baseContext.data!.report?.tabs || []).map((tab) => {
              const selected =
                selectedTabId ?? baseContext.data!.report?.tabs?.[0]?.id;
              const isActive = selected === tab.id;
              return (
                <div
                  key={"report-tab-" + tab.id}
                  className={`absolute top-0 w-full ${
                    isActive ? "relative left-0" : "-left-[10000px]"
                  }`}
                >
                  <MemoizedSortableReportContent
                    selectedTab={tab}
                    disabled={isActive && Boolean(editing)}
                    onMoveCardToTab={moveCardModalState.openModal}
                    onShowCalculationDetails={calcDetailsModalState.openModal}
                    setEditing={setEditing}
                  />
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>
      <MoveCardToTabModal
        state={moveCardModalState.state}
        onClose={moveCardModalState.closeModal}
      />
      {baseContext.data?.report && manageTabsOpen && (
        <ReportTabManagementModal
          isOpen={manageTabsOpen}
          onClose={closeManageTabs}
          tabs={
            (baseContext.data.report.tabs as ReportTabDetailsFragment[]) || []
          }
          reportId={baseContext.data.report.id}
        />
      )}
    </ReportUIStateContext.Provider>
  );
}

/**
 * Default memo() only shallow-compares props. Apollo often keeps the same
 * `selectedTab` object reference when only `cards` order changes after a
 * reorder mutation, so the list would skip re-rendering and react-beautiful-dnd
 * would snap back even though the cache had the new order.
 *
 * Do not key this subtree on `editing`: remounting resets scroll and skips the
 * exit-edit transition.
 */
function sortableReportContentPropsEqual(
  prev: ComponentProps<typeof SortableReportContent>,
  next: ComponentProps<typeof SortableReportContent>
): boolean {
  if (prev.disabled !== next.disabled) return false;
  if (prev.selectedTab.id !== next.selectedTab.id) return false;
  const pc = prev.selectedTab.cards;
  const nc = next.selectedTab.cards;
  if (pc.length !== nc.length) return false;
  for (let i = 0; i < pc.length; i++) {
    if (pc[i].id !== nc[i].id) return false;
  }
  if (prev.onMoveCardToTab !== next.onMoveCardToTab) return false;
  if (prev.onShowCalculationDetails !== next.onShowCalculationDetails) {
    return false;
  }
  if (prev.setEditing !== next.setEditing) return false;
  return true;
}

const MemoizedSortableReportContent = memo(
  SortableReportContent,
  sortableReportContentPropsEqual
);
