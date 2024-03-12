import { createContext, useMemo, useState } from "react";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import Modal, { FooterButtonProps } from "../components/Modal";
import { useTranslatedProps } from "../components/TranslatedPropControl";
import {
  DataSourceTypes,
  DataUploadOutputType,
  useDataDownloadInfoQuery,
} from "../generated/graphql";
import bytes from "bytes";
import { Trans, useTranslation } from "react-i18next";

const priority = [
  DataUploadOutputType.ZippedShapefile,
  DataUploadOutputType.GeoJson,
  DataUploadOutputType.GeoTiff,
  DataUploadOutputType.Png,
  DataUploadOutputType.FlatGeobuf,
  DataUploadOutputType.Pmtiles,
];

export const DataDownloadModalContext = createContext<{
  setDataDownloadModal: (tocId: number | undefined) => void;
  dataDownloadModal?: number;
}>({
  setDataDownloadModal: () => {},
});

export default function DataDownloadModal({
  onRequestClose,
  tocId,
}: {
  onRequestClose: () => void;
  tocId: number;
}) {
  const { t } = useTranslation("homepage");
  const onError = useGlobalErrorHandler();
  const { data, loading } = useDataDownloadInfoQuery({
    variables: {
      tocId,
    },
    onError,
  });

  const sortedOptions = useMemo(() => {
    return [...(data?.tableOfContentsItem?.downloadOptions || [])]
      .sort((a, b) => {
        // Get the index of the types in the priority array
        let indexOfA = priority.indexOf(a.type!);
        let indexOfB = priority.indexOf(b.type!);

        // If one of the types is not found in the priority array, we consider its priority lowest
        indexOfA = indexOfA === -1 ? priority.length : indexOfA;
        indexOfB = indexOfB === -1 ? priority.length : indexOfB;

        // Compare the indices to determine order
        if (indexOfA < indexOfB) {
          return -1;
        }
        if (indexOfA > indexOfB) {
          return 1;
        }
        // a must be equal to b
        return 0;
      })
      .filter((option) => !option.isOriginal);
  }, [data?.tableOfContentsItem?.downloadOptions]);

  const getTranslatedProp = useTranslatedProps(data?.tableOfContentsItem);

  const isEsriVectorService = useMemo(() => {
    return (
      data?.tableOfContentsItem?.dataLayer?.dataSource?.type ===
        DataSourceTypes.ArcgisVector ||
      data?.tableOfContentsItem?.dataLayer?.dataSource?.type ===
        DataSourceTypes.ArcgisDynamicMapserver
    );
  }, [data?.tableOfContentsItem?.dataLayer?.dataSource?.type]);

  const type = useMemo(() => {
    return data?.tableOfContentsItem?.dataLayer?.dataSource?.type;
  }, [data?.tableOfContentsItem?.dataLayer?.dataSource?.type]);

  const original = useMemo(() => {
    if (
      data?.tableOfContentsItem?.dataLayer?.dataSource?.type ===
      DataSourceTypes.ArcgisVector
    ) {
      return {
        isOriginal: true,
        size: 0,
        url: data.tableOfContentsItem.primaryDownloadUrl,
        type: DataUploadOutputType.GeoJson,
      };
    }
    return data?.tableOfContentsItem?.downloadOptions?.find(
      (option) => option.isOriginal
    );
  }, [data?.tableOfContentsItem?.downloadOptions]);

  return (
    <Modal
      open
      title={
        <>
          <span>{t("Download")}</span>{" "}
          <span className="">{getTranslatedProp("title")}</span>
        </>
      }
      footer={[
        ...(isEsriVectorService && data?.tableOfContentsItem?.primaryDownloadUrl
          ? [
              {
                label: t("Start Download"),
                onClick: () => {
                  window.open(
                    data!.tableOfContentsItem!.primaryDownloadUrl!,
                    "_blank"
                  );
                  onRequestClose();
                },
                variant: "primary",
              } as FooterButtonProps,
            ]
          : []),
        {
          label: t("Close"),
          onClick: onRequestClose,
        },
      ]}
      onRequestClose={onRequestClose}
      loading={loading}
    >
      <div className="space-y-4">
        {isEsriVectorService && (
          <div className="">
            <p className="text-sm">
              <Trans ns="homepage">
                This data layer is hosted on an ArcGIS vector service. SeaSketch
                will extract vector features from the service and return them to
                you as a GeoJSON file, usable in most modern geospatial
                software. This extract may be up to 3 hours old.
              </Trans>
            </p>
          </div>
        )}
        {type === DataSourceTypes.Geojson &&
          data?.tableOfContentsItem?.primaryDownloadUrl && (
            <div className="">
              <p className="text-sm">
                <Trans ns="homepage">
                  This data source comes from a GeoJSON file on a 3rd party
                  server. Click the link below to download it from the original
                  source.
                </Trans>
              </p>
              <p className="my-4 bg-primary-500 bg-opacity-5 p-2 border rounded">
                <a
                  className="text-primary-500 underline "
                  href={data.tableOfContentsItem.primaryDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data.tableOfContentsItem.primaryDownloadUrl}
                </a>
              </p>
            </div>
          )}
        {!isEsriVectorService &&
          type !== DataSourceTypes.Geojson &&
          original?.url && (
            <div className="shadow-sm p-4 py-2 border rounded">
              <h3>
                {data?.tableOfContentsItem?.dataLayer?.dataSource?.createdAt ? (
                  <span>
                    {t("Original file uploaded on ")}
                    {new Date(
                      data.tableOfContentsItem.dataLayer.dataSource.createdAt
                    ).toLocaleDateString()}
                  </span>
                ) : (
                  t("Original file")
                )}
              </h3>
              <div className="flex">
                <a
                  className="flex-1 text-primary-500 underline"
                  download={
                    data?.tableOfContentsItem?.dataLayer?.dataSource
                      ?.uploadedSourceFilename || "Download..."
                  }
                  href={original.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data?.tableOfContentsItem?.dataLayer?.dataSource
                    ?.uploadedSourceFilename || "Download..."}
                </a>
                <span>{bytes(parseInt(original.size) || 0)}</span>
              </div>
              <div className="py-1">
                <DownloadFormatDescription type={original.type!} />
              </div>
            </div>
          )}
        {sortedOptions.length > 0 && (
          <div>
            <h3>{t("Alternate formats")}</h3>
            <ul className="space-y-2">
              {sortedOptions.map((option) => {
                const filename = new URL(
                  option.url || "https://www.example.com"
                ).pathname
                  .split("/")
                  .pop();
                const downloadFilename = new URL(
                  option.url || "https://www.example.com"
                ).searchParams.get("download");
                return (
                  <li>
                    <div className="flex pr-4">
                      <a
                        className="text-primary-500 underline flex-1"
                        download={filename}
                        href={option.url!}
                      >
                        {downloadFilename || filename}
                      </a>
                      <span>{bytes(parseInt(option.size) || 0)}</span>
                    </div>
                    <DownloadFormatDescription type={option.type!} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function DataDownloadModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dataDownloadModal, setDataDownloadModal] = useState<
    number | undefined
  >();
  return (
    <DataDownloadModalContext.Provider
      value={{ setDataDownloadModal, dataDownloadModal }}
    >
      {dataDownloadModal !== undefined && (
        <DataDownloadModal
          onRequestClose={() => setDataDownloadModal(undefined)}
          tocId={dataDownloadModal}
        />
      )}
      {children}
    </DataDownloadModalContext.Provider>
  );
}

function DownloadFormatDescription({ type }: { type: DataUploadOutputType }) {
  const { t } = useTranslation("homepage");
  return (
    <p className="text-sm">
      {(() => {
        switch (type) {
          case DataUploadOutputType.GeoJson:
            return t(
              "GeoJSON is an uncompressed text format compatible with most spatial software."
            );
          case DataUploadOutputType.GeoTiff:
            return t(
              "GeoTIFF is a public domain metadata standard which allows georeferencing information to be embedded within a TIFF file."
            );
          case DataUploadOutputType.Png:
            return t(
              "PNG is a raster-graphics file-format that supports lossless data compression. It has no spatial metadata encoded within it so is not useful in spatial software."
            );
          case DataUploadOutputType.FlatGeobuf:
            return (
              <Trans ns="homepage">
                <a
                  href="https://flatgeobuf.org/"
                  target="_blank"
                  className="underline"
                >
                  FlatGeobuf
                </a>{" "}
                is a compact binary encoding for geographic data based on
                flatbuffers. It is a relatively new format only compatible with
                recent versions of open-source software.
              </Trans>
            );
          case DataUploadOutputType.Pmtiles:
            return (
              <Trans>
                The{" "}
                <a
                  href="https://github.com/protomaps/PMTiles"
                  target="_blank"
                  className="underline"
                >
                  PMTiles
                </a>{" "}
                format is an archive of all the tiles used to render this layer
                in SeaSketch.
              </Trans>
            );
          case DataUploadOutputType.ZippedShapefile:
            return (
              <Trans ns="homepage">
                <a
                  className="underline"
                  href="https://doc.arcgis.com/en/arcgis-online/reference/shapefiles.htm"
                  target="_blank"
                >
                  Zipped shapefiles
                </a>{" "}
                are a compressed binary format compatible with most software.
              </Trans>
            );
          default:
            return null;
        }
      })()}
    </p>
  );
}
