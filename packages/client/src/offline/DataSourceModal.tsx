import bytes from "bytes";
import { useState, useEffect, useMemo } from "react";
import { Trans } from "react-i18next";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import ModalDeprecated from "../components/ModalDeprecated";
import Spinner from "../components/Spinner";
import Warning from "../components/Warning";
import {
  useOfflineSurveyMapsQuery,
  OfflineBasemapDetailsFragment,
  OfflineTileSettingsForCalculationFragment,
  useGenerateOfflineTilePackageMutation,
  OfflineSourceDetails,
} from "../generated/graphql";
import getSlug from "../getSlug";
import { defaultOfflineTilingSettings } from "./BasemapOfflineSettings";
import TilePackageListItem from "./TilePackageListItem";
import worker from "../TileCalculator";
import { cleanCoords } from "../workers/utils";
import splitGeojson from "geojson-antimeridian-cut";
import { Feature, Polygon } from "geojson";

export default function DataSourceModal({
  source,
  onRequestClose,
}: {
  source: Pick<OfflineSourceDetails, "dataSourceUrl" | "templateUrl" | "type">;
  onRequestClose: (update?: boolean) => void;
}) {
  const { data, loading, refetch } = useOfflineSurveyMapsQuery({
    variables: {
      slug: getSlug(),
    },
  });
  const [matchingMaps, setMatchingMaps] = useState<
    OfflineBasemapDetailsFragment[]
  >([]);
  const [stats, setStats] = useState<{
    calculating: boolean;
    tiles?: number;
    bytes?: number;
    error?: string;
  }>({ calculating: true });

  const sourceUrl = source.dataSourceUrl;
  useEffect(() => {
    if (data) {
      (async () => {
        const maps: OfflineBasemapDetailsFragment[] = [];
        for (const survey of data?.projectBySlug?.surveys || []) {
          for (const map of survey.basemaps || []) {
            if (
              map.offlineSupportInformation?.sources.find(
                (s) => s.dataSourceUrl === sourceUrl
              )
            ) {
              if (!maps.find((m) => m.id === map.id)) {
                maps.push(map);
              }
            }
          }
        }
        setMatchingMaps(maps);
      })();
    } else {
      setMatchingMaps([]);
    }
  }, [data, source, sourceUrl]);

  const tilePackages = useMemo(() => {
    return (
      data?.projectBySlug?.offlineTilePackagesConnection.nodes || []
    ).filter((pkg) => pkg.dataSourceUrl === sourceUrl);
  }, [data?.projectBySlug?.offlineTilePackagesConnection.nodes, sourceUrl]);

  const calculatedTilingSettings = useMemo(() => {
    const settings: OfflineTileSettingsForCalculationFragment[] = [];
    if (data?.projectBySlug) {
      const defaultSettings =
        data?.projectBySlug?.offlineTileSettings.find((s) => !s.basemapId) ||
        defaultOfflineTilingSettings;
      for (const map of matchingMaps) {
        settings.push(
          map.useDefaultOfflineTileSettings
            ? defaultSettings
            : map.offlineTileSettings[0] || defaultSettings
        );
      }
    }
    return calculateRequiredTilingSettings(settings);
  }, [data?.projectBySlug, matchingMaps]);

  useEffect(() => {
    if (
      data?.projectBySlug?.region.geojson &&
      (!stats.calculating || !stats.tiles)
    ) {
      worker
        .countChildTiles({
          maxShorelineZ: calculatedTilingSettings.maxShorelineZ,
          maxZ: calculatedTilingSettings.maxZ,
          levelOfDetail: 1,
          region: splitGeojson(
            cleanCoords(data.projectBySlug.region.geojson) as Feature<Polygon>
          ),
        })
        .then((tiles) => {
          setStats({
            calculating: false,
            tiles,
            bytes: tiles * 40000,
          });
        })
        .catch((e) => {
          setStats({
            calculating: false,
            tiles: 0,
            bytes: 0,
            error: e.toString(),
          });
        });
    }
  }, [source, data?.projectBySlug, calculatedTilingSettings]);

  const [generate, generateState] = useGenerateOfflineTilePackageMutation();
  return (
    <ModalDeprecated
      loading={loading || !matchingMaps}
      open={true}
      onRequestClose={onRequestClose}
      footer={
        <>
          <Button onClick={onRequestClose} label={<Trans>Close</Trans>} />
          <Button
            onClick={() => {
              generate({
                variables: {
                  dataSourceUrl: sourceUrl!,
                  maxZ: calculatedTilingSettings.maxZ,
                  maxShorelineZ: calculatedTilingSettings.maxShorelineZ,
                  projectId: data!.projectBySlug!.id,
                  sourceType: source.type,
                  originalUrlTemplate: source.templateUrl,
                },
              }).then(() => {
                refetch();
                // onRequestClose(true);
              });
            }}
            disabled={generateState.loading}
            loading={generateState.loading}
            primary
            label={<Trans>Generate Tile Package</Trans>}
          />
        </>
      }
    >
      <div className="w-144">
        <h2 className="truncate font-mono p-1">{source.dataSourceUrl}</h2>
        {tilePackages.length === 0 && (
          <Warning>
            <Trans>
              No Tile Packages found. Related maps cannot be used offline until
              created.{" "}
              <b>Generating tile packages may incure fees from MapBox</b>
            </Trans>
          </Warning>
        )}
        <div className="p-2 rounded bg-gray-50 my-2">
          <h3 className="text-xs mb-2 uppercase font-semibold text-gray-500">
            <Trans>Used in</Trans>
          </h3>
          {matchingMaps!.map((map) => {
            const tileSettings =
              (!map.useDefaultOfflineTileSettings &&
              map.offlineTileSettings?.length
                ? map.offlineTileSettings[0]
                : data!.projectBySlug!.offlineTileSettings.find(
                    (s) => !s.basemapId
                  )) || defaultOfflineTilingSettings;
            return (
              <Link
                key={`basemap-${map.id}`}
                to={`./offline/basemap/${
                  map.id
                }?returnToUrl=${encodeURIComponent(window.location.pathname)}`}
              >
                <div
                  className="inline-flex mr-2 w-16 h-16 rounded bg-contain text-center items-center justify-center text-white"
                  style={{
                    backgroundImage: `url("${map.thumbnail}")`,
                    textShadow: "0.5px 0.15px 5px black",
                  }}
                >
                  <span className="font-semibold">
                    {/* @ts-ignore */}
                    {tileSettingsLabel(tileSettings)}
                  </span>
                </div>
              </Link>
            );
          })}
          <h3 className="text-xs mb-2 mt-4 uppercase font-semibold text-gray-500">
            <Trans>Required tiling settings</Trans>
          </h3>
          <div className="flex items-center">
            <h4 className="flex-1">
              <Trans>Zoom levels</Trans>
            </h4>
            <span>{tileSettingsLabel(calculatedTilingSettings)}</span>
          </div>
          <div className="flex items-center">
            <h4 className="flex-1">
              <Trans>Calculated Tile Count</Trans>
            </h4>
            <span>
              {stats.calculating ? <Spinner /> : stats.tiles!.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center">
            <h4 className="flex-1">
              <Trans>Estimated tile package size</Trans>
            </h4>
            <span>{stats.calculating ? <Spinner /> : bytes(stats.bytes!)}</span>
          </div>
          <div className="flex items-center">
            <h4 className="flex-1">
              <Trans>MapBox fees to generate package (w/o free tier)</Trans>
            </h4>
            <span>
              {stats.calculating ? (
                <Spinner />
              ) : (
                `$${Math.round((stats.tiles! / 1000) * 0.25 * 100) / 100}`
              )}
            </span>
          </div>
        </div>
        {stats.error && (
          <Warning level="error">{stats.error.toString()}</Warning>
        )}
        {tilePackages.length > 0 && (
          <div className="mt-2">
            <h2 className="text-base">
              <Trans>Tile Packages</Trans>
            </h2>
            <p className="text-sm text-gray-500">
              <Trans>
                The tile package below will be made available for download to
                users who need to use these maps offline. Make sure the maximum
                zoom level supported by the existing tile package meets your
                needs. If not you can generate a new one which will replace it
                when finished.
              </Trans>
            </p>
            {tilePackages.map((pkg) => (
              <TilePackageListItem key={pkg.id} pkg={pkg} />
            ))}
          </div>
        )}
      </div>
    </ModalDeprecated>
  );
}

const calculateRequiredTilingSettings = (
  settings: OfflineTileSettingsForCalculationFragment[]
) => {
  let maxZ = 6;
  let maxShorelineZ: number | undefined = undefined;
  for (const setting of settings) {
    if (setting.maxZ > maxZ) {
      maxZ = setting.maxZ;
    }
    if (setting.maxShorelineZ && setting.maxShorelineZ > maxZ) {
      if (!maxShorelineZ || setting.maxShorelineZ > maxShorelineZ) {
        maxShorelineZ = setting.maxShorelineZ;
      }
    }
  }
  return {
    maxZ,
    maxShorelineZ,
  };
};

const tileSettingsLabel = ({
  maxZ,
  maxShorelineZ,
}: {
  maxZ: number;
  maxShorelineZ?: number;
  // eslint-disable-next-line i18next/no-literal-string
}) => `z${maxZ}${maxShorelineZ && `-${maxShorelineZ}`}`;
