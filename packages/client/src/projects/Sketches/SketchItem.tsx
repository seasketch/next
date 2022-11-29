import { MouseEvent, useCallback } from "react";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import { useDrag } from "react-dnd";

export interface SketchTocItemProps {
  id: number;
  name: string;
  nodeProps: any;
  handleSelect: (e: MouseEvent) => void;
  level: number;
  isDisabled?: boolean;
  isSelected?: boolean;
  onContextMenu: (e: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => void;
  parentFolderId?: number | null;
  parentCollectionId?: number | null;
  onDragEnd?: (items: { type: "sketch" | "folder"; id: number }[]) => void;
  onDropEnd?: (items: { type: "sketch" | "folder"; id: number }[]) => void;
}

export default function SketchItem({
  nodeProps,
  level,
  isDisabled,
  isSelected,
  onContextMenu,
  id,
  name,
  parentFolderId,
  parentCollectionId,
  onDragEnd,
}: SketchTocItemProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    type: "Sketch",
    // The collect function utilizes a "monitor" instance (see the Overview for what this is)
    // to pull important pieces of state from the DnD system.
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    item: {
      id,
      name,
      typeName: "Sketch",
      folderId: parentFolderId,
      collectionId: parentCollectionId,
    },
    end(draggedItem, monitor) {
      if (onDragEnd) {
        // TODO: add mult-select support
        onDragEnd([{ type: "sketch", id: draggedItem.id }]);
      }
    },
  }));

  const attachRef = useCallback(
    (el: any) => {
      drag(el);
      if (nodeProps.ref) {
        nodeProps.ref(el);
      }
    },
    [drag, nodeProps]
  );

  return (
    <div
      // onFocus={(e) => {
      //   setFocused({
      //     type: data.__typename === "SketchFolder" ? "folder" : "sketch",
      //     id: data.id,
      //   });
      // }}
      // onBlur={() => setFocused(null)}
      {...nodeProps}
      onClick={nodeProps.onClick}
      style={{
        marginLeft: 40 * (level - 1) - 3,
        opacity: isDisabled ? 0.5 : 1,
        paddingLeft: 3,
      }}
      className={`py-0.5 ${isSelected ? "bg-blue-200" : ""}`}
      onContextMenu={onContextMenu}
      ref={attachRef}
    >
      <span className="flex items-center text-sm space-x-0.5">
        <VisibilityCheckbox
          disabled={Boolean(isDisabled)}
          id={id}
          visibility={false}
        />
        <span className="px-1 cursor-default select-none">{name}</span>
      </span>
    </div>
  );
}
