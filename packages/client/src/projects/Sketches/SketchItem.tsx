import { MouseEventHandler, useCallback } from "react";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import { useDrag } from "react-dnd";
import { TreeItemI, TreeNodeProps } from "../../components/TreeView";

export interface SketchNodeDataProps {
  id: number;
  name: string;
  isCollection: boolean;
  folderId?: number | null;
  collectionId?: number | null;
  type: "Sketch";
}

export function isSketchNode(
  node: TreeItemI<any>
): node is TreeItemI<SketchNodeDataProps> {
  return node.data.type === "Sketch";
}

export default function SketchItem({
  level,
  isSelected,
  onSelect,
  onContextMenu,
  node,
  isContextMenuTarget,
  updateContextMenuTargetRef,
  onDragEnd,
}: TreeNodeProps<SketchNodeDataProps>) {
  const isDisabled = false;
  const data = node.data;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    type: "Sketch",
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    item: {
      id: data.id,
      name: data.name,
      type: data.type,
      folderId: data.folderId,
      collectionId: data.collectionId,
    } as SketchNodeDataProps,
    end(draggedItem, monitor) {
      if (onDragEnd) {
        onDragEnd([draggedItem]);
      }
    },
  }));

  const attachRef = useCallback(
    (el: any) => {
      drag(el);
    },
    [drag]
  );

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
      onClick={(e) => {
        if (isSelected && onSelect) {
          onSelect(e.metaKey, node, false);
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={{
        // marginLeft: 35 * (level - 1) - 1,
        opacity: isDisabled ? 0.5 : 1,
        paddingLeft: 3,
      }}
      className={`border rounded border-transparent ${
        isSelected ? "bg-blue-200" : ""
      }`}
    >
      <span
        className="flex items-center text-sm space-x-0.5"
        style={{ paddingTop: 2, paddingBottom: 2 }}
      >
        <VisibilityCheckbox
          disabled={Boolean(isDisabled)}
          id={data.id}
          visibility={false}
        />
        <span
          ref={isContextMenuTarget ? updateContextMenuTargetRef : undefined}
          className="px-1 py-0.5 cursor-pointer select-none"
          onClick={updateSelectionOnClick}
          onContextMenu={contextMenuHandler}
        >
          {data.name}
        </span>
      </span>
    </div>
  );
}
