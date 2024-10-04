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
        data?.tableOfContentsItem?.usesDynamicMetadata
      )}
      dynamicMetadataAvailable={
        data?.tableOfContentsItem?.isCustomGlSource || false
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
      startingDocument={data?.tableOfContentsItem?.computedMetadata}
      xml={
        data?.tableOfContentsItem?.metadataXml
          ? {
              ...data.tableOfContentsItem.metadataXml,
              format: data.tableOfContentsItem.metadataFormat!,
            }
          : undefined
      }
    />
  );
}
