import { MouseEvent, useCallback } from "react";
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

// export interface SketchTocItemProps {
//   id: number;
//   name: string;
//   nodeProps: any;
//   handleSelect: (e: MouseEvent) => void;
//   level: number;
//   isDisabled?: boolean;
//   isSelected?: boolean;
//   onContextMenu: (e: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => void;
//   parentFolderId?: number | null;
//   parentCollectionId?: number | null;
//   onDragEnd?: (items: { type: "sketch" | "folder"; id: number }[]) => void;
//   onDropEnd?: (items: { type: "sketch" | "folder"; id: number }[]) => void;
//   isExpanded?: boolean;
//   handleExpand?: (e: MouseEvent<any, globalThis.MouseEvent>) => void;
//   numChildren?: number;
// }

export default function SketchItem({
  onSelect,
  level,
  isSelected,
  onContextMenu,
  node,
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
    },
    end(draggedItem, monitor) {
      // if (onDragEnd) {
      //   // TODO: add mult-select support
      //   onDragEnd([{ type: "sketch", id: draggedItem.id }]);
      // }
    },
  }));

  const attachRef = useCallback(
    (el: any) => {
      drag(el);
    },
    [drag]
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
      onClick={(e) => {
        if (onSelect) {
          onSelect(e.metaKey, node, !isSelected);
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={{
        marginLeft: 35 * (level - 1) - 1,
        opacity: isDisabled ? 0.5 : 1,
        paddingLeft: 3,
      }}
      className={`my-0.5 border rounded border-transparent ${
        isSelected ? "bg-blue-200" : ""
      }`}
      // TODO: add back in
      // onContextMenu={(e) => {
      //   if (onContextMenu) {
      //     onContextMenu(e, node, isSelected);
      //   }
      // }}
      ref={attachRef}
    >
      <span
        className="flex items-center text-sm space-x-0.5"
        style={{ paddingTop: 3, paddingBottom: 3 }}
      >
        <VisibilityCheckbox
          disabled={Boolean(isDisabled)}
          id={data.id}
          visibility={false}
        />
        <span className="px-1 cursor-default select-none">{data.name}</span>
      </span>
    </div>
  );
}
