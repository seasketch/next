import React, { Children, useCallback, useContext, useState } from "react";
import SortableTree from "react-sortable-tree";
// @ts-ignore
import FileExplorerTheme from "react-sortable-tree-theme-file-explorer";
import "react-sortable-tree/style.css";
import { LayerManagerContext } from "../LayerManager";
import VisibilityCheckbox from "./VisibilityCheckbox";
import "./TableOfContents.css";
import Spinner from "../../components/Spinner";

export interface TableOfContentsNode {
  id: string;
  type: "folder" | "layer";
  title: string;
  children?: TableOfContentsNode[];
  expanded: boolean;
  disabled?: boolean;
}

interface TableOfContentsProps {
  nodes: TableOfContentsNode[];
  onChange: (nodes: TableOfContentsNode[]) => void;
  isVirtualized?: boolean;
  extraButtons?: (node: TableOfContentsNode) => React.ReactNode[];
  disabledMessage?: string;
}

export default function TableOfContents(props: TableOfContentsProps) {
  const [expansionToggled, setExpansionToggled] = useState(true);
  const showFolderToggle = hasFolders(props.nodes[0]);

  const { manager, layerStates } = useContext(LayerManagerContext);

  const setExpanded = (expanded: boolean, child?: TableOfContentsNode) => {
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
    <div className="relative">
      {showFolderToggle && (
        <div className="z-10 p-0 absolute top-0 left-32 text-gray-500">
          <button
            className="mr-2 text-sm underline"
            onClick={() => setExpanded(expansionToggled)}
          >
            {expansionToggled ? "expand all" : "collapse all"}
          </button>
        </div>
      )}
      <SortableTree
        canDrag={false}
        isVirtualized={!!props.isVirtualized}
        onChange={props.onChange}
        treeData={props.nodes}
        style={{ height: "auto" }}
        theme={FileExplorerTheme}
        generateNodeProps={(data) => {
          const layerState = layerStates[data.node.id];
          const visibility =
            data.node.type === "layer"
              ? !!layerState?.visible
              : folderVisibility(data.node as TableOfContentsNode, layerStates);
          const isVisible = visibility === "mixed" || visibility;
          return {
            title: `${data.node.title}${
              data.node.disabled && props.disabledMessage
                ? " " + props.disabledMessage
                : ""
            }`,
            style: {
              opacity: data.node.disabled ? 0.5 : 1,
            },
            icons: [
              <VisibilityCheckbox
                id={data.node.id}
                disabled={data.node.disabled}
                onClick={() => {
                  let childIds = [];
                  if (data.node.type === "layer") {
                    childIds = [data.node.id];
                  } else {
                    childIds = getEnabledChildren(
                      data.node as TableOfContentsNode,
                      isVisible,
                      layerStates
                    );
                  }
                  if (isVisible) {
                    manager?.hideLayers(childIds);
                  } else {
                    manager?.showLayers(childIds);
                  }
                }}
                visibility={visibility}
              />,
              ...(props.extraButtons
                ? props.extraButtons(data.node as TableOfContentsNode)
                : []),
            ],
            buttons: [
              layerState?.error ? (
                <span>{layerState.error?.message}</span>
              ) : null,
              <Spinner
                // className="transition duration-500 ease-in"
                style={{
                  display: layerState?.loading ? "inline-block" : "none",
                }}
              />,
            ],
          };
        }}
      />
    </div>
  );
}

function folderVisibility(
  folder: TableOfContentsNode,
  layerStates: { [id: string]: { visible: boolean | "mixed" } }
): boolean | "mixed" {
  if (folder.children && folder.children.length) {
    let anyOn = false;
    let anyOff = false;
    for (const child of folder.children) {
      let state: boolean | "mixed";
      if (child.type === "layer") {
        state = layerStates[child.id]?.visible || false;
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
  folder: TableOfContentsNode,
  visible: boolean,
  layerStates: { [id: string]: { visible: boolean | "mixed" } }
) {
  let ids: string[] = [];
  if (folder.children) {
    for (const child of folder.children) {
      if (child.type === "folder") {
        ids = ids.concat(getEnabledChildren(child, visible, layerStates));
      } else if (!child.disabled) {
        const state = layerStates[child.id];
        if ((!state && visible === false) || state?.visible === visible) {
          ids.push(child.id);
        }
      }
    }
  }
  return ids;
}

function hasFolders(node?: TableOfContentsNode) {
  if (node?.children) {
    for (const child of node.children) {
      if (child.type === "folder") {
        return true;
      }
    }
  }
  return false;
}
