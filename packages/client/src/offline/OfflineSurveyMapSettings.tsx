import {
  CheckCircleIcon,
  CollectionIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/solid";
import { flatten } from "lodash";
import {
  AnySourceData,
  RasterDemSource,
  RasterSource,
  VectorSource,
} from "mapbox-gl";
import { useEffect, useMemo, useState } from "react";
import { Trans as T } from "react-i18next";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import CenteredCardListLayout, {
  Card,
  Header,
} from "../components/CenteredCardListLayout";
import Spinner from "../components/Spinner";
import {
  BasemapDetailsFragment,
  useOfflineSurveyMapsQuery,
  OfflineBasemapDetailsFragment,
} from "../generated/graphql";
import {
  OfflineTilePackageDetailsFragment,
  OfflineTilePackageStatus,
} from "../generated/queries";
import getSlug from "../getSlug";
import DataSourceModal from "./DataSourceModal";
import { getSources, useStyleSources } from "./mapboxApiHelpers";
import TilePackageListItem from "./TilePackageListItem";

const Trans = (props: any) => <T ns="admin:offline" {...props} />;

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

  const [sourceModalOpen, setSourceModalOpen] =
    useState<null | RasterSource | VectorSource | RasterDemSource>(null);
  const surveyBasemaps = useMemo(() => {
    const details: {
      basemap: OfflineBasemapDetailsFragment;
      surveys: string[];
    }[] = [];
    for (const survey of data?.projectBySlug?.surveys || []) {
      for (const basemap of survey.basemaps || []) {
        const existing = details.find((d) => d.basemap.id === basemap.id);
        if (existing) {
          if (existing.surveys.indexOf(survey.name) === -1) {
            existing.surveys.push(survey.name);
          }
        } else {
          details.push({
            basemap,
            surveys: [survey.name],
          });
        }
      }
    }
    const detailsBySurveys: {
      surveys: string[];
      id: string;
      basemaps: OfflineBasemapDetailsFragment[];
    }[] = [];
    for (const detail of details) {
      const id = detail.surveys.join("-");
      const existing = detailsBySurveys.find((d) => d.id === id);
      if (existing) {
        existing.basemaps.push(detail.basemap);
      } else {
        detailsBySurveys.push({
          id,
          basemaps: [detail.basemap],
          surveys: detail.surveys,
        });
      }
    }
    for (const detail of detailsBySurveys) {
      detail.basemaps = detail.basemaps.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }
    return detailsBySurveys.sort((a, b) => b.surveys.length - a.surveys.length);
  }, [data?.projectBySlug?.offlineTileSettings, data?.projectBySlug?.surveys]);

  const [dataSources, setDataSources] = useState<
    (RasterSource | RasterDemSource | VectorSource)[]
  >([]);

  useEffect(() => {
    const basemaps: {
      [id: number]: BasemapDetailsFragment & {
        useDefaultOfflineTileSettings: boolean;
      };
    } = {};
    for (const survey of data?.projectBySlug?.surveys || []) {
      for (const basemap of survey.basemaps || []) {
        if (basemap.isOfflineEnabled) {
          basemaps[basemap.id] = basemap;
        }
      }
    }
    Promise.all(
      Object.values(basemaps).map(({ url }) =>
        getSources(
          url,
          data!.projectBySlug!.mapboxPublicKey ||
            process.env.REACT_APP_MAPBOX_ACCESS_TOKEN
        )
      )
    ).then((sources) => {
      const flattenedSources = flatten(sources);
      const uniqueSources: {
        [url: string]: RasterSource | RasterDemSource | VectorSource;
      } = {};
      for (const source of flattenedSources) {
        const url = urlForSource(source);
        if (
          url &&
          (source.type === "raster" ||
            source.type === "raster-dem" ||
            source.type === "vector")
        ) {
          uniqueSources[url] = source;
        }
      }
      setDataSources(Object.values(uniqueSources));
    });
  }, [data]);

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
            <Trans>Survey Maps</Trans>
          </Header>
          <p className="text-sm text-gray-500 py-2">
            <Trans>
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
                    <Trans>Used in </Trans>
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
                        tilePackages={
                          data?.projectBySlug?.offlineTilePackagesConnection
                            .nodes || []
                        }
                        onSourceClick={(source) => setSourceModalOpen(source)}
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
              <Trans>Tile Packages</Trans>
            </Header>
            <p className="text-sm text-gray-500 py-2">
              <Trans>
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
  tilePackages,
  onSourceClick,
}: {
  map: OfflineBasemapDetailsFragment;
  mapboxApiKey: string;
  defaultTilingSettings: { maxZ: number; maxShorelineZ: number };
  tilePackages: OfflineTilePackageDetailsFragment[];
  onSourceClick: (
    source: RasterSource | RasterDemSource | VectorSource
  ) => void;
}) {
  const { sources, loading, error } = useStyleSources(map.url, mapboxApiKey);
  const tilingSettings = !map.useDefaultOfflineTileSettings
    ? map.offlineTileSettings[0] || defaultTilingSettings
    : defaultTilingSettings;

  const annotatedSources = useMemo(() => {
    const annotated = [];
    if (sources) {
      for (const source of sources) {
        const url = urlForSource(source)!;
        const pkg = tilePackages.find((p) => p.dataSourceUrl === url);
        annotated.push({
          ...source,
          tilePackage: pkg,
          source: source,
          status: pkg ? "match" : "missing",
        });
      }
    }
    return annotated;
  }, [sources, tilePackages]);

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
              <Trans>Default tiling settings </Trans>
            ) : (
              <Trans>Custom tiling settings </Trans>
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
              <Trans>configure</Trans>
            </Link>
          </p>
          <div>
            {loading && <Spinner />}
            {error}
            {annotatedSources &&
              (isMapboxHosted ? (
                <div className="text-sm">
                  <h5 className="text-sm text-gray-500 pb-0.5">
                    <Trans>Source types</Trans>
                  </h5>
                  <div className="text-gray-500 space-x-1 overflow-hidden whitespace-nowrap">
                    {annotatedSources.map((s, i) => (
                      <button
                        key={urlForSource(s.source)}
                        onClick={() =>
                          onSourceClick(
                            s.source as
                              | VectorSource
                              | RasterDemSource
                              | RasterSource
                          )
                        }
                      >
                        <Badge
                          key={s.type + i}
                          variant={
                            s.status === "missing" ? "warning" : "primary"
                          }
                        >
                          {s.status === "complete" && (
                            <CheckCircleIcon className="w-4 h-4 opacity-80 -ml-1.5 mr-0.5" />
                          )}
                          {s.status === "incomplete" && (
                            <ExclamationCircleIcon className="w-4 h-4 opacity-80 -ml-1.5 mr-0.5 text-red-800" />
                          )}
                          {s.status === "missing" && (
                            <ExclamationCircleIcon className="w-4 h-4 opacity-80 -ml-1.5 mr-0.5 text-yellow-700" />
                          )}
                          {s.status === "match" && s.tilePackage && (
                            <MiniPkgIcon status={s.tilePackage.jobStatus!} />
                          )}
                          {s.type}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm">
                  <Trans>
                    Only supported for Mapbox-hosted basemaps currently.
                  </Trans>
                </div>
              ))}
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
