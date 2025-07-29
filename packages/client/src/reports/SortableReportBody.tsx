import React, { useState, useCallback, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useReportContext } from "./ReportContext";
import { ReportCardFactory } from "./ReportCard";
import { Draggable, Droppable } from "react-beautiful-dnd";
import { ReportCardConfiguration } from "./cards/cards";

interface SortableReportBodyProps {
  selectedTab?: any;
  selectedForEditing?: number | null;
  localCardEdits?: ReportCardConfiguration<any> | null;
  onCardUpdate?: (
    cardId: number,
    updatedConfig: ReportCardConfiguration<any>
  ) => void;
}

export function SortableReportBody({
  selectedTab: propSelectedTab,
  selectedForEditing: propSelectedForEditing,
  localCardEdits,
  onCardUpdate,
}: SortableReportBodyProps) {
  const { t } = useTranslation("admin:sketching");
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

  if (!selectedTab) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-100 rounded-b-lg">
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
            {optimisticCards.map((card, index) => {
              // Merge local edits with the card if it's the one being edited
              const cardWithLocalEdits =
                selectedForEditing === card.id && localCardEdits
                  ? { ...card, ...localCardEdits }
                  : card;

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
                      className={`${
                        snapshot.isDragging
                          ? "shadow-lg rotate-2 scale-105 z-50"
                          : ""
                      } ${
                        !snapshot.isDragging
                          ? "transition-colors duration-150"
                          : ""
                      }`}
                      style={{
                        ...provided.draggableProps.style,
                      }}
                    >
                      <ReportCardFactory
                        config={cardWithLocalEdits}
                        dragHandleProps={
                          selectedForEditing ? {} : provided.dragHandleProps
                        }
                        onUpdate={(updatedConfig) => {
                          if (onCardUpdate) {
                            onCardUpdate(card.id, updatedConfig);
                          }
                        }}
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
