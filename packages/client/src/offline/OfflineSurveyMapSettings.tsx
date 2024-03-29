import {
  CheckCircleIcon,
  CollectionIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/solid";
import { AnySourceData } from "mapbox-gl";
import { useMemo, useState } from "react";
import { Trans } from "react-i18next";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import CenteredCardListLayout, {
  Card,
  Header,
} from "../components/CenteredCardListLayout";
import Spinner from "../components/Spinner";
import {
  useOfflineSurveyMapsQuery,
  OfflineBasemapDetailsFragment,
  OfflineSourceDetails,
} from "../generated/graphql";
import { OfflineTilePackageStatus } from "../generated/queries";
import getSlug from "../getSlug";
import DataSourceModal from "./DataSourceModal";
import TilePackageListItem from "./TilePackageListItem";
import useBasemapsBySurvey from "./useBasemapsBySurvey";

export default function OfflineSurveyMapSettings() {
  const slug = getSlug();

  const {
    data,
    loading,
    refetch: refetchData,
  } = useOfflineSurveyMapsQuery({
    variables: {
      slug,
    },
  });

  const [sourceModalOpen, setSourceModalOpen] = useState<null | Pick<
    OfflineSourceDetails,
    "dataSourceUrl" | "templateUrl" | "type"
  >>(null);

  const { surveyBasemaps } = useBasemapsBySurvey();

  const sortedTilePackages = useMemo(() => {
    if (data?.projectBySlug?.offlineTilePackagesConnection.nodes) {
      const nodes = [...data.projectBySlug.offlineTilePackagesConnection.nodes];
      return nodes.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else {
      return [];
    }
  }, [data?.projectBySlug?.offlineTilePackagesConnection.nodes]);

  return (
    <div>
      {sourceModalOpen && (
        <DataSourceModal
          source={sourceModalOpen}
          onRequestClose={(refetch) => {
            setSourceModalOpen(null);
            if (refetch) {
              refetchData();
            }
          }}
        />
      )}
      <CenteredCardListLayout>
        <Card>
          <Header>
            <Trans ns="admin:offline">Survey Maps</Trans>
          </Header>
          <p className="text-sm text-gray-500 py-2">
            <Trans ns="admin:offline">
              Map data used in surveys used offline will need to be downloaded
              on each machine to be used in the field. Online maps may consist
              of millions of tiles and hundreds of gigabytes of data. Using the
              setting below, administrators can specify a subset of the map data
              that is feasible to download for offline use. This feature
              currently support vector and raster tiles hosted on Mapbox.
            </Trans>
          </p>
          {loading ? (
            <div className="flex items-center justify-center w-full py-5">
              <Spinner />
            </div>
          ) : (
            surveyBasemaps.map((details) => {
              return (
                <div key={details.id}>
                  <h4 className="truncate font-semibold text-sm py-4">
                    <Trans ns="admin:offline">Used in </Trans>
                    {details.surveys.join(", ")}
                  </h4>
                  <div className="space-y-4">
                    {details.basemaps.map((map) => (
                      <MapItem
                        mapboxApiKey={
                          data!.projectBySlug!.mapboxPublicKey ||
                          process.env.REACT_APP_MAPBOX_ACCESS_TOKEN
                        }
                        key={map.id}
                        map={map}
                        defaultTilingSettings={
                          (data?.projectBySlug?.offlineTileSettings.find(
                            (s) => !s.basemapId
                          ) as {
                            maxZ: number;
                            maxShorelineZ: number;
                          }) || { maxZ: 11 }
                        }
                        onSourceClick={(source, tp?: any) => {
                          setSourceModalOpen(source);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </Card>
        {sortedTilePackages.length > 0 && (
          <Card>
            <Header>
              <Trans ns="admin:offline">Tile Packages</Trans>
            </Header>
            <p className="text-sm text-gray-500 py-2">
              <Trans ns="admin:offline">
                Tile packages contain map tiles and can be downloaded by
                end-users to populate an offline cache. Tile Package generation
                happens on the SeaSketch servers, so feel free to leave the site
                and come back to check on this process.
              </Trans>
            </p>
            {sortedTilePackages.map((pkg) => (
              <TilePackageListItem key={pkg.id} pkg={pkg} />
            ))}
          </Card>
        )}
      </CenteredCardListLayout>
    </div>
  );
}

function MapItem({
  map,
  mapboxApiKey,
  defaultTilingSettings,
  onSourceClick,
}: {
  map: OfflineBasemapDetailsFragment;
  mapboxApiKey: string;
  defaultTilingSettings: { maxZ: number; maxShorelineZ: number };
  onSourceClick: (
    source: Pick<OfflineSourceDetails, "dataSourceUrl" | "type" | "templateUrl">
  ) => void;
}) {
  const tilingSettings = !map.useDefaultOfflineTileSettings
    ? map.offlineTileSettings[0] || defaultTilingSettings
    : defaultTilingSettings;

  const isMapboxHosted = /mapbox:/.test(map.url);
  return (
    <>
      <div
        className={`flex items-center h-24 ${
          !isMapboxHosted && "opacity-50 pointer-events-none"
        }`}
      >
        <img
          src={map.thumbnail}
          className="w-24 h-24 rounded"
          alt={`${map.name} preview`}
        />
        <div className="px-2 flex-1 h-full">
          <h4 className="text-base truncate">{map.name}</h4>
          <p className="text-sm text-gray-500">
            {map.useDefaultOfflineTileSettings ? (
              <Trans ns="admin:offline">Default tiling settings </Trans>
            ) : (
              <Trans ns="admin:offline">Custom tiling settings </Trans>
            )}
            {
              <span className="font-mono">
                (
                {tilingSettings.maxShorelineZ
                  ? // eslint-disable-next-line i18next/no-literal-string
                    `z${tilingSettings.maxZ}-${tilingSettings.maxShorelineZ}`
                  : // eslint-disable-next-line i18next/no-literal-string
                    `z${tilingSettings.maxZ}`}
                )
              </span>
            }
            <Link
              className="underline mx-2 text-black"
              to={`/${getSlug()}/admin/offline/basemap/${map.id}?returnToUrl=${
                window.location.pathname
              }`}
            >
              <Trans ns="admin:offline">configure</Trans>
            </Link>
          </p>
          <div>
            {map.offlineSupportInformation && isMapboxHosted ? (
              <div className="text-sm">
                <h5 className="text-sm text-gray-500 pb-0.5">
                  <Trans ns="admin:offline">Source types</Trans>
                </h5>
                <div className="text-gray-500 space-x-1 overflow-hidden whitespace-nowrap">
                  {map.offlineSupportInformation.sources.map((source, i) => {
                    const tilePackage = source.tilePackages.length
                      ? source.tilePackages[0]
                      : null;
                    return (
                      <button
                        key={source.dataSourceUrl}
                        onClick={() => {
                          onSourceClick(source);
                        }}
                      >
                        <Badge
                          key={source.dataSourceUrl}
                          variant={!tilePackage ? "warning" : "primary"}
                        >
                          {tilePackage?.jobStatus ===
                            OfflineTilePackageStatus.Complete && (
                            <CheckCircleIcon className="w-4 h-4 opacity-80 -ml-1.5 mr-0.5" />
                          )}
                          {!tilePackage && (
                            <ExclamationCircleIcon className="w-4 h-4 opacity-80 -ml-1.5 mr-0.5 text-yellow-700" />
                          )}
                          {tilePackage?.jobStatus ===
                            OfflineTilePackageStatus.Failed && (
                            <ExclamationCircleIcon className="w-4 h-4 opacity-80 -ml-1.5 mr-0.5 text-red-800" />
                          )}
                          {tilePackage &&
                            tilePackage.jobStatus !==
                              OfflineTilePackageStatus.Complete &&
                            tilePackage.jobStatus !==
                              OfflineTilePackageStatus.Failed && (
                              <MiniPkgIcon status={tilePackage.jobStatus!} />
                            )}
                          {source.type.toLowerCase()}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm">
                <Trans ns="admin:offline">
                  Only supported for Mapbox-hosted basemaps currently.
                </Trans>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MiniPkgIcon({ status }: { status: OfflineTilePackageStatus }) {
  switch (status) {
    case OfflineTilePackageStatus.Complete:
      return <CheckCircleIcon className="w-4 h-4 opacity-80 -ml-1.5 mr-0.5" />;
    case OfflineTilePackageStatus.Generating:
    case OfflineTilePackageStatus.Uploading:
      return <Spinner mini className="opacity-80 -ml-1 mr-1" />;
    case OfflineTilePackageStatus.Queued:
      return <CollectionIcon className="w-4 h-4 opacity-80 -ml-1.5 mr-0.5" />;
    case OfflineTilePackageStatus.Failed:
      return (
        <ExclamationCircleIcon className="w-4 h-4 opacity-80 -ml-1.5 mr-0.5" />
      );
  }
}

export function urlForSource(source: AnySourceData) {
  if (
    source.type === "raster" ||
    source.type === "raster-dem" ||
    source.type === "vector"
  ) {
    const url = source.tiles ? source.tiles[0] : source.url;
    return url;
  } else {
    // can't do anything with that source
  }
}
