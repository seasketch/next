import { Node } from "prosemirror-model";
import { collectText } from "../../admin/surveys/collectText";
import { DownloadIcon, DragHandleDots2Icon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { createContext, useContext, useState, useEffect } from "react";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import ReportCardTitleActionMenu from "./ReportCardTitleActionMenu";

export default function ReportCardTitleToolbar({ node }: { node: Node }) {
  const context = useContext(ReportCardTitleToolbarContext);
  const { t } = useTranslation("admin:sketching");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const title = collectText(node.content);
  const { setEditing } = useContext(ReportUIStateContext);
  // const { deleteCard, getDependencies } = useReportContext();
  // const deps = getDependencies(context.cardId);
  // Clean up dragging state when mouse/touch is released anywhere
  useEffect(() => {
    if (!isDragging) return;
    const handleEnd = () => setIsDragging(false);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchend", handleEnd);
    return () => {
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging]);

  const isActive = menuOpen || isDragging;

  if (context.editing) {
    return null;
  }
  return (
    <h1
      className="text-2xl font-bold flex space-x-2 items-center w-[453px] group overflow-visible"
      data-report-title-node-view="yes"
      data-report-title="yes"
    >
      <span className="flex-1 truncate">{title.toString()}</span>
      {/* When active: apply styles directly. When not active: apply via group-hover */}
      <div
        className={`flex-none group-hover:w-auto flex items-center space-x-2 border transition-all duration-200 rounded-2xl px-3 py-1
          ${
            isActive
              ? "border-black/5 shadow-sm bg-blue-50/20"
              : "border-black/0 group-hover:border-black/5 group-hover:bg-blue-50/20"
          }`}
        style={{ marginTop: "-5px", marginBottom: "-5px" }}
      >
        <button
          title={t("Download results")}
          className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-600 ${
            isActive ? "opacity-100" : ""
          }`}
        >
          <DownloadIcon className="w-4 h-4" />
        </button>
        {context.dragHandleProps && (
          <button
            className={`text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
              isActive ? "opacity-100" : ""
            }`}
            {...context.dragHandleProps}
            title={t("Drag to reorder")}
            aria-label={t("Drag to reorder")}
            onMouseDown={(e) => {
              setIsDragging(true);
              context.dragHandleProps?.onMouseDown?.(e);
            }}
            onTouchStart={(e) => {
              setIsDragging(true);
              context.dragHandleProps?.onTouchStart?.(e);
            }}
          >
            <DragHandleDots2Icon className="w-4 h-4" />
          </button>
        )}
        <ReportCardTitleActionMenu
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          loading={context.loading}
          adminMode={context.adminMode}
          cardId={context.cardId}
          hasMetrics={context.hasMetrics}
          hasMultipleTabs={context.hasMultipleTabs}
          openMoveCardToTabModal={context.openMoveCardToTabModal}
          openCalculationDetailsModal={context.openCalculationDetailsModal}
          setEditing={setEditing}
        />
      </div>
    </h1>
  );
}

/**
 * Because titles need to be rendered within a prosemirror body using a react node view, we need to pass a lot of information from the ReportCard component to the toolbar via context.
 */
export const ReportCardTitleToolbarContext = createContext<{
  editing: boolean;
  dragHandleProps?: any;
  adminMode: boolean;
  cardId: number;
  hasMetrics: boolean;
  hasMultipleTabs: boolean;
  openMoveCardToTabModal?: (cardId: number) => void;
  openCalculationDetailsModal?: (cardId: number) => void;
  loading: boolean;
}>({
  editing: false,
  adminMode: false,
  cardId: 0,
  hasMetrics: false,
  hasMultipleTabs: false,
  openMoveCardToTabModal: undefined,
  openCalculationDetailsModal: undefined,
  loading: false,
});
