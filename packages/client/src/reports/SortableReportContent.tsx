import { Trans } from "react-i18next";
import ReportCard from "./ReportCard";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "react-beautiful-dnd";
import { ReportTabConfiguration } from "./cards/cards";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import {
  BaseDraftReportContextDocument,
  ReorderReportTabCardsMutation,
  ReorderReportTabCardsMutationVariables,
  useReorderReportTabCardsMutation,
} from "../generated/graphql";
import { useMemo } from "react";
import { ReportCardTitleToolbarContext } from "./widgets/ReportCardTitleToolbar";
import { useBaseReportContext } from "./context/BaseReportContext";
import { useCardDependencies } from "./context/useCardDependencies";

interface SortableReportContentProps {
  selectedTab: ReportTabConfiguration;
  disabled?: boolean;
  onMoveCardToTab?: (cardId: number) => void;
  onShowCalculationDetails?: (cardId: number) => void;
  setEditing: (editing: number | null, preselectTitle?: boolean) => void;
}

/**
 * Helper component that wraps ReportCard with the toolbar context.
 * This is extracted to its own component to properly memoize the context value
 * and prevent ReportCard from re-rendering when dragHandleProps change.
 */
export function ReportCardWithToolbarContext({
  card,
  dragHandleProps,
  hasMultipleTabs,
  onMoveCardToTab,
  onShowCalculationDetails,
  setEditing,
  adminMode,
}: {
  card: ReportTabConfiguration["cards"][number];
  dragHandleProps?: any;
  adminMode?: boolean;
  hasMultipleTabs: boolean;
  onMoveCardToTab?: (cardId: number) => void;
  onShowCalculationDetails?: (cardId: number) => void;
  setEditing?: (editing: number | null, preselectTitle?: boolean) => void;
}) {
  const cardId = card.id;
  // Dependencies are now fetched inside ReportCard via useCardDependencies
  // We'll determine hasMetrics based on the card's dependency configuration
  const cardDependencies = useCardDependencies(cardId);
  const hasMetrics = cardDependencies.metrics.length > 0;

  const toolbarContextValue = useMemo(() => {
    return {
      dragHandleProps,
      adminMode: Boolean(adminMode),
      cardId,
      hasMetrics,
      hasMultipleTabs,
      openMoveCardToTabModal: onMoveCardToTab,
      openCalculationDetailsModal: hasMetrics
        ? onShowCalculationDetails
        : undefined,
      loading: false,
      setEditing,
    };
  }, [
    cardId,
    dragHandleProps,
    hasMetrics,
    hasMultipleTabs,
    onMoveCardToTab,
    onShowCalculationDetails,
    setEditing,
    adminMode,
  ]);

  return (
    <ReportCardTitleToolbarContext.Provider value={toolbarContextValue}>
      <ReportCard config={card} />
    </ReportCardTitleToolbarContext.Provider>
  );
}

export function SortableReportContent(props: SortableReportContentProps) {
  const selectedTab = props.selectedTab;
  const disabled = props.disabled;
  const onError = useGlobalErrorHandler();

  // Context values for toolbar context
  const { report, sketchClass } = useBaseReportContext();

  const hasMultipleTabs = useMemo(
    () => (report.tabs || []).length > 1,
    [report.tabs]
  );

  const [reorderReportTabCards] = useReorderReportTabCardsMutation({
    onError,
    awaitRefetchQueries: true,
    refetchQueries: [
      {
        query: BaseDraftReportContextDocument,
        variables: { sketchClassId: sketchClass.id },
      },
    ],
    optimisticResponse: (
      vars: ReorderReportTabCardsMutationVariables
    ): ReorderReportTabCardsMutation => {
      const cardIds = Array.isArray(vars.cardIds)
        ? vars.cardIds
        : [vars.cardIds];
      return {
        __typename: "Mutation" as const,
        reorderReportTabCards: {
          __typename: "ReorderReportTabCardsPayload" as const,
          reportCards: cardIds.map((id, index) => ({
            __typename: "ReportCard" as const,
            id,
            position: index + 1,
          })),
        },
      };
    },
    update: (cache, { data }) => {
      const reportCards = data?.reorderReportTabCards?.reportCards;
      if (!reportCards?.length) return;

      cache.modify({
        id: cache.identify({ __typename: "ReportTab", id: selectedTab.id }),
        fields: {
          cards(existingCardRefs, { readField }) {
            const refs = existingCardRefs ?? [];
            const refById = new Map<number, (typeof refs)[number]>();
            for (const ref of refs) {
              refById.set(readField("id", ref) as number, ref);
            }
            const ordered = [...reportCards]
              .sort((a, b) => a.position - b.position)
              .map((c) => refById.get(c.id))
              .filter((r) => r != null) as typeof refs;
            const used = new Set(reportCards.map((c) => c.id));
            const rest = [...refs].filter(
              (ref) => !used.has(readField("id", ref) as number)
            );
            return [...ordered, ...rest];
          },
        },
      });
    },
  });

  if (!selectedTab) {
    return null;
  }

  return (
    <DragDropContext
      onDragEnd={(result: DropResult) => {
        if (
          !result.destination ||
          (result.destination.droppableId === result.source.droppableId &&
            result.destination.index === result.source.index)
        ) {
          return;
        }

        const cardIds = selectedTab.cards.map((card) => card.id);
        // Reorder the cardIds array based on the drag result
        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;
        const [removed] = cardIds.splice(sourceIndex, 1);
        cardIds.splice(destinationIndex, 0, removed);

        // Call the reorder function
        reorderReportTabCards({
          variables: {
            reportTabId: selectedTab.id,
            cardIds,
          },
        });
      }}
    >
      <div
        className={`p-4 transition-colors ${
          disabled ? "bg-gray-300" : "bg-gray-100"
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
              {selectedTab.cards.map((card, index) => {
                // const { metrics, loading, errors, overlaySources } =
                //   context.getDependencies(card.id);
                return (
                  <Draggable
                    key={card.id}
                    draggableId={card.id.toString()}
                    index={index}
                    isDragDisabled={disabled}
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
                        <ReportCardWithToolbarContext
                          card={card}
                          dragHandleProps={
                            disabled ? undefined : provided.dragHandleProps
                          }
                          hasMultipleTabs={hasMultipleTabs}
                          onMoveCardToTab={props.onMoveCardToTab}
                          onShowCalculationDetails={
                            props.onShowCalculationDetails
                          }
                          setEditing={props.setEditing}
                          adminMode={true}
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
    </DragDropContext>
  );
}
