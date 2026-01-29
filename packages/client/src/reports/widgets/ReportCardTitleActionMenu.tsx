import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { CalculatorIcon, SwitchHorizontalIcon } from "@heroicons/react/outline";
import ReportCardActionMenu from "../components/ReportCardActionMenu";
import Spinner from "../../components/Spinner";

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
            throw new Error("Not implemented");
            // deleteCard?.(cardId);
          }}
        >
          {t("Delete card")}
        </ReportCardActionMenu.Item>
      )}
    </ReportCardActionMenu>
  );
});

export default ReportCardTitleActionMenu;
