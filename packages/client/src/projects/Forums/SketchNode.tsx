/* eslint-disable i18next/no-literal-string */
import { useCallback, useEffect, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Spinner from "../../components/Spinner";
import TreeView, { TreeNodeProps } from "../../components/TreeView";
import { SketchTocDetailsFragment } from "../../generated/graphql";
import { SketchFolderDetailsFragment } from "../../generated/queries";
import getSlug from "../../getSlug";
import { myPlansFragmentsToTreeItems } from "../Sketches";
import FolderItem, { isFolderNode } from "../Sketches/FolderItem";
import { TreeItemType } from "../Sketches/SketchingTools";
import SketchItem, { isSketchNode } from "../Sketches/SketchItem";
import useExpandedIds from "../Sketches/useExpandedIds";
import { useReactNodeView } from "./ReactNodeView";

export default function SketchNode() {
  const context = useReactNodeView();
  const treeItems = useMemo(() => {
    const items = myPlansFragmentsToTreeItems(context.node?.attrs.items || []);
    return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
  }, [context.node?.attrs.items]);

  const treeRenderFn = useCallback(
    ({ node, ...props }: TreeNodeProps<TreeItemType>) => {
      if (isFolderNode(node) && props.children) {
        return <FolderItem {...props} node={node} />;
      } else if (isSketchNode(node)) {
        return <SketchItem {...props} node={node} />;
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        return <div>Unimplemented</div>;
      }
    },
    []
  );

  const folders = useMemo(() => {
    return treeItems.filter(
      (i) => i.data.type === "SketchFolder"
    ) as unknown as SketchFolderDetailsFragment[];
  }, [treeItems]);

  const sketches = useMemo(() => {
    return treeItems.filter(
      (i) => i.data.type === "Sketch"
    ) as unknown as SketchTocDetailsFragment[];
  }, [treeItems]);

  const parent = useMemo(() => {
    return treeItems.find(
      (i) => i.data.collectionId === null && i.data.folderId === null
    )!;
  }, [treeItems]);

  const { expandedIds, onExpand } = useExpandedIds(
    getSlug(),
    folders,
    sketches,
    `expanded-my-plans-ids-${getSlug()}-forum-${parent.id}`,
    true
  );

  // console.log(treeItems);
  return (
    <div className="text-sm -ml-6">
      <DndProvider backend={HTML5Backend}>
        {/* <Spinner mini /> */}
        {/* {title} */}
        <TreeView
          items={treeItems}
          ariaLabel="Table of Contents"
          render={treeRenderFn}
          expanded={expandedIds}
          onExpand={onExpand}
        />
      </DndProvider>
    </div>
  );
}
