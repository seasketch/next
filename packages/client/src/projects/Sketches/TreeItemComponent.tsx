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
  parseTreeItemId,
  TreeItem,
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
  dropAcceptsTypes?: string[];
}

export type DragItemProps = {
  nodeId: string;
  parents: string[];
} & TreeNodeDataProps;

export function isSketchNode(node: TreeItem): node is TreeItem {
  return node.type === "Sketch";
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
  children,
  numChildren,
  onDropEnd,
  disableEditing,
  hideCheckboxes,
  highlighted,
  isLoading,
  parentIsRadioFolder,
  error,
  clearSelection,
  childGroupPadding,
  parents,
}: TreeNodeProps) {
  const isChecked = checked !== CheckState.UNCHECKED;
  const hasCheckedChildren = checked !== CheckState.UNCHECKED;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    canDrag: !disableEditing,
    type: node.type,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    item: node,
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
    accept: node.dropAcceptsTypes || [],
    canDrop: (item: TreeItem, monitor) => {
      if (disableEditing) {
        return false;
      }
      if (
        node.isLeaf ||
        item.id === node.id ||
        parents.indexOf(item.id) !== -1
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
      const { id: itemId } = parseTreeItemId(item.id);
      const { id: nodeId } = parseTreeItemId(node.id);
      (item.type === "SketchFolder" ? dropFolder : dropSketch)(
        itemId,
        node.type === "Sketch"
          ? {
              collectionId: nodeId,
              folderId: null,
            }
          : {
              collectionId: null,
              folderId: nodeId,
            }
      );
      if (onDropEnd) {
        onDropEnd(node);
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
          paddingLeft: !node.isLeaf ? 0 : 3,
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
              id={node.id}
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
          node.type !== "Sketch" &&
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
        {node.type === "Sketch" && !node.isLeaf && (
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
          {node.title}
        </label>
      </span>
      {children && children.length > 0 && isExpanded && !node.hideChildren && (
        <ul
          role="group"
          onClick={(e) => {
            if (clearSelection) {
              clearSelection();
            }
          }}
          style={{
            paddingLeft: childGroupPadding || 35,
          }}
        >
          {children.map((item) => (
            <TreeItemComponent
              key={item.node.id}
              {...item}
              numChildren={item.children.length}
              onExpand={onExpand}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              level={1}
              children={item.children}
              isContextMenuTarget={item.isContextMenuTarget}
              updateContextMenuTargetRef={updateContextMenuTargetRef}
              onDragEnd={onDragEnd}
              onDropEnd={onDropEnd}
              onChecked={onChecked}
              disableEditing={disableEditing || false}
              hideCheckboxes={hideCheckboxes || false}
              checked={item.checked}
              highlighted={item.highlighted}
              isLoading={item.loading}
              error={item.error || null}
              clearSelection={clearSelection}
            />
          ))}
        </ul>
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
