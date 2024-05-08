import { Trans } from "react-i18next";
import {
  AdminOverlayFragment,
  DataLayer,
  DataSourceTypes,
  FullAdminSourceFragment,
  SublayerType,
  TableOfContentsItem,
  useUpdateEnableDownloadMutation,
} from "../../generated/graphql";
import Switch from "../../components/Switch";

export default function EnableDataDownload({
  className,
  item,
  layer,
  source,
  projectId,
}: {
  className?: string;
  item: Pick<
    TableOfContentsItem,
    | "id"
    | "hasOriginalSourceUpload"
    | "title"
    | "enableDownload"
    | "primaryDownloadUrl"
  >;
  projectId: number;
  source: FullAdminSourceFragment;
  layer: Pick<DataLayer, "id" | "sublayer" | "sublayerType">;
}) {
  const sourceTypeSupportsDownload =
    source.type === DataSourceTypes.ArcgisVector ||
    (source.type === DataSourceTypes.ArcgisDynamicMapserver &&
      layer.sublayerType === SublayerType.Vector) ||
    source.type === DataSourceTypes.Geojson ||
    source.type === DataSourceTypes.SeasketchMvt ||
    source.type === DataSourceTypes.SeasketchRaster ||
    source.type === DataSourceTypes.SeasketchVector;
  const [mutation, updateEnableDownloadState] = useUpdateEnableDownloadMutation(
    {
      optimisticResponse: (data) => {
        return {
          __typename: "Mutation",
          updateTableOfContentsItem: {
            __typename: "UpdateTableOfContentsItemPayload",
            tableOfContentsItem: {
              __typename: "TableOfContentsItem",
              id: data.id,
              enableDownload: Boolean(data.enableDownload),
              project: {
                __typename: "Project",
                id: projectId,
                downloadableLayersCount: item.enableDownload ? 1 : 0,
                eligableDownloadableLayersCount: item.enableDownload ? 1 : 0,
              },
              primaryDownloadUrl: item.primaryDownloadUrl,
            },
          },
        };
      },
    }
  );

  let isDisabled = false;
  let canBeToggled = true;

  if (!sourceTypeSupportsDownload) {
    return null;
  }

  let description = (
    <Trans ns={["admin"]}>
      If enabled, users will be able to download the original data file uploaded
      to SeaSketch.
    </Trans>
  );

  if (
    source.type === DataSourceTypes.ArcgisVector ||
    source.type === DataSourceTypes.ArcgisDynamicMapserver
  ) {
    description = (
      <Trans ns={["admin"]}>
        If enabled, users will have the ability to download raw feature data as
        a GeoJSON file. SeaSketch will extract vector features from the service
        using the{" "}
        <a
          className="text-primary-500"
          href="https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer-.htm"
          target="_blank"
        >
          ArcGIS REST API query endpoint
        </a>
        . Cached data may be up to 3 hours old. As an admin, you can always{" "}
        <a
          target="_blank"
          className="text-primary-500"
          href={`https://arcgis-export.seasketch.org/?location=${
            source.url +
            (source?.type === DataSourceTypes.ArcgisDynamicMapserver
              ? "/" + layer?.sublayer
              : "")
          }&download=${item.title}`}
        >
          click here to download
        </a>
        .
      </Trans>
    );
  } else if (source.type === DataSourceTypes.Geojson) {
    description = (
      <Trans ns={["admin"]}>
        If enabled, users will be able to download the original data file
        uploaded to SeaSketch.
      </Trans>
    );
  } else if (!item.hasOriginalSourceUpload) {
    isDisabled = true;
    canBeToggled = false;
    <Trans ns={["admin"]}>
      Data download cannot be enabled because the original is not available.
      Older data layers may need to be uploaded again to support this
      capability.
    </Trans>;
  }

  return (
    <div className={`${className}`}>
      <div className="flex">
        <div className={`flex-1 text-sm font-medium text-gray-700`}>
          <Trans ns={["admin"]}>Enable data download</Trans>
        </div>
        <div className="flex-none">
          <Switch
            disabled={isDisabled}
            isToggled={canBeToggled && item.enableDownload}
            onClick={() =>
              mutation({
                variables: {
                  id: item.id,
                  enableDownload: !item.enableDownload,
                },
              })
            }
          />
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}
