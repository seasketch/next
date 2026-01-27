import { Node } from "prosemirror-model";
import { collectText } from "../../admin/surveys/collectText";
import { DotsHorizontalIcon, DownloadIcon, DragHandleDots1Icon, DragHandleDots2Icon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import ReportCardActionMenu from "../components/ReportCardActionMenu";
import { useReportContext } from "../ReportContext";
import { CalculatorIcon, SwitchHorizontalIcon } from "@heroicons/react/outline";
import ReportCardLoadingIndicator from "../components/ReportCardLoadingIndicator";
import { SourceProcessingJobDetailsFragment } from "../../generated/graphql";
import Spinner from "../../components/Spinner";

export default function ReportCardTitleToolbar({ node }: { node: Node }) {
  const context = useContext(ReportCardTitleToolbarContext);
  const { t } = useTranslation("admin:sketching");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const title = collectText(node.content);
  const { setSelectedForEditing, deleteCard, setShowCalcDetails, getDependencies } = useReportContext();

  const deps = getDependencies(context.cardId);





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
          ${isActive
            ? "border-black/5 shadow-sm bg-blue-50/20"
            : "border-black/0 group-hover:border-black/5 group-hover:bg-blue-50/20"
          }`}
        style={{ marginTop: "-5px", marginBottom: "-5px" }}
      >
        <button title={t("Download results")} className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-600 ${isActive ? "opacity-100" : ""}`}>
          <DownloadIcon className="w-4 h-4" />
        </button>
        {context.dragHandleProps && (
          <button
            className={`text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isActive ? "opacity-100" : ""}`}
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
        {/* <ReportCardLoadingIndicator
          display={true}
          metrics={deps.metrics}
          sourceProcessingJobs={sourceProcessingJobs}
        /> */}
        <ReportCardActionMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          label={t("Card actions")}
          dependencies={deps}
        >
          {context.adminMode && (
            <ReportCardActionMenu.Item
              icon={<Pencil1Icon className="h-4 w-4" />}
              onSelect={() => {
                setSelectedForEditing(context.cardId!);
              }}
            >
              {t("Edit card")}
            </ReportCardActionMenu.Item>
          )}
          {context.hasMetrics && (
            <ReportCardActionMenu.Item
              onSelect={() => setShowCalcDetails(context.cardId!)}
              icon={deps.loading ? <Spinner className="scale-90" /> : <CalculatorIcon className="h-4 w-4" />}
            >
              {t("Calculation details")}
            </ReportCardActionMenu.Item>
          )}
          {context.adminMode &&
            Boolean(context.openMoveCardToTabModal) && (
              <ReportCardActionMenu.Item
                icon={<SwitchHorizontalIcon className="h-4 w-4" />}
                onSelect={() => {
                  context.openMoveCardToTabModal?.();
                }}
              >
                {t("Move to tab")}
              </ReportCardActionMenu.Item>
            )}
          {context.adminMode && Boolean(deleteCard) && (
            <ReportCardActionMenu.Item
              icon={<TrashIcon className="h-4 w-4" />}
              variant="danger"
              onSelect={() => {
                deleteCard?.(context.cardId);
              }}
            >
              {t("Delete card")}
            </ReportCardActionMenu.Item>
          )}

        </ReportCardActionMenu>
      </div>
    </h1>
  );
}

/**
 * Because titles need to be rendered within a prosemirror body using a react node view, we need to pass a lot of information from the ReportCard component to the toolbar via context.
 */
export const ReportCardTitleToolbarContext = createContext<{ editing: boolean, dragHandleProps?: any; adminMode: boolean, cardId: number, hasMetrics: boolean, openMoveCardToTabModal?: () => void }>({ editing: false, adminMode: false, cardId: 0, hasMetrics: false, openMoveCardToTabModal: () => { } });
