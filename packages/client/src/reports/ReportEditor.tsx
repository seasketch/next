import * as Menubar from "@radix-ui/react-menubar";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import type { ComponentProps } from "react";
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
  ProjectReportsContextDocument,
  ReportTabDetailsFragment,
  Sketch,
  useAddReportCardMutation,
  useCopyableReportCardsQuery,
  useDeleteDraftReportMutation,
  useProjectReportsContextQuery,
  useSetPrimaryReportForSketchClassMutation,
  useUpdateReportTitleMutation,
} from "../generated/graphql";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import useDialog from "../components/useDialog";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import TextInput from "../components/TextInput";
import Warning from "../components/Warning";
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
import { ExampleSketchSelector } from "./components/DemonstrationSketchDropdown";
import {
  ReportWindowActionsMenu,
  useReportWindowExports,
} from "./components/ReportWindowActionsMenu";
import {
  MoveCardToTabModal,
  useMoveCardToTabState,
} from "./components/MoveCardToTabModal";
import { useCalculationDetailsModalState } from "./components/CalculationDetailsModal";
import { BaseReportContext } from "./context/BaseReportContext";
import { useSubjectReportContext } from "./context/SubjectReportContext";
import { ReportUIStateContext } from "./context/ReportUIStateContext";
import getSlug from "../getSlug";
import ReportFullPrintBridge from "./ReportFullPrintBridge";
import { ReportTabManagementModal } from "./ReportTabManagementModal";
import { ReportTabs } from "./ReportTabs";
import { SortableReportContent } from "./SortableReportContent";
type CopyableSketchClassRow = NonNullable<
  NonNullable<CopyableReportCardsQuery["project"]>["sketchClasses"]
>[number];

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

/** Prefer the cards pane when it scrolls; otherwise the padded workspace (short-content fallback). */
function scrollReportWorkspaceToBottom(
  cardsScrollEl: HTMLElement | null,
  workspaceScrollEl: HTMLElement | null,
  behavior: ScrollBehavior = "smooth"
) {
  if (
    cardsScrollEl &&
    cardsScrollEl.scrollHeight > cardsScrollEl.clientHeight
  ) {
    scrollContainerToBottom(cardsScrollEl, behavior);
  } else if (workspaceScrollEl) {
    scrollContainerToBottom(workspaceScrollEl, behavior);
  }
}

function scrollReportWorkspaceToBottomAfterLayout(
  cardsScrollEl: HTMLElement | null,
  workspaceScrollEl: HTMLElement | null,
  behavior: ScrollBehavior = "smooth"
) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollReportWorkspaceToBottom(cardsScrollEl, workspaceScrollEl, behavior);
    });
  });
}

export type ReportEditorPublishMenuProps =
  | {
      variant: "available";
      hasUnpublishedChanges: boolean;
      publishing: boolean;
      lastPublishedSummary: string | null;
      onPublish: () => void;
    }
  | {
      variant: "unavailable";
      /** Why Publish is disabled (e.g. report not primary for any sketch class in this admin context). */
      message: string;
    };

export type ReportEditorDeletionProps = {
  assignedSketchClasses: { id: number; name: string }[];
  onDeleted: () => void | Promise<void>;
};

export default function ReportEditor({
  demonstrationSketches,
  selectedSketchId,
  setSelectedSketchId,
  sketchClassLabelsById,
  recentSketchIdsStorageKey,
  reportAssociatedSketchClassIds,
  publishMenu,
  reportDeletion,
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
  publishMenu?: ReportEditorPublishMenuProps;
  reportDeletion?: ReportEditorDeletionProps;
}) {
  const baseContext = useContext(BaseReportContext);
  const subjectContext = useSubjectReportContext();
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
  const [assignSketchClassesOpen, setAssignSketchClassesOpen] = useState(false);
  const openAssignSketchClasses = useCallback(
    () => setAssignSketchClassesOpen(true),
    []
  );
  const closeAssignSketchClasses = useCallback(
    () => setAssignSketchClassesOpen(false),
    []
  );
  const { confirmDelete } = useDialog();
  const [changeReportTitleOpen, setChangeReportTitleOpen] = useState(false);
  const [reportTitleDraft, setReportTitleDraft] = useState("");
  const [savingSketchClassId, setSavingSketchClassId] = useState<number | null>(
    null
  );
  const onError = useGlobalErrorHandler();
  const slug = getSlug();

  const projectId = subjectContext.data?.sketch?.sketchClass?.projectId;
  const reportAssignmentsQuery = useProjectReportsContextQuery({
    variables: { slug },
    skip: !assignSketchClassesOpen || !slug,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });
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
  const workspaceScrollAreaRef = useRef<HTMLDivElement>(null);
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

    scrollReportWorkspaceToBottom(
      cardsScrollAreaRef.current,
      workspaceScrollAreaRef.current,
      "smooth"
    );
  }, [pendingNewCardId, allCardIds, editing, setEditing]);

  useLayoutEffect(() => {
    const el = cardsScrollAreaRef.current;
    if (el) {
      el.scrollTop = 0;
    }
    const workspace = workspaceScrollAreaRef.current;
    if (workspace) {
      workspace.scrollTop = 0;
    }
  }, [selectedTabId]);

  const [addReportCard] = useAddReportCardMutation({
    awaitRefetchQueries: true,
    onError,
  });

  const [updateReportTitle, updateReportTitleState] =
    useUpdateReportTitleMutation({
      onError,
    });

  const [deleteDraftReport] = useDeleteDraftReportMutation({
    onError,
  });
  const [setPrimaryReport] = useSetPrimaryReportForSketchClassMutation({
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

  const openChangeReportTitleModal = useCallback(() => {
    const r = baseContext.data?.report;
    if (!r) return;
    setReportTitleDraft((r.title ?? "").trim());
    setChangeReportTitleOpen(true);
  }, [baseContext.data?.report]);

  const closeChangeReportTitleModal = useCallback(() => {
    setChangeReportTitleOpen(false);
  }, []);

  const handleSaveReportTitle = useCallback(async () => {
    const reportId = baseContext.data?.report?.id;
    const trimmed = reportTitleDraft.trim();
    const currentSaved = (baseContext.data?.report?.title ?? "").trim();
    if (!reportId || !trimmed) return;
    if (trimmed === currentSaved) {
      setChangeReportTitleOpen(false);
      return;
    }
    try {
      await updateReportTitle({
        variables: { reportId, title: trimmed },
      });
      setChangeReportTitleOpen(false);
    } catch {
      // Handled by mutation onError
    }
  }, [
    baseContext.data?.report?.id,
    baseContext.data?.report?.title,
    reportTitleDraft,
    updateReportTitle,
  ]);

  const handleDeleteReportRequest = useCallback(() => {
    if (!reportDeletion) return;
    const rid = baseContext.data?.report?.id;
    if (rid == null) return;

    confirmDelete({
      message: t("Delete this report permanently?"),
      description: (
        <p className="">
          {t("This cannot be undone.")}
          {reportDeletion.assignedSketchClasses.length > 0 && (
            <p>
              {t(
                "Sketch classes that use this report as their primary report include "
              ) +
                " " +
                reportDeletion.assignedSketchClasses
                  .map((sc) => sc.name)
                  .join(", ") +
                "."}
            </p>
          )}
        </p>
      ),
      primaryButtonText: t("Delete"),
      onDelete: async () => {
        await deleteDraftReport({
          variables: { reportId: rid },
          update(cache) {
            cache.evict({
              // eslint-disable-next-line i18next/no-literal-string -- Apollo typename
              id: cache.identify({ __typename: "Report", id: rid }),
            });
            cache.gc();
          },
        });
        await reportDeletion.onDeleted();
      },
    });
  }, [
    reportDeletion,
    baseContext.data?.report?.id,
    t,
    confirmDelete,
    deleteDraftReport,
  ]);

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
        scrollReportWorkspaceToBottomAfterLayout(
          cardsScrollAreaRef.current,
          workspaceScrollAreaRef.current,
          "smooth"
        );
      }
    },
    []
  );

  const requestFullReportPrint = useCallback(() => {
    reportPrintControlsRef.current?.runPrint();
  }, []);

  const { reportDataReady, exportReport } = useReportWindowExports();

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

  // After delete we evict the report from the Apollo cache before navigation finishes;
  // the query can briefly complete with no report while loading is false.
  if (!baseContext.data?.report) {
    return null;
  }

  const report = baseContext.data.report;
  const assignableProjectId = reportAssignmentsQuery.data?.projectBySlug?.id;
  const assignableReports = (
    reportAssignmentsQuery.data?.reportsConnection?.nodes || []
  )
    .filter((r: any): r is NonNullable<typeof r> => Boolean(r))
    .filter(
      (r: any) => r.projectId === assignableProjectId && r.draftId == null
    );
  const assignableSketchClasses = (
    reportAssignmentsQuery.data?.projectBySlug?.sketchClasses || []
  )
    .filter((sc: any): sc is NonNullable<typeof sc> => Boolean(sc))
    .filter(
      (sc) =>
        !sc.isArchived &&
        sc.formElementId == null
    )
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

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
                    <MenuBarItem
                      disabled={editMenuDisabled}
                      onClick={() => {
                        if (!editMenuDisabled) {
                          openAssignSketchClasses();
                        }
                      }}
                    >
                      {t("Assign sketch classes")}
                    </MenuBarItem>
                    <MenuBarItem onClick={openChangeReportTitleModal}>
                      {t("Change report title")}
                    </MenuBarItem>
                    {reportDeletion ? (
                      <>
                        <MenuBarSeparator />
                        <MenuBarItem onClick={handleDeleteReportRequest}>
                          {t("Delete report")}
                        </MenuBarItem>
                      </>
                    ) : null}
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
                                  selectedTabId ?? report.tabs?.[0]?.id ?? 0
                                }
                                currentSketchClassId={
                                  subjectContext.data?.sketch?.sketchClass
                                    ?.id ?? -1
                                }
                                draftReportId={report.id ?? null}
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
              {publishMenu ? (
                <Menubar.Menu>
                  <MenubarTrigger
                    title={
                      publishMenu.variant === "unavailable"
                        ? publishMenu.message
                        : publishMenu.hasUnpublishedChanges
                        ? t(
                            "There are unpublished changes. Publish to save them."
                          )
                        : t("No unpublished changes")
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      <span>{t("Publish")}</span>
                      {publishMenu.variant === "available" &&
                      publishMenu.hasUnpublishedChanges ? (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                  </MenubarTrigger>
                  <Menubar.Portal>
                    <MenuBarContent>
                      {publishMenu.variant === "unavailable" ? (
                        <>
                          <Menubar.Label className="RadixDropdownItem block max-w-[18rem] rounded px-2 py-1.5 text-xs leading-snug text-gray-600 outline-none">
                            {publishMenu.message}
                          </Menubar.Label>
                          <MenuBarSeparator />
                          <MenuBarItem disabled onClick={() => {}}>
                            {t("Publish Report")}
                          </MenuBarItem>
                        </>
                      ) : (
                        <>
                          <MenuBarLabel>
                            {publishMenu.lastPublishedSummary ??
                              t("No published version yet.")}
                          </MenuBarLabel>
                          {publishMenu.hasUnpublishedChanges ? (
                            <Menubar.Label className="RadixDropdownItem block max-w-[16rem] rounded px-2 pb-1.5 pl-2 pt-0 text-xs leading-snug text-blue-700 outline-none">
                              {t(
                                "This draft has changes that are not in the published report yet."
                              )}
                            </Menubar.Label>
                          ) : null}
                          <MenuBarSeparator />
                          <MenuBarItem
                            disabled={
                              publishMenu.publishing ||
                              !publishMenu.hasUnpublishedChanges
                            }
                            onClick={() => {
                              if (
                                !publishMenu.publishing &&
                                publishMenu.hasUnpublishedChanges
                              ) {
                                publishMenu.onPublish();
                              }
                            }}
                          >
                            {publishMenu.publishing
                              ? t("Publishing...")
                              : publishMenu.hasUnpublishedChanges
                              ? t("Publish Report")
                              : `${t("Publish Report")} (${t("No changes")})`}
                          </MenuBarItem>
                        </>
                      )}
                    </MenuBarContent>
                  </Menubar.Portal>
                </Menubar.Menu>
              ) : null}
            </Menubar.Root>
          </div>
        </header>
        <div
          ref={workspaceScrollAreaRef}
          className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden p-8 items-center"
        >
          <div className="w-128 max-w-full flex flex-col flex-1 min-h-0 rounded-lg shadow-xl border border-t-black/5 border-l-black/10 border-r-black/15 border-b-black/20 z-10 bg-gray-100 overflow-hidden">
            {/* report header */}
            <div className="p-4 border-b flex items-center bg-white gap-2 rounded-t-lg">
              <h1 className="flex-1 truncate text-lg">
                <ExampleSketchSelector
                  demonstrationSketches={demonstrationSketches}
                  selectedSketchId={selectedSketchId}
                  setSelectedSketchId={setSelectedSketchId}
                  sketchClassLabelsById={sketchClassLabelsById}
                  recentSketchIdsStorageKey={recentSketchIdsStorageKey}
                  reportAssociatedSketchClassIds={
                    reportAssociatedSketchClassIds
                  }
                />
              </h1>
              <ReportWindowActionsMenu
                onPrint={requestFullReportPrint}
                onAddCard={addACard}
                onManageTabs={openManageTabs}
                onAssignSketchClasses={openAssignSketchClasses}
                editActionsDisabled={editMenuDisabled}
              />
            </div>
            {/* report tabs */}
            <div className="shrink-0 overflow-hidden bg-white">
              <ReportTabs />
            </div>
            {/* report cards */}
            <div
              ref={cardsScrollAreaRef}
              className="relative flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-gray-100"
            >
              {(report.tabs || []).map((tab) => {
                const selected = selectedTabId ?? report.tabs?.[0]?.id;
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
      {manageTabsOpen && (
        <ReportTabManagementModal
          isOpen={manageTabsOpen}
          onClose={closeManageTabs}
          tabs={(report.tabs as ReportTabDetailsFragment[]) || []}
          reportId={report.id}
        />
      )}
      <Modal
        open={assignSketchClassesOpen}
        onRequestClose={closeAssignSketchClasses}
        title={t("Assign sketch classes")}
        scrollable
        footer={[
          {
            label: t("Close"),
            variant: "secondary",
            onClick: closeAssignSketchClasses,
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {t(
              "Choose which report each sketch class should present to users."
            )}
          </p>
          {reportAssignmentsQuery.loading ? (
            <div className="py-6 flex items-center justify-center">
              <Spinner />
            </div>
          ) : reportAssignmentsQuery.error ? (
            <Warning level="error">
              {t("Could not load sketch class report assignments.")}
            </Warning>
          ) : assignableSketchClasses.length === 0 ? (
            <Warning level="info">
              {t(
                "No sketch classes are available yet. Create one in Sketching first."
              )}
            </Warning>
          ) : (
            <div className="space-y-2">
              {assignableSketchClasses.map((sc: any) => {
                const currentDraftReportId = sc.draftReport?.id ?? null;
                const rowSaving = savingSketchClassId === sc.id;
                return (
                  <div
                    key={sc.id}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] gap-3 items-center rounded border border-gray-200 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {sc.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {currentDraftReportId
                          ? t("Currently assigned")
                          : t("No report assigned")}
                      </div>
                    </div>
                    <div className="relative">
                      <select
                        value={currentDraftReportId ?? ""}
                        disabled={rowSaving}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md disabled:opacity-50"
                        onChange={async (e) => {
                          const raw = e.target.value;
                          if (!raw) {
                            return;
                          }
                          const draftReportId = Number(raw);
                          if (!Number.isFinite(draftReportId)) {
                            return;
                          }
                          if (draftReportId === currentDraftReportId) {
                            return;
                          }
                          setSavingSketchClassId(sc.id);
                          try {
                            await setPrimaryReport({
                              variables: {
                                sketchClassId: sc.id,
                                draftReportId,
                              },
                              refetchQueries: [
                                {
                                  query: ProjectReportsContextDocument,
                                  variables: { slug },
                                },
                              ],
                              awaitRefetchQueries: true,
                            });
                            await reportAssignmentsQuery.refetch();
                          } finally {
                            setSavingSketchClassId(null);
                          }
                        }}
                      >
                        {!currentDraftReportId ? (
                          <option value="">{t("Select report")}</option>
                        ) : null}
                        {assignableReports.map((r: any) => (
                          <option key={r.id} value={r.id}>
                            {r.title?.trim() ||
                              `${t("Untitled report")} #${r.id}`}
                            {r.id === report.id ? ` (${t("This report")})` : ""}
                          </option>
                        ))}
                      </select>
                      {rowSaving ? (
                        <div className="absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">
                          {t("Saving...")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
      <Modal
        open={changeReportTitleOpen}
        onRequestClose={closeChangeReportTitleModal}
        title={t("Change report title")}
        scrollable
        footer={[
          {
            label: t("Cancel"),
            variant: "secondary",
            onClick: closeChangeReportTitleModal,
          },
          {
            label: updateReportTitleState.loading ? t("Saving...") : t("Save"),
            variant: "primary",
            loading: updateReportTitleState.loading,
            disabled:
              updateReportTitleState.loading ||
              !reportTitleDraft.trim() ||
              reportTitleDraft.trim() === (report.title ?? "").trim(),
            onClick: () => {
              void handleSaveReportTitle();
            },
          },
        ]}
      >
        <div className="space-y-4 text-left">
          <p className="text-sm text-gray-600">
            {t(
              "Titles are only visible in the admin interface to help distinguish them while authoring."
            )}
          </p>
          <TextInput
            name="draftReportTitle"
            label={t("Report title")}
            value={reportTitleDraft}
            onChange={setReportTitleDraft}
            autoFocus
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                reportTitleDraft.trim() &&
                reportTitleDraft.trim() !== (report.title ?? "").trim() &&
                !updateReportTitleState.loading
              ) {
                e.preventDefault();
                void handleSaveReportTitle();
              }
            }}
          />
        </div>
      </Modal>
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
