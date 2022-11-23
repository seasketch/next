import {
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
} from "../../generated/graphql";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import { useTranslation } from "react-i18next";
import { FolderIcon, FolderOpenIcon } from "@heroicons/react/solid";
import {
  forwardRef,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import TreeView, { INode } from "react-accessible-treeview";
import ArrowIcon from "./ArrowIcon";
import Skeleton from "../../components/Skeleton";
import { SketchAction } from "./useSketchActions";
import ContextMenuDropdown, {
  DropdownDivider,
} from "../../components/ContextMenuDropdown";
import { DropdownOption } from "../../components/DropdownButton";

export default forwardRef<
  HTMLDivElement,
  {
    loading?: boolean;
    sketches: SketchTocDetailsFragment[];
    folders: SketchFolderDetailsFragment[];
    selectedSketchIds: number[];
    selectedFolderIds: number[];
    onSelectionChange: (
      item: SketchFolderDetailsFragment | SketchTocDetailsFragment,
      isSelected: boolean
    ) => void;
    reservedKeyCodes?: string[];
    onReservedKeyDown?: (
      keycode: string,
      focus?: null | { type: "folder" | "sketch"; id: number }
    ) => void;
    actions?: { create: SketchAction[]; edit: SketchAction[] };
    onActionSelected?: (action: SketchAction) => void;
  }
>(
  (
    {
      sketches,
      folders,
      selectedSketchIds,
      selectedFolderIds,
      onSelectionChange,
      loading,
      reservedKeyCodes,
      onReservedKeyDown,
      actions,
      onActionSelected,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [expandedIds, setExpandedIds] = useState<number[]>([]);
    const treeView = useRef<HTMLUListElement>(null);
    const [focused, setFocused] =
      useState<null | { type: "sketch" | "folder"; id: number }>(null);
    const [contextMenuTarget, setContextMenuTarget] =
      useState<{ target: HTMLDivElement; offsetX?: number } | null>(null);

    useEffect(() => {
      const handler = () => setContextMenuTarget(null);
      if (contextMenuTarget) {
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
      }
    }, [contextMenuTarget]);

    const treeData = useMemo(() => {
      const items: (SketchFolderDetailsFragment | SketchTocDetailsFragment)[] =
        [
          {
            name: "ROOT -- should not be displayed",
            id: 0,
          },
          ...[...sketches, ...folders].sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
        ];
      const idx: { [id: number]: number } = {};
      items.forEach(({ id }, index) => {
        idx[id] = index;
      });

      let nodes: INode[] = [
        {
          id: 0,
          name: "ROOT -- should not be displayed",
          children: [],
          parent: null,
        },
      ];

      const children: { [id: number]: number[] } = {};
      const orphans: number[] = [];

      items.forEach((item, id) => {
        if (id !== 0) {
          const parentId = item.collectionId || item.folderId;
          nodes.push({
            id,
            name: item.name || "",
            parent: parentId ? idx[parentId] : 0,
            children: [],
          });
          if (parentId) {
            const parentIndex = idx[parentId];
            if (!(parentIndex in children)) {
              children[parentIndex] = [];
            }
            children[parentIndex].push(id);
          } else {
            orphans.push(id);
          }
        }
      });
      for (const node of nodes) {
        node.children = children[node.id] || [];
      }
      nodes[0].children = orphans;
      return {
        items,
        nodes,
      };
    }, [sketches, folders]);

    const selectedIds: number[] = useMemo(() => {
      const selectedNodeIds: number[] = [];
      for (const id of selectedFolderIds) {
        const idx = treeData.items.findIndex((f) => f.id === id);
        if (idx > 0) {
          selectedNodeIds.push(idx);
        }
      }
      for (const id of selectedSketchIds) {
        const idx = treeData.items.findIndex((f) => f.id === id);
        if (idx > 0) {
          selectedNodeIds.push(idx);
        }
      }
      return selectedNodeIds;
    }, [selectedSketchIds, selectedFolderIds, treeData.items]);

    const contextMenuOptions = useMemo(() => {
      const options: (DropdownOption | ReactNode)[] = [];
      if (actions && onActionSelected) {
        for (const action of actions.edit) {
          const { label, disabled, disabledForContextAction, keycode } = action;
          if (!disabledForContextAction) {
            options.push({
              label,
              disabled,
              onClick: () => onActionSelected(action),
            });
          }
        }
        const createActions = actions.create.filter(
          (a) => !a.disabledForContextAction
        );
        if (createActions.length) {
          options.push(<DropdownDivider label={t("add new")} />);
          for (const action of createActions) {
            const { label, disabled, disabledForContextAction, keycode } =
              action;
            if (!disabledForContextAction) {
              options.push({
                label,
                disabled,
                onClick: () => onActionSelected(action),
              });
            }
          }
        }
      }
      return options;
    }, [actions]);

    useEffect(() => {
      if (treeView.current) {
        treeView.current.onkeydown = (event) => {
          if (event.key === " ") {
            event.stopPropagation();
            // TODO: toggle visibility
            return;
          }
          if (
            reservedKeyCodes &&
            onReservedKeyDown &&
            reservedKeyCodes.indexOf(event.key) !== -1
          ) {
            event.stopPropagation();
            const view = treeView.current;
            setTimeout(() => {
              view?.blur();
            }, 100);
            onReservedKeyDown(event.key, focused);
            return;
          }
          if (!event.metaKey && /^\w$/.test(event.key)) {
            event.stopPropagation();
          }
        };
      }
    }, [treeView, reservedKeyCodes, onReservedKeyDown, focused]);

    if (loading) {
      return (
        <div className="pt-2 space-y-2" ref={ref}>
          <Skeleton className="w-1/2 h-5" />
          <Skeleton className="w-2/3 h-5" />
          <Skeleton className="w-1/2 h-5" />
          <Skeleton className="w-2/3 h-5" />
          <Skeleton className="w-1/2 h-5" />
          <Skeleton className="w-2/3 h-5" />
          <Skeleton className="w-1/2 h-5" />
          <Skeleton className="w-2/3 h-5" />
        </div>
      );
    }

    return (
      <div className="pt-2 pl-5" ref={ref}>
        {contextMenuTarget &&
          onActionSelected &&
          actions &&
          actions.edit.length > 0 && (
            <ContextMenuDropdown
              options={contextMenuOptions}
              target={contextMenuTarget.target}
              offsetX={contextMenuTarget.offsetX}
            />
          )}
        <TreeView
          ref={treeView}
          data={treeData.nodes}
          selectedIds={selectedIds}
          // multiSelect
          togglableSelect={true}
          expandedIds={expandedIds}
          onExpand={(props) => {}}
          onSelect={(props) => {
            const { element, isSelected } = props;
            const data = treeData.items[element.id];
            onSelectionChange(data, isSelected);
          }}
          clickAction="EXCLUSIVE_SELECT"
          aria-label={t("Your sketches")}
          nodeRenderer={({
            element,
            isBranch,
            isExpanded,
            isDisabled,
            getNodeProps,
            level,
            handleExpand,
            dispatch,
            isSelected,
            handleSelect,
          }) => {
            const data = treeData.items[element.id];
            const isExpandable = data.__typename === "SketchFolder";
            const nodeProps = getNodeProps();
            return (
              <div
                onFocus={(e) => {
                  setFocused({
                    type:
                      data.__typename === "SketchFolder" ? "folder" : "sketch",
                    id: data.id,
                  });
                }}
                onBlur={() => setFocused(null)}
                {...nodeProps}
                onClick={(e) => {
                  if (!isExpandable) {
                    nodeProps.onClick(e);
                  } else {
                    handleSelect(e);
                  }
                }}
                style={{
                  marginLeft: 40 * (level - 1) - (isExpandable ? 18 : 3),
                  opacity: isDisabled ? 0.5 : 1,
                  paddingLeft: isExpandable ? 0 : 3,
                }}
                className={`py-0.5 ${isSelected ? "bg-blue-200" : ""}`}
                onContextMenu={(e) => {
                  var rect = e.currentTarget.getBoundingClientRect();
                  var x = e.clientX - rect.left; //x position within the element.
                  if (!isSelected) {
                    handleSelect(e);
                  }

                  const target = e.currentTarget;
                  setContextMenuTarget({
                    target: target as HTMLDivElement,
                    offsetX: x,
                  });
                  e.preventDefault();
                  // setContextMenuTarget()
                }}
              >
                <span className="flex items-center text-sm space-x-0.5">
                  {isExpandable && (
                    <button
                      title={element.children.length === 0 ? "Empty" : ""}
                      className={
                        isExpandable && element.children.length < 1
                          ? "opacity-25 cursor-not-allowed"
                          : ""
                      }
                      onClick={(e) => {
                        handleExpand(e);
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <ArrowIcon isOpen={isExpanded} />
                    </button>
                  )}
                  {data && (
                    <VisibilityCheckbox
                      disabled={
                        isDisabled ||
                        (isExpandable && element.children.length === 0)
                      }
                      id={data.id}
                      visibility={false}
                    />
                  )}{" "}
                  {data &&
                    data.__typename === "SketchFolder" &&
                    (isExpanded ? (
                      <FolderOpenIcon className="w-6 h-6 text-primary-500" />
                    ) : (
                      <FolderIcon className="w-6 h-6 text-primary-500" />
                    ))}
                  <span className="px-1 cursor-default select-none">
                    {element.name}
                  </span>
                </span>
              </div>
            );
          }}
        />
      </div>
    );
  }
);
