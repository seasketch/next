import React, { useState, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../components/Modal";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "react-beautiful-dnd";
import { TrashIcon, PencilIcon } from "@heroicons/react/outline";
import {
  useAddReportTabMutation,
  useDeleteReportTabMutation,
  useRenameReportTabMutation,
  useReorderReportTabsMutation,
  ReportTabDetailsFragment,
  DraftReportDocument,
} from "../generated/graphql";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import TextInput from "../components/TextInput";
import useDialog from "../components/useDialog";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  DragHandleHorizontalIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { FormLanguageContext } from "../formElements/FormElement";
import EditorLanguageSelector from "../surveys/EditorLanguageSelector";
import languages from "../lang/supported";

interface ReportTabManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: ReportTabDetailsFragment[];
  reportId: number;
}

export function ReportTabManagementModal({
  isOpen,
  onClose,
  tabs,
  reportId,
}: ReportTabManagementModalProps) {
  const { t } = useTranslation("admin:sketching");
  const onError = useGlobalErrorHandler();
  const dialog = useDialog();
  const langContext = useContext(FormLanguageContext);

  // State for editing tab names
  const [editingTabId, setEditingTabId] = useState<number | null>(null);
  const [editingTabName, setEditingTabName] = useState("");

  // State for delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tabToDelete, setTabToDelete] =
    useState<ReportTabDetailsFragment | null>(null);
  const [selectedMoveToTabId, setSelectedMoveToTabId] = useState<number | null>(
    null
  );

  // Optimistic state for tab ordering
  const [optimisticTabs, setOptimisticTabs] =
    useState<ReportTabDetailsFragment[]>(tabs);

  // GraphQL mutations
  const [addReportTab, { loading: addingTab }] = useAddReportTabMutation({
    onError,
    refetchQueries: [DraftReportDocument],
    awaitRefetchQueries: true,
  });

  const [deleteReportTab, { loading: deletingTabLoading }] =
    useDeleteReportTabMutation({
      onError,
      refetchQueries: [DraftReportDocument],
      awaitRefetchQueries: true,
    });

  const [renameReportTab, { loading: renamingTab }] =
    useRenameReportTabMutation({
      onError,
      refetchQueries: [DraftReportDocument],
      awaitRefetchQueries: true,
    });

  const [reorderReportTabs, { loading: reorderingTabs }] =
    useReorderReportTabsMutation({
      onError,
      refetchQueries: [DraftReportDocument],
      awaitRefetchQueries: true,
    });

  // Update optimistic tabs when tabs prop changes
  React.useEffect(() => {
    setOptimisticTabs(tabs);
  }, [tabs]);

  // Helper function to get localized tab title
  const getLocalizedTabTitle = useCallback(
    (tab: ReportTabDetailsFragment) => {
      if (langContext?.lang?.code !== "EN" && tab.alternateLanguageSettings) {
        const alternateSettings =
          tab.alternateLanguageSettings[langContext.lang.code];
        if (alternateSettings?.title) {
          return alternateSettings.title;
        }
      }
      return tab.title;
    },
    [langContext?.lang?.code]
  );

  // Handle adding a new tab
  const handleAddTab = useCallback(async () => {
    const tabName = prompt(t("Enter a name for the new tab"));

    if (!tabName || !tabName.trim()) {
      return;
    }

    try {
      // TODO: Update AddReportTabMutation to support alternateLanguageSettings
      // For now, we'll save to the main title regardless of language
      await addReportTab({
        variables: {
          reportId,
          title: tabName.trim(),
          position: optimisticTabs.length + 1,
        },
      });
    } catch (error) {
      // Error is handled by onError
    }
  }, [addReportTab, reportId, optimisticTabs.length, t]);

  // Handle starting delete process
  const handleDeleteTab = useCallback((tab: ReportTabDetailsFragment) => {
    setTabToDelete(tab);
    setSelectedMoveToTabId(null);
    setDeleteModalOpen(true);
  }, []);

  // Handle confirming delete
  const handleConfirmDelete = useCallback(async () => {
    if (!tabToDelete) return;

    try {
      await deleteReportTab({
        variables: {
          tabId: tabToDelete.id,
          ...(selectedMoveToTabId && { moveCardsToTabId: selectedMoveToTabId }),
        },
      });
      setDeleteModalOpen(false);
      setTabToDelete(null);
      setSelectedMoveToTabId(null);
    } catch (error) {
      // Error is handled by onError
    }
  }, [deleteReportTab, tabToDelete, selectedMoveToTabId]);

  // Handle canceling delete
  const handleCancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setTabToDelete(null);
    setSelectedMoveToTabId(null);
  }, []);

  // Handle starting to edit a tab name
  const handleStartEdit = useCallback(
    (tab: ReportTabDetailsFragment) => {
      setEditingTabId(tab.id);
      // Use localized title for editing
      setEditingTabName(getLocalizedTabTitle(tab));
    },
    [getLocalizedTabTitle]
  );

  // Handle saving the edited tab name
  const handleSaveEdit = useCallback(async () => {
    if (!editingTabId || !editingTabName.trim()) {
      setEditingTabId(null);
      return;
    }

    try {
      // Find the current tab to get its existing alternateLanguageSettings
      const currentTab = optimisticTabs.find((tab) => tab.id === editingTabId);
      if (!currentTab) {
        setEditingTabId(null);
        return;
      }

      let newAlternateLanguageSettings =
        currentTab.alternateLanguageSettings || {};

      if (langContext?.lang?.code !== "EN") {
        // Update alternate language settings for non-English languages
        newAlternateLanguageSettings = {
          ...newAlternateLanguageSettings,
          [langContext.lang.code]: {
            ...newAlternateLanguageSettings[langContext.lang.code],
            title: editingTabName.trim(),
          },
        };
      }

      await renameReportTab({
        variables: {
          tabId: editingTabId,
          title:
            langContext?.lang?.code === "EN"
              ? editingTabName.trim()
              : currentTab.title,
          alternateLanguageSettings: newAlternateLanguageSettings,
        },
      });
      setEditingTabId(null);
      setEditingTabName("");
    } catch (error) {
      // Error is handled by onError
    }
  }, [
    renameReportTab,
    editingTabId,
    editingTabName,
    langContext?.lang?.code,
    optimisticTabs,
  ]);

  // Handle canceling edit
  const handleCancelEdit = useCallback(() => {
    setEditingTabId(null);
    setEditingTabName("");
  }, []);

  // Handle drag and drop reordering
  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;

      if (sourceIndex === destinationIndex) {
        return;
      }

      // Update optimistic state immediately
      const reorderedTabs = Array.from(optimisticTabs);
      const [removed] = reorderedTabs.splice(sourceIndex, 1);
      reorderedTabs.splice(destinationIndex, 0, removed);
      setOptimisticTabs(reorderedTabs);

      try {
        await reorderReportTabs({
          variables: {
            reportId,
            tabIds: reorderedTabs.map((tab) => tab.id),
          },
        });
      } catch (error) {
        // Error is handled by onError
        // Revert optimistic state on error
        setOptimisticTabs(tabs);
      }
    },
    [reorderReportTabs, reportId, optimisticTabs, tabs]
  );

  const isLoading =
    addingTab || deletingTabLoading || renamingTab || reorderingTabs;

  return (
    <>
      <Modal
        open={isOpen}
        onRequestClose={onClose}
        title={t("Report Tabs")}
        className="w-56"
        disableBackdropClick={true}
        footerClassName="bg-gray-100 border-t"
        footer={[
          {
            label: t("Close"),
            onClick: onClose,
            variant: "secondary",
          },
          {
            label: (
              <span className="flex items-center space-x-2">
                <PlusIcon className="" />
                <span>{t("Add New Tab")}</span>
              </span>
            ),
            onClick: handleAddTab,
            // variant: "primary",
            className: "",
          },
        ]}
      >
        {/* Language Selector */}
        {langContext && (
          <div className="mb-4 flex justify-end">
            <EditorLanguageSelector />
          </div>
        )}
        <div className="space-y-4 mb-6">
          <p className="text-sm text-gray-500">
            {t(
              "The tab bar will only be shown if a report has 2 or more tabs."
            )}
          </p>
          {/* Tabs List */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="tabs">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {optimisticTabs.map((tab, index) => (
                    <Draggable
                      key={tab.id}
                      draggableId={tab.id.toString()}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`bg-gray-50 rounded-lg px-4 py-2 border ${
                            snapshot.isDragging
                              ? "shadow-lg"
                              : "hover:bg-gray-100"
                          } ${!snapshot.isDragging ? "-150" : ""}`}
                          style={{
                            ...provided.draggableProps.style,
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            {/* Drag Handle */}
                            <div
                              {...provided.dragHandleProps}
                              className="flex-shrink-0 cursor-move text-gray-500 hover:text-gray-600"
                            >
                              <DragHandleHorizontalIcon className="w-5 h-5" />
                            </div>
                            {/* Tab Content */}
                            <div className="flex-1">
                              {editingTabId === tab.id ? (
                                <div className="flex items-center space-x-2">
                                  <TextInput
                                    value={editingTabName}
                                    onChange={(v) => setEditingTabName(v)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleSaveEdit();
                                      } else if (e.key === "Escape") {
                                        handleCancelEdit();
                                      }
                                    }}
                                    autoFocus
                                    label=""
                                    name="tabName"
                                  />
                                  <span>&nbsp;</span>
                                  <button
                                    onClick={handleSaveEdit}
                                    disabled={isLoading || renamingTab}
                                    className="text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {renamingTab ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                    ) : (
                                      <CheckCircledIcon className="w-5 h-5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    disabled={isLoading || renamingTab}
                                    className="text-gray-600 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <CrossCircledIcon className="w-5 h-5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-1">
                                      <h3 className="font-medium text-gray-900">
                                        {getLocalizedTabTitle(tab)}
                                      </h3>
                                      {langContext?.lang?.code !== "EN" &&
                                        tab.alternateLanguageSettings?.[
                                          langContext.lang.code
                                        ]?.title && (
                                          <span className="text-xs text-blue-600 bg-blue-100 px-1 py-0.5 rounded">
                                            {langContext.lang.code}
                                          </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                      {tab.cards?.length || 0}{" "}
                                      {(tab.cards?.length || 0) === 1
                                        ? t("Card")
                                        : t("Cards")}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleStartEdit(tab)}
                                      disabled={isLoading}
                                      className="text-gray-400 hover:text-gray-600 p-1"
                                      title={t("Rename tab")}
                                    >
                                      <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTab(tab)}
                                      disabled={isLoading}
                                      className="text-red-400 hover:text-red-600 p-1"
                                      title={t("Delete tab")}
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Empty State */}
          {optimisticTabs.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg
                  className="w-12 h-12 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-500">
                {t("No tabs yet. Add your first tab to get started.")}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {tabToDelete && (
        <Modal
          open={deleteModalOpen}
          onRequestClose={handleCancelDelete}
          title={t("Delete Tab")}
          icon="delete"
          disableBackdropClick={true}
          footer={[
            {
              label: t("Cancel"),
              onClick: handleCancelDelete,
              variant: "secondary",
            },
            {
              label: t("Delete"),
              onClick: handleConfirmDelete,
              disabled: deletingTabLoading,
              loading: deletingTabLoading,
              variant: "danger",
            },
          ]}
        >
          <div className="space-y-4">
            <p>
              {t("Are you sure you want to delete the tab '{{tabTitle}}'?", {
                tabTitle: getLocalizedTabTitle(tabToDelete),
              })}
            </p>

            {/* Card movement section */}
            {(tabToDelete.cards?.length || 0) > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  {t(
                    "This tab contains {{cardCount}} cards. You can optionally move them to another tab:",
                    {
                      cardCount: tabToDelete.cards?.length || 0,
                    }
                  )}
                </p>

                <div className="space-y-2">
                  <select
                    value={selectedMoveToTabId || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setSelectedMoveToTabId(null);
                      } else if (value) {
                        setSelectedMoveToTabId(parseInt(value));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">
                      {t("Select a tab to move cards to...")}
                    </option>
                    {optimisticTabs
                      .filter((tab) => tab.id !== tabToDelete.id)
                      .map((tab) => (
                        <option key={tab.id} value={tab.id}>
                          {getLocalizedTabTitle(tab)} ({tab.cards?.length || 0}{" "}
                          {t("cards")})
                        </option>
                      ))}
                  </select>
                </div>

                <p className="text-xs text-gray-500">
                  {t(
                    "If you don't select a tab, the cards will be deleted along with the tab."
                  )}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
