import React, { useMemo } from "react";
import {
  useGetMetadataQuery,
  useUpdateMetadataMutation,
} from "../../generated/graphql";
import MetadataEditor from "../MetadataEditor";
import { esriRestUrlFromMetadataItem } from "../../dataLayers/esriRestUrl";
import useCurrentLang from "../../useCurrentLang";

interface TableOfContentsMetadataEditorProps {
  onRequestClose?: () => void;
  id: number;
}

export default function TableOfContentsMetadataEditor({
  onRequestClose,
  id,
}: TableOfContentsMetadataEditorProps) {
  const lang = useCurrentLang();
  const { data, error, loading } = useGetMetadataQuery({
    variables: {
      itemId: id,
      lang: lang.code,
    },
  });
  const [mutation, mutationState] = useUpdateMetadataMutation();
  const esriRestUrl = useMemo(
    () => esriRestUrlFromMetadataItem(data?.tableOfContentsItemByIdentifier),
    [data?.tableOfContentsItemByIdentifier]
  );

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
      esriRestUrl={esriRestUrl}
      itemId={id}
      hideArcGisRestLink={Boolean(
        data?.tableOfContentsItemByIdentifier?.hideArcGisRestLink
      )}
    />
  );
}
