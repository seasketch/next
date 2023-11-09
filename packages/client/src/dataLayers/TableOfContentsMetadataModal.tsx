import {
  CustomGLSource,
  DataTableOfContentsItem,
} from "@seasketch/mapbox-gl-esri-sources";
import { useGetMetadataQuery } from "../generated/graphql";
import MetadataModal from "./MetadataModal";
import { useEffect, useState } from "react";

export default function TableOfContentsMetadataModal({
  id,
  onRequestClose,
  customGLSource,
  sublayerId,
}: {
  id: number;
  onRequestClose: () => void;
  customGLSource?: CustomGLSource<any>;
  sublayerId?: string;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    metadata: any;
    sourceId?: number;
  }>();
  const { data, loading, error } = useGetMetadataQuery({
    variables: {
      itemId: id,
    },
    skip: !id,
  });

  useEffect(() => {
    if (customGLSource) {
      if (parseInt(customGLSource.sourceId) === state?.sourceId) {
        // do nothing
      } else {
        setState({
          loading: true,
          error: undefined,
          metadata: undefined,
        });
        customGLSource.getComputedMetadata().then((metadata) => {
          let metadataDoc: any;
          if (sublayerId) {
            const item = metadata.tableOfContentsItems.find(
              (item) => item.type === "data" && item.id === sublayerId
            ) as DataTableOfContentsItem | undefined;
            if (item) {
              metadataDoc = item.metadata;
            }
          } else {
            metadataDoc = (
              metadata.tableOfContentsItems[0] as DataTableOfContentsItem
            ).metadata;
          }
          setState({
            loading: false,
            metadata: metadataDoc,
            sourceId: parseInt(customGLSource.sourceId),
          });
        });
      }
    } else {
      setState({
        loading,
        error: error?.message,
        metadata: data?.tableOfContentsItem?.metadata,
        sourceId: id,
      });
    }
  }, [data, loading, error, customGLSource, id, sublayerId, state?.sourceId]);
  return (
    <MetadataModal
      document={state?.metadata}
      loading={loading}
      error={error}
      onRequestClose={onRequestClose}
    />
  );
}
