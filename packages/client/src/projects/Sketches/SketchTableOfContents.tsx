import {
  SketchFolderDetailsFragment,
  SketchGeometryType,
  SketchTocDetailsFragment,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import TreeView, { INode } from "react-accessible-treeview";
import Skeleton from "../../components/Skeleton";
import { SketchAction } from "./useSketchActions";
import ContextMenuDropdown, {
  DropdownDividerProps,
} from "../../components/ContextMenuDropdown";
import { DropdownOption } from "../../components/DropdownButton";
import FolderItem from "./FolderItem";
import { DropTargetMonitor, useDrop } from "react-dnd";
import SketchItem from "./SketchItem";
import useUpdateSketchTableOfContentsDraggable from "./useUpdateSketchTableOfContentsItem";

export default forwardRef<
  HTMLDivElement,
  {
    loading?: boolean;
    sketches: SketchTocDetailsFragment[];
    folders: SketchFolderDetailsFragment[];
    selectedSketchIds: number[];
    selectedFolderIds: number[];
    expandedFolderIds: number[];
    expandedSketchIds: number[];
    onSelectionChange: (
      item: SketchFolderDetailsFragment | SketchTocDetailsFragment,
      isSelected: boolean
    ) => void;
    onExpandedChange: (
      item: SketchFolderDetailsFragment | SketchTocDetailsFragment,
      isExpanded: boolean
    ) => void;
    reservedKeyCodes?: string[];
    onReservedKeyDown?: (keycode: string) => void;
    actions?: { create: SketchAction[]; edit: SketchAction[] };
    onActionSelected?: (action: SketchAction) => void;
  }
>(
  (
    {
      sketches,
      folders,
      selectedSketchIds,
      selectedFolderIds,
      onSelectionChange,
      loading,
      reservedKeyCodes,
      onReservedKeyDown,
      actions,
      onActionSelected,
      onExpandedChange,
      expandedFolderIds,
      expandedSketchIds,
    },
    ref
  ) => {
    const { t } = useTranslation();
    // const [expandedIds, setExpandedIds] = useState<number[]>([]);
    const treeView = useRef<HTMLUListElement>(null);
    const { dropFolder, dropSketch } =
      useUpdateSketchTableOfContentsDraggable();
    const [contextMenuTarget, setContextMenuTarget] = useState<{
      target: HTMLDivElement;
      offsetX?: number;
    } | null>(null);

    useEffect(() => {
      const handler = () => setContextMenuTarget(null);
      if (contextMenuTarget) {
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
      }
    }, [contextMenuTarget]);

    const treeData = useMemo(() => {
      const items: (SketchFolderDetailsFragment | SketchTocDetailsFragment)[] =
        [
          {
            name: "ROOT -- should not be displayed",
            id: 0,
          },
          ...[...sketches, ...folders].sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
        ];
      const idx: { [id: string]: number } = {};
      items.forEach(({ id, __typename }, index) => {
        idx[`${__typename}:${id}`] = index;
      });

      let nodes: INode[] = [
        {
          id: 0,
          name: "ROOT -- should not be displayed",
          children: [],
          parent: null,
        },
      ];

      const children: { [id: number]: number[] } = {};
      const orphans: number[] = [];

      items.forEach((item, id) => {
        if (id !== 0) {
          let parentId: null | string = null;
          if (item.collectionId) {
            // eslint-disable-next-line i18next/no-literal-string
            parentId = `Sketch:${item.collectionId}`;
          } else if (item.folderId) {
            // eslint-disable-next-line i18next/no-literal-string
            parentId = `SketchFolder:${item.folderId}`;
          }
          nodes.push({
            id,
            name: item.name || "",
            parent: parentId ? idx[parentId] : 0,
            children: [],
            isBranch: item.__typename === "SketchFolder",
          });
          if (parentId) {
            const parentIndex = idx[parentId];
            if (!(parentIndex in children)) {
              children[parentIndex] = [];
            }
            children[parentIndex].push(id);
          } else {
            orphans.push(id);
          }
        }
      });
      for (const node of nodes) {
        node.children = children[node.id] || [];
      }
      nodes[0].children = orphans;
      return {
        items,
        nodes,
      };
    }, [sketches, folders]);

    const selectedIds: number[] = useMemo(() => {
      const selectedNodeIds: number[] = [];
      for (const id of selectedFolderIds) {
        const idx = treeData.items.findIndex(
          (f) => f.id === id && f.__typename === "SketchFolder"
        );
        if (idx > 0) {
          selectedNodeIds.push(idx);
        }
      }
      for (const id of selectedSketchIds) {
        const idx = treeData.items.findIndex(
          (f) => f.id === id && f.__typename !== "SketchFolder"
        );
        if (idx > 0) {
          selectedNodeIds.push(idx);
        }
      }
      return selectedNodeIds;
    }, [selectedSketchIds, selectedFolderIds, treeData.items]);

    const expandedIds: number[] = useMemo(() => {
      const expandedNodeIds: number[] = [];
      for (const id of expandedFolderIds) {
        const idx = treeData.items.findIndex(
          (f) => f.id === id && f.__typename === "SketchFolder"
        );
        if (idx > 0) {
          expandedNodeIds.push(idx);
        }
      }
      for (const id of expandedSketchIds) {
        const idx = treeData.items.findIndex(
          (f) => f.id === id && f.__typename !== "SketchFolder"
        );
        if (idx > 0) {
          expandedNodeIds.push(idx);
        }
      }
      return expandedNodeIds;
    }, [expandedFolderIds, treeData.items, expandedSketchIds]);

    const contextMenuOptions = useMemo(() => {
      const options: (DropdownOption | DropdownDividerProps)[] = [];
      if (actions && onActionSelected) {
        for (const action of actions.edit) {
          const { label, disabled, disabledForContextAction } = action;
          if (!disabledForContextAction) {
            options.push({
              label,
              disabled,
              onClick: () => onActionSelected(action),
            });
          }
        }
        const createActions = actions.create.filter(
          (a) => !a.disabledForContextAction
        );
        if (createActions.length) {
          // @ts-ignore
          options.push({ label: t("add new"), id: "add-new-divider" });
          for (const action of createActions) {
            const { id, label, disabled, disabledForContextAction } = action;
            if (!disabledForContextAction) {
              options.push({
                id,
                label,
                disabled,
                onClick: () => onActionSelected(action),
              });
            }
          }
        }
      }
      return options;
    }, [actions, onActionSelected, t]);

    const [{ canDrop, isOver }, drop] = useDrop(() => ({
      // The type (or types) to accept - strings or symbols
      accept: ["SketchFolder", "Sketch"],
      canDrop: (item, monitor) => {
        return (
          monitor.isOver({ shallow: true }) === true &&
          (Boolean(item.collectionId) || Boolean(item.folderId))
        );
      },
      // Props to collect
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
      drop: (
        item: {
          id: number;
          typeName: string;
          folderId?: number | null;
          collectionId?: number | null;
        },
        monitor: DropTargetMonitor<{ id: number; typeName: string }>
      ) => {
        if (!monitor.didDrop()) {
          (item.typeName === "SketchFolder" ? dropFolder : dropSketch)(
            item.id,
            {
              folderId: null,
              collectionId: null,
            }
          );
        }
      },
    }));

    useEffect(() => {
      if (treeView.current) {
        treeView.current.onkeydown = (event) => {
          if (event.key === " ") {
            event.stopPropagation();
            // TODO: toggle visibility
            return;
          }
          if (
            reservedKeyCodes &&
            onReservedKeyDown &&
            reservedKeyCodes.indexOf(event.key) !== -1
          ) {
            event.stopPropagation();
            event.preventDefault();
            const view = treeView.current;
            setTimeout(() => {
              view?.blur();
            }, 100);
            onReservedKeyDown(event.key);
            return;
          }
          if (!event.metaKey && /^\w$/.test(event.key)) {
            event.stopPropagation();
          }
        };
      }
    }, [treeView, reservedKeyCodes, onReservedKeyDown]);

    const onDragEnd = useCallback(
      (items: { type: "sketch" | "folder"; id: number }[]) => {
        for (const item of items) {
          if (item.type === "sketch") {
            const sketch = sketches.find((s) => s.id === item.id);
            if (sketch) {
              onSelectionChange(sketch, true);
            } else {
              console.warn("didn't find sketch", item);
            }
          } else {
            const folder = folders.find((f) => f.id === item.id);
            if (folder) {
              onSelectionChange(folder, true);
            } else {
              console.warn("didn't find folder", item);
            }
          }
        }
      },
      [folders, onSelectionChange, sketches]
    );

    const onDropEnd = useCallback(
      (items: { type: "sketch" | "folder"; id: number }[]) => {
        for (const item of items) {
          if (item.type === "folder") {
            const folder = folders.find((f) => f.id === item.id);
            if (folder) {
              onExpandedChange(folder, true);
            }
          }
        }
      },
      [onExpandedChange, folders]
    );

    if (loading) {
      return (
        <div className="pt-2 space-y-2" ref={ref}>
          <Skeleton className="w-1/2 h-5" />
          <Skeleton className="w-2/3 h-5" />
          <Skeleton className="w-1/2 h-5" />
          <Skeleton className="w-2/3 h-5" />
          <Skeleton className="w-1/2 h-5" />
          <Skeleton className="w-2/3 h-5" />
          <Skeleton className="w-1/2 h-5" />
          <Skeleton className="w-2/3 h-5" />
        </div>
      );
    }

    return (
      <div
        ref={drop}
        className={
          isOver && canDrop
            ? "border-blue-200 rounded-md border pt-2 pl-5 bg-blue-50"
            : "pt-2 pl-5 border border-transparent"
        }
      >
        {contextMenuTarget &&
          onActionSelected &&
          actions &&
          actions.edit.length > 0 && (
            <ContextMenuDropdown
              options={contextMenuOptions}
              target={contextMenuTarget.target}
              offsetX={contextMenuTarget.offsetX}
            />
          )}
        <div>
          <TreeView
            ref={treeView}
            data={treeData.nodes}
            selectedIds={selectedIds}
            // multiSelect
            togglableSelect={true}
            expandedIds={expandedIds}
            onExpand={(props) => {
              const { element, isExpanded } = props;
              const data = treeData.items[element.id];
              onExpandedChange(data, isExpanded);
            }}
            onSelect={(props) => {
              const { element, isSelected } = props;
              const data = treeData.items[element.id];
              onSelectionChange(data, isSelected);
            }}
            clickAction="EXCLUSIVE_SELECT"
            aria-label={t("Your sketches")}
            nodeRenderer={({
              element,
              isExpanded,
              isDisabled,
              getNodeProps,
              level,
              handleExpand,
              isSelected,
              handleSelect,
              treeState,
            }) => {
              const data = treeData.items[element.id];
              const nodeProps = getNodeProps();
              if (data.__typename === "SketchFolder") {
                return (
                  <FolderItem
                    id={data.id}
                    name={data.name}
                    parentFolderId={data.folderId}
                    parentCollectionId={data.collectionId}
                    handleExpand={handleExpand}
                    handleSelect={handleSelect}
                    level={level}
                    nodeProps={nodeProps}
                    numChildren={element?.children?.length || 0}
                    isDisabled={isDisabled}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    onContextMenu={(e) => {
                      var rect = e.currentTarget.getBoundingClientRect();
                      var x = e.clientX - rect.left; //x position within the element.
                      if (!isSelected) {
                        handleSelect(e);
                      }

                      const target = e.currentTarget;
                      setContextMenuTarget({
                        target: target as HTMLDivElement,
                        offsetX: x,
                      });
                      e.preventDefault();
                    }}
                    onDragEnd={onDragEnd}
                    onDropEnd={onDropEnd}
                  />
                );
              } else if (
                data.__typename === "Sketch" &&
                data.sketchClass?.geometryType !== SketchGeometryType.Collection
              ) {
                return (
                  <SketchItem
                    id={data.id}
                    name={data.name}
                    parentCollectionId={data.collectionId}
                    parentFolderId={data.folderId}
                    handleSelect={handleSelect}
                    level={level}
                    nodeProps={nodeProps}
                    isDisabled={isDisabled}
                    isSelected={isSelected}
                    onContextMenu={(e) => {
                      var rect = e.currentTarget.getBoundingClientRect();
                      var x = e.clientX - rect.left; //x position within the element.
                      if (!isSelected) {
                        handleSelect(e);
                      }

                      const target = e.currentTarget;
                      setContextMenuTarget({
                        target: target as HTMLDivElement,
                        offsetX: x,
                      });
                      e.preventDefault();
                    }}
                    onDragEnd={onDragEnd}
                  />
                );
              }
            }}
          />
        </div>
      </div>
    );
  }
);
