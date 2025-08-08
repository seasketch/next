import { useState, useEffect, Suspense, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import {
  DraftReportDocument,
  SketchingDetailsFragment,
  useAddReportCardMutation,
  useCreateDraftReportMutation,
  useDeleteReportCardMutation,
  useDraftReportQuery,
  useReorderReportTabCardsMutation,
  useUpdateReportCardMutation,
  useProjectMetadataQuery,
  useMoveCardToTabMutation,
  usePublishReportMutation,
  SketchTocDetailsFragment,
  useSketchReportingDetailsQuery,
  SketchGeometryType,
} from "../../generated/graphql";
import { PlusCircleIcon } from "@heroicons/react/solid";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  MenuBarContentClasses,
  MenuBarItemClasses,
} from "../../components/Menubar";
import {
  ReportConfiguration,
  registerCards,
  ReportCardType,
  ReportCardConfiguration,
} from "../../reports/cards/cards";
import {
  getCardRegistration,
  ReportCardConfigUpdateCallback,
} from "../../reports/registerCard";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Warning from "../../components/Warning";
import { ReportContext, useReportState } from "../../reports/ReportContext";
import { ReportTabs } from "../../reports/ReportTabs";
import { SortableReportBody } from "../../reports/SortableReportBody";
import { ReportTabManagementModal } from "../../reports/ReportTabManagementModal";
import { AddCardModal } from "../../reports/AddCardModal";
import Button from "../../components/Button";
import DropdownButton from "../../components/DropdownButton";
import useDialog from "../../components/useDialog";
import Spinner from "../../components/Spinner";
import { FormLanguageContext } from "../../formElements/FormElement";
import EditorLanguageSelector from "../../surveys/EditorLanguageSelector";
import languages from "../../lang/supported";
import getSlug from "../../getSlug";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { SketchingIcon } from "../../projects/ToolbarButtons";
import { MetricSubjectFragment } from "overlay-engine";

registerCards();

export default function SketchClassReportsAdmin({
  sketchClass,
}: {
  sketchClass: SketchingDetailsFragment;
}) {
  const { t, i18n } = useTranslation("admin:sketching");
  const { confirmDelete } = useDialog();
  const slug = getSlug();

  const onError = useGlobalErrorHandler();
  const { data, loading } = useDraftReportQuery({
    variables: {
      sketchClassId: sketchClass.id,
    },
    onError,
  });

  const sketchesForDemonstration = useMemo(() => {
    const sketches =
      data?.sketchClass?.project?.mySketches?.filter(
        (sketch) => sketch.sketchClassId === sketchClass.id
      ) || [];

    // Sort by createdAt (most recent first)
    return sketches.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Most recent first
    });
  }, [data]);

  const [selectedSketchId, setSelectedSketchId] = useState<number | null>(
    () => {
      // Auto-select the first (most recent) sketch by default
      const sketches =
        data?.sketchClass?.project?.mySketches?.filter(
          (sketch) => sketch.sketchClassId === sketchClass.id
        ) || [];

      if (sketches.length > 0) {
        // Sort by createdAt and select the most recent
        const sortedSketches = sketches.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA; // Most recent first
        });
        return sortedSketches[0].id;
      }
      return null;
    }
  );

  // Update selectedSketchId when sketches change
  useEffect(() => {
    if (!selectedSketchId && sketchesForDemonstration.length > 0) {
      setSelectedSketchId(sketchesForDemonstration[0].id);
    }
  }, [sketchesForDemonstration, selectedSketchId]);

  const sketchReportingDetails = useSketchReportingDetailsQuery({
    variables: {
      id: selectedSketchId || 0,
      sketchClassId: sketchClass.id,
    },
    skip: !selectedSketchId,
  });

  const [moveCardToTab, moveCardToTabState] = useMoveCardToTabMutation({
    onError,
    refetchQueries: [DraftReportDocument],
    awaitRefetchQueries: true,
  });

  const { data: projectData } = useProjectMetadataQuery({
    variables: { slug },
  });

  // Set up language state
  let lang = languages.find((l) => l.code === (i18n.language || "EN"))!;
  if (!lang) {
    lang = languages.find((l) => l.code === "EN")!;
  }
  const [language, setLanguage] = useState(lang);

  const [createDraftReport, createDraftReportState] =
    useCreateDraftReportMutation({
      awaitRefetchQueries: true,
      refetchQueries: [DraftReportDocument],
    });

  const [addReportCard, addReportCardState] = useAddReportCardMutation({
    awaitRefetchQueries: true,
    refetchQueries: [DraftReportDocument],
  });

  const [updateReportCard, updateReportCardState] = useUpdateReportCardMutation(
    { onError }
  );

  const [reorderReportTabCards] = useReorderReportTabCardsMutation({
    onError,
    refetchQueries: [DraftReportDocument],
    awaitRefetchQueries: true,
  });

  const [deleteCardMutation, deleteCardMutationState] =
    useDeleteReportCardMutation({
      onError,
      refetchQueries: [DraftReportDocument],
      awaitRefetchQueries: true,
    });

  const [publishReport, publishReportState] = usePublishReportMutation({
    onError,
    refetchQueries: [DraftReportDocument],
    awaitRefetchQueries: true,
  });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [manageTabsModalOpen, setManageTabsModalOpen] = useState(false);
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);
  const [localCardEdits, setLocalCardEdits] =
    useState<ReportCardConfiguration<any> | null>(null);

  const history = useHistory();

  const draftReport = data?.sketchClass?.draftReport;

  // Use the custom hook to manage report state
  const reportState = useReportState(
    (draftReport as any) || undefined,
    selectedSketchId || 0
  );

  // Get the selected sketch for demonstration
  const selectedSketch = sketchReportingDetails.data?.sketch;
  const selectedSketchClass = sketchReportingDetails.data?.sketchClass;

  const handleCardReorder = async (cardIds: number[], reportTabId: number) => {
    try {
      await reorderReportTabCards({
        variables: {
          reportTabId,
          cardIds,
        },
      });
    } catch (error) {
      // Error is handled by onError
    }
  };

  const handleCardMove = async (cardId: number, destinationTabId: number) => {
    try {
      await moveCardToTab({
        variables: {
          cardId,
          tabId: destinationTabId,
        },
      });
    } catch (error) {
      // Error is handled by onError
    }
  };

  const handleCardSelect = async (cardType: string) => {
    if (!reportState.selectedTab) {
      console.error("No selected tab");
      return;
    }

    const registration = getCardRegistration(cardType as ReportCardType);
    if (!registration) {
      console.error("Card registration not found for type:", cardType);
      return;
    }

    try {
      await addReportCard({
        variables: {
          reportTabId: reportState.selectedTab.id,
          componentSettings: registration.defaultSettings,
          cardType: cardType,
          body: registration.pickerSettings.body || {},
        },
      });
      setAddCardModalOpen(false);
    } catch (error) {
      // Error is handled by onError
    }
  };

  const handleCancelEditing = () => {
    reportState.setSelectedForEditing(null);
    setLocalCardEdits(null);
  };

  const handleCardUpdate = (
    cardId: number,
    updatedConfig:
      | ReportCardConfiguration<any>
      | ((
          prevState: ReportCardConfiguration<any>
        ) => ReportCardConfiguration<any>)
  ) => {
    if (reportState.selectedForEditing === cardId) {
      setLocalCardEdits((prevState) => {
        if (!prevState) {
          return null;
        }
        return typeof updatedConfig === "function"
          ? updatedConfig(prevState)
          : updatedConfig;
      });
    }
  };

  const handleDeleteCard = async (cardId: number) => {
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
  };

  const handleSaveCard = async () => {
    if (!selectedCardForEditing) {
      return;
    }

    if (!localCardEdits) {
      // cancel
      reportState.setSelectedForEditing(null);
      setLocalCardEdits(null);
      return;
    }

    try {
      await updateReportCard({
        variables: {
          id: selectedCardForEditing.id,
          componentSettings:
            localCardEdits.componentSettings ||
            selectedCardForEditing.componentSettings,
          alternateLanguageSettings:
            localCardEdits.alternateLanguageSettings ||
            selectedCardForEditing.alternateLanguageSettings,
          body: localCardEdits.body || selectedCardForEditing.body,
          cardType: localCardEdits.type || selectedCardForEditing.type,
        },
        refetchQueries: [DraftReportDocument],
        awaitRefetchQueries: true,
      });

      // Clear local edits and exit editing mode on successful save
      reportState.setSelectedForEditing(null);
      setLocalCardEdits(null);
    } catch (error) {
      // Error is handled by onError
    }
  };

  // Handle navigation blocking when editing
  useEffect(() => {
    if (!reportState.selectedForEditing) return;

    const message = t(
      "You have unsaved changes to a report card. Are you sure you want to leave?"
    );

    // Handle browser refresh/close (beforeunload)
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    // Handle React Router navigation
    const unblock = history.block(() => message);

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      unblock();
    };
  }, [reportState.selectedForEditing, history, t]);

  if (!loading && !draftReport) {
    if (
      !createDraftReportState.called &&
      !createDraftReportState.loading &&
      !createDraftReportState.error
    ) {
      createDraftReport({
        variables: {
          sketchClassId: sketchClass.id,
        },
      }).catch(() => {
        // do nothing. component will show error
      });
    }
    return (
      <div className="flex flex-col w-full h-full items-center p-8">
        {createDraftReportState.called &&
          !createDraftReportState.loading &&
          !createDraftReportState.error && (
            <Warning level="warning">{t("No draft report found")}</Warning>
          )}
        {createDraftReportState.error && (
          <Warning level="error">
            {t("Error creating draft report. ")}
            {createDraftReportState.error.message}
          </Warning>
        )}
        {createDraftReportState.loading && (
          <div className="flex flex-col w-full h-full items-center p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="text-gray-500">{t("Creating draft report...")}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const hasUnpublishedChanges =
    (data?.sketchClass && !data?.sketchClass?.report) ||
    new Date(data?.sketchClass?.draftReport?.updatedAt) >=
      new Date(data?.sketchClass?.report?.createdAt);

  const selectedCardForEditing = reportState.selectedForEditing
    ? reportState.selectedTab?.cards.find(
        (card) => card.id === reportState.selectedForEditing
      )
    : null;

  // Merge local edits with server state for the card being edited
  const cardWithLocalEdits = {
    ...(selectedCardForEditing || {}),
    ...(localCardEdits || {}),
  } as ReportCardConfiguration<any>;

  return (
    <FormLanguageContext.Provider
      value={{
        lang: language,
        setLanguage: (code: string) => {
          const lang = languages.find((lang) => lang.code === code);
          if (!lang) {
            throw new Error(`Unrecognized language ${code}`);
          }
          setLanguage(lang);
          i18n.changeLanguage(lang.code);
        },
        supportedLanguages:
          (projectData?.project?.supportedLanguages as string[]) || [],
      }}
    >
      <ReportContext.Provider
        value={{
          report: draftReport as unknown as ReportConfiguration,
          sketchClass:
            (selectedSketchClass as unknown as SketchingDetailsFragment) ||
            sketchClass,
          sketch: selectedSketch || ({} as any),
          adminMode: true,
          ...reportState,
          deleteCard: handleDeleteCard,
          isCollection: false,
          childSketches: selectedSketch?.children || [],
          siblingSketches: selectedSketch?.siblings || [],
          relatedFragments:
            (selectedSketch?.relatedFragments as unknown as MetricSubjectFragment[]) ||
            [],
          geographies:
            selectedSketchClass?.project?.geographies ||
            data?.sketchClass?.project?.geographies ||
            [],
        }}
      >
        <div className="flex flex-col w-full h-full">
          {/* Header */}
          <div className="bg-gray-100 p-4 flex-none border-b shadow z-10 flex items-center justify-between">
            <div className="flex-none space-x-2">
              <Button
                small
                disabled={publishReportState.loading || !hasUnpublishedChanges}
                title={
                  hasUnpublishedChanges
                    ? t("There are unpublished changes. Publish to save them.")
                    : t("No unpublished changes")
                }
                loading={publishReportState.loading}
                label={t("Publish Report")}
                onClick={() => {
                  publishReport({
                    variables: {
                      sketchClassId: sketchClass.id,
                    },
                  });
                }}
                primary={hasUnpublishedChanges}
              />
              <span className="text-sm text-gray-500">
                {data?.sketchClass?.report &&
                  t("Published ") +
                    new Date(
                      data.sketchClass.report.createdAt
                    ).toLocaleDateString()}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {t("Demo Sketch:")}
                </span>
                <DropdownButton
                  small
                  disabled={sketchesForDemonstration.length === 0}
                  label={
                    selectedSketch ? (
                      <Trans ns="admin:sketching">
                        Displayed Sketch: {selectedSketch.name}
                      </Trans>
                    ) : (
                      t("Select a sketch...")
                    )
                  }
                  // buttonClassName="min-w-72"
                  options={sketchesForDemonstration.map((sketch) => ({
                    label: sketch.name,
                    onClick: () => setSelectedSketchId(sketch.id),
                    id: sketch.id.toString(),
                  }))}
                />
                {sketchReportingDetails.loading && <Spinner />}
              </div>
            </div>
            <EditorLanguageSelector />
          </div>

          {/* Main */}
          <div className="flex-1 flex relative">
            {/* left sidebar */}
            <div
              className={`absolute left-0 top-0 bg-white flex-none border-r shadow-lg border-black/15 min-h-full flex flex-col w-72 transition-transform ${
                reportState.selectedForEditing
                  ? "translate-x-0"
                  : "-translate-x-72"
              }`}
            >
              {selectedCardForEditing && (
                <>
                  <div className="flex-1">
                    <div className="p-4">
                      <h3 className="text-lg font-medium">
                        {/* {selectedCardForEditing.title} */}
                      </h3>
                    </div>
                    <div className="p-4 pt-0">
                      <Suspense
                        fallback={
                          <div>
                            <Spinner />
                          </div>
                        }
                      >
                        <AdminFactory
                          type={selectedCardForEditing.type}
                          config={cardWithLocalEdits}
                          onUpdate={(update) => {
                            setLocalCardEdits((prevState) => {
                              const result =
                                typeof update === "function"
                                  ? update(prevState || ({} as any))
                                  : update;
                              return result;
                            });
                          }}
                        />
                      </Suspense>
                    </div>
                  </div>
                  <div className="flex-none bg-gray-100 p-4 space-x-2 border-t flex justify-end">
                    <Button
                      label={t("Cancel")}
                      onClick={handleCancelEditing}
                      disabled={updateReportCardState.loading}
                    />
                    <Button
                      label={t("Save")}
                      onClick={handleSaveCard}
                      primary
                      loading={updateReportCardState.loading}
                      disabled={updateReportCardState.loading}
                    />
                  </div>
                </>
              )}
            </div>

            {/* main content */}
            {sketchesForDemonstration.length === 0 ? (
              <div className="flex-1 p-8 pt-16">
                <div className="max-w-md text-center mx-auto">
                  <div className="mb-6">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                      <div className="w-6 h-6 text-blue-600">
                        {SketchingIcon}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {t("No sketches available for demonstration")}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {t(
                      "To author reports based on real data, you need to create sketches in your account first. Consider creating multiple sketches that represent different scenarios to test your reports thoroughly."
                    )}
                  </p>
                  <Button
                    label={t("Go to Sketching")}
                    onClick={() => {
                      window.location.href = `/${slug}/app/sketches`;
                    }}
                    primary
                  />
                </div>
              </div>
            ) : (
              <DragDropContext
                onDragEnd={(result: DropResult) => {
                  if (
                    !result.destination ||
                    (result.destination.droppableId ===
                      result.source.droppableId &&
                      result.destination.index === result.source.index)
                  ) {
                    return;
                  }

                  const sourceTabId = parseInt(
                    result.source.droppableId
                      .replace("tab-header-", "")
                      .replace("tab-body-", "")
                  );
                  const destinationTabId = parseInt(
                    result.destination.droppableId
                      .replace("tab-header-", "")
                      .replace("tab-body-", "")
                  );
                  const cardId = parseInt(result.draggableId);

                  const isSourceTabBody =
                    result.source.droppableId.startsWith("tab-body-");
                  const isDestinationTabBody =
                    result.destination.droppableId.startsWith("tab-body-");
                  const isDestinationTabHeader =
                    result.destination.droppableId.startsWith("tab-header-");

                  if (isDestinationTabHeader) {
                    // Dropped on a tab header - move card to that tab
                    handleCardMove(cardId, destinationTabId);
                    // Switch to the destination tab
                    reportState.setSelectedTabId(destinationTabId);
                  } else if (
                    isSourceTabBody &&
                    isDestinationTabBody &&
                    sourceTabId === destinationTabId
                  ) {
                    // Reorder within the same tab body
                    const sourceTab = draftReport?.tabs?.find(
                      (tab) => tab.id === sourceTabId
                    );
                    if (sourceTab && sourceTab.cards) {
                      const cardIds = sourceTab.cards.map((card) => card.id);
                      // Reorder the cardIds array based on the drag result
                      const sourceIndex = result.source.index;
                      const destinationIndex = result.destination.index;
                      const [removed] = cardIds.splice(sourceIndex, 1);
                      cardIds.splice(destinationIndex, 0, removed);
                      handleCardReorder(cardIds, sourceTabId);
                    }
                  } else if (
                    isSourceTabBody &&
                    isDestinationTabBody &&
                    sourceTabId !== destinationTabId
                  ) {
                    // Moving between different tab bodies
                    handleCardMove(cardId, destinationTabId);
                    // Switch to the destination tab
                    reportState.setSelectedTabId(destinationTabId);
                  } else {
                    // Fallback for any unexpected scenarios
                  }
                }}
              >
                <div className="flex-1 p-8">
                  {draftReport && (
                    <>
                      <div
                        className={`w-128 mx-auto bg-white rounded-lg shadow-xl border border-t-black/5 border-l-black/10 border-r-black/15 border-b-black/20 ${
                          reportState.selectedForEditing
                            ? "3xl:translate-x-0 translate-x-36"
                            : ""
                        }`}
                      >
                        {/* report header */}
                        <div className="px-4 py-3 border-b bg-white rounded-t-lg flex items-center space-x-2">
                          <div className="flex-1">{selectedSketch?.name}</div>
                          {/* <div className="flex-none flex items-center hover:bg-gray-100 rounded-full hover:outline-4 hover:outline hover:outline-gray-100">
                        <button>
                          <DotsHorizontalIcon className="w-6 h-6 text-gray-400" />
                        </button>
                      </div> */}
                          <div className="flex-none flex items-center">
                            <DropdownMenu.Root
                              open={dropdownOpen}
                              onOpenChange={setDropdownOpen}
                            >
                              <DropdownMenu.Trigger
                                asChild
                                disabled={!!reportState.selectedForEditing}
                              >
                                <button
                                  // disabled={!!selectedForEditing}
                                  title={
                                    reportState.selectedForEditing
                                      ? t(
                                          "Cannot add a card or tab while editing"
                                        )
                                      : t("Add a card or tab")
                                  }
                                >
                                  <PlusCircleIcon
                                    className={`w-7 h-7 text-blue-500  ${
                                      reportState.selectedForEditing
                                        ? "text-gray-400"
                                        : "hover:text-blue-600"
                                    }`}
                                  />
                                </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                  className={MenuBarContentClasses}
                                  side="bottom"
                                  align="end"
                                  sideOffset={5}
                                >
                                  <DropdownMenu.Item
                                    className={MenuBarItemClasses}
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      setAddCardModalOpen(true);
                                      setDropdownOpen(false);
                                    }}
                                  >
                                    {t("Add a Card")}
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    className={MenuBarItemClasses}
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      setManageTabsModalOpen(true);
                                      setDropdownOpen(false);
                                    }}
                                  >
                                    {t("Manage Tabs")}
                                  </DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </div>
                        </div>

                        {/* report tabs */}
                        <ReportTabs enableDragDrop={true} />
                        {/* report body */}
                        <SortableReportBody
                          selectedTab={reportState.selectedTab}
                          selectedForEditing={reportState.selectedForEditing}
                          localCardEdits={localCardEdits}
                          onCardUpdate={handleCardUpdate}
                        />
                        {/* Add Card Modal */}
                        {draftReport && (
                          <AddCardModal
                            isOpen={addCardModalOpen}
                            onClose={() => setAddCardModalOpen(false)}
                            onSelect={handleCardSelect}
                          />
                        )}
                        {/* report footer */}
                        {/* <div className="p-4 border-t"></div> */}
                      </div>
                    </>
                  )}

                  {/* Manage Tabs Modal */}
                  {draftReport && (
                    <ReportTabManagementModal
                      isOpen={manageTabsModalOpen}
                      onClose={() => setManageTabsModalOpen(false)}
                      tabs={draftReport.tabs || []}
                      reportId={draftReport.id}
                    />
                  )}
                </div>
              </DragDropContext>
            )}

            {/* right sidebar */}
            <div className="w-0 bg-white flex-none border-l shadow"></div>
          </div>

          {/* Footer */}
          {/* <div className="bg-gray-100 p-4 flex-none border-t shadow"></div> */}
        </div>
      </ReportContext.Provider>
    </FormLanguageContext.Provider>
  );
}

function AdminFactory({
  type,
  config,
  onUpdate,
}: {
  type: ReportCardType;
  config: ReportCardConfiguration<any> | null | undefined;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  const registration = getCardRegistration(type);
  if (!registration?.adminComponent || !config) {
    return null;
  }
  const Component = registration.adminComponent;
  return <Component config={config} onUpdate={onUpdate} />;
}
