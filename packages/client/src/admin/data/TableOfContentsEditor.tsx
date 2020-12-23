import React, { useContext, useEffect, useState } from "react";
import { Item, Menu, Separator } from "react-contexify";
import { Link, useParams } from "react-router-dom";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import {
  LayerManagerContext,
  useLayerManager,
} from "../../dataLayers/LayerManager";
import TableOfContents, {
  ClientTableOfContentsItem,
} from "../../dataLayers/tableOfContents/TableOfContents";
import {
  TableOfContentsItem,
  useDraftTableOfContentsQuery,
  useLayersAndSourcesForItemsQuery,
  useCreateFolderMutation,
  DraftTableOfContentsDocument,
  useUpdateTableOfContentsItemChildrenMutation
} from "../../generated/graphql";
import useProjectId from "../../useProjectId";
import { generateStableId } from "./arcgis/arcgis";
import DeleteTableOfContentsItemModal from "./DeleteTableOfContentsItemModal";

export default function TableOfContentsEditor() {
  const [selectedView, setSelectedView] = useState("tree");
  const { slug } = useParams<{ slug: string }>();
  const { manager } = useContext(LayerManagerContext);
  const tocQuery = useDraftTableOfContentsQuery({
    variables: { slug },
  });
  const projectId = useProjectId();
  const [treeItems, setTreeItems] = useState<ClientTableOfContentsItem[]>([]);
  const [createFolder, createFolderState] = useCreateFolderMutation();
  const [itemForDeletion, setItemForDeletion] = useState<ClientTableOfContentsItem>();
  const [updateChildrenMutation, updateChildrenMutationState] = useUpdateTableOfContentsItemChildrenMutation();
  
  useEffect(() => {
    if (tocQuery.data?.projectBySlug?.draftTableOfContentsItems) {
      setTreeItems(
        nestItems(tocQuery.data.projectBySlug.draftTableOfContentsItems)
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
      manager.reset(sources, layers);
    }
  }, [layersAndSources.data, manager]);

  return (
    <div className="relative">
      <header className="fixed bg-white h-16 w-128 z-10">
        <div className="max-w-md m-auto mt-4">
          <div className="bg-cool-gray-200 w-auto inline-block p-0.5 rounded text-sm">
            <span className="px-2">view</span>
            <select
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value)}
              className="bg-white form-select text-sm overflow-visible p-1 px-2 pr-7"
              style={{ lineHeight: 1, backgroundSize: "1em 1em" }}
            >
              <option value="tree">Tree Editor</option>
              <option value="state">Default Visibility</option>
              <option value="order">Z-Order</option>
            </select>
          </div>
          <Link
            to={`./data/add-data`}
            className="bg-white rounded shadow-sm border-grey-500 border px-2 py-1 text-sm mx-2"
          >
            Add data
          </Link>
          <button
            className="bg-white rounded shadow-sm border-grey-500 border px-2 py-0.5 text-sm mx-2"
            onClick={async () => {
              const folderName = window.prompt("Folder name");
              if (folderName && folderName.length) {
                try {
                  const response = await createFolder({
                    variables: {
                      projectId: projectId!,
                      stableId: generateStableId(),
                      title: folderName,
                    },
                  });
                  // tocQuery.updateQuery((prev) => {

                  //   tocQuery.data!.projectBySlug!.draftTableOfContentsItems!.unshift(
                  //     response.data!.createTableOfContentsItem!
                  //       .tableOfContentsItem!
                  //   );
                  //   return {
                  //     ...tocQuery.data,
                  //   };
                  // });
                  // TODO: make this a bit more efficient. Right now the whole
                  // list has to be refreshed along with data layers and sources
                  tocQuery.refetch();
                } catch (e) {
                  alert(e.message);
                }
              }
            }}
          >
            Add folder
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-scroll p-4 pt-16" onContextMenu={(e) => e.preventDefault()}>
        {tocQuery.loading && <Spinner />}
        <TableOfContents hideExpandAll={true} onMoveNode={async (data) => {
          // let 
          const newParentId = data.nextParentNode?.id;
          let children: number[];
          if (data.nextParentNode && data.nextParentNode.children && Array.isArray(data.nextParentNode.children)) {
            children = data.nextParentNode.children.map((item) => item.id);
          } else {
            children = data.treeData.map((item) => item.id);
          }
          // console.log('newParentStableId', newParentStableId, 'was', data.node.parentStableId);
          await updateChildrenMutation({
            variables: {
              id: newParentId,
              childIds: children
            }
          });

        }} canDrag={true} onChange={(e) => setTreeItems(e)} nodes={treeItems} contextMenuId="layers-toc-editor" contextMenuItems={[
          <Item key="zoom-to" hidden={(args) => {
            return args.props.item.isFolder || !args.props.item.bounds
          }} className="text-sm hover:bg-primary-500" onClick={(args) => {
            const bounds = args.props.item.bounds.map((coord: string) => parseFloat(coord));
            manager?.map?.fitBounds(bounds, {
              padding: 40
            })
          }}>Zoom To</Item>,
          <Item key="1" className="text-sm">Edit</Item>,
          <Item key="2" className="text-sm" onClick={(args) => {
            setItemForDeletion(args.props.item);
          }}>Delete</Item>
        ]} />
        <DeleteTableOfContentsItemModal item={itemForDeletion} onRequestClose={() => setItemForDeletion(undefined)} onDelete={async () => await tocQuery.refetch()} />
      </div>
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
  > & { dataLayerId?: number | string | null })[]
) {
  const output: ClientTableOfContentsItem[] = [];
  const lookup: { [stableId: string]: ClientTableOfContentsItem } = {};
  for (const item of items) {
    lookup[item.stableId] = {
      ...item,
      ...(item.isFolder ? { children: [], expanded: false } : {}),
    };
  }
  console.log(Object.values(lookup).map((item) => ({title: item.title, sortIndex: item.sortIndex})));
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

function bySortIndexAndId(a: ClientTableOfContentsItem, b: ClientTableOfContentsItem): number {
  // return (a.sortIndex)
  const sortIndexA = a.sortIndex || 0;
  const sortIndexB = b.sortIndex || 0;
  return sortIndexA - sortIndexB;
}