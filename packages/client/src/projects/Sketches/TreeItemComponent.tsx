import {
  MouseEventHandler,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useDrag, useDrop } from "react-dnd";
import {
  CheckState,
  TreeItemI,
  TreeNodeProps,
} from "../../components/TreeView";
import CollectionIcon from "@heroicons/react/outline/CollectionIcon";
import ArrowIcon from "./ArrowIcon";
import useUpdateSketchTableOfContentsDraggable from "./useUpdateSketchTableOfContentsItem";
import { motion } from "framer-motion";
import { FolderIcon, FolderOpenIcon } from "@heroicons/react/outline";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/Tooltip";

export interface TreeNodeDataProps {
  id: number;
  name: string;
  isCollection?: boolean;
  folderId?: number | null;
  collectionId?: number | null;
  type: "Sketch" | "SketchFolder" | "TableOfContentsItem";
  timestamp?: string;
  dropAcceptsTypes?: string[];
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

export default function TreeItemComponent({
  isSelected,
  onSelect,
  isExpanded,
  onExpand,
  onContextMenu,
  node,
  isContextMenuTarget,
  updateContextMenuTargetRef,
  onDragEnd,
  checked,
  onChecked,
  ChildGroup,
  children,
  numChildren,
  onDropEnd,
  disableEditing,
  hideCheckboxes,
  highlighted,
  isLoading,
  parentIsRadioFolder,
  error,
}: TreeNodeProps<TreeNodeDataProps>) {
  const data = node.data;
  const isChecked = checked !== CheckState.UNCHECKED;
  const hasCheckedChildren = checked !== CheckState.UNCHECKED;

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
    accept: data.dropAcceptsTypes || [],
    canDrop: (item: DragItemProps, monitor) => {
      if (disableEditing) {
        return false;
      }
      if (
        node.isLeaf ||
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

  const [ref, setRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (ref && isContextMenuTarget) {
      updateContextMenuTargetRef(ref);
    }
  }, [ref, updateContextMenuTargetRef, isContextMenuTarget]);

  const onVisibilityClick = useCallback(() => {
    if (onChecked) {
      onChecked(node, !isChecked && !hasCheckedChildren, children);
    }
  }, [onChecked, node, isChecked, hasCheckedChildren, children]);

  const updateSelectionOnClick: MouseEventHandler<any> = useCallback(
    (e) => {
      if (onSelect) {
        onSelect(e.metaKey, node, !isSelected);
        e.preventDefault();
        e.stopPropagation();
      } else {
        if (!isContextMenuTarget) {
          onVisibilityClick();
        }
      }
    },
    [onSelect, node, isSelected, isContextMenuTarget, onVisibilityClick]
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
      style={
        node.isLeaf || node.hideChildren
          ? {
              opacity: 1,
              marginLeft: 3,
            }
          : {
              marginLeft: -15,
              opacity: 1,
            }
      }
      className={`${
        isContextMenuTarget && !onSelect ? "bg-blue-500 bg-opacity-10" : ""
      } my-1 rounded relative ${
        isOverCurrent && !isDragging && canDrop
          ? "bg-blue-100 border-blue-400 border"
          : isSelected && !isDragging
          ? "bg-blue-50 border-blue-200 border"
          : "border border-transparent"
      }`}
    >
      <span
        className={`flex items-start text-sm space-x-0.5 ${className}`}
        style={{
          paddingTop: 2,
          paddingBottom: 2,
          paddingLeft: data.isCollection ? 0 : 3,
        }}
      >
        {!node.isLeaf && !node.hideChildren && (
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
          <WrapWithErrorTooltip error={error}>
            <VisibilityCheckboxAnimated
              className="flex-none"
              loading={isLoading}
              onClick={onVisibilityClick}
              disabled={Boolean(node.checkOffOnly && !hasCheckedChildren)}
              id={data.id}
              error={error || undefined}
              visibility={
                checked === CheckState.CHECKED
                  ? true
                  : checked === CheckState.PARTIAL
                  ? "mixed"
                  : false
              }
              ariaLabelledBy={`${node.id}-label`}
              radio={parentIsRadioFolder}
            />
          </WrapWithErrorTooltip>
        )}
        {!node.hideChildren &&
          !node.isLeaf &&
          data.type !== "Sketch" &&
          (isExpanded ? (
            <FolderOpenIcon
              fill="currentColor"
              fillOpacity={0.2}
              strokeWidth={1}
              onContextMenu={contextMenuHandler}
              onClick={updateSelectionOnClick}
              className="-mt-1 relative -right-0.5 w-6 h-6 text-primary-700"
            />
          ) : (
            <FolderIcon
              fill="currentColor"
              fillOpacity={0.2}
              strokeWidth={1}
              onContextMenu={contextMenuHandler}
              onClick={updateSelectionOnClick}
              className="-mt-1 relative -right-0.5 w-6 h-6 text-primary-700"
            />
          ))}
        {data.type === "Sketch" && data.isCollection && (
          <CollectionIcon
            stroke="currentColor"
            fill="currentColor"
            fillOpacity={0.2}
            strokeWidth={1}
            onContextMenu={contextMenuHandler}
            onClick={updateSelectionOnClick}
            style={{ height: 22 }}
            className="-mt-1 w-6 text-primary-700"
          />
        )}
        <label
          id={`${node.id}-label`}
          ref={isContextMenuTarget ? setRef : undefined}
          className={`px-1 cursor-pointer select-none -mt-0.5 ${
            error ? "text-red-600" : ""
          }`}
          onClick={updateSelectionOnClick}
          onContextMenu={contextMenuHandler}
        >
          {data.name}
        </label>
      </span>
      {children && children.length > 0 && isExpanded && !node.hideChildren && (
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

function WrapWithErrorTooltip({
  error,
  children,
}: {
  error: string | null | undefined;
  children?: ReactNode;
}) {
  if (error) {
    return (
      <Tooltip>
        <TooltipTrigger>{children}</TooltipTrigger>
        <TooltipContent className="Tooltip">{error}</TooltipContent>
      </Tooltip>
    );
  } else {
    return <>{children}</>;
  }
}
