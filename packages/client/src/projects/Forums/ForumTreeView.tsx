/* eslint-disable i18next/no-literal-string */
import { gql, useApolloClient } from "@apollo/client";
import { useCallback, useContext, useEffect, useMemo } from "react";
import TreeView, { TreeNodeProps } from "../../components/TreeView";
import {
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
} from "../../generated/graphql";
import { myPlansFragmentsToTreeItems } from "../Sketches";
import FolderItem, { isFolderNode } from "../Sketches/FolderItem";
import { TreeItemType } from "../Sketches/SketchingTools";
import SketchItem, { isSketchNode } from "../Sketches/SketchItem";
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
  } = useContext(SketchUIStateContext);

  const treeItems = useMemo(() => {
    const items = myPlansFragmentsToTreeItems(props.items);
    return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
  }, [props.items]);

  useEffect(() => {
    // Sketches displayed to the map need to be in Apollo Cache.
    if (treeItems.length) {
      for (const item of treeItems) {
        if (item.data.type === "Sketch") {
          client.cache.writeFragment({
            id: item.id,
            data: {
              __typename: "Sketch",
              ...item.data,
              timestamp: props.timestamp,
            },
            fragment: gql`
              fragment MySketch on Sketch {
                name
                isCollection
                collectionId
                folderId
                timestamp
              }
            `,
          });
        } else if (item.data.type === "SketchFolder") {
          client.cache.writeFragment({
            id: item.id,
            data: {
              __typename: "SketchFolder",
              ...item.data,
            },
            fragment: gql`
              fragment MyFolder on SketchFolder {
                name
                collectionId
                folderId
              }
            `,
          });
        }
      }
      updateFromCache();
      return () => {
        for (const item of treeItems) {
          if (item.data.type === "Sketch") {
            client.cache.evict({
              id: item.id,
            });
          }
        }
        updateFromCache();
      };
    }
    // They also need to be removed when the component is removed.
  }, [treeItems, client.cache, updateFromCache]);

  const treeRenderFn = useCallback(
    ({ node, ...props }: TreeNodeProps<TreeItemType>) => {
      if (isFolderNode(node) && props.children) {
        return <FolderItem {...props} node={node} />;
      } else if (isSketchNode(node)) {
        return <SketchItem {...props} node={node} />;
      } else {
        return <div>Unimplemented</div>;
      }
    },
    []
  );

  return (
    <div className="text-sm -ml-6">
      <TreeView
        items={treeItems}
        ariaLabel="Table of Contents"
        render={treeRenderFn}
        expanded={expandedIds}
        onExpand={onExpand}
        checkedItems={visibleSketches}
        onChecked={onChecked}
        disableEditing={true}
        selection={selectedIds}
        onSelect={onSelect}
        clearSelection={clearSelection}
      />
    </div>
  );
}
