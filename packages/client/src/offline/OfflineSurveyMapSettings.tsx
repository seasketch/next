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
import Button from "../components/Button";
import CenteredCardListLayout, {
  Card,
  Header,
} from "../components/CenteredCardListLayout";
import EnabledToggleButton from "../components/EnabledToggleButton";
import Spinner from "../components/Spinner";
import {
  BasemapDetailsFragment,
  useOfflineSurveyMapsQuery,
  useToggleOfflineBasemapSupportMutation,
  useUpdateBasemapMutation,
} from "../generated/graphql";
import getSlug from "../getSlug";
import { getSources, useStyleSources } from "./mapboxApiHelpers";

const Trans = (props: any) => <T ns="admin:offline" {...props} />;

export default function OfflineSurveyMapSettings() {
  const slug = getSlug();
  // eslint-disable-next-line i18next/no-literal-string
  const { data, loading } = useOfflineSurveyMapsQuery({
    variables: {
      slug,
    },
  });

  const surveyBasemaps = useMemo(() => {
    const details: { basemap: BasemapDetailsFragment; surveys: string[] }[] =
      [];
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
      basemaps: BasemapDetailsFragment[];
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
  }, [data]);

  const [dataSources, setDataSources] = useState<
    (RasterSource | RasterDemSource | VectorSource)[]
  >([]);

  useEffect(() => {
    const basemaps: { [id: number]: BasemapDetailsFragment } = {};
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
        if (
          source.type === "raster" ||
          source.type === "raster-dem" ||
          source.type === "vector"
        ) {
          const url = source.tiles ? source.tiles[0] : source.url;
          if (url) {
            uniqueSources[url] = source;
          }
        } else {
          // can't do anything with that source
        }
      }
      setDataSources(Object.values(uniqueSources));
    });
  }, [data]);

  return (
    <div>
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
                  {details.basemaps.map((map) => (
                    <MapItem
                      mapboxApiKey={
                        data!.projectBySlug!.mapboxPublicKey ||
                        process.env.REACT_APP_MAPBOX_ACCESS_TOKEN
                      }
                      key={map.id}
                      map={map}
                    />
                  ))}
                </div>
              );
            })
          )}
        </Card>
        <Card>
          <Header>
            <Trans>Data Sources and Tile Packages</Trans>
          </Header>
          <p className="text-sm text-gray-500 py-2">
            <Trans>
              Based on the selection above and the tiling settings for each
              basemap, SeaSketch identifies the data sources that will need to
              be cached. Note that some basemaps may share data sources which
              can reduce cache sizes.
            </Trans>
          </p>
          <p className="text-sm text-gray-500 pb-2">
            <Trans>
              Each source will need to be turned into a "tile package" before it
              is available for download. These tile packages can be regenerated
              whenever maps are updated, and users can choose when to download
              the new tile package. Tile packages may also be downloaded and
              distributed to authorized users via portable usb drives.
            </Trans>
          </p>
          {dataSources.map((source) => {
            return (
              <div
                className="text-sm truncate"
                title={source.url || source.tiles![0]}
              >
                {source.url || source.tiles![0]}
              </div>
            );
          })}
        </Card>
      </CenteredCardListLayout>
    </div>
  );
}

function MapItem({
  map,
  mapboxApiKey,
}: {
  map: BasemapDetailsFragment;
  mapboxApiKey: string;
}) {
  const { sources, loading, error } = useStyleSources(map.url, mapboxApiKey);
  const [mutate, mutationState] = useToggleOfflineBasemapSupportMutation();

  const isMapboxHosted = /mapbox:/.test(map.url);
  return (
    <div
      className={`flex py-2 items-center h-24 ${
        !isMapboxHosted && "opacity-50 pointer-events-none"
      }`}
    >
      <img
        src={map.thumbnail}
        className="w-20 h-20 rounded"
        alt={`${map.name} preview`}
      />
      <div className="px-2 flex-1 h-full">
        <h4 className="text-base truncate">{map.name}</h4>
        {loading && <Spinner />}
        {error}
        {sources &&
          (isMapboxHosted ? (
            <div className="text-sm">
              <h5 className="text-sm text-gray-500">
                <Trans>Source types</Trans>
              </h5>
              <div className="text-gray-500 space-x-1 overflow-hidden whitespace-nowrap">
                {sources.map((s) => (
                  <Badge>{s.type}</Badge>
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
      {map.isOfflineEnabled && (
        <Link
          className="underline mx-4"
          to={`/${getSlug()}/edit-basemap/${map.id}`}
        >
          <Trans>Tiling Settings</Trans>
        </Link>
      )}

      <EnabledToggleButton
        small
        enabled={map.isOfflineEnabled}
        onClick={() => {
          mutate({
            variables: {
              id: map.id,
              enable: !map.isOfflineEnabled,
            },
            optimisticResponse: (data) => {
              return {
                __typename: "Mutation",
                updateBasemap: {
                  __typename: "UpdateBasemapPayload",
                  basemap: {
                    __typename: "Basemap",
                    id: data.id,
                    isOfflineEnabled: data.enable,
                  },
                },
              };
            },
          });
        }}
      />
    </div>
  );
}
