import { Trans, useTranslation } from "react-i18next";
import {
  DataSourceTypes,
  FullAdminDataLayerFragment,
  FullAdminSourceFragment,
  SublayerType,
} from "../../../generated/graphql";
import {
  SettingsDLListItem,
  SettingsDefinitionList,
} from "../../SettingsDefinitionList";
import InlineAuthor from "../../../components/InlineAuthor";
import HostedLayerInfo from "./HostedLayerInfo";
import ArcGISDynamicMapServiceLayerInfo from "./ArcGISDynamicMapServiceLayerInfo";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { InfoCircledIcon, TableIcon } from "@radix-ui/react-icons";
import GeostatsModal from "../GLStyleEditor/GeostatsModal";
import ArcGISTiledRasterSettings from "../ArcGISTiledRasterSettings";
import ArcGISVectorLayerInfo from "./ArcGISVectorLayerInfo";
import * as Tooltip from "@radix-ui/react-tooltip";
import RemoteVectorLayerInfo from "./RemoteVectorLayerInfo";
import {
  GeostatsLayer,
  RasterInfo,
  SuggestedRasterPresentation,
  isRasterInfo,
} from "@seasketch/geostats-types";
import RasterInfoModal, { RasterInfoHistogram } from "../RasterInfoModal";
import Spinner from "../../../components/Spinner";
import CustomizeTilesModal from "../CustomizeTilesModal";

export default function LayerInfoList({
  source,
  readonly,
  layer,
  children,
  isLatestVersion,
}: {
  source: Pick<
    FullAdminSourceFragment,
    | "type"
    | "authorProfile"
    | "createdAt"
    | "url"
    | "originalSourceUrl"
    | "uploadedSourceFilename"
    | "hostingQuotaUsed"
    | "outputs"
    | "queryParameters"
    | "id"
    | "useDevicePixelRatio"
    | "geostats"
    | "maxzoom"
    | "minzoom"
    | "arcgisFetchStrategy"
    | "dataLibraryMetadata"
  >;
  layer: Pick<
    FullAdminDataLayerFragment,
    "sublayer" | "sublayerType" | "sourceLayer" | "id" | "version"
  >;
  readonly?: boolean;
  children?: ReactNode;
  isLatestVersion: boolean;
}) {
  const { t } = useTranslation("admin:data");
  let profile = source.authorProfile;
  // @ts-ignore
  if (source.uploadedBy === "datalibrary@seasketch.org") {
    profile = {
      userId: -9999,
      email: "support@seasketch.org",
      fullname: "Data Library",
      affiliations:
        "These layers are automatically updated from their original sources",
    };
  }
  const isRemote = isRemoteSource(source.type);
  const geostatsLayer: GeostatsLayer | undefined = useMemo(() => {
    if (!source.geostats) return undefined;
    if (isRasterInfo(source.geostats)) {
      return undefined;
    }
    if (layer.sourceLayer) {
      return (source.geostats.layers || []).find(
        (l: any) => l.layer === layer.sourceLayer
      );
    } else {
      return source.geostats.layers[0];
    }
  }, [source.geostats]);

  const rasterInfo: RasterInfo | undefined = useMemo(() => {
    if (!source.geostats) return undefined;
    if (isRasterInfo(source.geostats)) {
      return source.geostats;
    }
    return undefined;
  }, [source.geostats]);

  const [showColumnModal, setShowColumnModal] = useState(false);
  const [showRasterModal, setShowRasterModal] = useState(false);
  const [showCustomizeTilesModal, setShowCustomizeTilesModal] = useState(false);

  return (
    <>
      <SettingsDefinitionList>
        <SettingsDLListItem
          term={t("Created By")}
          description={
            <>
              <div className="flex space-x-1.5 items-center">
                <span>
                  {profile ? (
                    <InlineAuthor profile={profile} />
                  ) : (
                    <span className="flex items-center">
                      <span>{t("Unknown")}</span>
                      <Tooltip.Provider>
                        <Tooltip.Root delayDuration={10}>
                          <Tooltip.Trigger asChild>
                            <button className="ml-1">
                              <InfoCircledIcon />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              side="right"
                              className="TooltipContent"
                              sideOffset={5}
                            >
                              <div className="text-sm w-64">
                                <h5 className="font-medium">
                                  {t("Unknown Author")}
                                </h5>
                                <p>
                                  {t(
                                    "Prior to May 2024, author information was not collected for all layers."
                                  )}
                                </p>
                              </div>
                              <Tooltip.Arrow className="TooltipArrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    </span>
                  )}
                </span>
                <span
                  className="truncate"
                  title={new Date(source.createdAt).toLocaleString()}
                >
                  <Trans ns="admin:data">
                    on {new Date(source.createdAt).toLocaleString()}
                  </Trans>
                </span>
              </div>
            </>
          }
        />
        <SettingsDLListItem
          term={t("Source Type")}
          description={humanizeSourceType(
            source.type,
            layer?.sublayerType || undefined
          )}
        />
        {isRemote && source.url && (
          <SettingsDLListItem
            term={t("Source Location")}
            description={
              <div className="w-full truncate">
                {/* eslint-disable-next-line react/jsx-no-target-blank */}
                <a
                  title={source.url}
                  className="text-primary-500 underline"
                  href={
                    source.url + (layer.sublayer ? `/${layer.sublayer}` : "")
                  }
                  target="_blank"
                >
                  {source.url}
                  {layer.sublayer ? `/${layer.sublayer}` : ""}
                </a>
              </div>
            }
          />
        )}
        {source.dataLibraryMetadata && (
          <SettingsDLListItem
            term={t("Data Library Metadata")}
            description={
              <div className="w-full truncate">
                <pre>{JSON.stringify(source.dataLibraryMetadata, null, 2)}</pre>
              </div>
            }
          />
        )}
        {(source.type === DataSourceTypes.SeasketchMvt ||
          source.type === DataSourceTypes.SeasketchRaster) && (
          <>
            <SettingsDLListItem
              term={t("Tileset")}
              description={
                <div className="flex space-x-1">
                  <TilesetDetails url={source.url! + ".json"} />
                  {isLatestVersion && (
                    <div className="flex-1 text-center">
                      <button
                        onClick={() => setShowCustomizeTilesModal(true)}
                        className="text-primary-500"
                      >
                        {t("Replace tiles")}
                      </button>
                    </div>
                  )}
                </div>
              }
            />
            {showCustomizeTilesModal && (
              <CustomizeTilesModal
                onRequestClose={() => setShowCustomizeTilesModal(false)}
                source={source}
              />
            )}
          </>
        )}
        {geostatsLayer && (
          <SettingsDLListItem
            term={t("Geometry")}
            description={
              <div className="w-full truncate flex">
                <span className="flex-1 truncate">
                  {geostatsLayer.count.toLocaleString()}{" "}
                  {pluralizeGeometryType(geostatsLayer.geometry)}
                </span>
                <div className="text-right px-1">
                  <button
                    onClick={() => setShowColumnModal(true)}
                    className="hover:shadow-sm text-primary-500 items-center inline-flex border px-2 rounded-full text-xs py-0.5 "
                  >
                    <TableIcon className="inline mr-1" />
                    <span>{t("column detail")}</span>
                  </button>
                </div>
              </div>
            }
          />
        )}
        {rasterInfo && (
          <SettingsDLListItem
            term={t("Raster")}
            description={
              <div className="w-full truncate flex">
                <span>
                  {rasterInfo.bands.length === 1
                    ? t("Single band")
                    : rasterInfo.bands.length + " " + t("bands")}
                </span>
                ,
                <span className="ml-1">
                  {rasterInfo.presentation === SuggestedRasterPresentation.rgb
                    ? rasterInfo.bands.length === 3
                      ? t("RGB")
                      : t("RGBA")
                    : rasterInfo.presentation ===
                      SuggestedRasterPresentation.categorical
                    ? t("categorical")
                    : t("data values")}
                </span>
                <div className="text-right flex-1 px-1">
                  <button
                    onClick={() => setShowRasterModal(true)}
                    className="hover:shadow-sm right-7 text-primary-500 items-center inline-flex border px-2 rounded-full text-xs py-0.5 "
                  >
                    <span>{t("band detail")}</span>
                    {rasterInfo &&
                    rasterInfo.presentation ===
                      SuggestedRasterPresentation.rgb ? (
                      <div className="relative -top-4 w-10 ml-1">
                        {rasterInfo.bands.map((band) => (
                          <RasterInfoHistogram
                            className="top-0 left-0 absolute opacity-70"
                            data={band.stats.histogram}
                            count={band.count}
                            min={band.minimum}
                            max={band.maximum}
                            colorInterpretation={band.colorInterpretation}
                            width={40}
                            height={10}
                          />
                        ))}
                      </div>
                    ) : (
                      <TableIcon className="inline ml-1" />
                    )}
                  </button>
                </div>
              </div>
            }
          />
        )}
        {!isRemote && (
          <HostedLayerInfo
            layerId={layer.id}
            readonly={readonly}
            source={source}
            version={layer.version || 0}
          />
        )}
        {source.type === DataSourceTypes.ArcgisDynamicMapserver && (
          <ArcGISDynamicMapServiceLayerInfo
            source={source}
            layer={layer}
            readonly={readonly}
          />
        )}
        {source.type === DataSourceTypes.ArcgisRasterTiles && (
          <ArcGISTiledRasterSettings
            source={source}
            readonly={readonly}
            hideLocation
            hideType
          />
        )}
        {(source.type === DataSourceTypes.ArcgisVector ||
          source.type ===
            DataSourceTypes.ArcgisDynamicMapserverVectorSublayer) && (
          <ArcGISVectorLayerInfo
            source={source}
            readonly={readonly}
            layer={layer}
          />
        )}
        {source.type === DataSourceTypes.Vector && (
          <RemoteVectorLayerInfo source={source} readonly={readonly} />
        )}
        {children}
      </SettingsDefinitionList>
      {showColumnModal && source.geostats && (
        <GeostatsModal
          geostats={source.geostats}
          onRequestClose={() => setShowColumnModal(false)}
        />
      )}
      {showRasterModal && rasterInfo && (
        <RasterInfoModal
          rasterInfo={rasterInfo}
          onRequestClose={() => setShowRasterModal(false)}
        />
      )}
    </>
  );
}

export function humanizeSourceType(
  type: DataSourceTypes,
  sublayerType?: SublayerType
) {
  switch (type) {
    case DataSourceTypes.ArcgisDynamicMapserver:
      if (sublayerType === SublayerType.Vector) {
        return "ArcGIS Mapserver Sublayer (vector)";
      } else if (sublayerType === SublayerType.Raster) {
        return "ArcGIS Mapserver Sublayer (raster)";
      } else {
        return "ArcGIS Dynamic Mapserver";
      }
    case DataSourceTypes.ArcgisDynamicMapserverVectorSublayer:
      return "ArcGIS Dynamic Mapserver Vector Sublayer";
    case DataSourceTypes.ArcgisDynamicMapserverRasterSublayer:
      return "ArcGIS Dynamic Mapserver Raster";
    case DataSourceTypes.ArcgisVector:
      return "Vector data hosted on ArcGIS Server";
    case DataSourceTypes.ArcgisRasterTiles:
      return "Raster tiles hosted on ArcGIS Server";
    case DataSourceTypes.Geojson:
      return "Remote GeoJSON";
    case DataSourceTypes.Image:
      return "Remote Image";
    case DataSourceTypes.Raster:
      return "Remote Raster Tiles";
    case DataSourceTypes.Vector:
      return "Remote Vector Tiles";
    case DataSourceTypes.RasterDem:
      return "Remote Raster DEM Tiles";
    case DataSourceTypes.SeasketchMvt:
      return "Vector Tiles hosted on SeaSketch";
    case DataSourceTypes.SeasketchRaster:
      return "Raster Tiles hosted on SeaSketch";
    case DataSourceTypes.SeasketchVector:
      return "GeoJSON hosted on SeaSketch";
    case DataSourceTypes.Video:
      return "Remote Video";
    case DataSourceTypes.Inaturalist:
      return "iNaturalist Map Service";
    default:
      return type;
  }
}

export function isRemoteSource(type: DataSourceTypes) {
  return (
    type !== DataSourceTypes.SeasketchMvt &&
    type !== DataSourceTypes.SeasketchRaster &&
    type !== DataSourceTypes.SeasketchVector
  );
}

function pluralizeGeometryType(type: GeostatsLayer["geometry"]) {
  switch (type) {
    case "Point":
      return "points";
    case "LineString":
      return "lines";
    case "Polygon":
      return "polygons";
    case "MultiLineString":
      return "multilines";
    case "MultiPolygon":
      return "multipolygons";
    case "MultiPoint":
      return "multipoints";
    case "GeometryCollection":
      return "geometry collections";
    case "Unknown":
      return "features";
    default:
      return type;
  }
}

function TilesetDetails({ url }: { url: string }) {
  const { t } = useTranslation("admin:data");
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    tilejson: null | {
      vector_layers: {
        id: string;
        description: string;
        fields: {
          name: string;
          type: string;
          description: string;
        }[];
        minzoom: number;
        maxzoom: number;
      }[];
      tiles: string[];
      attribution: string;
      scheme: string;
      bounds: number[];
      center?: number[];
    };
  }>({ loading: true, error: null, tilejson: null });

  useEffect(() => {
    fetch(url)
      .then((res) => res.json())
      .then((tilejson) => {
        setState({ loading: false, error: null, tilejson });
      })
      .catch((error) => {
        setState({ loading: false, error: error.message, tilejson: null });
      });
  }, [url]);
  if (state.loading) {
    return <Spinner />;
  } else if (state.error) {
    return <div>Error: {state.error}</div>;
  } else if (!state.tilejson) {
    return <div>{t("No tilejson found")}</div>;
  } else if (
    "vector_layers" in state.tilejson &&
    state.tilejson.vector_layers.length > 0
  ) {
    return (
      <div>
        {state.tilejson.vector_layers.length}{" "}
        {state.tilejson.vector_layers.length === 1
          ? t("layer. ")
          : t("layers. ")}
        {t("Zoom levels ")}
        {`${state.tilejson.vector_layers[0].minzoom} - ${state.tilejson.vector_layers[0].maxzoom}.`}
      </div>
    );
  } else if ("minzoom" in state.tilejson && "maxzoom" in state.tilejson) {
    return (
      <div>
        {t("Zoom levels ")}
        {`${state.tilejson.minzoom} - ${state.tilejson.maxzoom}.`}
      </div>
    );
  } else {
    return <div>{t("No tilejson found")}</div>;
  }
}
