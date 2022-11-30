/* eslint-disable i18next/no-literal-string */
import { TreeItemI } from "../../components/TreeView";
import {
  SketchFolderDetailsFragment,
  SketchGeometryType,
  SketchTocDetailsFragment,
} from "../../generated/graphql";
import { FolderNodeDataProps } from "./FolderItem";
import { SketchNodeDataProps } from "./SketchItem";

export function myPlansFragmentsToTreeItems(
  fragments: (SketchTocDetailsFragment | SketchFolderDetailsFragment)[]
) {
  const items: TreeItemI<FolderNodeDataProps | SketchNodeDataProps>[] = [];
  for (const fragment of fragments) {
    items.push({
      id: treeItemIdForFragment(fragment),
      parentId: fragment.folderId
        ? treeItemId(fragment.folderId, "SketchFolder")
        : fragment.collectionId
        ? treeItemId(fragment.collectionId, "Sketch")
        : null,
      // @ts-ignore
      data: {
        id: fragment.id,
        name: fragment.name,
        type: fragment.__typename === "Sketch" ? "Sketch" : "SketchFolder",
        folderId: fragment.folderId,
        collectionId: fragment.collectionId,
        ...(fragment.__typename === "Sketch"
          ? {
              isCollection: Boolean(
                fragment.sketchClass?.geometryType ===
                  SketchGeometryType.Collection
              ),
            }
          : {}),
      },
    });
  }
  return items;
}

export function treeItemIdForFragment(
  fragment: SketchTocDetailsFragment | SketchFolderDetailsFragment
) {
  return treeItemId(fragment.id, fragment.__typename!);
}

export function treeItemId(id: number, typeName: string) {
  return typeName === "SketchFolder" ? `SketchFolder:${id}` : `Sketch:${id}`;
}
