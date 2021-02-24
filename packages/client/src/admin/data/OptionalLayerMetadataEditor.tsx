import React from "react";
import {
  useGetOptionalBasemapLayerMetadataQuery,
  useUpdateOptionalBasemapLayerMetadataMutation,
} from "../../generated/graphql";
import MetadataEditor from "../MetadataEditor";

interface OptionalLayerMetadataEditorProps {
  onRequestClose?: () => void;
  id: number;
}

export default function OptionalLayerMetadataEditor({
  onRequestClose,
  id,
}: OptionalLayerMetadataEditorProps) {
  const { data, error, loading } = useGetOptionalBasemapLayerMetadataQuery({
    variables: {
      id,
    },
  });
  const [
    mutation,
    mutationState,
  ] = useUpdateOptionalBasemapLayerMetadataMutation();
  return (
    <MetadataEditor
      onRequestClose={onRequestClose}
      mutation={(value) =>
        mutation({
          variables: {
            id,
            metadata: value,
          },
        })
      }
      mutationState={mutationState}
      loading={loading}
      error={error}
      startingDocument={data?.optionalBasemapLayer?.metadata}
    />
  );
}
