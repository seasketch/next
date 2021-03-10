import React, { ReactNode, useContext, useRef, useState } from "react";
import SortableTree, {
  changeNodeAtPath,
  FullTree,
  NodeData,
  OnMovePreviousAndNextLocation,
  OnVisibilityToggleData,
  TreeIndex,
  TreeNode,
} from "react-sortable-tree";
// @ts-ignore
import FileExplorerTheme from "react-sortable-tree-theme-file-explorer";
import "react-sortable-tree/style.css";
import { MapContext } from "../MapContextManager";
import VisibilityCheckbox from "./VisibilityCheckbox";
import "./TableOfContents.css";
import Spinner from "../../components/Spinner";
import {
  AccessControlListType,
  TableOfContentsItem as GeneratedTableOfContentsItem,
  TableOfContentsItem,
} from "../../generated/graphql";
import { Menu, useContextMenu } from "react-contexify";
import "react-contexify/dist/ReactContexify.css";
import Button from "../../components/Button";
import { useTranslation } from "react-i18next";

export type ClientTableOfContentsItem = Pick<
  GeneratedTableOfContentsItem,
  | "title"
  | "showRadioChildren"
  | "bounds"
  | "isFolder"
  | "isClickOffOnly"
  | "showRadioChildren"
  | "stableId"
  | "parentStableId"
  | "sortIndex"
  | "hideChildren"
  | "acl"
> & {
  id: number | string;
  disabled?: boolean;
  expanded?: boolean;
  children?: ClientTableOfContentsItem[];
  dataLayerId?: number | string | null;
};

interface TableOfContentsProps {
  nodes: ClientTableOfContentsItem[];
  onChange: (nodes: ClientTableOfContentsItem[]) => void;
  isVirtualized?: boolean;
  extraButtons?: (node: ClientTableOfContentsItem) => React.ReactNode[];
  disabledMessage?: string;
  extraClassName?: (node: ClientTableOfContentsItem) => string | null;
  contextMenuId?: string;
  contextMenuItems?: ReactNode[];
  /** defaults to false */
  canDrag?: boolean;
  onMoveNode?: (
    data: NodeData & FullTree & OnMovePreviousAndNextLocation
  ) => void;
  hideExpandAll?: boolean;
  onVisibilityToggle?: (data: OnVisibilityToggleData) => void;
}

export default function TableOfContents(props: TableOfContentsProps) {
  const [expansionToggled, setExpansionToggled] = useState(true);
  const showFolderToggle = hasFolders(props.nodes[0]) && !props.hideExpandAll;
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { show } = useContextMenu({
    id: props.contextMenuId || "none",
  });
  const { manager, layerStates } = useContext(MapContext);

  const setExpanded = (
    expanded: boolean,
    child?: ClientTableOfContentsItem
  ) => {
    setExpansionToggled(!expanded);
    if (!child) {
      for (const child of props.nodes[0].children!) {
        setExpanded(expanded, child);
      }
      props.onChange([...props.nodes]);
    } else {
      if (child.children) {
        for (const node of child.children) {
          setExpanded(expanded, node);
        }
      }
      child.expanded = expanded;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {props.contextMenuItems && (
        <Menu
          id={props.contextMenuId!}
          animation={false}
          onHidden={() => {
            setSelectedItemId(undefined);
          }}
        >
          {props.contextMenuItems}
        </Menu>
      )}
      {showFolderToggle && (
        <div className="z-10 p-0 absolute top-0 right-12 text-gray-500">
          <Button
            small
            title={t("toggle all folder expansion")}
            buttonClassName="px-0 py-0"
            className="px-0 py-0"
            onClick={() => setExpanded(expansionToggled)}
            label={
              <>
                {!expansionToggled ? (
                  <svg
                    className="w-4 h-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 13h6M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                    />
                  </svg>
                )}
              </>
            }
          />
          {/* <button
            className="mr-2 text-sm underline"
            onClick={() => setExpanded(expansionToggled)}
          >
            {expansionToggled ? "expand all" : "collapse all"}
          </button> */}
        </div>
      )}
      <SortableTree
        canDrag={!!props.canDrag}
        isVirtualized={!!props.isVirtualized}
        onChange={props.onChange}
        treeData={props.nodes}
        onMoveNode={props.onMoveNode}
        canNodeHaveChildren={(node) => !!node.isFolder}
        style={{ height: "auto" }}
        theme={FileExplorerTheme}
        getNodeKey={(data) => data.node.id}
        generateNodeProps={(data) => {
          const layerState = layerStates[data.node.dataLayerId];
          const visibility = data.node.isFolder
            ? folderVisibility(
                data.node as ClientTableOfContentsItem,
                layerStates
              )
            : !!layerState?.visible;
          const isVisible = visibility === "mixed" || visibility;
          const selected = data.node.id.toString() === selectedItemId;
          const inRadioFolder = data.parentNode?.showRadioChildren;
          return {
            style: {
              border: selected ? "1px solid inset rgba(0,0,0,0.05)" : "none",
            },
            toggleChildrenVisibility: data.node.hideChildren
              ? undefined
              : ({
                  node,
                  path,
                }: {
                  node: TreeIndex & TreeNode;
                  path: number[];
                }) => {
                  // if ()
                  const newTreeData = changeNodeAtPath({
                    treeData: props.nodes,
                    path: path,
                    newNode: ({
                      node,
                    }: {
                      node: ClientTableOfContentsItem;
                    }) => ({
                      ...node,
                      expanded: !node.expanded,
                    }),
                    getNodeKey: (data: TreeIndex & TreeNode) => data.node.id,
                  });

                  props.onChange(newTreeData as ClientTableOfContentsItem[]);

                  if (props.onVisibilityToggle) {
                    props.onVisibilityToggle({
                      treeData: props.nodes,
                      node: node,
                      // @ts-ignore
                      expanded: !node.expanded,
                      // @ts-ignore
                      path: path,
                    });
                  }
                },
            title: (
              <span
                onContextMenu={(e) => {
                  if (props.contextMenuId) {
                    // e.preventDefault();
                    // @ts-ignore
                    window.document.getSelection().removeAllRanges();
                    const options = {
                      props: {
                        foo: "bar",
                        item: data.node,
                      },
                    };
                    show(e, options);
                    setTimeout(() => {
                      setSelectedItemId(data.node.id.toString());
                    }, 8);
                  }
                }}
                className={data.node.disabled ? "text-gray-500" : ""}
              >
                {data.node.title}
                {data.node.disabled && props.disabledMessage
                  ? " " + props.disabledMessage
                  : ""}
              </span>
            ),

            className: `${data.node.disabled ? "opacity-50" : ""} ${
              props.extraClassName
                ? props.extraClassName(data.node as ClientTableOfContentsItem)
                : ""
            } ${selected ? "bg-gray-100 pl-2 -ml-2" : ""} ${
              data.node.hideChildren ? "hideChildren" : ""
            }`,
            icons: [
              <VisibilityCheckbox
                id={data.node.id}
                radio={!!inRadioFolder}
                disabled={
                  data.node.disabled ||
                  (!visibility && data.node.isClickOffOnly)
                }
                error={!!layerState?.error}
                onClick={() => {
                  let childIds = [];
                  let layerIds = [];
                  if (!data.node.isFolder) {
                    childIds = [data.node.id];
                    layerIds = [data.node.dataLayerId];
                  } else {
                    [childIds, layerIds] = getEnabledChildren(
                      data.node as ClientTableOfContentsItem,

                      isVisible,
                      layerStates
                    );
                  }
                  if (isVisible) {
                    manager?.hideLayers(layerIds);
                  } else {
                    // TODO: handle radio siblings
                    if (
                      data.parentNode &&
                      data.parentNode.showRadioChildren &&
                      data.parentNode.children &&
                      Array.isArray(data.parentNode.children)
                    ) {
                      for (const sibling of data.parentNode.children.filter(
                        (item) => item.id !== data.node.id
                      )) {
                        let [childIds, layerIds] = getEnabledChildren(
                          sibling as ClientTableOfContentsItem,
                          false,
                          layerStates
                        );
                        if (
                          !sibling.isFolder &&
                          layerStates[sibling.dataLayerId.toString()]?.visible
                        ) {
                          layerIds.push(sibling.dataLayerId);
                        }
                        manager?.hideLayers(layerIds.map((n) => n.toString()));
                      }
                    }
                    manager?.showLayers(layerIds);
                  }
                }}
                visibility={visibility}
              />,
              ...(props.extraButtons
                ? props.extraButtons(data.node as ClientTableOfContentsItem)
                : []),
            ],
            buttons: [
              layerState?.error ? (
                <LayerError message={layerState.error.message} />
              ) : null,
              <Spinner
                // className="transition duration-500 ease-in"
                style={{
                  display: layerState?.loading ? "inline-block" : "none",
                }}
              />,
              ...(props.canDrag &&
              data.node.acl?.type &&
              data.node.acl.type !== AccessControlListType.Public
                ? [
                    <span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="text-gray-400 -mb-0.5 h-4 w-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>,
                  ]
                : []),
            ],
          };
        }}
      />
    </div>
  );
}

function LayerError(props: { message: string }) {
  return (
    <span title={props.message}>
      <svg
        className="text-red-800 w-5 h-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </span>
  );
}

function folderVisibility(
  folder: ClientTableOfContentsItem,
  layerStates: { [id: string]: { visible: boolean | "mixed" } }
): boolean | "mixed" {
  if (folder.children && folder.children.length) {
    let anyOn = false;
    let anyOff = false;
    for (const child of folder.children) {
      let state: boolean | "mixed";
      if (!child.isFolder) {
        state = layerStates[child.dataLayerId!]?.visible || false;
      } else {
        state = folderVisibility(child, layerStates);
      }
      if (state === "mixed") {
        return state;
      } else if (state === false && anyOn === true) {
        return "mixed";
      } else if (state === false) {
        anyOff = true;
      } else if (state === true && anyOff === true) {
        return "mixed";
      } else if (state === true) {
        anyOn = true;
      }
    }
    if (anyOn && anyOff) {
      return "mixed";
    } else if (anyOn) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

function getEnabledChildren(
  folder: ClientTableOfContentsItem,
  visible: boolean,
  layerStates: { [id: string]: { visible: boolean | "mixed" } }
) {
  let ids: (string | number)[] = [];
  let layerIds: (string | number)[] = [];
  if (folder.children) {
    let children = folder.children;
    if (!visible && folder.showRadioChildren) {
      if (children[0]) {
        children = [children[0]];
      } else {
        children = [];
      }
    }
    for (const child of children) {
      if (child.isFolder && (!child.isClickOffOnly || visible)) {
        const values = getEnabledChildren(child, visible, layerStates);
        ids = ids.concat(values[0]);
        layerIds = layerIds.concat(values[1]);
      } else if (!child.isFolder && !child.disabled) {
        const state = layerStates[child.dataLayerId!];
        if ((!state && visible === false) || state?.visible === visible) {
          ids.push(child.id);
          layerIds.push(child.dataLayerId!);
        }
      }
    }
  }
  return [ids, layerIds];
}

function hasFolders(node?: ClientTableOfContentsItem) {
  if (node?.children) {
    for (const child of node.children) {
      if (child.isFolder) {
        return true;
      }
    }
  }
  return false;
}

export function nestItems(
  items: (Pick<
    TableOfContentsItem,
    | "title"
    | "showRadioChildren"
    | "isFolder"
    | "isClickOffOnly"
    | "id"
    | "stableId"
    | "parentStableId"
    | "sortIndex"
    | "hideChildren"
  > & { dataLayerId?: number | string | null })[],
  expansionState?: { [id: number]: boolean }
) {
  expansionState = expansionState || {};
  const output: ClientTableOfContentsItem[] = [];
  const lookup: { [stableId: string]: ClientTableOfContentsItem } = {};
  for (const item of items) {
    lookup[item.stableId] = {
      ...item,
      ...(item.isFolder
        ? {
            children: [],
            expanded:
              item.id in expansionState
                ? expansionState[item.id] && !item.hideChildren
                : false,
          }
        : {}),
    };
  }
  for (const item of Object.values(lookup).sort(bySortIndexAndId)) {
    if (item.parentStableId) {
      const parent = lookup[item.parentStableId];
      if (parent) {
        parent.children!.push(item);
      }
    } else {
      output.push(item);
    }
  }
  return output;
}

export function bySortIndexAndId(
  a: ClientTableOfContentsItem,
  b: ClientTableOfContentsItem
): number {
  // return (a.sortIndex)
  const sortIndexA = a.sortIndex || 0;
  const sortIndexB = b.sortIndex || 0;
  return sortIndexA - sortIndexB;
}

export function createBoundsRecursive(
  item: ClientTableOfContentsItem,
  bounds?: [number, number, number, number]
): [number, number, number, number] {
  if (item.bounds) {
    if (!bounds) {
      bounds = item.bounds.map((v) => parseFloat(v)) as [
        number,
        number,
        number,
        number
      ];
    } else {
      bounds = combineBounds(
        bounds,
        item.bounds.map((v) => parseFloat(v)) as [
          number,
          number,
          number,
          number
        ]
      );
    }
  }
  if (!bounds) {
    bounds = [180.0, 90.0, -180.0, -90.0];
  }
  if (item.children) {
    for (const child of item.children) {
      bounds = createBoundsRecursive(child, bounds);
    }
  }
  return bounds;
}

export function combineBounds(
  a: [number, number, number, number],
  b: [number, number, number, number]
): [number, number, number, number] {
  return [
    a[0] < b[0] ? a[0] : b[0],
    a[1] < b[1] ? a[1] : b[1],
    a[2] > b[2] ? a[2] : b[2],
    a[3] > b[3] ? a[3] : b[3],
  ];
}
