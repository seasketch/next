/* eslint-disable i18next/no-literal-string */
import { gql, useApolloClient } from "@apollo/client";
import { useContext, useEffect, useMemo, useState } from "react";
import ContextMenuDropdown from "../../components/ContextMenuDropdown";
import TreeView from "../../components/TreeView";
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
    menuOptions,
  } = useContext(SketchUIStateContext);

  const [contextMenu, setContextMenu] = useState<
    | {
        id: string;
        // options: (DropdownOption | DropdownDividerProps)[];
        target: HTMLElement;
        offsetX: number;
      }
    | undefined
  >();

  // Clear the context menu if selection changes
  useEffect(() => {
    setContextMenu((prev) => {
      if (prev && selectedIds.indexOf(prev.id) !== -1) {
        return prev;
      } else {
        return undefined;
      }
    });
  }, [selectedIds]);

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

  return (
    <div className={`text-sm -ml-6`}>
      {contextMenu?.target && Boolean(menuOptions?.contextMenu?.length) && (
        <ContextMenuDropdown
          options={menuOptions?.contextMenu || []}
          target={contextMenu.target}
          offsetX={contextMenu.offsetX}
          onClick={() => {
            setContextMenu(undefined);
          }}
        />
      )}
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
        setContextMenu={setContextMenu}
        contextMenuItemId={contextMenu?.id}
      />
    </div>
  );
}
