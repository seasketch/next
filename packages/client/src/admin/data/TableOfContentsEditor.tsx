import { LngLatBoundsLike, LngLatLike } from "mapbox-gl";
import React, { useContext, useEffect, useState } from "react";
import { Item, Menu, Separator } from "react-contexify";
import { Link, useParams } from "react-router-dom";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import { MapContext } from "../../dataLayers/MapContextManager";
import MetadataModal from "../../dataLayers/MetadataModal";
import TableOfContents, {
  ClientTableOfContentsItem,
} from "../../dataLayers/tableOfContents/TableOfContents";
import {
  TableOfContentsItem,
  useDraftTableOfContentsQuery,
  useLayersAndSourcesForItemsQuery,
  useCreateFolderMutation,
  DraftTableOfContentsDocument,
  useUpdateTableOfContentsItemChildrenMutation,
} from "../../generated/graphql";
import useLocalStorage from "../../useLocalStorage";
import useProjectId from "../../useProjectId";
import { generateStableId } from "./arcgis/arcgis";
import DeleteTableOfContentsItemModal from "./DeleteTableOfContentsItemModal";
import EditFolderModal from "./EditFolderModal";
import LayerTableOfContentsItemEditor from "./LayerTableOfContentsItemEditor";
import MetadataEditor from "./MetadataEditor";
import ZIndexEditor from "./ZIndexEditor";

export default function TableOfContentsEditor() {
  const [selectedView, setSelectedView] = useState("tree");
  const { slug } = useParams<{ slug: string }>();
  const { manager } = useContext(MapContext);
  const tocQuery = useDraftTableOfContentsQuery({
    variables: { slug },
  });
  const projectId = useProjectId();
  const [treeItems, setTreeItems] = useState<ClientTableOfContentsItem[]>([]);
  const [openLayerItemId, setOpenLayerItemId] = useState<number>();
  const [createNewFolderModalOpen, setCreateNewFolderModalOpen] = useState<
    boolean
  >(false);
  const [itemForDeletion, setItemForDeletion] = useState<
    ClientTableOfContentsItem
  >();
  const [
    updateChildrenMutation,
    updateChildrenMutationState,
  ] = useUpdateTableOfContentsItemChildrenMutation();
  const [expansionState, setExpansionState] = useLocalStorage<{
    [id: number]: boolean;
  }>("toc-editor-expansion-state", {});
  const [folderId, setFolderId] = useState<number>();
  const [openMetadataItemId, setOpenMetadataItemId] = useState<number>();
  const [openMetadataViewerId, setOpenMetadataViewerId] = useState<number>();

  useEffect(() => {
    if (tocQuery.data?.projectBySlug?.draftTableOfContentsItems) {
      setTreeItems(
        nestItems(
          tocQuery.data.projectBySlug.draftTableOfContentsItems,
          expansionState
        )
      );
    } else {
      setTreeItems([]);
    }
  }, [tocQuery.data?.projectBySlug?.draftTableOfContentsItems]);

  const layersAndSources = useLayersAndSourcesForItemsQuery({
    variables: {
      slug,
      tableOfContentsItemIds:
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems?.map(
          (item) => item.id
        ) || [],
    },
  });

  useEffect(() => {
    const layers = layersAndSources?.data?.projectBySlug?.dataLayersForItems;
    const sources = layersAndSources?.data?.projectBySlug?.dataSourcesForItems;
    if (layers && sources && manager) {
      // @ts-ignore
      manager.reset(sources, layers);
    }
  }, [layersAndSources.data, manager]);

  useEffect(() => {
    tocQuery.refetch();
  }, [slug]);

  return (
    <div className="">
      {
        <EditFolderModal
          className="z-30"
          folderId={folderId}
          onRequestClose={async (created) => {
            if (created) {
              await tocQuery.refetch();
            }
            setFolderId(undefined);
            setCreateNewFolderModalOpen(false);
          }}
          createNew={createNewFolderModalOpen}
        />
      }
      <header className="fixed bg-white h-16 w-128 z-20">
        <div className="max-w-md m-auto mt-4">
          <div className="bg-cool-gray-200 w-auto inline-block p-0.5 rounded text-sm">
            <span className="px-2">view</span>
            <select
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value)}
              className="bg-white form-select text-sm overflow-visible p-1 px-2 pr-7 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 rounded-md focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5"
              style={{ lineHeight: 1, backgroundSize: "1em 1em" }}
            >
              <option value="tree">Tree Editor</option>
              <option value="state">Default Visibility</option>
              <option value="order">Z-Order</option>
            </select>
          </div>
          {/* <Link
            to={`./data/add-data`}
            className="bg-white rounded shadow-sm border-grey-500 border px-2 py-1 text-sm mx-2"
          >
            Add data
          </Link> */}
          <Button
            small
            label="Add data"
            href={`./data/add-data`}
            className="ml-2"
          />
          <Button
            className="ml-2"
            label="Add folder"
            small
            onClick={async () => {
              setCreateNewFolderModalOpen(true);
            }}
          />
          {/* <button
            className="bg-white rounded shadow-sm border-grey-500 border px-2 py-0.5 text-sm mx-2"
            onClick={async () => {
              setCreateNewFolderModalOpen(true);
            }}
          >
            Add folder
          </button> */}
        </div>
      </header>
      <div
        className="flex-1 overflow-y-scroll p-4 pt-16"
        onContextMenu={(e) => e.preventDefault()}
      >
        {tocQuery.loading && <Spinner />}
        {selectedView === "tree" && (
          <TableOfContents
            hideExpandAll={true}
            onMoveNode={async (data) => {
              // let
              const newParentId = data.nextParentNode?.id;
              let children: number[];
              if (
                data.nextParentNode &&
                data.nextParentNode.children &&
                Array.isArray(data.nextParentNode.children)
              ) {
                children = data.nextParentNode.children.map((item) => item.id);
              } else {
                children = data.treeData.map((item) => item.id);
              }
              if (newParentId && !expansionState[newParentId]) {
                setExpansionState((prev) => ({
                  ...prev,
                  [newParentId]: true,
                }));
              }
              await updateChildrenMutation({
                variables: {
                  id: newParentId,
                  childIds: children,
                },
              });
            }}
            canDrag={true}
            onChange={(e) => setTreeItems(e)}
            nodes={treeItems}
            contextMenuId="layers-toc-editor"
            contextMenuItems={[
              <Item
                key="zoom-to"
                hidden={(args) => {
                  return !args.props.item.isFolder && !args.props.item.bounds;
                }}
                className="text-sm hover:bg-primary-500"
                onClick={(args) => {
                  let bounds: [number, number, number, number] | undefined;
                  if (args.props.item.isFolder) {
                    // bounds = null;
                    bounds = createBoundsRecursive(args.props.item);
                  } else {
                    if (args.props.item.bounds) {
                      bounds = args.props.item.bounds.map((coord: string) =>
                        parseFloat(coord)
                      );
                    }
                  }
                  if (
                    bounds &&
                    [180.0, 90.0, -180.0, -90.0].join(",") !== bounds.join(",")
                  ) {
                    manager?.map?.fitBounds(bounds, {
                      padding: 40,
                    });
                  }
                }}
              >
                Zoom To
              </Item>,
              <Item
                key="1"
                className="text-sm"
                onClick={(args) => {
                  if (args.props?.item?.isFolder) {
                    setFolderId(args.props.item.id);
                  } else {
                    if (args.props.item.bounds) {
                      let bounds = args.props.item.bounds.map((coord: string) =>
                        parseFloat(coord)
                      );
                      if (
                        bounds &&
                        [180.0, 90.0, -180.0, -90.0].join(",") !==
                          bounds.join(",")
                      ) {
                        manager?.map?.fitBounds(bounds, {
                          padding: 40,
                        });
                      }
                    }
                    manager?.showLayers([args.props.item.dataLayerId]);
                    setOpenLayerItemId(args.props.item.id);
                  }
                }}
              >
                Edit
              </Item>,
              <Item
                key="2"
                hidden={(args) => args.props?.item?.isFolder}
                className="text-sm"
                onClick={(args) => {
                  setOpenMetadataViewerId(args.props.item.id);
                }}
              >
                Metadata
              </Item>,
              <Item
                key="3"
                hidden={(args) => args.props?.item?.isFolder}
                className="text-sm"
                onClick={(args) => {
                  setOpenMetadataItemId(args.props.item.id);
                }}
              >
                Edit Metadata
              </Item>,
              <Item
                key="4"
                className="text-sm"
                onClick={(args) => {
                  setItemForDeletion(args.props.item);
                }}
              >
                Delete
              </Item>,
            ]}
            onVisibilityToggle={(data) => {
              setExpansionState((prev) => {
                return {
                  ...prev,
                  [data.node.id]: data.expanded,
                };
              });
            }}
          />
        )}
        {selectedView === "order" && (
          <ZIndexEditor
            // @ts-ignore
            tableOfContentsItems={
              tocQuery.data?.projectBySlug?.draftTableOfContentsItems
            }
            // @ts-ignore
            dataLayers={
              layersAndSources.data?.projectBySlug?.dataLayersForItems
            }
            // @ts-ignore
            dataSources={
              layersAndSources.data?.projectBySlug?.dataSourcesForItems
            }
          />
        )}
        <DeleteTableOfContentsItemModal
          item={itemForDeletion}
          onRequestClose={() => setItemForDeletion(undefined)}
          onDelete={async () => await tocQuery.refetch()}
        />
      </div>
      {openLayerItemId && (
        <LayerTableOfContentsItemEditor
          onRequestClose={() => setOpenLayerItemId(undefined)}
          itemId={openLayerItemId}
        />
      )}
      {openMetadataItemId && (
        <MetadataEditor
          id={openMetadataItemId}
          onRequestClose={() => setOpenMetadataItemId(undefined)}
        />
      )}
      {openMetadataViewerId && (
        <MetadataModal
          id={openMetadataViewerId}
          onRequestClose={() => setOpenMetadataViewerId(undefined)}
        />
      )}
    </div>
  );
}

function nestItems(
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

function bySortIndexAndId(
  a: ClientTableOfContentsItem,
  b: ClientTableOfContentsItem
): number {
  // return (a.sortIndex)
  const sortIndexA = a.sortIndex || 0;
  const sortIndexB = b.sortIndex || 0;
  return sortIndexA - sortIndexB;
}

function createBoundsRecursive(
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

function combineBounds(
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
