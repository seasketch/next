import { FolderIcon, FolderOpenIcon } from "@heroicons/react/solid";
import { useCallback, useState } from "react";
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

function FolderItem({
  onSelect,
  level,
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
      id: data.id,
      name: data.name,
      type: "SketchFolder",
      folderId: data.folderId,
      collectionId: data.collectionId,
    },
    end(draggedItem, monitor) {
      // if (onDragEnd) {
      //   onDragEnd([{ type: "folder", id: draggedItem.originalId }]);
      // }
    },
  }));

  const [{ canDrop, isOver }, drop] = useDrop(() => ({
    accept: ["SketchFolder", "Sketch"],
    canDrop: (item: FolderNodeDataProps) => {
      if (item.id === data.id || data.folderId === item.folderId) {
        return false;
      }
      return true;
    },
    // Props to collect
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
    drop: (item) => {
      (item.type === "SketchFolder" ? dropFolder : dropSketch)(item.id, {
        collectionId: null,
        folderId: data.id,
      });
      // if (onDropEnd) {
      //   onDropEnd([{ type: "folder", id: data.originalId }]);
      // }
    },
  }));

  const attachRef = useCallback(
    (el: any) => {
      drag(el);
      drop(el);
      // if (updateContextMenuTargetRef && isContextMenuTarget) {
      //   updateContextMenuTargetRef(el);
      // }
    },
    [drag, drop, isContextMenuTarget, updateContextMenuTargetRef]
  );

  let className = "border border-transparent";
  if (isSelected) {
    className = "bg-blue-200 border border-transparent";
  }
  if (isDragging) {
    className = "bg-gray-200 border border-transparent";
  }
  if (isOver && canDrop) {
    className = "border-blue-200 rounded-md border bg-blue-100";
  }

  return (
    <div
      ref={attachRef}
      style={{
        marginLeft: 35 * (level - 1) - 18,
        opacity: isDisabled ? 0.5 : 1,
        paddingLeft: 0,
      }}
      className={`my-0.5 rounded ${
        isSelected
          ? "bg-blue-50 border-blue-200 border"
          : "border border-transparent"
      } ${isContextMenuTarget ? "italic" : ""}`}
    >
      <span
        ref={isContextMenuTarget ? updateContextMenuTargetRef : undefined}
        className={`flex items-center text-sm space-x-0.5 ${className}`}
        onContextMenu={(e) => {
          if (onContextMenu) {
            if (onSelect) {
              onSelect(e.metaKey, node, !isSelected);
            }
            var rect = e.currentTarget.getBoundingClientRect();
            var offsetX = e.clientX - rect.left; //x position within the element.
            onContextMenu(node, e.currentTarget, offsetX);
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
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
            disabled={isDisabled || numChildren === 0}
            id={data.id}
            visibility={false}
          />
        }{" "}
        {isExpanded ? (
          <FolderOpenIcon className="w-6 h-6 text-primary-500" />
        ) : (
          <FolderIcon className="w-6 h-6 text-primary-500" />
        )}
        <span
          className="px-1 cursor-pointer select-none"
          onClick={(e) => {
            if (onSelect) {
              onSelect(e.metaKey, node, !isSelected);
            }
            e.preventDefault();
            e.stopPropagation();
          }}
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
