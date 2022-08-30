import { useGetMetadataQuery } from "../generated/graphql";
import MetadataModal from "./MetadataModal";

export default function TableOfContentsMetadataModal({
  id,
  onRequestClose,
}: {
  id: number;
  onRequestClose: () => void;
}) {
  const { data, loading, error } = useGetMetadataQuery({
    variables: {
      itemId: id,
    },
  });
  return (
    <MetadataModal
      document={data?.tableOfContentsItem?.metadata}
      loading={loading}
      error={error}
      onRequestClose={onRequestClose}
    />
  );
}
