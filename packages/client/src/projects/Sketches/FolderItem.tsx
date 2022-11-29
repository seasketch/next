import { FolderIcon, FolderOpenIcon } from "@heroicons/react/solid";
import { MouseEvent, useCallback } from "react";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import ArrowIcon from "./ArrowIcon";
import { useDrag, useDrop } from "react-dnd";
import useUpdateSketchTableOfContentsDraggable from "./useUpdateSketchTableOfContentsItem";
import { SketchTocItemProps } from "./SketchItem";

export default function FolderItem({
  nodeProps,
  handleSelect,
  level,
  isDisabled,
  isSelected,
  onContextMenu,
  isExpanded,
  handleExpand,
  numChildren,
  id,
  name,
  parentFolderId,
  parentCollectionId,
  onDragEnd,
  onDropEnd,
}: SketchTocItemProps & {
  isExpanded?: boolean;
  handleExpand: (e: MouseEvent<any, globalThis.MouseEvent>) => void;
  numChildren: number;
}) {
  const { dropFolder, dropSketch } = useUpdateSketchTableOfContentsDraggable();
  const [{ isDragging }, drag] = useDrag(() => ({
    // "type" is required. It is used by the "accept" specification of drop targets.
    type: "SketchFolder",
    // The collect function utilizes a "monitor" instance (see the Overview for what this is)
    // to pull important pieces of state from the DnD system.
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    item: {
      id,
      name,
      typeName: "SketchFolder",
      folderId: parentFolderId,
    },
    end(draggedItem, monitor) {
      if (onDragEnd) {
        // TODO: add mult-select support
        onDragEnd([{ type: "folder", id: draggedItem.id }]);
      }
    },
  }));

  const [{ canDrop, isOver }, drop] = useDrop(() => ({
    // The type (or types) to accept - strings or symbols
    accept: ["SketchFolder", "Sketch"],
    canDrop: (item: {
      id: number;
      folderId?: number;
      collectionId?: number;
      typeName: string;
    }) => {
      if (item.id === id || parentFolderId === item.id) {
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
      (item.typeName === "SketchFolder" ? dropFolder : dropSketch)(item.id, {
        collectionId: null,
        folderId: id,
      });
      if (onDropEnd) {
        onDropEnd([{ type: "folder", id }]);
      }
    },
  }));

  const attachRef = useCallback(
    (el: any) => {
      drag(el);
      drop(el);
      if (nodeProps.ref) {
        nodeProps.ref(el);
      }
    },
    [drag, drop, nodeProps]
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
      {...nodeProps}
      ref={attachRef}
      onClick={handleSelect}
      style={{
        marginLeft: 40 * (level - 1) - 18,
        opacity: isDisabled ? 0.5 : 1,
        paddingLeft: 0,
      }}
      className={`py-0.5 ${className}`}
      onContextMenu={onContextMenu}
    >
      <span className="flex items-center text-sm space-x-0.5">
        {
          <button
            title={numChildren === 0 ? "Empty" : ""}
            className={numChildren < 1 ? "opacity-25 cursor-not-allowed" : ""}
            onClick={(e) => {
              handleExpand(e);
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <ArrowIcon isOpen={isExpanded || false} />
          </button>
        }
        {
          <VisibilityCheckbox
            disabled={isDisabled || numChildren === 0}
            id={id}
            visibility={false}
          />
        }{" "}
        {isExpanded ? (
          <FolderOpenIcon className="w-6 h-6 text-primary-500" />
        ) : (
          <FolderIcon className="w-6 h-6 text-primary-500" />
        )}
        <span className="px-1 cursor-default select-none">{name}</span>
      </span>
    </div>
  );
}
