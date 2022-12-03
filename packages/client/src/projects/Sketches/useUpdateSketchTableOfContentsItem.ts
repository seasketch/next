import { useCallback } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  useUpdateSketchFolderParentMutation,
  useUpdateSketchParentMutation,
} from "../../generated/graphql";

export default function useUpdateSketchTableOfContentsDraggable() {
  const onError = useGlobalErrorHandler();
  const [mutateFolder] = useUpdateSketchFolderParentMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateSketchFolder: {
          __typename: "UpdateSketchFolderPayload",
          sketchFolder: {
            __typename: "SketchFolder",
            id: data.id,
            folderId: data.folderId,
            collectionId: data.collectionId,
          },
        },
      };
    },
  });
  const [mutateSketch] = useUpdateSketchParentMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateSketchParent: {
          __typename: "UpdateSketchParentPayload",
          sketch: {
            __typename: "Sketch",
            id: data.id,
            folderId: data.folderId,
            collectionId: data.collectionId,
          },
        },
      };
    },
  });

  const dropFolder = useCallback(
    (
      id: number,
      patch: { folderId?: number | null; collectionId?: number | null }
    ) => {
      return mutateFolder({
        variables: {
          id: id,
          folderId: patch.folderId,
          collectionId: patch.collectionId,
        },
      });
    },
    [mutateFolder]
  );

  const dropSketch = useCallback(
    (
      id: number,
      patch: { folderId?: number | null; collectionId?: number | null }
    ) => {
      return mutateSketch({
        variables: {
          id: id,
          folderId: patch.folderId,
          collectionId: patch.collectionId,
        },
      });
    },
    [mutateSketch]
  );

  return { dropFolder, dropSketch };
}
