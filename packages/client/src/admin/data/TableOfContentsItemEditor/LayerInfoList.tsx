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
import { useMemo, useState } from "react";
import { GeostatsLayer } from "../GLStyleEditor/extensions/glStyleAutocomplete";
import { InfoCircledIcon, TableIcon } from "@radix-ui/react-icons";
import GeostatsModal from "../GLStyleEditor/GeostatsModal";
import ArcGISTiledRasterSettings from "../ArcGISTiledRasterSettings";
import ArcGISVectorLayerInfo from "./ArcGISVectorLayerInfo";
import * as Tooltip from "@radix-ui/react-tooltip";
import RemoteVectorLayerInfo from "./RemoteVectorLayerInfo";

export default function LayerInfoList({
  source,
  readonly,
  layer,
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
  >;
  layer: Pick<
    FullAdminDataLayerFragment,
    "sublayer" | "sublayerType" | "sourceLayer"
  >;
  readonly?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const profile = source.authorProfile;
  const isRemote = isRemoteSource(source.type);
  const geostatsLayer: GeostatsLayer | undefined = useMemo(() => {
    if (!source.geostats) return undefined;
    if (layer.sourceLayer) {
      return (source.geostats.layers || []).find(
        (l: any) => l.layer === layer.sourceLayer
      );
    } else {
      return source.geostats.layers[0];
    }
  }, [source.geostats]);

  const [showColumnModal, setShowColumnModal] = useState(false);

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
        {geostatsLayer && (
          <SettingsDLListItem
            term={t("Geometry")}
            description={
              <div className="w-full truncate flex">
                <span>
                  {geostatsLayer.count.toLocaleString()}{" "}
                  {geostatsLayer.geometry.toLocaleLowerCase()} {t("features")}
                </span>
                <div className="text-right flex-1 px-1">
                  <button
                    onClick={() => setShowColumnModal(true)}
                    className="hover:shadow-sm right-7 text-primary-500 items-center inline-flex border px-2 rounded-full text-xs py-0.5 "
                  >
                    <TableIcon className="inline mr-1" />
                    <span>{t("column detail")}</span>
                  </button>
                </div>
              </div>
            }
          />
        )}
        {!isRemote && <HostedLayerInfo readonly={readonly} source={source} />}
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
      </SettingsDefinitionList>
      {showColumnModal && source.geostats && (
        <GeostatsModal
          geostats={source.geostats}
          onRequestClose={() => setShowColumnModal(false)}
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
