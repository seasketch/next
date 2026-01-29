import { useTranslation } from "react-i18next";
import { Sketch } from "../generated/graphql";
import { BaseReportContext } from "./context/BaseReportContext";
import { memo, useCallback, useContext, useMemo, useState } from "react";
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

  const uiStateContextValue = useMemo(() => {
    return {
      selectedTabId: selectedTabId,
      setSelectedTabId: setSelectedTabId,
      editing: editing,
      setEditing: setEditing,
      adminMode: true,
      preselectTitle: preselectTitle,
    };
  }, [selectedTabId, setSelectedTabId, editing, setEditing, preselectTitle]);

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
      <CalculationDetailsModal
        state={calcDetailsModalState.state}
        onClose={calcDetailsModalState.closeModal}
        config={calcDetailsCard}
        metrics={emptyDependencies.metrics}
        adminMode={true}
      />
    </ReportUIStateContext.Provider>
  );
}

const MemoizedSortableReportContent = memo(SortableReportContent);
