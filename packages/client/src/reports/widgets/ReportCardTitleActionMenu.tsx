import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { CalculatorIcon, SwitchHorizontalIcon } from "@heroicons/react/outline";
import ReportCardActionMenu from "../components/ReportCardActionMenu";
import Spinner from "../../components/Spinner";
import useDialog from "../../components/useDialog";
import {
  DraftReportDocument,
  useDeleteReportCardMutation,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

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
  setEditing: (cardId: number) => void;
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
}: ReportCardTitleActionMenuProps) {
  const { t } = useTranslation("admin:sketching");
  const { confirmDelete } = useDialog();
  const onError = useGlobalErrorHandler();
  const [deleteCardMutation] = useDeleteReportCardMutation({
    onError,
    refetchQueries: [DraftReportDocument],
    awaitRefetchQueries: true,
  });
  const handleDeleteCard = useCallback(
    async (cardId: number) => {
      await confirmDelete({
        message: t("Are you sure you want to delete this card?"),
        description: t("This action cannot be undone."),
        onDelete: async () => {
          try {
            await deleteCardMutation({
              variables: {
                id: cardId,
              },
            });
          } catch (error) {
            // Error is handled by onError
          }
        },
      });
    },
    [confirmDelete, t, deleteCardMutation]
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
      {adminMode && (
        <ReportCardActionMenu.Item
          icon={<TrashIcon className="h-4 w-4" />}
          variant="danger"
          onSelect={() => {
            handleDeleteCard(cardId);
          }}
        >
          {t("Delete card")}
        </ReportCardActionMenu.Item>
      )}
    </ReportCardActionMenu>
  );
});

export default ReportCardTitleActionMenu;
