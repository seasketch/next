/* eslint-disable i18next/no-literal-string */
import { gql, useApolloClient } from "@apollo/client";
import { useCallback, useContext, useEffect, useMemo } from "react";
import TreeView, { TreeItem } from "../../components/TreeView";
import {
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
} from "../../generated/graphql";
import { myPlansFragmentsToTreeItems } from "../Sketches";
import { SketchUIStateContext } from "../Sketches/SketchUIStateContextProvider";

export default function ForumTreeView(props: {
  items: (SketchTocDetailsFragment | SketchFolderDetailsFragment)[];
  timestamp?: string;
}) {
  const client = useApolloClient();

  const {
    expandedIds,
    onExpand,
    selectedIds,
    clearSelection,
    onSelect,
    visibleSketches,
    onChecked,
    updateFromCache,
    getMenuOptions,
  } = useContext(SketchUIStateContext);

  const treeItems = useMemo(() => {
    const items = myPlansFragmentsToTreeItems(props.items);
    return items.sort((a, b) => a.title.localeCompare(b.title));
  }, [props.items]);

  useEffect(() => {
    // Sketches displayed to the map need to be in Apollo Cache.
    if (props.items.length) {
      for (const item of props.items) {
        if (item.__typename === "Sketch") {
          client.cache.writeFragment({
            id: `Sketch:${item.id}`,
            data: {
              __typename: "Sketch",
              ...item,
              timestamp: props.timestamp || new Date().getTime(),
              sharedInForum: true,
            },
            fragment: gql`
              fragment MySketch on Sketch {
                name
                isCollection
                collectionId
                folderId
                timestamp
                sharedInForum
                sketchClassId
                bbox
              }
            `,
          });
        } else if (item.__typename === "SketchFolder") {
          client.cache.writeFragment({
            id: `SketchFolder:${item.id}`,
            data: {
              __typename: "SketchFolder",
              ...item,
              sharedInForum: true,
            },
            fragment: gql`
              fragment MyFolder on SketchFolder {
                name
                collectionId
                folderId
                sharedInForum
              }
            `,
          });
        }
      }
      updateFromCache();
      return () => {
        for (const item of treeItems) {
          if (item.type === "Sketch") {
            client.cache.evict({
              id: item.id,
            });
          }
        }
        updateFromCache();
      };
    }
    // They also need to be removed when the component is removed.
  }, [treeItems, client.cache, updateFromCache, props.items, props.timestamp]);

  const getContextMenuItems = useCallback(
    (item: TreeItem) => {
      if (item) {
        return getMenuOptions(
          [item.id],
          item.type === "Sketch"
            ? { sketch: true, folder: false, collection: !item.isLeaf }
            : { sketch: false, folder: true, collection: false },
          item.bbox
        ).contextMenu;
      } else {
        return [];
      }
    },
    [getMenuOptions]
  );

  return (
    <div className={`text-sm -ml-6`}>
      <TreeView
        items={treeItems}
        ariaLabel="Table of Contents"
        expanded={expandedIds}
        onExpand={onExpand}
        checkedItems={visibleSketches}
        onChecked={onChecked}
        disableEditing={true}
        selection={selectedIds}
        onSelect={onSelect}
        clearSelection={clearSelection}
        getContextMenuItems={getContextMenuItems}
      />
    </div>
  );
}
