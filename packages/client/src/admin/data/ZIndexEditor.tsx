import React, { useContext, useEffect, useRef, useState } from "react";
import {
  LayerTreeContext,
  MapManagerContext,
} from "../../dataLayers/MapContextManager";
import "react-sortable-tree/style.css";
import SortableTree, { TreeItem } from "react-sortable-tree";
import {
  RenderUnderType,
  useUpdateZIndexesMutation,
  useUpdateRenderUnderTypeMutation,
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  OverlayFragment,
} from "../../generated/graphql";
import { gql, useApolloClient } from "@apollo/client";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import { useTranslation } from "react-i18next";

interface ZIndexEditorProps {
  dataLayers?: DataLayerDetailsFragment[] | null;
  dataSources?: DataSourceDetailsFragment[] | null;
  tableOfContentsItems?: OverlayFragment[];
}

export default function ZIndexEditor(props: ZIndexEditorProps) {
  const { t } = useTranslation("admin");
  const [treeState, setTreeState] = useState<TreeItem[]>();
  const [expandedItems, setExpandedItems] = useState<(number | string)[]>([]);
  const [updateZIndexes] = useUpdateZIndexesMutation({
    optimisticResponse: (data) => {
      let z = 0;
      const layers: { id: number; zIndex: number; __typename: "DataLayer" }[] =
        [];
      for (const id of data.dataLayerIds as number[]) {
        layers.push({ id, zIndex: z++, __typename: "DataLayer" });
      }
      return {
        __typename: "Mutation",
        updateZIndexes: {
          __typename: "UpdateZIndexesPayload",
          dataLayers: layers,
        },
      };
    },
  });
  const [updateRenderUnder] = useUpdateRenderUnderTypeMutation({
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateDataLayer: {
          __typename: "UpdateDataLayerPayload",
          dataLayer: {
            __typename: "DataLayer",
            id: data.layerId,
            renderUnder: data.renderUnder!,
          },
        },
      };
    },
  });
  const { layerStatesByTocStaticId } = useContext(LayerTreeContext);
  const { manager } = useContext(MapManagerContext);
  let layerLookup = useRef<{ [id: string]: DataLayerDetailsFragment }>({});

  const lookupRenderUnder = (item: TreeItem) => {
    let setting = RenderUnderType.Labels;
    if (item.children) {
      for (const child of item.children as TreeItem[]) {
        setting = layerLookup.current[child.id].renderUnder;
        if (setting === RenderUnderType.None) {
          return setting;
        }
      }
    } else {
      setting = layerLookup.current[item.id].renderUnder;
    }
    return setting;
  };

  useEffect(() => {
    if (props.dataLayers && props.tableOfContentsItems) {
      for (const layer of props.dataLayers) {
        layerLookup.current[layer.id] = layer;
      }
      let items: TreeItem[] = [];
      for (const item of props.tableOfContentsItems) {
        if (item.dataLayerId) {
          const layer = props.dataLayers.find((l) => l.id === item.dataLayerId);
          if (!layer) {
            throw new Error(
              /* eslint-disable-next-line */
              `Could not find layer associated with ${item.title}`
            );
          }
          if (layer.sublayer) {
            const source = props.dataSources?.find(
              (s) => s.id === layer.dataSourceId
            );
            const parentId = "source" + layer.dataSourceId;
            let parent = items.find((i) => i.id === parentId);
            if (!parent) {
              parent = {
                id: parentId,
                title: t("Image Service"),

                subtitle:
                  source?.supportsDynamicLayers === false
                    ? t("Dynamic layers are unsupported.")
                    : t("Dynamic layers are supported."),
                expanded: expandedItems.indexOf(parentId) !== -1,
                zIndex: 999999999,
                children: [],
              };
              items.push(parent);
            }
            parent!.children = [
              ...(parent.children! as TreeItem[]),
              {
                id: item.dataLayerId,
                stableId: item.stableId,
                title: item.title,
                zIndex: layer.zIndex,
                preventDrag: source?.supportsDynamicLayers === false,
              },
            ];
            if (layer.zIndex < parent.zIndex) {
              parent.zIndex = layer.zIndex;
            }
            // if (layer.renderUnder === RenderUnderType.Labels) {
            //   parent.renderUnder = RenderUnderType.Labels;
            // } else if (layer.renderUnder === RenderUnderType.Land) {
            //   parent.renderUnder = RenderUnderType.Land;
            // }
          } else {
            items.push({
              id: item.dataLayerId,
              title: item.title,
              stableId: item.stableId,
              // title: item.title + `(${item.dataLayerId})`,
              zIndex: layer.zIndex,
            });
          }
        }
      }

      items = items.sort((a, b) => {
        const aRenderUnder = lookupRenderUnder(a);
        const bRenderUnder = lookupRenderUnder(b);
        if (
          aRenderUnder === RenderUnderType.Labels &&
          bRenderUnder !== RenderUnderType.Labels
        ) {
          return 1;
        } else if (
          bRenderUnder === RenderUnderType.Labels &&
          aRenderUnder !== RenderUnderType.Labels
        ) {
          return -1;
        } else {
          return a.zIndex - b.zIndex;
        }
      });
      for (const item of items) {
        if (lookupRenderUnder(item) === RenderUnderType.Labels) {
          const index = items.indexOf(item);
          items = [
            ...items.slice(0, index),
            {
              id: "labels",
              title: t("Basemap Labels"),
              zIndex: item.zIndex - 0.5,
              preventDrag: true,
              isBasemapLayer: true,
            },
            ...items.slice(index),
          ];
          break;
        } else if (items.indexOf(item) === items.length - 1) {
          items.push({
            id: "labels",
            title: t("Basemap Labels"),
            zIndex: item.zIndex + 0.5,
            preventDrag: true,
            isBasemapLayer: true,
          });
          break;
        }
      }

      setTreeState(items);
    }
  }, [props.dataLayers, props.tableOfContentsItems]);

  const onChange = (treeData: TreeItem[]) => {
    let currentIndex = 0;
    const zIndexes: { [layerId: number]: number } = {};
    const layerIdsInOrder: number[] = [];
    let underLabels = false;
    const expandedIds: number[] = [];
    for (const item of treeData) {
      if (item.id === "labels") {
        underLabels = true;
      } else {
        if (item.children) {
          if (item.expanded) {
            expandedIds.push(item.id);
          }
          for (const child of item.children as TreeItem[]) {
            zIndexes[child.id] = currentIndex++;
            layerIdsInOrder.push(child.id);
            if (child.expanded) {
              expandedIds.push(child.id);
            }
            if (
              (underLabels &&
                lookupRenderUnder(child) !== RenderUnderType.Labels) ||
              (!underLabels &&
                lookupRenderUnder(child) !== RenderUnderType.None)
            ) {
              updateRenderUnder({
                variables: {
                  layerId: child.id,
                  renderUnder: underLabels
                    ? RenderUnderType.Labels
                    : RenderUnderType.None,
                },
              });
            }
          }
        } else {
          zIndexes[item.id] = currentIndex++;
          layerIdsInOrder.push(item.id);
          if (item.expanded) {
            expandedIds.push(item.id);
          }
          const lyr = layerLookup.current[item.id];
          if (
            (underLabels &&
              lookupRenderUnder(item) !== RenderUnderType.Labels) ||
            (!underLabels && lookupRenderUnder(item) !== RenderUnderType.None)
          ) {
            updateRenderUnder({
              variables: {
                layerId: item.id,
                renderUnder: underLabels
                  ? RenderUnderType.Labels
                  : RenderUnderType.None,
              },
            });
          }
        }
      }
    }
    setExpandedItems(expandedIds);
    setTreeState([...treeData]);

    updateZIndexes({
      variables: {
        dataLayerIds: layerIdsInOrder,
      },
    });
  };

  return (
    <div className="ZIndexEditor">
      <SortableTree
        treeData={treeState || []}
        onChange={onChange}
        getNodeKey={(data) => data.node.id}
        isVirtualized={false}
        canNodeHaveChildren={() => false}
        canDrop={(data) => {
          if (!data.prevParent && data.nextParent) {
            return false;
          } else if (data.prevParent?.id !== data.nextParent?.id) {
            return false;
          } else {
            return true;
          }
        }}
        canDrag={(data) =>
          !data.node.preventDrag &&
          (!data.parentNode || data.parentNode.children!.length > 1)
        }
        generateNodeProps={(data) => {
          const visible =
            layerStatesByTocStaticId[data.node.stableId] &&
            layerStatesByTocStaticId[data.node.stableId].visible;
          return {
            className: data.node.isBasemapLayer ? "basemap" : "",
            buttons:
              !data.node.children && data.node.title !== t("Basemap Labels")
                ? [
                    <VisibilityCheckbox
                      visibility={visible}
                      id={data.node.stableId}
                      disabled={false}
                      onClick={() => {
                        if (visible) {
                          manager?.hideTocItems([data.node.stableId]);
                        } else {
                          manager?.showTocItems([data.node.stableId]);
                        }
                      }}
                    />,
                  ]
                : [],
          };
        }}
      />
    </div>
  );
}
