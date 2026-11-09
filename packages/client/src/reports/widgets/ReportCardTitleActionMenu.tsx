import { memo, useCallback } from "react";
import { useApolloClient } from "@apollo/client";
import { useTranslation } from "react-i18next";
import {
  ColumnsIcon,
  MixerHorizontalIcon,
  Pencil1Icon,
  TrashIcon,
  ValueNoneIcon,
} from "@radix-ui/react-icons";
import { CalculatorIcon, SwitchHorizontalIcon } from "@heroicons/react/outline";
import ReportCardActionMenu from "../components/ReportCardActionMenu";
import Spinner from "../../components/Spinner";
import useDialog from "../../components/useDialog";
import { useDeleteReportCardMutation } from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useBaseReportContext } from "../context/BaseReportContext";
import { removeReportCardFromCache } from "../utils/removeReportCardFromCache";
import { reportCardExitDuration, wait } from "../reportCardExit";

export interface ReportCardTitleActionMenuProps {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  loading: boolean;
  adminMode: boolean;
  cardId: number;
  hasMetrics: boolean;
  hasMultipleTabs: boolean;
  openMoveCardToTabModal?: (cardId: number) => void;
  openCalculationDetailsModal?: (cardId: number) => void;
  setEditing: (cardId: number | null) => void;
  hasCardContentTabs?: boolean;
  onUseTabbedDisplay?: () => void;
  onRemoveTabbedDisplay?: () => void;
  onManageCardTabs?: () => void;
  onCardDeleting?: (cardId: number) => void;
  onCardDeleteFailed?: (cardId: number) => void;
}

/**
 * Memoized action menu for report card titles.
 * Extracted to prevent re-renders when dragHandleProps change in the parent.
 */
const ReportCardTitleActionMenu = memo(function ReportCardTitleActionMenu({
  menuOpen,
  setMenuOpen,
  loading,
  adminMode,
  cardId,
  hasMetrics,
  hasMultipleTabs,
  openMoveCardToTabModal,
  openCalculationDetailsModal,
  setEditing,
  hasCardContentTabs,
  onUseTabbedDisplay,
  onRemoveTabbedDisplay,
  onManageCardTabs,
  onCardDeleting,
  onCardDeleteFailed,
}: ReportCardTitleActionMenuProps) {
  const { t } = useTranslation("admin:sketching");
  const { confirm, confirmDelete } = useDialog();
  const onError = useGlobalErrorHandler();
  const client = useApolloClient();
  const { report } = useBaseReportContext();
  const [deleteCardMutation] = useDeleteReportCardMutation({
    onError,
  });
  const handleDeleteCard = useCallback(
    (id: number) => {
      confirmDelete({
        message: t("Are you sure you want to delete this card?"),
        description: t("This action cannot be undone."),
        onDelete: () => {
          // Close the dialog immediately so the exit animation is visible.
          // The mutation returns only a boolean, and refetching DraftReport
          // updates the sketch class's primary draft — not this report when
          // it is a duplicate. Remove the card from the open report's cache
          // after the animation.
          onCardDeleting?.(id);
          setEditing(null);
          const exit = wait(reportCardExitDuration());
          void (async () => {
            try {
              await deleteCardMutation({
                variables: {
                  id,
                },
              });
              await exit;
              removeReportCardFromCache(client.cache, id, report.id);
            } catch {
              onCardDeleteFailed?.(id);
            }
          })();
        },
      });
    },
    [
      confirmDelete,
      t,
      deleteCardMutation,
      onCardDeleting,
      onCardDeleteFailed,
      setEditing,
      client,
      report.id,
    ]
  );

  return (
    <ReportCardActionMenu
      open={menuOpen}
      onOpenChange={setMenuOpen}
      label={t("Card actions")}
      loading={loading}
    >
      {adminMode && (
        <ReportCardActionMenu.Item
          icon={<Pencil1Icon className="h-4 w-4" />}
          onSelect={() => {
            setEditing(cardId);
            // Scroll the card into view after a frame to ensure the edit mode UI has rendered
            requestAnimationFrame(() => {
              const cardElement = document.querySelector(
                // eslint-disable-next-line i18next/no-literal-string
                `[data-rbd-draggable-id="${cardId}"]`
              );
              if (cardElement) {
                cardElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            });
          }}
        >
          {t("Edit card")}
        </ReportCardActionMenu.Item>
      )}
      {hasMetrics && openCalculationDetailsModal && (
        <ReportCardActionMenu.Item
          onSelect={() => openCalculationDetailsModal(cardId)}
          icon={
            loading ? (
              <Spinner className="scale-90" />
            ) : (
              <CalculatorIcon className="h-4 w-4" />
            )
          }
        >
          {t("Calculation details")}
        </ReportCardActionMenu.Item>
      )}
      {adminMode && hasMultipleTabs && openMoveCardToTabModal && (
        <ReportCardActionMenu.Item
          icon={<SwitchHorizontalIcon className="h-4 w-4" />}
          onSelect={() => {
            openMoveCardToTabModal(cardId);
          }}
        >
          {t("Move to tab")}
        </ReportCardActionMenu.Item>
      )}
      {adminMode && !hasCardContentTabs && onUseTabbedDisplay && (
        <ReportCardActionMenu.Item
          icon={<ColumnsIcon className="h-4 w-4" />}
          onSelect={() => {
            onUseTabbedDisplay();
          }}
        >
          {t("Use tabbed display")}
        </ReportCardActionMenu.Item>
      )}
      {adminMode && hasCardContentTabs && onManageCardTabs && (
        <ReportCardActionMenu.Item
          icon={<MixerHorizontalIcon className="h-4 w-4" />}
          onSelect={() => {
            onManageCardTabs();
          }}
        >
          {t("Manage tabs")}
        </ReportCardActionMenu.Item>
      )}
      {adminMode && hasCardContentTabs && onRemoveTabbedDisplay && (
        <ReportCardActionMenu.Item
          icon={<ValueNoneIcon className="h-4 w-4" />}
          onSelect={() => {
            void (async () => {
              const ok = await confirm(t("Remove tabbed display?"), {
                icon: "alert",
                primaryButtonText: t("Remove"),
                description: t(
                  "Content from each tab will be moved to the main card body."
                ),
              });
              if (ok) {
                onRemoveTabbedDisplay();
              }
            })();
          }}
        >
          {t("Remove tabbed display")}
        </ReportCardActionMenu.Item>
      )}
      {adminMode && (
        <>
          <ReportCardActionMenu.Separator />
          <ReportCardActionMenu.Item
            icon={<TrashIcon className="h-4 w-4" />}
            variant="danger"
            onSelect={() => {
              handleDeleteCard(cardId);
            }}
          >
            {t("Delete card")}
          </ReportCardActionMenu.Item>
        </>
      )}
    </ReportCardActionMenu>
  );
});

export default ReportCardTitleActionMenu;
