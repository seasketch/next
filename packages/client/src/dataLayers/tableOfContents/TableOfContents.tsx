import React, { Children, useCallback, useContext, useState } from "react";
import SortableTree from "react-sortable-tree";
// @ts-ignore
import FileExplorerTheme from "react-sortable-tree-theme-file-explorer";
import "react-sortable-tree/style.css";
import { LayerManagerContext } from "../LayerManager";
import VisibilityCheckbox from "./VisibilityCheckbox";
import "./TableOfContents.css";
import Spinner from "../../components/Spinner";
import { TableOfContentsItem as GeneratedTableOfContentsItem } from "../../generated/graphql";

export interface TableOfContentsNode {
  id: string;
  type: "folder" | "layer";
  title: string;
  children?: TableOfContentsNode[];
  expanded: boolean;
  disabled?: boolean;
}

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
}

export default function TableOfContents(props: TableOfContentsProps) {
  const [expansionToggled, setExpansionToggled] = useState(true);
  const showFolderToggle = hasFolders(props.nodes[0]);

  const { manager, layerStates } = useContext(LayerManagerContext);

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
          const layerState = layerStates[data.node.dataLayerId];
          const visibility = data.node.isFolder
            ? folderVisibility(
                data.node as ClientTableOfContentsItem,
                layerStates
              )
            : !!layerState?.visible;
          const isVisible = visibility === "mixed" || visibility;
          return {
            title: `${data.node.title}${
              data.node.disabled && props.disabledMessage
                ? " " + props.disabledMessage
                : ""
            }`,
            className: `${data.node.disabled ? "opacity-50" : ""} ${
              props.extraClassName
                ? props.extraClassName(data.node as ClientTableOfContentsItem)
                : ""
            }`,
            icons: [
              <VisibilityCheckbox
                id={data.node.id}
                disabled={data.node.disabled}
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
    for (const child of folder.children) {
      if (child.isFolder) {
        const values = getEnabledChildren(child, visible, layerStates);
        ids = ids.concat(values[0]);
        layerIds = layerIds.concat(values[1]);
      } else if (!child.disabled) {
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
