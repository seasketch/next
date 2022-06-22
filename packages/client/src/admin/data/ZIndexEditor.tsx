import React, { useContext, useEffect, useRef, useState } from "react";
import {
  ClientDataLayer,
  ClientDataSource,
  MapContext,
} from "../../dataLayers/MapContextManager";
import { ClientTableOfContentsItem } from "../../dataLayers/tableOfContents/TableOfContents";
import "react-sortable-tree/style.css";
import SortableTree, { TreeItem } from "react-sortable-tree";
import {
  RenderUnderType,
  useUpdateZIndexesMutation,
  useUpdateRenderUnderTypeMutation,
} from "../../generated/graphql";
import { gql, useApolloClient } from "@apollo/client";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import { useTranslation } from "react-i18next";

interface ZIndexEditorProps {
  dataLayers?: ClientDataLayer[] | null;
  dataSources?: ClientDataSource[] | null;
  tableOfContentsItems?: ClientTableOfContentsItem[];
}

export default function ZIndexEditor(props: ZIndexEditorProps) {
  const { t } = useTranslation(["admin"]);
  const [treeState, setTreeState] = useState<TreeItem[]>();
  const [expandedItems, setExpandedItems] = useState<(number | string)[]>([]);
  const client = useApolloClient();
  const [updateZIndexes] = useUpdateZIndexesMutation();
  const [updateRenderUnder] = useUpdateRenderUnderTypeMutation();
  const { manager, layerStates } = useContext(MapContext);
  let layerLookup = useRef<{ [id: string]: ClientDataLayer }>({});

  const lookupRenderUnder = (item: TreeItem) => {
    let setting = RenderUnderType.Labels;
    if (item.children) {
      for (const child of item.children as TreeItem[]) {
        // @ts-ignore
        setting = layerLookup.current[child.id].renderUnder;
        if (setting === RenderUnderType.None) {
          return setting;
        }
      }
    } else {
      // @ts-ignore
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
            // @ts-ignore
            let parent = items.find((i) => i.id === parentId);
            if (!parent) {
              parent = {
                // @ts-ignore
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
              // @ts-ignore
              items.push(parent);
            }
            parent!.children = [
              // @ts-ignore
              ...(parent.children! as TreeItem[]),
              {
                // @ts-ignore
                id: item.dataLayerId,
                title: item.title,
                zIndex: layer.zIndex,
                preventDrag: source?.supportsDynamicLayers === false,
              },
            ];
            // @ts-ignore
            if (layer.zIndex < parent.zIndex) {
              // @ts-ignore
              parent.zIndex = layer.zIndex;
            }
            // if (layer.renderUnder === RenderUnderType.Labels) {
            //   parent.renderUnder = RenderUnderType.Labels;
            // } else if (layer.renderUnder === RenderUnderType.Land) {
            //   parent.renderUnder = RenderUnderType.Land;
            // }
          } else {
            items.push({
              // @ts-ignore
              id: item.dataLayerId,
              title: item.title,
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
          // @ts-ignore
          return a.zIndex - b.zIndex;
        }
      });
      for (const item of items) {
        if (lookupRenderUnder(item) === RenderUnderType.Labels) {
          const index = items.indexOf(item);
          items = [
            ...items.slice(0, index),
            {
              // @ts-ignore
              id: "labels",
              title: t("Basemap Labels"),
              // @ts-ignore
              zIndex: item.zIndex - 0.5,
              preventDrag: true,
              isBasemapLayer: true,
            },
            ...items.slice(index),
          ];
          break;
        } else if (items.indexOf(item) === items.length - 1) {
          items.push({
            // @ts-ignore
            id: "labels",
            title: t("Basemap Labels"),
            // @ts-ignore
            zIndex: item.zIndex + 0.5,
            preventDrag: true,
            isBasemapLayer: true,
          });
          break;
        }
      }

      setTreeState(items);
    }
  }, [
    expandedItems,
    props.dataLayers,
    props.dataSources,
    props.tableOfContentsItems,
    t,
  ]);

  const onChange = (treeData: TreeItem[]) => {
    let currentIndex = 0;
    const zIndexes: { [layerId: number]: number } = {};
    const layerIdsInOrder: number[] = [];
    let underLabels = false;
    const expandedIds: number[] = [];
    for (const item of treeData) {
      // @ts-ignore
      if (item.id === "labels") {
        underLabels = true;
      } else {
        if (item.children) {
          if (item.expanded) {
            // @ts-ignore
            expandedIds.push(item.id);
          }
          for (const child of item.children as TreeItem[]) {
            // @ts-ignore
            zIndexes[child.id] = currentIndex++;
            // @ts-ignore
            layerIdsInOrder.push(child.id);
            if (child.expanded) {
              // @ts-ignore
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
                  // @ts-ignore
                  layerId: child.id,
                  renderUnder: underLabels
                    ? RenderUnderType.Labels
                    : RenderUnderType.None,
                },
              });
              client.writeFragment({
                // @ts-ignore
                id: `DataLayer:${child.id}`,
                fragment: gql`
                  fragment NewRenderUnder on DataLayer {
                    # id
                    renderUnder
                  }
                `,
                data: {
                  // id: layerId,
                  renderUnder: underLabels
                    ? RenderUnderType.Labels
                    : RenderUnderType.None,
                },
              });
            }
          }
        } else {
          // @ts-ignore
          zIndexes[item.id] = currentIndex++;
          // @ts-ignore
          layerIdsInOrder.push(item.id);
          if (item.expanded) {
            // @ts-ignore
            expandedIds.push(item.id);
          }
          if (
            (underLabels &&
              lookupRenderUnder(item) !== RenderUnderType.Labels) ||
            (!underLabels && lookupRenderUnder(item) !== RenderUnderType.None)
          ) {
            updateRenderUnder({
              variables: {
                // @ts-ignore
                layerId: item.id,
                renderUnder: underLabels
                  ? RenderUnderType.Labels
                  : RenderUnderType.None,
              },
            });
            client.writeFragment({
              // @ts-ignore
              id: `DataLayer:${item.id}`,
              fragment: gql`
                fragment NewRenderUnder on DataLayer {
                  # id
                  renderUnder
                }
              `,
              data: {
                // id: layerId,
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

    for (const layerId in zIndexes) {
      client.writeFragment({
        id: `DataLayer:${layerId}`,
        fragment: gql`
          fragment NewZIndex on DataLayer {
            # id
            zIndex
          }
        `,
        data: {
          // id: layerId,
          zIndex: zIndexes[layerId],
        },
      });
    }

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
        // @ts-ignore
        getNodeKey={(data) => data.node.id}
        isVirtualized={false}
        // onVisibilityToggle={(data) => {
        //   setTreeState(data.treeData);
        // }}
        canNodeHaveChildren={(node) => !!node.children}
        canDrop={(data) => {
          if (!data.prevParent && data.nextParent) {
            return false;
            // @ts-ignore
          } else if (data.prevParent?.id !== data.nextParent?.id) {
            return false;
          } else {
            return true;
          }
        }}
        canDrag={(data) =>
          // @ts-ignore
          !data.node.preventDrag &&
          (!data.parentNode || data.parentNode.children!.length > 1)
        }
        generateNodeProps={(data) => {
          const visible =
            // @ts-ignore
            layerStates[data.node.id] && layerStates[data.node.id].visible;
          return {
            // @ts-ignore
            className: data.node.isBasemapLayer ? "basemap" : "",
            buttons:
              !data.node.children && data.node.title !== t("Basemap Labels")
                ? [
                    <VisibilityCheckbox
                      visibility={visible}
                      // @ts-ignore
                      id={data.node.id}
                      disabled={false}
                      onClick={() => {
                        if (visible) {
                          // @ts-ignore
                          manager?.hideLayers([data.node.id]);
                        } else {
                          // @ts-ignore
                          manager?.showLayers([data.node.id]);
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
