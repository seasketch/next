import { createContext, useState } from "react";
import { useGetMetadataQuery } from "../generated/graphql";
import MetadataModal from "./MetadataModal";

export const TableOfContentsMetadataModalContext = createContext<{
  id?: number;
  onRequestClose: () => void;
  open: (id: number) => void;
}>({
  onRequestClose: () => {},
  open: () => {},
});

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
    skip: !id,
  });

  return (
    <MetadataModal
      document={data?.tableOfContentsItem?.computedMetadata}
      loading={loading}
      error={error}
      onRequestClose={onRequestClose}
    />
  );
}

export function TableOfContentsMetadataModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [id, setId] = useState<number>();

  return (
    <TableOfContentsMetadataModalContext.Provider
      value={{
        id,
        onRequestClose: () => {
          setId(undefined);
        },
        open: (id: number) => {
          setId(id);
        },
      }}
    >
      {children}
      {id && (
        <TableOfContentsMetadataModal
          id={id}
          onRequestClose={() => setId(undefined)}
        />
      )}
    </TableOfContentsMetadataModalContext.Provider>
  );
}
