import {
  MouseEventHandler,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDrag, useDrop } from "react-dnd";
import {
  CheckState,
  TreeItem,
  TreeItemHighlights,
  TreeNodeComponentProps,
} from "../../components/TreeView";
import CollectionIcon from "@heroicons/react/outline/CollectionIcon";
import ArrowIcon from "./ArrowIcon";
import { motion } from "framer-motion";
import { FolderIcon, FolderOpenIcon } from "@heroicons/react/outline";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/Tooltip";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { EyeClosedIcon } from "@radix-ui/react-icons";

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

export enum SortingState {
  NONE,
  OVER_EXISTING_POSITION,
  DIRECTLY_OVER_FOLDER,
  LEADING_EDGE,
  TRAILING_EDGE,
}

type TocItemStyle = {
  container: string;
  label: string;
};

const CLASSNAMES = {
  BASE: {
    container: "border border-transparent",
    label: "",
  },
  SELECTED: {
    container: "bg-blue-50 border-blue-200 border",
    label: "bg-blue-200",
  },
  DROP_TARGET: {
    container: "bg-blue-100 border-blue-400 border",
    label: "bg-blue-300",
  },
  CONTEXT_MENU_TARGET: {
    container:
      "bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-25 border",
    label: "bg-blue-100",
  },
};

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
  onDrop,
  sortable,
  index,
  nextSiblingId,
  previousSiblingId,
  onSortEnd,
  allowContextMenuDefault,
  onUnhide,
  isHidden,
  highlights,
}: TreeNodeComponentProps) {
  const isChecked = checked !== CheckState.UNCHECKED;
  const hasCheckedChildren = checked !== CheckState.UNCHECKED;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [{ isDragging }, drag, dragPreview] = useDrag(
    () => ({
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
    }),
    [onDragEnd]
  );

  const contextMenuHandler: MouseEventHandler<any> = useCallback(
    (e) => {
      if (onContextMenu) {
        if (onSelect && !isSelected) {
          onSelect(e.metaKey, node, !isSelected);
        }
        var rect = e.currentTarget.getBoundingClientRect();
        var offsetX = e.clientX - rect.left; //x position within the element.
        onContextMenu(node, e.currentTarget, offsetX, e);
        if (!allowContextMenuDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    [isSelected, node, onContextMenu, onSelect]
  );

  const [sortState, setSortState] = useState<SortingState>(SortingState.NONE);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const [{ canDrop, isOverCurrent }, drop] = useDrop(
    () => ({
      accept: node.dropAcceptsTypes || [],
      canDrop: (item: TreeItem, monitor) => {
        if (disableEditing) {
          return false;
        }
        if (sortable && item.id !== node.id) {
          return true;
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
      hover: (item, monitor) => {
        if (!sortable || !rootRef.current) {
          return;
        }
        const span = rootRef.current.querySelector(".label-container");
        const offset = monitor.getClientOffset();
        if (span && offset) {
          const state = getSortState(
            item,
            node,
            span.getBoundingClientRect(),
            offset.y,
            node.isLeaf,
            previousSiblingId,
            nextSiblingId
          );
          setSortState(state);
        }
      },
      drop: (item, monitor) => {
        if (monitor.didDrop()) {
          return;
        }
        if (onDrop) {
          onDrop(item, node);
        }
        if (onDropEnd) {
          onDropEnd(node);
        }
        if (!sortable || !onSortEnd || !rootRef.current) {
          return;
        }
        const span = rootRef.current.querySelector(".label-container");
        const offset = monitor.getClientOffset();
        if (offset && span) {
          const state = getSortState(
            item,
            node,
            span.getBoundingClientRect(),
            offset.y,
            node.isLeaf,
            previousSiblingId,
            nextSiblingId
          );
          onSortEnd(item, node, state);
        }
      },
    }),
    [onDrop, onDropEnd, onSortEnd, sortable, disableEditing]
  );

  const attachRef = useCallback(
    (el: any) => {
      drag(el);
      drop(el);
      rootRef.current = el;
    },
    [drag, drop]
  );

  const [labelRef, setLabelRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (labelRef && isContextMenuTarget) {
      updateContextMenuTargetRef(labelRef);
    }
  }, [labelRef, updateContextMenuTargetRef, isContextMenuTarget]);

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
        if (!isContextMenuTarget && !node.checkOffOnly) {
          onVisibilityClick();
        }
      }
    },
    [onSelect, node, isSelected, isContextMenuTarget, onVisibilityClick]
  );

  const sortPlaceholder =
    sortState === SortingState.NONE ||
    sortState === SortingState.DIRECTLY_OVER_FOLDER ||
    sortState === SortingState.OVER_EXISTING_POSITION ? null : (
      <div
        style={{
          marginLeft:
            node.isLeaf || node.hideChildren
              ? 0
              : (childGroupPadding || 35) - 18,
          ...(sortState === SortingState.LEADING_EDGE
            ? {
                top: -2,
              }
            : { bottom: -2 }),
        }}
        className={`w-full border-b-2 h-0 border-blue-600 absolute flex items-center`}
      >
        <span className={`text-blue-600 block relative -left-3 top-0`}>
          {
            // eslint-disable-next-line i18next/no-literal-string
            "▸"
          }
        </span>
      </div>
    );

  let classNames = CLASSNAMES.BASE;
  if (isContextMenuTarget && !onSelect) {
    classNames = CLASSNAMES.CONTEXT_MENU_TARGET;
  } else if (
    isOverCurrent &&
    !isDragging &&
    canDrop &&
    (!sortable || sortState === SortingState.DIRECTLY_OVER_FOLDER)
  ) {
    classNames = CLASSNAMES.DROP_TARGET;
  } else if (isSelected && !isDragging) {
    classNames = CLASSNAMES.SELECTED;
  }

  return (
    <>
      <div
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
                marginLeft: 0,
              }
            : {
                marginLeft: -17,
                opacity: 1,
              }
        }
        className={`${classNames.container} rounded relative`}
      >
        {sortable && canDrop && isOverCurrent && sortPlaceholder}

        <div
          className={`label-container flex items-center text-sm space-x-0.5  ${classNames.label}`}
          style={{
            paddingTop: 5,
            paddingBottom: 5,
            paddingLeft: node.isLeaf || node.hideChildren ? 3 : 0,
          }}
        >
          {!node.isLeaf && !node.hideChildren && (
            <button
              title={numChildren === 0 ? "Empty" : "Expand"}
              className={`pr-0.5 ${
                !numChildren || numChildren < 1 ? "opacity-50" : ""
              }`}
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
              <ContextMenu.Trigger asChild={true}>
                <FolderOpenIcon
                  fill="currentColor"
                  fillOpacity={0.2}
                  strokeWidth={1}
                  onContextMenu={contextMenuHandler}
                  onClick={updateSelectionOnClick}
                  className="relative -right-0.5 w-6 h-6 text-primary-700"
                />
              </ContextMenu.Trigger>
            ) : (
              <ContextMenu.Trigger asChild={true}>
                <FolderIcon
                  fill="currentColor"
                  fillOpacity={0.2}
                  strokeWidth={1}
                  onContextMenu={contextMenuHandler}
                  onClick={updateSelectionOnClick}
                  className="relative -right-0.5 w-6 h-6 text-primary-700"
                />
              </ContextMenu.Trigger>
            ))}
          {node.type === "Sketch" && !node.isLeaf && (
            <ContextMenu.Trigger asChild={true}>
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
            </ContextMenu.Trigger>
          )}
          <ContextMenu.Trigger asChild={true}>
            <label
              id={`${node.id}-label`}
              ref={isContextMenuTarget ? setLabelRef : undefined}
              className={`px-1 cursor-pointer select-none truncate ${
                error ? "text-red-600" : ""
              } ${isHidden ? "opacity-50" : ""}`}
              onClick={updateSelectionOnClick}
              onContextMenu={contextMenuHandler}
            >
              {highlights?.[node.id]?.title ? (
                <SearchResultHighlights data={highlights[node.id].title!} />
              ) : (
                node.title
              )}
            </label>
          </ContextMenu.Trigger>
          {isHidden && (
            <button
              onClick={() => {
                if (onUnhide) {
                  onUnhide(node.id);
                }
              }}
            >
              <EyeClosedIcon className="text-black opacity-50 hover:opacity-80" />
            </button>
          )}
        </div>
        {highlights?.[node.id]?.metadata &&
          !Boolean(highlights?.[node.id]?.title?.length) && (
            <>
              <div
                style={{ marginLeft: 1 }}
                className="text-xs text-gray-500 pl-6 truncate"
              >
                <SearchResultHighlights data={highlights[node.id].metadata!} />
              </div>
            </>
          )}
        {children &&
          children.length > 0 &&
          isExpanded &&
          !node.hideChildren && (
            <ul
              role="group"
              onClick={(e) => {
                if (clearSelection) {
                  clearSelection();
                }
              }}
              className={isDragging && sortable ? "bg-gray-50" : ""}
              style={{
                paddingLeft: childGroupPadding || 35,
              }}
            >
              {children.map((item, index) => (
                <TreeItemComponent
                  highlights={highlights}
                  index={index}
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
                  onDrop={onDrop}
                  onChecked={onChecked}
                  disableEditing={disableEditing || false}
                  hideCheckboxes={hideCheckboxes || false}
                  checked={item.checked}
                  highlighted={item.highlighted}
                  isLoading={item.loading}
                  error={item.error || null}
                  clearSelection={clearSelection}
                  sortable={sortable}
                  nextSiblingId={children[index + 1]?.node.id}
                  previousSiblingId={children[index - 1]?.node.id}
                  onSortEnd={onSortEnd}
                  allowContextMenuDefault={allowContextMenuDefault}
                  isHidden={item.hidden}
                  onUnhide={onUnhide}
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
    </>
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

function getSortState(
  dragItem: TreeItem,
  target: TreeItem,
  targetBoundingRect: DOMRect,
  yOffset: number,
  treatAsLeaf: boolean,
  previousSiblingId?: string,
  nextSiblingId?: string
) {
  // Don't replace items with themselves
  if (dragItem.id === target.id || target.parentId === dragItem.id) {
    return SortingState.OVER_EXISTING_POSITION;
  }
  // Get vertical middle
  const hoverMiddleY = (targetBoundingRect.bottom - targetBoundingRect.top) / 2;
  const height = targetBoundingRect.bottom - targetBoundingRect.top;
  // Get pixels to the top
  const hoverClientY = yOffset - targetBoundingRect.top;

  // For folders, return DIRECTLY_OVER_FOLDER if within the middle 25%.
  if (!treatAsLeaf) {
    if (
      hoverClientY >= hoverMiddleY - height / 4 &&
      hoverClientY <= hoverMiddleY + height / 4
    ) {
      return SortingState.DIRECTLY_OVER_FOLDER;
    }
  }

  // // Dragging towards top
  if (hoverClientY < hoverMiddleY) {
    if (dragItem.id === previousSiblingId) {
      // Don't show indicator if between self and previous sibling
      return SortingState.OVER_EXISTING_POSITION;
    } else {
      return SortingState.LEADING_EDGE;
    }
  }

  // Dragging towards bottom
  if (hoverClientY > hoverMiddleY) {
    if (dragItem.id === nextSiblingId) {
      // Don't show indicator if between self and next sibling
      return SortingState.OVER_EXISTING_POSITION;
    } else {
      return SortingState.TRAILING_EDGE;
    }
  }
  return SortingState.NONE;
}

function SearchResultHighlights({ data }: { data: string }) {
  const parts = data.split(/<<<|>>>/);
  return (
    <div>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return <span className="bg-yellow-200 px-0.5 -mx-0.5">{part}</span>;
        } else {
          return <span>{part}</span>;
        }
      })}
    </div>
  );
}
