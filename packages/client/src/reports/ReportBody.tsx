import { Trans } from "react-i18next";
import { useContext, useMemo } from "react";
import { useBaseReportContext } from "./context/BaseReportContext";
import { ReportUIStateContext } from "./context/ReportUIStateContext";
import { ReportCardWithToolbarContext } from "./SortableReportContent";

export function ReportBody() {
  const { report } = useBaseReportContext();
  const uiState = useContext(ReportUIStateContext);
  const selectedTabId = uiState.selectedTabId;

  const hasMultipleTabs = useMemo(
    () => (report.tabs || []).length > 1,
    [report.tabs]
  );

  if (!report?.tabs || report.tabs.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {report.tabs.map((tab) => {
        const isActive = tab.id === selectedTabId;
        return (
          <div
            key={tab.id}
            className={
              isActive
                ? "p-4 space-y-2 relative w-full left-0"
                : "p-4 space-y-2 hidden"
            }
          >
            {tab.cards?.length === 0 && (
              <div>
                <p className="text-sm text-gray-500">
                  <Trans ns="admin:sketching">This tab is empty</Trans>
                </p>
              </div>
            )}
            {tab.cards?.map((card) => (
              <ReportCardWithToolbarContext
                key={card.id}
                card={card}
                hasMultipleTabs={hasMultipleTabs}
                onShowCalculationDetails={uiState.setShowCalcDetails}
                setEditing={uiState.setEditing}
                adminMode={false}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
