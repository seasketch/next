import React from "react";
import {
  useGetMetadataQuery,
  useUpdateMetadataMutation,
} from "../../generated/graphql";
import MetadataEditor from "../MetadataEditor";

interface TableOfContentsMetadataEditorProps {
  onRequestClose?: () => void;
  id: number;
}

export default function TableOfContentsMetadataEditor({
  onRequestClose,
  id,
}: TableOfContentsMetadataEditorProps) {
  const { data, error, loading } = useGetMetadataQuery({
    variables: {
      itemId: id,
    },
  });
  const [mutation, mutationState] = useUpdateMetadataMutation();

  return (
    <MetadataEditor
      onRequestClose={onRequestClose}
      usingDynamicMetadata={Boolean(
        data?.tableOfContentsItemByIdentifier?.usesDynamicMetadata
      )}
      dynamicMetadataAvailable={
        data?.tableOfContentsItemByIdentifier?.isCustomGlSource || false
      }
      mutation={(value) =>
        mutation({
          variables: {
            itemId: id,
            metadata: value,
          },
        })
      }
      mutationState={mutationState}
      loading={loading}
      error={error}
      startingDocument={data?.tableOfContentsItemByIdentifier?.computedMetadata}
      xml={
        data?.tableOfContentsItemByIdentifier?.metadataXml
          ? {
              ...data.tableOfContentsItemByIdentifier.metadataXml,
              format: data.tableOfContentsItemByIdentifier.metadataFormat!,
            }
          : undefined
      }
    />
  );
}
