import { useCallback } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  SketchChildType,
  UpdateTocItemParentInput,
  useUpdateTocItemsParentMutation,
} from "../../generated/graphql";
import {
  evictReportDependenciesForSketchId,
  evictReportDependenciesForUpdatedCollectionSketch,
} from "../../reports/utils/evictReportDependenciesCache";

export default function useUpdateSketchTableOfContentsDraggable() {
  const onError = useGlobalErrorHandler();
  const [mutate] = useUpdateTocItemsParentMutation({
    onError,
    update: (cache, { data }) => {
      const result = data?.updateSketchTocItemParent;
      if (!result) {
        return;
      }
      for (const collection of result.updatedCollections ?? []) {
        if (
          collection !== null &&
          typeof collection === "object" &&
          collection.id !== undefined &&
          collection.id !== null
        ) {
          // Defensive typing to match evictReportDependenciesForUpdatedCollectionSketch expectations
          evictReportDependenciesForUpdatedCollectionSketch(cache, {
            id: collection.id,
            sketchClass: collection.sketchClass
              ? { reportId: collection.sketchClass.reportId }
              : undefined,
            // Add other required fields if evictReportDependenciesForUpdatedCollectionSketch signature changes
          });
        }
      }
      for (const sketch of result.sketches ?? []) {
        if (
          sketch !== null &&
          typeof sketch === "object" &&
          sketch.id !== undefined &&
          sketch.id !== null
        ) {
          evictReportDependenciesForSketchId(cache, sketch.id);
        }
      }
    },
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateSketchTocItemParent: {
          __typename: "UpdateSketchTocItemParentResults",
          folders: ((data.tocItems as UpdateTocItemParentInput[] | null) || [])
            .filter((i) => i.type === SketchChildType.SketchFolder)
            .map((i) => ({
              __typename: "SketchFolder",
              id: i.id,
              folderId: data.folderId,
              collectionId: data.collectionId,
            })),
          sketches: ((data.tocItems as UpdateTocItemParentInput[] | null) || [])
            .filter((i) => i.type === SketchChildType.Sketch)
            .map((i) => ({
              __typename: "Sketch",
              id: i.id,
              updatedAt: new Date().toString(),
              folderId: data.folderId,
              collectionId: data.collectionId,
            })),
          updatedCollections: [],
        },
      };
    },
  });

  const dropFolder = useCallback(
    (
      id: number,
      patch: { folderId?: number | null; collectionId?: number | null }
    ) => {
      return mutate({
        variables: {
          tocItems: [
            {
              id: id,
              type: SketchChildType.SketchFolder,
            },
          ],
          ...patch,
        },
      });
    },
    [mutate]
  );

  const dropSketch = useCallback(
    (
      id: number,
      patch: { folderId?: number | null; collectionId?: number | null }
    ) => {
      return mutate({
        variables: {
          tocItems: [
            {
              id: id,
              type: SketchChildType.Sketch,
            },
          ],
          ...patch,
        },
      });
    },
    [mutate]
  );

  return { dropFolder, dropSketch };
}
