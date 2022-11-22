import {
  SketchFolderDetailsFragment,
  SketchGeometryType,
  SketchTocDetailsFragment,
} from "../../generated/graphql";
import SortableTree, {
  changeNodeAtPath,
  FullTree,
  NodeData,
  OnMovePreviousAndNextLocation,
  OnVisibilityToggleData,
  TreeIndex,
  TreeNode,
  TreeItem,
} from "react-sortable-tree";
// @ts-ignore
import FileExplorerTheme from "react-sortable-tree-theme-file-explorer";
import "react-sortable-tree/style.css";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import "../../dataLayers/tableOfContents/TableOfContents.css";
import { useTranslation, Trans as I18n } from "react-i18next";
import { FolderIcon, FolderOpenIcon } from "@heroicons/react/solid";
import { useEffect, useMemo, useState } from "react";
import TreeView, {
  INode,
  flattenTree,
  CLICK_ACTIONS,
} from "react-accessible-treeview";
import ArrowIcon from "./ArrowIcon";
const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default function SketchTableOfContents({
  sketches,
  folders,
  ignoreClicksOnRefs,
}: {
  sketches: SketchTocDetailsFragment[];
  folders: SketchFolderDetailsFragment[];
  ignoreClicksOnRefs?: HTMLElement[];
}) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const treeData = useMemo(() => {
    const items: (SketchFolderDetailsFragment | SketchTocDetailsFragment)[] = [
      {
        name: "ROOT -- should not be displayed",
        id: 0,
      },
      ...[...sketches, ...folders].sort((a, b) => a.name.localeCompare(b.name)),
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
          if (!(parentId in children)) {
            children[parentId] = [];
          }
          children[parentId].push(id);
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        containerRef &&
        (containerRef === target || containerRef.contains(target))
      ) {
        return;
      } else if (ignoreClicksOnRefs) {
        for (const el of ignoreClicksOnRefs) {
          if (el === target || el.contains(target)) {
            return;
          }
        }
      }
      setSelectedIds([]);
    };
    document.body.addEventListener("click", handler);
    return () => {
      document.body.removeEventListener("click", handler);
    };
  }, [containerRef, ignoreClicksOnRefs]);

  return (
    <div className="pt-2 pl-5" ref={(ref) => setContainerRef(ref)}>
      <TreeView
        data={treeData.nodes}
        selectedIds={selectedIds}
        // multiSelect
        togglableSelect={true}
        expandedIds={expandedIds}
        onExpand={(props) => {}}
        onSelect={(props) => {
          const { element, isSelected } = props;
          setSelectedIds((prev) => {
            return [
              ...prev.filter((id) => id !== element.id),
              ...(isSelected ? [element.id] : []),
            ];
          });
        }}
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
              {...nodeProps}
              style={{
                marginLeft: 40 * (level - 1) - (isExpandable ? 18 : 3),
                opacity: isDisabled ? 0.5 : 1,
                paddingLeft: isExpandable ? 0 : 3,
              }}
              className={`py-0.5 ${isSelected ? "bg-gray-200" : ""}`}
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.stopPropagation();
                  // toggle visibility
                }
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
                <span className="px-1 cursor-pointer select-none">
                  {element.name}
                </span>
              </span>
            </div>
          );
        }}
      />

      {/* <SortableTree
        theme={FileExplorerTheme}
        isVirtualized={false}
        treeData={nodes}
        onChange={(treeData) => {}}
        getNodeKey={(data) => data.node.id}
        style={{ height: "auto" }}
        canNodeHaveChildren={(node) =>
          node.__typename === "SketchFolder" ||
          (node.sketchClass?.geometryType &&
            node.sketchClass.geometryType === SketchGeometryType.Collection)
        }
        canDrop={({ node, prevParent, nextParent }) => {
          return false;
        }}
        canDrag={() => true}
        placeholderRenderer={() => <div></div>}
        generateNodeProps={(data) => {
          return {
            title: <span>{data.node.title}</span>,
            className: "text-sm",
            icons: [
              <VisibilityCheckbox
                id={data.node.id}
                disabled={false}
                visibility={false}
              />,
              ...(data.node.__typename === "SketchFolder"
                ? [
                    data.node.expanded ? (
                      <FolderOpenIcon className="w-6 h-6 text-primary-500 mr-1" />
                    ) : (
                      <FolderIcon className="w-6 h-6 text-primary-500 mr-1" />
                    ),
                  ]
                : []),
            ],
          };
        }}
      /> */}
    </div>
  );
}
