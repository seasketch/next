import { createContext, useState } from "react";
import { useGetMetadataQuery } from "../generated/graphql";
import MetadataModal from "./MetadataModal";

export const TableOfContentsMetadataModalContext = createContext<{
  id?: number;
  onRequestClose: () => void;
  open: (id: number, title?: string) => void;
  title?: string;
}>({
  onRequestClose: () => {},
  open: () => {},
});

export default function TableOfContentsMetadataModal({
  id,
  onRequestClose,
  title,
}: {
  id: number;
  onRequestClose: () => void;
  title?: string;
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
      xml={data?.tableOfContentsItem?.metadataXml}
      loading={loading}
      error={error}
      onRequestClose={onRequestClose}
      title={title}
    />
  );
}

export function TableOfContentsMetadataModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [id, setId] = useState<number>();
  const [title, setTitle] = useState<string | undefined>();

  return (
    <TableOfContentsMetadataModalContext.Provider
      value={{
        id,
        onRequestClose: () => {
          setId(undefined);
          setTitle(undefined);
        },
        open: (id: number, title?: string) => {
          setId(id);
          setTitle(title);
        },
      }}
    >
      {children}
      {id && (
        <TableOfContentsMetadataModal
          id={id}
          onRequestClose={() => {
            setId(undefined);
            setTitle(undefined);
          }}
          title={title}
        />
      )}
    </TableOfContentsMetadataModalContext.Provider>
  );
}
