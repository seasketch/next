import { FolderIcon, FolderOpenIcon } from "@heroicons/react/solid";
import { MouseEventHandler, useCallback } from "react";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import ArrowIcon from "./ArrowIcon";
import { useDrag, useDrop } from "react-dnd";
import useUpdateSketchTableOfContentsDraggable from "./useUpdateSketchTableOfContentsItem";
import { TreeItemI, TreeNodeProps } from "../../components/TreeView";

export interface FolderNodeDataProps {
  name: string;
  id: number;
  folderId?: number | null;
  collectionId?: number | null;
  type: "SketchFolder";
}

export function isFolderNode(
  node: TreeItemI<any>
): node is TreeItemI<FolderNodeDataProps> {
  return node.data.type === "SketchFolder";
}

export type DragItemProps<T> = {
  nodeId: string;
  parents: string[];
} & T;

function FolderItem({
  onSelect,
  isSelected,
  onContextMenu,
  isExpanded,
  onExpand,
  numChildren,
  node,
  ChildGroup,
  children,
  isContextMenuTarget,
  updateContextMenuTargetRef,
  onDragEnd,
  onDropEnd,
  isChecked,
  hasCheckedChildren,
  onChecked,
}: TreeNodeProps<FolderNodeDataProps>) {
  const data = node.data;
  const isDisabled = false;

  const { dropFolder, dropSketch } = useUpdateSketchTableOfContentsDraggable();

  const [{ isDragging }, drag] = useDrag(() => ({
    type: "SketchFolder",
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    item: {
      nodeId: node.id,
      id: data.id,
      name: data.name,
      type: "SketchFolder",
      folderId: data.folderId,
      collectionId: data.collectionId,
      parents: node.parents,
    } as DragItemProps<FolderNodeDataProps>,
    end(draggedItem, monitor) {
      if (onDragEnd) {
        onDragEnd([draggedItem as DragItemProps<FolderNodeDataProps>]);
      }
    },
  }));

  const [{ canDrop, isOverCurrent }, drop] = useDrop(() => ({
    accept: ["SketchFolder", "Sketch"],
    canDrop: (item: DragItemProps<FolderNodeDataProps>, monitor) => {
      if (item.id === data.id || node.parents.indexOf(item.nodeId) !== -1) {
        return false;
      }
      return true;
    },
    // Props to collect
    collect: (monitor) => ({
      isOverCurrent: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      (item.type === "SketchFolder" ? dropFolder : dropSketch)(item.id, {
        collectionId: null,
        folderId: data.id,
      });
      if (onDropEnd) {
        onDropEnd(data);
      }
    },
  }));

  const attachRef = useCallback(
    (el: any) => {
      drag(el);
      drop(el);
    },
    [drag, drop]
  );

  let className = "";
  if (isSelected) {
    className = "bg-blue-200";
  }
  if (isDragging) {
    className = "bg-gray-200";
  }
  if (isOverCurrent && canDrop) {
    className = "bg-blue-300";
  }

  const updateSelectionOnClick: MouseEventHandler<any> = useCallback(
    (e) => {
      if (onSelect) {
        onSelect(e.metaKey, node, !isSelected);
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [onSelect, node, isSelected]
  );

  const contextMenuHandler: MouseEventHandler<any> = useCallback(
    (e) => {
      if (onContextMenu) {
        if (onSelect && !isSelected) {
          onSelect(e.metaKey, node, !isSelected);
        }
        var rect = e.currentTarget.getBoundingClientRect();
        var offsetX = e.clientX - rect.left; //x position within the element.
        onContextMenu(node, e.currentTarget, offsetX);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [isSelected, node, onContextMenu, onSelect]
  );

  return (
    <div
      data-node-id={node.id}
      ref={attachRef}
      style={{
        marginLeft: -15,
        opacity: isDisabled ? 0.5 : 1,
        paddingLeft: 0,
      }}
      className={`rounded ${
        isOverCurrent && !isDragging && canDrop
          ? "bg-blue-100 border-blue-400 border"
          : isSelected && !isDragging
          ? "bg-blue-50 border-blue-200 border"
          : "border border-transparent"
      }`}
      onClick={(e) => {
        if (isSelected && onSelect) {
          onSelect(e.metaKey, node, false);
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <span className={`flex items-center text-sm space-x-0.5 ${className}`}>
        {
          <button
            title={numChildren === 0 ? "Empty" : "Expand"}
            className={!numChildren || numChildren < 1 ? "opacity-50" : ""}
            onClick={(e) => {
              if (onExpand) {
                onExpand(node, !isExpanded);
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <ArrowIcon isOpen={isExpanded || false} />
          </button>
        }
        {
          <VisibilityCheckbox
            onClick={() => {
              if (onChecked) {
                onChecked(node, !isChecked && !hasCheckedChildren, children);
              }
            }}
            disabled={isDisabled || numChildren === 0}
            id={data.id}
            visibility={isChecked ? true : hasCheckedChildren ? "mixed" : false}
          />
        }{" "}
        {isExpanded ? (
          <FolderOpenIcon
            onContextMenu={contextMenuHandler}
            onClick={updateSelectionOnClick}
            className="w-6 h-6 text-primary-500"
          />
        ) : (
          <FolderIcon
            onContextMenu={contextMenuHandler}
            onClick={updateSelectionOnClick}
            className="w-6 h-6 text-primary-500"
          />
        )}
        <span
          ref={isContextMenuTarget ? updateContextMenuTargetRef : undefined}
          className="py-1 px-1 cursor-pointer select-none truncate flex-1"
          onClick={updateSelectionOnClick}
          onContextMenu={contextMenuHandler}
        >
          {data.name}
        </span>
      </span>
      {children && children.length > 0 && isExpanded && (
        <ChildGroup items={children} />
      )}
    </div>
  );
}

export default FolderItem;
