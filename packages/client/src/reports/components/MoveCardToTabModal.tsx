import { useCallback, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  DraftReportDocument,
  useMoveCardToTabMutation,
} from "../../generated/graphql";
import { useBaseReportContext } from "../context/BaseReportContext";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

export interface MoveCardToTabState {
  open: boolean;
  cardId: number | null;
}

export interface UseMoveCardToTabStateReturn {
  state: MoveCardToTabState;
  openModal: (cardId: number) => void;
  closeModal: () => void;
}

/**
 * Hook to manage the state of the MoveCardToTabModal.
 * Use this in ReportEditor to control when the modal opens and which card is being moved.
 */
export function useMoveCardToTabState(): UseMoveCardToTabStateReturn {
  const [state, setState] = useState<MoveCardToTabState>({
    open: false,
    cardId: null,
  });

  const openModal = useCallback((cardId: number) => {
    setState({ open: true, cardId });
  }, []);

  const closeModal = useCallback(() => {
    setState({ open: false, cardId: null });
  }, []);

  return { state, openModal, closeModal };
}

interface MoveCardToTabModalProps {
  state: MoveCardToTabState;
  onClose: () => void;
}

/**
 * Modal for moving a report card to a different tab.
 * Gets tab information from useBaseReportContext.
 */
export function MoveCardToTabModal({
  state,
  onClose,
}: MoveCardToTabModalProps) {
  const { t, i18n } = useTranslation("admin:sketching");
  const onError = useGlobalErrorHandler();
  const { report } = useBaseReportContext();
  const { selectedTabId, setSelectedTabId } = useContext(ReportUIStateContext);

  const [selectedTargetTabId, setSelectedTargetTabId] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (state.cardId && report?.tabs) {
      const tab = report.tabs.find((tab) =>
        tab.cards.some((card) => card.id === state.cardId)
      );
      if (tab) {
        setSelectedTargetTabId(tab.id);
      }
    }
  }, [state.cardId, report?.tabs]);

  const [moveCardToTab, { loading }] = useMoveCardToTabMutation({
    onError,
    refetchQueries: [DraftReportDocument],
    awaitRefetchQueries: true,
  });

  // Sort tabs by position
  const sortedTabs = [...(report?.tabs || [])].sort(
    (a, b) => a.position - b.position
  );

  // Get localized tab title
  const getLocalizedTabTitle = (tab: (typeof sortedTabs)[number]) => {
    const lang = i18n.language;
    if (
      tab.alternateLanguageSettings &&
      typeof tab.alternateLanguageSettings === "object" &&
      lang in tab.alternateLanguageSettings
    ) {
      const langSettings = (
        tab.alternateLanguageSettings as Record<string, { title?: string }>
      )[lang];
      if (langSettings?.title) {
        return langSettings.title;
      }
    }
    return tab.title;
  };

  // Determine which tab is currently active (where the card currently lives)
  const currentTabId = selectedTabId ?? report?.tabs?.[0]?.id;

  const handleMove = async () => {
    if (state.cardId !== null && selectedTargetTabId !== null) {
      await moveCardToTab({
        variables: {
          cardId: state.cardId,
          tabId: selectedTargetTabId,
        },
      });
      onClose();
      setSelectedTargetTabId(null);
      setSelectedTabId(selectedTargetTabId);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setSelectedTargetTabId(null);
    }
  };

  if (!state.open) {
    return null;
  }

  return (
    <Modal
      open
      onRequestClose={handleClose}
      title={t("Move card to tab")}
      footer={[
        {
          label: t("Cancel"),
          onClick: handleClose,
          variant: "secondary",
          disabled: loading,
        },
        {
          label: t("Move"),
          onClick: handleMove,
          variant: "primary",
          loading: loading,
          disabled:
            loading || selectedTargetTabId === null || state.cardId === null,
        },
      ]}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {t("Select a tab to move this card to.")}
        </p>
        <div className="space-y-2">
          {sortedTabs.map((tab) => {
            const localizedTitle = getLocalizedTabTitle(tab);
            const isCurrentTab = tab.id === currentTabId;
            return (
              <label
                key={tab.id}
                className={`flex items-center space-x-2 rounded border p-2 cursor-pointer ${
                  selectedTargetTabId === tab.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-200"
                }`}
              >
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={selectedTargetTabId === tab.id}
                  onChange={() => setSelectedTargetTabId(tab.id)}
                  disabled={loading}
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-800">
                    {localizedTitle}
                  </span>
                  {isCurrentTab && (
                    <span className="ml-2 text-xs text-gray-500">
                      {t("Current tab")}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
          {sortedTabs.length === 0 && (
            <p className="text-sm text-gray-500">{t("No tabs available")}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
