import {
  SketchFolderDetailsFragment,
  SketchGeometryType,
  SketchTocDetailsFragment,
} from "../../generated/graphql";
import SortableTree, {
  changeNodeAtPath,
  FullTree,
  NodeData,
  OnMovePreviousAndNextLocation,
  OnVisibilityToggleData,
  TreeIndex,
  TreeNode,
  TreeItem,
} from "react-sortable-tree";
// @ts-ignore
import FileExplorerTheme from "react-sortable-tree-theme-file-explorer";
import "react-sortable-tree/style.css";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import "../../dataLayers/tableOfContents/TableOfContents.css";
import { useTranslation, Trans as I18n } from "react-i18next";
import { FolderIcon, FolderOpenIcon } from "@heroicons/react/solid";
import { useMemo } from "react";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default function SketchTableOfContents({
  sketches,
  folders,
}: {
  sketches: SketchTocDetailsFragment[];
  folders: SketchFolderDetailsFragment[];
}) {
  const { t } = useTranslation();

  const nodes = useMemo(() => {
    const treeItems: TreeItem[] = [];
    const children: (SketchTocDetailsFragment | SketchFolderDetailsFragment)[] =
      [];
    const roots: (SketchTocDetailsFragment | SketchFolderDetailsFragment)[] =
      [];
    for (const item of [...sketches, ...folders]) {
      if (!item.folderId && !item.collectionId) {
        roots.push(item);
      } else {
        children.push(item);
      }
    }
    function addChildren(root: TreeItem) {}
    for (const root of roots) {
      const treeItem: TreeItem = {
        title: root.name,
        expanded: true,
        ...root,
      };
      addChildren(treeItem);
      treeItems.push(treeItem);
    }
    console.log("treeItems", treeItems);
    return treeItems.sort((a, b) =>
      a.title!.toString().localeCompare(b.title!.toString())
    );
  }, [sketches, folders]);

  return (
    <div className="pt-2 -ml-4">
      {/* <ul className="px-2 py-1">
        {folders.map((f) => (
          <li key={f.id}>
            <input type="checkbox" className="mr-2 rounded" />
            <span className="text-sm">{f.name}</span>
          </li>
        ))}
        {sketches.map((s) => (
          <li key={s.id}>
            <input type="checkbox" className="mr-2 rounded" />
            <span className="text-sm">{s.name}</span>
          </li>
        ))}
      </ul> */}
      <SortableTree
        theme={FileExplorerTheme}
        isVirtualized={false}
        treeData={nodes}
        onChange={(treeData) => {}}
        getNodeKey={(data) => data.node.id}
        style={{ height: "auto" }}
        canNodeHaveChildren={(node) =>
          node.__typename === "SketchFolder" ||
          (node.sketchClass?.geometryType &&
            node.sketchClass.geometryType === SketchGeometryType.Collection)
        }
        canDrop={({ node, prevParent, nextParent }) => {
          return false;
        }}
        canDrag={() => true}
        placeholderRenderer={() => <div></div>}
        generateNodeProps={(data) => {
          return {
            title: <span>{data.node.title}</span>,
            className: "text-sm",
            icons: [
              <VisibilityCheckbox
                id={data.node.id}
                disabled={false}
                visibility={false}
              />,
              ...(data.node.__typename === "SketchFolder"
                ? [
                    data.node.expanded ? (
                      <FolderOpenIcon className="w-6 h-6 text-primary-500 mr-1" />
                    ) : (
                      <FolderIcon className="w-6 h-6 text-primary-500 mr-1" />
                    ),
                  ]
                : []),
            ],
          };
        }}
      />
    </div>
  );
}
