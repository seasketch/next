import { useTranslation } from "react-i18next";
import {
  DraftReportDocument,
  ReportTabDetailsFragment,
  Sketch,
  useAddReportCardMutation,
} from "../generated/graphql";
import { BaseReportContext } from "./context/BaseReportContext";
import {
  memo,
  useCallback,
  useContext,
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
import {
  CalculationDetailsModal,
  useCalculationDetailsModalState,
} from "./components/CalculationDetailsModal";
import { ReportTabManagementModal } from "./ReportTabManagementModal";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { PlusIcon } from "@radix-ui/react-icons";

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

  // Get all card IDs from the current tabs data
  const allCardIds = useMemo(() => {
    return new Set(
      baseContext.data?.report?.tabs?.flatMap((tab) =>
        tab.cards.map((card) => card.id)
      ) || []
    );
  }, [baseContext.data?.report?.tabs]);

  // When the pending card appears in the data, scroll to it and focus
  useLayoutEffect(() => {
    if (pendingNewCardId && allCardIds.has(pendingNewCardId)) {
      const cardId = pendingNewCardId;
      // Clear the pending state first to avoid re-running
      setPendingNewCardId(null);
      pendingNewCardIdRef.current = null;

      // Use requestAnimationFrame to ensure DOM has painted
      requestAnimationFrame(() => {
        const cardElement = document.querySelector(
          // eslint-disable-next-line i18next/no-literal-string
          `[data-rbd-draggable-id="${cardId}"]`
        );
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        const editor = document.querySelector(
          // eslint-disable-next-line i18next/no-literal-string
          `[data-rbd-draggable-id="${cardId}"] [contenteditable="true"]`
        );
        if (editor) {
          (editor as HTMLElement).focus();
        }
      });
    }
  }, [pendingNewCardId, allCardIds]);

  const [addReportCard] = useAddReportCardMutation({
    awaitRefetchQueries: true,
    // refetchQueries: [DraftReportDocument],
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
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Use ",
            },
            {
              type: "text",
              text: "Text Blocks",
              marks: [{ type: "strong" }],
            },
            {
              type: "text",
              text: " to add instructions or other details to your report.",
            },
          ],
        },
      ],
    };

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
      });
      const newCardId = data?.addReportCard?.reportCard?.id || null;
      if (!newCardId) {
        console.error("No new card id");
        return;
      }
      // Set the pending card ID - the useLayoutEffect will handle scrolling
      // and focusing once the card appears in the data
      setPendingNewCardId(newCardId);
      pendingNewCardIdRef.current = newCardId;
      // Put the card into edit mode
      setEditing(newCardId, true);
    } catch (error) {
      // Error is handled by onError
    }
  }, [
    addReportCard,
    selectedTabId,
    baseContext.data?.report?.tabs,
    setEditing,
  ]);

  // Find the card config for the calculation details modal
  const calcDetailsCard = calcDetailsModalState.state.cardId
    ? baseContext.data?.report?.tabs
        ?.flatMap((tab) => tab.cards)
        .find((card) => card.id === calcDetailsModalState.state.cardId)
    : undefined;

  const { t } = useTranslation("admin:sketching");
  const emptyDependencies = useMemo(() => {
    return {
      metrics: [],
      overlaySources: [],
      loading: false,
      errors: [],
    };
  }, []);

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
    };
  }, [
    selectedTabId,
    setSelectedTabId,
    editing,
    setEditing,
    preselectTitle,
    calcDetailsModalState.state.cardId,
    setShowCalcDetails,
  ]);

  if (baseContext.loading) {
    return <div>{t("Loading report data...")}</div>;
  }

  return (
    <ReportUIStateContext.Provider value={uiStateContextValue}>
      <div className="flex-1 p-8 max-h-full overflow-hidden">
        <div className="w-128 mx-auto bg-white rounded-lg shadow-xl border border-t-black/5 border-l-black/10 border-r-black/15 border-b-black/20 z-10 max-h-full flex flex-col">
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
              <DropdownMenu.Trigger asChild>
                <button
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
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
          <div className="relative max-h-full overflow-y-auto">
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
