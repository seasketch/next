import { createContext, useMemo, useState } from "react";
import { useGetMetadataQuery } from "../generated/graphql";
import MetadataModal from "./MetadataModal";
import { esriRestUrlFromMetadataItem } from "./esriRestUrl";
import { localizedCkanDatasetUrl } from "./CkanSourceFooter";
import useCurrentLang from "../useCurrentLang";

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

  const lang = useCurrentLang();
  const { data, loading, error } = useGetMetadataQuery({
    variables: {
      itemId: id,
      stableId,
      lang: lang.code,
    },
    skip: !id && !stableId,
  });

  const esriRestUrl = useMemo(
    () => esriRestUrlFromMetadataItem(data?.tableOfContentsItemByIdentifier),
    [data?.tableOfContentsItemByIdentifier]
  );
  const hideArcGisRestLink = Boolean(
    data?.tableOfContentsItemByIdentifier?.hideArcGisRestLink
  );

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
      esriRestUrl={hideArcGisRestLink ? null : esriRestUrl}
      ckanDatasetUrl={
        data?.tableOfContentsItemByIdentifier?.ckanDatasetUrl
          ? localizedCkanDatasetUrl(
              data.tableOfContentsItemByIdentifier.ckanDatasetUrl,
              lang.code
            )
          : null
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
