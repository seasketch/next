import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../components/Modal";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "react-beautiful-dnd";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/outline";
import {
  useAddReportTabMutation,
  useDeleteReportTabMutation,
  useRenameReportTabMutation,
  useReorderReportTabsMutation,
  ReportTabDetailsFragment,
  DraftReportDocument,
} from "../generated/graphql";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import Button from "../components/Button";
import TextInput from "../components/TextInput";
import useDialog from "../components/useDialog";

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

  // GraphQL mutations
  const [addReportTab, { loading: addingTab }] = useAddReportTabMutation({
    onError,
    refetchQueries: [DraftReportDocument],
    awaitRefetchQueries: true,
  });

  const [deleteReportTab, { loading: deletingTab }] =
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

  // Handle adding a new tab
  const handleAddTab = useCallback(async () => {
    const tabName = prompt(t("Enter a name for the new tab"));

    if (!tabName || !tabName.trim()) {
      return;
    }

    try {
      await addReportTab({
        variables: {
          reportId,
          title: tabName.trim(),
          position: tabs.length + 1,
        },
      });
    } catch (error) {
      // Error is handled by onError
    }
  }, [addReportTab, reportId, tabs.length, t]);

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
  const handleStartEdit = useCallback((tab: ReportTabDetailsFragment) => {
    setEditingTabId(tab.id);
    setEditingTabName(tab.title);
  }, []);

  // Handle saving the edited tab name
  const handleSaveEdit = useCallback(async () => {
    if (!editingTabId || !editingTabName.trim()) {
      setEditingTabId(null);
      return;
    }

    try {
      await renameReportTab({
        variables: {
          tabId: editingTabId,
          title: editingTabName.trim(),
        },
      });
      setEditingTabId(null);
      setEditingTabName("");
    } catch (error) {
      // Error is handled by onError
    }
  }, [renameReportTab, editingTabId, editingTabName]);

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

      const reorderedTabs = Array.from(tabs);
      const [removed] = reorderedTabs.splice(sourceIndex, 1);
      reorderedTabs.splice(destinationIndex, 0, removed);

      try {
        await reorderReportTabs({
          variables: {
            reportId,
            tabIds: reorderedTabs.map((tab) => tab.id),
          },
        });
      } catch (error) {
        // Error is handled by onError
      }
    },
    [reorderReportTabs, reportId, tabs]
  );

  const isLoading = addingTab || deletingTab || renamingTab || reorderingTabs;

  return (
    <>
      <Modal
        open={isOpen}
        onRequestClose={onClose}
        title={t("Manage Tabs")}
        className="w-64"
        disableBackdropClick={true}
        footer={[
          {
            label: t("Add New Tab"),
            onClick: handleAddTab,
            disabled: isLoading,
            variant: "primary",
          },
          {
            label: t("Close"),
            onClick: onClose,
            variant: "secondary",
          },
        ]}
      >
        <div className="space-y-4">
          {/* Tabs List */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="tabs">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {tabs.map((tab, index) => (
                    <Draggable
                      key={tab.id}
                      draggableId={tab.id.toString()}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`bg-gray-50 rounded-lg p-4 border ${
                            snapshot.isDragging
                              ? "shadow-lg rotate-2"
                              : "hover:bg-gray-100"
                          } transition-all duration-200`}
                        >
                          <div className="flex items-center space-x-3">
                            {/* Drag Handle */}
                            <div
                              {...provided.dragHandleProps}
                              className="flex-shrink-0 cursor-move text-gray-400 hover:text-gray-600"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 9h8M8 15h8M8 12h8"
                                />
                              </svg>
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
                                  <button
                                    onClick={handleSaveEdit}
                                    disabled={isLoading}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="text-gray-600 hover:text-gray-700"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h3 className="font-medium text-gray-900">
                                      {tab.title}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                      {tab.cards?.length || 0} {t("cards")}
                                    </p>
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
          {tabs.length === 0 && (
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
              disabled: deletingTab,
              variant: "danger",
            },
          ]}
        >
          <div className="space-y-4">
            <p>
              {t("Are you sure you want to delete the tab '{{tabTitle}}'?", {
                tabTitle: tabToDelete.title,
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
                  {tabs
                    .filter((tab) => tab.id !== tabToDelete.id)
                    .map((tab) => (
                      <label
                        key={tab.id}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="moveToTab"
                          value={tab.id}
                          checked={selectedMoveToTabId === tab.id}
                          onChange={(e) =>
                            setSelectedMoveToTabId(parseInt(e.target.value))
                          }
                          className="text-blue-600"
                        />
                        <span className="text-sm">
                          {tab.title} ({tab.cards?.length || 0} {t("cards")})
                        </span>
                      </label>
                    ))}
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
