import { MouseEventHandler, useCallback } from "react";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import { useDrag, useDrop } from "react-dnd";
import { TreeItemI, TreeNodeProps } from "../../components/TreeView";
import CollectionIcon from "@heroicons/react/solid/CollectionIcon";
import ArrowIcon from "./ArrowIcon";
import useUpdateSketchTableOfContentsDraggable from "./useUpdateSketchTableOfContentsItem";
import { motion } from "framer-motion";
import { FolderIcon, FolderOpenIcon } from "@heroicons/react/solid";

export interface TreeNodeDataProps {
  id: number;
  name: string;
  isCollection?: boolean;
  folderId?: number | null;
  collectionId?: number | null;
  type: "Sketch" | "SketchFolder";
  timestamp?: string;
}

export type DragItemProps = {
  nodeId: string;
  parents: string[];
} & TreeNodeDataProps;

export function isSketchNode(
  node: TreeItemI<any>
): node is TreeItemI<TreeNodeDataProps> {
  return node.data.type === "Sketch";
}

export default function SketchItem({
  isSelected,
  onSelect,
  isExpanded,
  onExpand,
  onContextMenu,
  node,
  isContextMenuTarget,
  updateContextMenuTargetRef,
  onDragEnd,
  isChecked,
  onChecked,
  hasCheckedChildren,
  ChildGroup,
  children,
  numChildren,
  onDropEnd,
  disableEditing,
  hideCheckboxes,
  highlighted,
}: TreeNodeProps<TreeNodeDataProps>) {
  const data = node.data;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    canDrag: !disableEditing,
    type: data.type,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    item: {
      id: data.id,
      name: data.name,
      type: data.type,
      folderId: data.folderId,
      collectionId: data.collectionId,
    } as TreeNodeDataProps,
    end(draggedItem, monitor) {
      if (onDragEnd) {
        onDragEnd([draggedItem]);
      }
    },
  }));

  const { dropFolder, dropSketch } = useUpdateSketchTableOfContentsDraggable();

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

  const [{ canDrop, isOverCurrent }, drop] = useDrop(() => ({
    accept: ["SketchFolder", "Sketch"],
    canDrop: (item: DragItemProps, monitor) => {
      if (disableEditing) {
        return false;
      }
      if (
        (data.type === "Sketch" && !data.isCollection) ||
        item.id === data.id ||
        node.parents.indexOf(item.nodeId) !== -1
      ) {
        return false;
      }
      return true;
    },
    // Props to collect
    collect: (monitor) => ({
      isOverCurrent: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      isOver: monitor.isOver(),
    }),
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      (item.type === "SketchFolder" ? dropFolder : dropSketch)(
        item.id,
        data.type === "Sketch"
          ? {
              collectionId: data.id,
              folderId: null,
            }
          : {
              collectionId: null,
              folderId: data.id,
            }
      );
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

  return (
    <div
      data-node-id={node.id}
      ref={attachRef}
      onClick={(e) => {
        if (isSelected && onSelect) {
          onSelect(e.metaKey, node, false);
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={
        data.isCollection || data.type === "SketchFolder"
          ? {
              marginLeft: -15,
              opacity: 1,
            }
          : {
              opacity: 1,
              marginLeft: 3,
            }
      }
      className={`rounded relative ${
        isOverCurrent && !isDragging && canDrop
          ? "bg-blue-100 border-blue-400 border"
          : isSelected && !isDragging
          ? "bg-blue-50 border-blue-200 border"
          : "border border-transparent"
      }`}
    >
      <span
        className={`flex items-center text-sm space-x-0.5 ${className}`}
        style={{
          paddingTop: 2,
          paddingBottom: 2,
          paddingLeft: data.isCollection ? 0 : 3,
        }}
      >
        {(data.isCollection || data.type === "SketchFolder") && (
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
        )}
        {!hideCheckboxes && (
          <VisibilityCheckbox
            onClick={() => {
              if (onChecked) {
                onChecked(node, !isChecked && !hasCheckedChildren, children);
              }
            }}
            disabled={false}
            id={data.id}
            visibility={isChecked ? true : hasCheckedChildren ? "mixed" : false}
          />
        )}
        {data.type === "SketchFolder" &&
          (isExpanded ? (
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
          ))}
        {data.type === "Sketch" && data.isCollection && (
          <CollectionIcon
            onContextMenu={contextMenuHandler}
            onClick={updateSelectionOnClick}
            style={{ height: 22 }}
            className="w-6 text-primary-500"
          />
        )}
        <span
          ref={isContextMenuTarget ? updateContextMenuTargetRef : undefined}
          className="px-1 py-0.5 cursor-pointer select-none"
          onClick={updateSelectionOnClick}
          onContextMenu={contextMenuHandler}
        >
          {data.name}
        </span>
      </span>
      {children && children.length > 0 && isExpanded && (
        <ChildGroup items={children} />
      )}
      <motion.div
        variants={{
          highlighted: {
            opacity: 1,
            transition: {
              duration: 0,
            },
          },
          normal: {
            opacity: 0,
            transition: {
              duration: 0.5,
            },
          },
        }}
        animate={highlighted ? "highlighted" : "normal"}
        className="absolute left-0 top-0 w-full h-full rounded bg-yellow-300 bg-opacity-50 pointer-events-none opacity-0"
      ></motion.div>
    </div>
  );
}
