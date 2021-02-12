import React, { useContext, useEffect, useMemo, useState } from "react";
import { LayerInfo, MapServerCatalogInfo } from "./arcgis";
import SortableTree, { ExtendedNodeData, TreeItem } from "react-sortable-tree";
// @ts-ignore
import FileExplorerTheme from "react-sortable-tree-theme-file-explorer";
import "react-sortable-tree/style.css";
import "./ArcGISLayerTree.css";
import Button from "../../../components/Button";
import SettingsIcon from "../../../components/SettingsIcon";
import LayerLoadingStateContext from "./LayerLoadingStateContext";
import Spinner from "../../../components/Spinner";

interface ArcGISLayerTreeProps {
  mapServiceInfo: MapServerCatalogInfo;
  layers: LayerInfo[];
  vectorMode?: boolean;
  onVisibleLayersChanged?: (layers: number[]) => void;
  onVectorSettingsClick?: (item: LayerInfo) => void;
  // initialVisibleLayers: number[] | undefined;
}

interface TreeData extends TreeItem {
  id: number;
  title: string | React.ReactNode;
  children?: TreeData[];
  layerData: LayerInfo;
}

interface NodeState {
  visibility: "mixed" | boolean;
}

interface NodeStates {
  [id: number]: NodeState;
}

const TreeNodeContext = React.createContext<NodeStates>({});

export function ArcGISLayerTree(props: ArcGISLayerTreeProps) {
  const [treeData, setTreeData] = useState<TreeData[]>(
    treeDataFromLayerList(props.layers)
  );
  const [nodeStates, setNodeStates] = useState<NodeStates>({});

  const [expansionToggled, setExpansionToggled] = useState(true);

  const hasFolders =
    props.layers.find((lyr) => lyr.type === "Group Layer") != undefined;

  useEffect(() => {
    if (props.onVisibleLayersChanged) {
      props.onVisibleLayersChanged(
        getVisibleLayerIds(
          treeData,
          Object.keys(nodeStates).reduce((prev, key) => {
            const id = parseInt(key);
            prev[id] = nodeStates[id].visibility;
            return prev;
          }, {} as { [id: number]: "mixed" | boolean })
        )
      );
    }
  }, [nodeStates]);

  useEffect(() => {
    const checkboxState = calculateInitialVisibility(props.layers);
    setNodeStates(
      Object.keys(checkboxState).reduce((prev, key) => {
        const id = parseInt(key);
        prev[id] = {
          visibility: checkboxState[id],
        };
        return prev;
      }, {} as NodeStates)
    );
    setTreeData(treeDataFromLayerList(props.layers));
  }, [props.layers]);

  const setExpanded = (expanded: boolean, child?: TreeData) => {
    setExpansionToggled(!expanded);
    if (!child) {
      for (const child of treeData[0].children!) {
        setExpanded(expanded, child);
      }
      setTreeData([...treeData]);
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
    <div className="relative mt-4">
      {hasFolders && (
        <div className="z-10 p-0 absolute top-0 left-32 text-gray-500">
          <a
            href="javascript:;"
            className="mr-2 text-sm underline"
            onClick={() => setExpanded(expansionToggled)}
          >
            {expansionToggled ? "expand all" : "collapse all"}
          </a>
        </div>
      )}
      <div className="px-6">
        <TreeNodeContext.Provider value={nodeStates}>
          <SortableTree
            canDrag={false}
            isVirtualized={false}
            style={{ height: "auto" }}
            getNodeKey={(data) => data.node.layerData.id}
            treeData={treeData}
            generateNodeProps={(rowInfo) => ({
              style:
                props.vectorMode &&
                rowInfo.node.layerData.type === "Raster Layer"
                  ? {
                      opacity:
                        rowInfo.node.layerData.type === "Raster Layer"
                          ? 0.5
                          : 1,
                      textDecoration: "line-through",
                    }
                  : {},
              icons: [
                <VisibilityCheckbox
                  vectorMode={!!props.vectorMode}
                  rasterLayer={rowInfo.node.layerData.type === "Raster Layer"}
                  id={rowInfo.node.layerData.id}
                  onChange={(id, isChecked) => {
                    const newState = {
                      ...nodeStates,
                    };
                    newState[id] = {
                      ...nodeStates[id],
                      visibility: isChecked,
                    };

                    // make sure all children are checked
                    toggleChildrenRecursively(
                      rowInfo.node as TreeData,
                      isChecked,
                      newState
                    );
                    // make sure all parents are in correct state
                    updateParentVisibilityRecursively(
                      rowInfo.node as TreeData,
                      newState,
                      treeData
                    );
                    setNodeStates(newState);
                  }}
                />,
                ...(!!props.vectorMode &&
                rowInfo.node.layerData.type === "Feature Layer"
                  ? [
                      <button
                        className="cursor-pointer rounded block border mr-2 focus:outline-none focus:shadow-outline-blue p-0.5"
                        onClick={() => {
                          if (props.onVectorSettingsClick) {
                            props.onVectorSettingsClick(rowInfo.node.layerData);
                          }
                        }}
                      >
                        <SettingsIcon className="w-4 h-4 text-primary-500 hover:text-primary-600" />
                      </button>,
                      // <VectorLayerSizeIndicator id={rowInfo.node.layerData.id} />,
                    ]
                  : []),
              ],
              // buttons:
              //   rowInfo.node.layerData && rowInfo.node.layerData.url
              //     ? [
              //         <StateIndicators
              //           sourceId={
              //             !!props.vectorMode
              //               ? rowInfo.node.layerData.generatedSourceId
              //               : rowInfo.node.layerData.url.replace(/\/\d+$/, "")
              //           }
              //         />,
              //       ]
              //     : [],
              // //   ,
            })}
            onChange={(newData) => setTreeData(newData as TreeData[])}
            // rowHeight={42}
            theme={FileExplorerTheme}
          />
        </TreeNodeContext.Provider>
      </div>
    </div>
  );
}

function VisibilityCheckbox(props: {
  id: number;
  onChange?: (id: number, isChecked: boolean) => void;
  vectorMode: boolean;
  rasterLayer: boolean;
}) {
  const context = useContext(TreeNodeContext);
  const nodeData = context[props.id];
  const visibility = nodeData?.visibility || false;
  return (
    <input
      disabled={props.vectorMode && props.rasterLayer}
      className="form-checkbox cursor-pointer mr-2"
      // @ts-ignore
      indeterminate={(visibility === "mixed").toString()}
      onChange={(e) => {
        if (props.onChange) {
          props.onChange(props.id, !!e.target.checked);
        }
      }}
      aria-checked={visibility}
      type="checkbox"
      checked={
        (visibility === "mixed" || visibility === true) &&
        (!props.vectorMode || !props.rasterLayer)
      }
    />
  );
}

function StateIndicators(props: { sourceId: string }) {
  const context = useContext(LayerLoadingStateContext);
  const layerContext = context[props.sourceId];
  return (
    <>
      {layerContext && (
        <div>
          {layerContext.loading && <Spinner />}
          {layerContext.error && <span>{layerContext.error.message}</span>}
        </div>
      )}
    </>
  );
}

function updateParentVisibilityRecursively(
  node: TreeData,
  nodeStates: NodeStates,
  treeData: TreeData[]
) {
  const layerData = node.layerData;
  let parent: TreeData | undefined | false;
  if (layerData.parentLayer) {
    parent = findNodeById(layerData.parentLayer.id, treeData);
  }
  if (parent) {
    let anyTrue = false;
    let anyFalse = false;
    if (parent.children) {
      for (const { id } of parent.children) {
        let checked = nodeStates[id].visibility;
        anyTrue = anyTrue || checked !== false;
        anyFalse = anyFalse || checked === false;
      }
      if (anyTrue && anyFalse) {
        nodeStates[parent.id].visibility = "mixed";
      } else if (anyTrue && !anyFalse) {
        nodeStates[parent.id].visibility = true;
      } else {
        nodeStates[parent.id].visibility = false;
      }
    }
    updateParentVisibilityRecursively(parent, nodeStates, treeData);
  }
}

function toggleChildrenRecursively(
  node: TreeData,
  isChecked: boolean,
  nodeStates: NodeStates
) {
  if (node.children) {
    for (const child of node.children) {
      nodeStates[child.id].visibility = isChecked;
      toggleChildrenRecursively(child, isChecked, nodeStates);
    }
  }
}

function treeDataFromLayerList(layers: LayerInfo[]) {
  let data: TreeData[] = [];
  let nodesById: { [id: number]: TreeData } = {
    [-1]: {
      id: -1,
      title: "Layers",
      expanded: true,
      layerData: {
        id: -1,
        type: "Group Layer",
        name: "Layers",
        defaultVisibility: true,
      } as LayerInfo,
      children: [],
    },
  };
  const root = nodesById[-1];
  data.push(root);
  if (layers.length) {
    const initialState: { [layerId: number]: boolean } = {
      [-1]: true,
    };
    for (const layer of layers) {
      if (layer.defaultVisibility === true) {
        initialState[layer.id] = true;
      }
      const node: TreeData = {
        id: layer.id,
        title: layer.name,
        layerData: layer,
      };
      nodesById[node.id] = node;
      if (layer.parentLayer && layer.parentLayer.id !== -1) {
        const parent = nodesById[layer.parentLayer.id];
        if (!parent) {
          throw new Error(`Could not find parent node for ${layer.name}`);
        }
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      } else {
        node.layerData.parentLayer = { id: -1 };
        root.children!.push(node);
      }
    }
  } else {
    data = [];
  }
  return data;
}

function calculateInitialVisibility(layers: LayerInfo[]) {
  const visibility: { [id: number]: boolean } = {};
  visibility[-1] = true;
  for (const layer of layers) {
    visibility[layer.id] = !!layer.defaultVisibility;
  }
  return visibility;
}

function getVisibleLayerIds(
  treeData: TreeData[],
  visibleLayers: { [id: string]: boolean | "mixed" }
) {
  let ids: number[] = [];
  for (const node of treeData) {
    getVisibleLayerIdsRecursive(node, visibleLayers, ids);
  }
  return ids;
}

function getVisibleLayerIdsRecursive(
  node: TreeData,
  visibleLayers: { [id: string]: boolean | "mixed" },
  currentValue: number[]
) {
  if (visibleLayers[node.layerData.id] !== false) {
    if (node.layerData.type !== "Group Layer") {
      currentValue.push(node.layerData.id);
    } else if (node.children) {
      for (const child of node.children) {
        getVisibleLayerIdsRecursive(child, visibleLayers, currentValue);
      }
    }
  }
  return;
}

function findNodeById(
  id: number,
  treeData: TreeData[],
  currentNode?: TreeData
): TreeData | false {
  if (!currentNode) {
    for (const child of treeData) {
      const found = findNodeById(id, treeData, child);
      if (found) {
        return found;
      }
    }
  } else {
    if (currentNode.id === id) {
      return currentNode;
    } else {
      if (currentNode.children) {
        for (const child of currentNode.children) {
          const match = findNodeById(id, treeData, child);
          if (match) {
            return match;
          }
        }
      }
      return false;
    }
  }
  return false;
}
