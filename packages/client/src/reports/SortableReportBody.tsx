import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useReportContext } from "./ReportContext";
import ReportCard from "./ReportCard";
import { Draggable, Droppable } from "react-beautiful-dnd";
import { ReportCardConfiguration } from "./cards/cards";
import { ReportCardConfigUpdateCallback } from "./registerCard";

interface SortableReportBodyProps {
  selectedTab?: any;
  selectedForEditing?: number | null;
  localCardEdits?: ReportCardConfiguration<any> | null;
  onCardUpdate?: (
    cardId: number,
    updatedConfig:
      | ReportCardConfiguration<any>
      | ((
        prevState: ReportCardConfiguration<any>
      ) => ReportCardConfiguration<any>)
  ) => void;
  optimisticCardOrder?: number[];
}

export function SortableReportBody({
  selectedTab: propSelectedTab,
  selectedForEditing: propSelectedForEditing,
  localCardEdits,
  onCardUpdate,
  optimisticCardOrder,
}: SortableReportBodyProps) {
  const context = useReportContext();
  const selectedTab = propSelectedTab || context.selectedTab;
  const selectedForEditing =
    propSelectedForEditing ?? context.selectedForEditing;

  // Optimistic state for card ordering
  const [optimisticCards, setOptimisticCards] = useState<
    ReportCardConfiguration<any>[]
  >(selectedTab?.cards || []);

  // Update optimistic cards when selectedTab changes
  useEffect(() => {
    setOptimisticCards(selectedTab?.cards || []);
  }, [selectedTab?.cards]);

  // Use optimistic card order if available, otherwise use the default order
  const displayCards = useMemo(() => {
    if (!optimisticCardOrder || !selectedTab?.cards) {
      return optimisticCards;
    }

    // Reorder cards based on optimistic order
    const cardMap = new Map(
      selectedTab.cards.map((card: ReportCardConfiguration<any>) => [
        card.id,
        card,
      ])
    );
    return optimisticCardOrder
      .map((id) => cardMap.get(id))
      .filter(
        (card): card is ReportCardConfiguration<any> => card !== undefined
      );
  }, [optimisticCardOrder, selectedTab?.cards, optimisticCards]);

  const onReportCardUpdateFns = useMemo(() => {
    return displayCards.reduce((acc, card) => {
      acc[card.id] = (update: ReportCardConfiguration<any> | ((prevState: ReportCardConfiguration<any>) => ReportCardConfiguration<any>)) => {
        if (onCardUpdate) {
          onCardUpdate(card.id, update);
        }
      };
      return acc;
    }, {} as Record<number, ReportCardConfigUpdateCallback>);
  }, [displayCards.map(card => card.id).join(","), onCardUpdate]);


  if (!selectedTab) {
    return null;
  }

  return (
    <div
      className={`p-4 transition-colors ${!!selectedForEditing ? "bg-gray-300" : "bg-gray-100"
        } rounded-b-lg`}
    >
      {selectedTab.cards?.length === 0 && (
        <div>
          <p className="text-sm text-gray-500">
            <Trans ns="admin:sketching">
              No cards found. Click the + button to customize.
            </Trans>
          </p>
        </div>
      )}

      <Droppable droppableId={`tab-body-${selectedTab.id}`}>
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="space-y-2"
          >
            {displayCards.map((card, index) => {
              // Merge local edits with the card if it's the one being edited
              const cardWithLocalEdits =
                selectedForEditing === card.id && localCardEdits
                  ? { ...card, ...localCardEdits }
                  : card;

              const { metrics, loading, errors, overlaySources } =
                context.getDependencies(card.id);
              return (
                <Draggable
                  key={card.id}
                  draggableId={card.id.toString()}
                  index={index}
                  isDragDisabled={!!selectedForEditing}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`${snapshot.isDragging
                        ? "shadow-lg rotate-2 scale-105 z-50"
                        : ""
                        } ${!snapshot.isDragging
                          ? "transition-colors duration-150"
                          : ""
                        }`}
                      style={{
                        ...provided.draggableProps.style,
                      }}
                    >
                      <ReportCard
                        config={cardWithLocalEdits}
                        dragHandleProps={
                          selectedForEditing ? {} : provided.dragHandleProps
                        }
                        // onUpdate={onReportCardUpdateFns[card.id]}
                        metrics={metrics}
                        sources={overlaySources}
                      // loading={loading}
                      // errors={errors}
                      />
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
