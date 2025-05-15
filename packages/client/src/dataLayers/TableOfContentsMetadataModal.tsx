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
  stableId,
}: {
  id?: number;
  onRequestClose: () => void;
  title?: string;
  stableId?: string;
}) {
  if (!id && !stableId) {
    throw new Error("id or stableId is required");
  }

  const { data, loading, error } = useGetMetadataQuery({
    variables: {
      itemId: id,
      stableId,
    },
    skip: !id && !stableId,
  });

  return (
    <MetadataModal
      document={data?.tableOfContentsItemByIdentifier?.computedMetadata}
      xml={
        data?.tableOfContentsItemByIdentifier?.metadataXml
          ? {
              ...data.tableOfContentsItemByIdentifier.metadataXml,
              format: data?.tableOfContentsItemByIdentifier?.metadataFormat!,
            }
          : undefined
      }
      loading={loading}
      error={error}
      onRequestClose={onRequestClose}
      title={title}
      hostedSourceLastUpdated={
        data?.tableOfContentsItemByIdentifier?.hostedSourceLastUpdated
      }
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
