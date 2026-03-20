import { useTranslation } from "react-i18next";
import {
  BaseDraftReportContextDocument,
  ReportTabDetailsFragment,
  Sketch,
  useAddReportCardMutation,
} from "../generated/graphql";
import { BaseReportContext } from "./context/BaseReportContext";
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
import { ReportTabs } from "./ReportTabs";
import { ReportUIStateContext } from "./context/ReportUIStateContext";
import { DemonstrationSketchDropdown } from "./components/DemonstrationSketchDropdown";
import { SortableReportContent } from "./SortableReportContent";
import {
  MoveCardToTabModal,
  useMoveCardToTabState,
} from "./components/MoveCardToTabModal";
import { useCalculationDetailsModalState } from "./components/CalculationDetailsModal";
import { ReportTabManagementModal } from "./ReportTabManagementModal";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { PlusIcon } from "@radix-ui/react-icons";

/**
 * Console diagnostics for report add-card / scroll / focus flows.
 * Set in devtools: localStorage.setItem("seasketchDebugReportEditor", "1") then reload.
 * Unset: localStorage.removeItem("seasketchDebugReportEditor")
 */
function isReportEditorDebugEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    window.localStorage?.getItem("seasketchDebugReportEditor") === "1"
  );
}

/** New cards are appended at the end of the tab; scroll the list to the bottom. */
function scrollContainerToBottom(
  scrollContainer: HTMLElement,
  behavior: ScrollBehavior = "smooth"
) {
  const top = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
  scrollContainer.scrollTo({ top, behavior });
}

/**
 * ProseMirror (and focus) can change card height after first paint; wait until
 * after layout so scrollHeight reflects the real bottom.
 */
function scrollContainerToBottomAfterLayout(
  scrollContainer: HTMLElement,
  behavior: ScrollBehavior = "smooth",
  debugTag?: string
) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (isReportEditorDebugEnabled()) {
        const maxTop = Math.max(
          0,
          scrollContainer.scrollHeight - scrollContainer.clientHeight
        );
        // eslint-disable-next-line i18next/no-literal-string
        console.warn("[ReportEditor:debug] scroll after layout (before)", {
          tag: debugTag,
          scrollTop: scrollContainer.scrollTop,
          maxTop,
          scrollHeight: scrollContainer.scrollHeight,
          clientHeight: scrollContainer.clientHeight,
        });
      }
      scrollContainerToBottom(scrollContainer, behavior);
      if (isReportEditorDebugEnabled()) {
        requestAnimationFrame(() => {
          const maxTop = Math.max(
            0,
            scrollContainer.scrollHeight - scrollContainer.clientHeight
          );
          // eslint-disable-next-line i18next/no-literal-string
          console.warn(
            "[ReportEditor:debug] scroll after layout (+1 rAF; smooth may still be animating)",
            {
              tag: debugTag,
              scrollTop: scrollContainer.scrollTop,
              maxTop,
              deltaFromMax: maxTop - scrollContainer.scrollTop,
            }
          );
        });
      }
    });
  });
}

export default function ReportEditor({
  demonstrationSketches,
  selectedSketchId,
  setSelectedSketchId,
}: {
  demonstrationSketches: Pick<Sketch, "id" | "name">[];
  selectedSketchId: number | null;
  setSelectedSketchId: (sketchId: number | null) => void;
}) {
  const baseContext = useContext(BaseReportContext);
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
  const [manageTabsOpen, setManageTabsOpen] = useState(false);
  const openManageTabs = useCallback(() => setManageTabsOpen(true), []);
  const closeManageTabs = useCallback(() => setManageTabsOpen(false), []);
  const onError = useGlobalErrorHandler();

  // Track a newly created card that needs to be scrolled into view and focused
  const [pendingNewCardId, setPendingNewCardId] = useState<number | null>(null);
  const pendingNewCardIdRef = useRef<number | null>(null);
  pendingNewCardIdRef.current = pendingNewCardId;
  const cardsScrollAreaRef = useRef<HTMLDivElement>(null);

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

    if (!cardElement) {
      // eslint-disable-next-line i18next/no-literal-string
      console.warn("[ReportEditor] New card present in report data but draggable DOM node not found", {
        cardId,
        pendingNewCardId,
        reportId: baseContext.data?.report?.id,
        hadScrollArea: Boolean(scrollArea),
      });
    } else if (!scrollArea && isReportEditorDebugEnabled()) {
      // eslint-disable-next-line i18next/no-literal-string
      console.warn("[ReportEditor:debug] cardsScrollAreaRef missing; used scrollIntoView fallback", {
        cardId,
      });
    }
  }, [
    pendingNewCardId,
    allCardIds,
    editing,
    setEditing,
    baseContext.data?.report?.id,
  ]);

  useEffect(() => {
    if (!pendingNewCardId || allCardIds.has(pendingNewCardId)) return;
    const id = pendingNewCardId;
    const t = window.setTimeout(() => {
      if (pendingNewCardIdRef.current !== id) return;
      // eslint-disable-next-line i18next/no-literal-string
      console.warn(
        "[ReportEditor] pendingNewCardId still not in report list after 4s (cache/refetch?)",
        {
          pendingNewCardId: id,
          allCardIdsSize: allCardIds.size,
          reportId: baseContext.data?.report?.id,
        }
      );
    }, 4000);
    return () => window.clearTimeout(t);
  }, [pendingNewCardId, allCardIds, baseContext.data?.report?.id]);

  // ProseMirror must call onEditorReadyForFocus to clear pending; if it never does, editing can look stuck.
  useEffect(() => {
    if (!pendingNewCardId || !allCardIds.has(pendingNewCardId)) return;
    const id = pendingNewCardId;
    const t = window.setTimeout(() => {
      if (pendingNewCardIdRef.current !== id) return;
      // eslint-disable-next-line i18next/no-literal-string
      console.warn(
        "[ReportEditor] pendingNewCardId not cleared after 8s — onEditorReadyForFocus likely never ran (ProseMirror / preselectTitle?)",
        {
          pendingNewCardId: id,
          editing,
          preselectTitle,
          reportId: baseContext.data?.report?.id,
        }
      );
    }, 8000);
    return () => window.clearTimeout(t);
  }, [
    pendingNewCardId,
    allCardIds,
    editing,
    preselectTitle,
    baseContext.data?.report?.id,
  ]);

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

    const sketchClassId = baseContext.data?.sketchClass.id;
    const reportId = baseContext.data?.report?.id;
    if (!sketchClassId) {
      // eslint-disable-next-line i18next/no-literal-string
      console.warn(
        "[ReportEditor] addReportCard: sketchClassId missing; refetchQueries skipped — list may lag in production",
        { reportId, currentTabId }
      );
    }
    try {
      const { data } = await addReportCard({
        variables: {
          reportTabId: currentTabId,
          componentSettings: {
            type: "textBlock",
          },
          cardType: "TextBlock",
          body,
        },
        refetchQueries: sketchClassId
          ? [
              {
                query: BaseDraftReportContextDocument,
                variables: { sketchClassId },
              },
            ]
          : [],
      });
      const newCardId = data?.addReportCard?.reportCard?.id || null;
      if (!newCardId) {
        // eslint-disable-next-line i18next/no-literal-string
        console.error("[ReportEditor] addReportCard returned no reportCard id", {
          reportId,
          currentTabId,
          hasData: Boolean(data),
        });
        return;
      }
      if (isReportEditorDebugEnabled()) {
        // eslint-disable-next-line i18next/no-literal-string
        console.warn(
          "[ReportEditor:debug] addReportCard succeeded; deferring edit mode until card is in list",
          {
            newCardId,
            sketchClassId,
            currentTabId,
            reportId,
          }
        );
      }
      setPendingNewCardId(newCardId);
    } catch (error) {
      // eslint-disable-next-line i18next/no-literal-string
      console.warn("[ReportEditor] addReportCard request failed (see GlobalErrorHandler / network tab)", {
        reportId,
        currentTabId,
        error,
      });
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
          scrollContainerToBottomAfterLayout(
            scrollArea,
            "smooth",
            "onEditorReadyForFocus"
          );
        } else {
          // eslint-disable-next-line i18next/no-literal-string
          console.warn(
            "[ReportEditor] onEditorReadyForFocus: cardsScrollAreaRef missing; post-PM scroll skipped",
            { cardId, reportId: baseContext.data?.report?.id }
          );
        }
      } else if (pendingNewCardIdRef.current != null) {
        // eslint-disable-next-line i18next/no-literal-string
        console.warn("[ReportEditor] onEditorReadyForFocus ignored (card id mismatch)", {
          cardId,
          pendingNewCardId: pendingNewCardIdRef.current,
          reportId: baseContext.data?.report?.id,
        });
      }
    },
    [baseContext.data?.report?.id]
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
  ]);

  if (baseContext.loading) {
    return <div>{t("Loading report data...")}</div>;
  }

  return (
    <ReportUIStateContext.Provider value={uiStateContextValue}>
      <div className="flex-1 p-8 max-h-full overflow-hidden">
        <div className="w-128 mx-auto rounded-lg shadow-xl border border-t-black/5 border-l-black/10 border-r-black/15 border-b-black/20 z-10 max-h-full flex flex-col bg-gray-100">
          {/* report header */}
          <div className="px-4 py-3 border-b bg-white rounded-t-lg flex items-center space-x-2">
            <div className="flex-1">
              <DemonstrationSketchDropdown
                demonstrationSketches={demonstrationSketches}
                selectedSketchId={selectedSketchId}
                setSelectedSketchId={setSelectedSketchId}
              />
            </div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger disabled={editing != null} asChild>
                <button
                  className={`p-1.5 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors ${
                    editing != null ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  disabled={editing != null}
                  title={
                    editing != null
                      ? t("Cannot add cards while editing")
                      : undefined
                  }
                  aria-label={t("Report actions")}
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[160px] z-50"
                  sideOffset={5}
                  align="end"
                >
                  <DropdownMenu.Item
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer outline-none"
                    onSelect={addACard}
                  >
                    {t("Add Card")}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer outline-none"
                    onSelect={openManageTabs}
                  >
                    {t("Manage Tabs")}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          {/* report tabs */}
          <ReportTabs />
          {/* report cards */}
          <div
            ref={cardsScrollAreaRef}
            className="relative max-h-full overflow-y-auto overscroll-none"
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

const MemoizedSortableReportContent = memo(SortableReportContent);
