/* eslint-disable i18next/no-literal-string */
import {
  TreeItem,
  treeItemId,
  treeItemIdForFragment,
} from "../../components/TreeView";
import {
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
} from "../../generated/graphql";

export function myPlansFragmentsToTreeItems(
  fragments: (SketchTocDetailsFragment | SketchFolderDetailsFragment)[]
) {
  const items: TreeItem[] = [];
  for (const fragment of fragments) {
    const isLeaf =
      fragment.__typename === "SketchFolder"
        ? false
        : Boolean(fragment.__typename === "Sketch" && !fragment.isCollection);
    items.push({
      id: treeItemIdForFragment(fragment),
      isLeaf,
      parentId: fragment.folderId
        ? treeItemId(fragment.folderId, "SketchFolder")
        : fragment.collectionId
        ? treeItemId(fragment.collectionId, "Sketch")
        : null,
      title: fragment.name,
      type: fragment.__typename!,
      dropAcceptsTypes: isLeaf ? [] : ["SketchFolder", "Sketch"],
      bbox:
        fragment.__typename === "Sketch"
          ? ((fragment.bbox || undefined) as number[])
          : undefined,
    });
  }
  return items;
}
