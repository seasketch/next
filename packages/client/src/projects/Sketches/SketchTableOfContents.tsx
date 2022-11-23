import {
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
} from "../../generated/graphql";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import { useTranslation, Trans as I18n } from "react-i18next";
import { FolderIcon, FolderOpenIcon } from "@heroicons/react/solid";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import TreeView, { INode } from "react-accessible-treeview";
import ArrowIcon from "./ArrowIcon";
import Skeleton from "../../components/Skeleton";
import { propagateSelectChange } from "react-accessible-treeview/dist/TreeView/utils";
const Trans = (props: any) => <I18n ns="sketching" {...props} />;

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
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [expandedIds, setExpandedIds] = useState<number[]>([]);
    const treeView = useRef<HTMLUListElement>(null);
    const [focused, setFocused] =
      useState<null | { type: "sketch" | "folder"; id: number }>(null);

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
            const nodeProps = getNodeProps({
              // handleKeyDown: (e) => {},
            });
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
