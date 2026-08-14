import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "react-beautiful-dnd";
import {
  DragHandleDots2Icon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import Modal from "../../components/Modal";
import {
  applyCardTabEdits,
  listCardTabs,
  tabPanelHasContent,
} from "../widgets/prosemirror/tabs";
import type {
  CardTabInfo,
  PMJSONNode,
} from "../widgets/prosemirror/tabs/wrapCardInTabs";

export default function CardTabsManagementModal({
  open,
  body,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  body: PMJSONNode;
  onClose: () => void;
  onSave: (nextBody: PMJSONNode) => Promise<void> | void;
  saving?: boolean;
}) {
  const { t } = useTranslation("admin:sketching");
  const [tabs, setTabs] = useState<CardTabInfo[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const bodySnapshotRef = useRef(body);
  const wasOpenRef = useRef(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingFocusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      bodySnapshotRef.current = body;
      const nextTabs = listCardTabs(body);
      setTabs(nextTabs);
      setPreviewIndex(0);
    }
    wasOpenRef.current = open;
  }, [open, body]);

  useEffect(() => {
    const index = pendingFocusIndexRef.current;
    if (index === null) {
      return;
    }
    pendingFocusIndexRef.current = null;
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  }, [tabs]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) {
      return;
    }
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) {
      return;
    }
    setTabs((current) => {
      const next = current.slice();
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
    setPreviewIndex((current) => {
      if (current === from) {
        return to;
      }
      if (from < current && to >= current) {
        return current - 1;
      }
      if (from > current && to <= current) {
        return current + 1;
      }
      return current;
    });
  }, []);

  const removeTab = useCallback((index: number) => {
    setTabs((current) => {
      if (current.length <= 2) {
        return current;
      }
      return current.filter((_, i) => i !== index);
    });
    setPreviewIndex((current) => {
      if (index === current) {
        return Math.max(0, index - 1);
      }
      if (index < current) {
        return current - 1;
      }
      return current;
    });
  }, []);

  const addTab = useCallback(() => {
    const nextIndex = tabs.length;
    setTabs((current) => [
      ...current,
      {
        id: nanoid(),
        label: t("Tab {{number}}", { number: current.length + 1 }),
      },
    ]);
    setPreviewIndex(nextIndex);
    pendingFocusIndexRef.current = nextIndex;
  }, [t, tabs.length]);

  const handleSave = useCallback(async () => {
    const cleaned = tabs
      .map((tab, index) => ({
        ...tab,
        label: tab.label.trim() || t("Tab {{number}}", { number: index + 1 }),
      }))
      .filter((tab) => tab.label.length > 0);
    if (cleaned.length < 2) {
      return;
    }
    await onSave(applyCardTabEdits(bodySnapshotRef.current, cleaned));
  }, [onSave, t, tabs]);

  if (!open) {
    return null;
  }

  const canRemove = tabs.length > 2;

  return (
    <Modal
      open={open}
      title={t("Manage tabs")}
      onRequestClose={onClose}
      panelClassName="sm:!max-w-lg lg:!max-w-lg"
      footerClassName="bg-gray-50 border-t"
      footer={[
        {
          label: t("Cancel"),
          onClick: onClose,
          variant: "secondary",
        },
        {
          label: t("Save"),
          onClick: () => {
            void handleSave();
          },
          variant: "primary",
          loading: saving,
          disabled: tabs.length < 2 || saving,
        },
      ]}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <div className="report-tabs-control !my-0">
            <div
              className="report-tabs-track"
              role="tablist"
              aria-label={t("Tab preview")}
            >
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className="report-tabs-tab"
                  aria-selected={index === previewIndex}
                  onClick={() => {
                    setPreviewIndex(index);
                    inputRefs.current[index]?.focus();
                    inputRefs.current[index]?.select();
                  }}
                >
                  {tab.label.trim() ||
                    t("Tab {{number}}", { number: index + 1 })}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2.5 text-center text-xs text-gray-500">
            {t("Preview — tabs appear centered under the card title.")}
          </p>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="card-tabs">
            {(provided) => (
              <ul
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {tabs.map((tab, index) => {
                  const hasContent = tabPanelHasContent(
                    bodySnapshotRef.current,
                    tab.id
                  );
                  const removeTitle = !canRemove
                    ? t("At least two tabs are required")
                    : hasContent
                    ? t("Remove tab and its contents")
                    : t("Remove tab");
                  return (
                    <Draggable
                      key={tab.id}
                      draggableId={tab.id}
                      index={index}
                    >
                      {(dragProvided, snapshot) => (
                        <li
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                            snapshot.isDragging
                              ? "border-gray-300 bg-white shadow-md"
                              : previewIndex === index
                              ? "border-gray-300 bg-white"
                              : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                          }`}
                        >
                          <div
                            {...dragProvided.dragHandleProps}
                            className="flex-shrink-0 cursor-grab rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                            title={t("Drag to reorder")}
                            aria-label={t("Drag to reorder")}
                          >
                            <DragHandleDots2Icon className="h-4 w-4" />
                          </div>
                          <input
                            ref={(el) => {
                              inputRefs.current[index] = el;
                            }}
                            aria-label={t("Tab name")}
                            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            value={tab.label}
                            onFocus={() => setPreviewIndex(index)}
                            onChange={(event) => {
                              const value = event.target.value;
                              setTabs((current) =>
                                current.map((item, i) =>
                                  i === index ? { ...item, label: value } : item
                                )
                              );
                            }}
                          />
                          <button
                            type="button"
                            className="flex-shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent disabled:hover:text-gray-300"
                            disabled={!canRemove}
                            title={removeTitle}
                            aria-label={removeTitle}
                            onClick={() => removeTab(index)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </li>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>

        <button
          type="button"
          className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900"
          onClick={addTab}
        >
          <PlusIcon className="mr-1.5 h-4 w-4" />
          {t("Add tab")}
        </button>
      </div>
    </Modal>
  );
}
