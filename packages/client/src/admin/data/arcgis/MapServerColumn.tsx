import React, { ReactNode, useEffect, useRef, useState } from "react";
import {
  extentToLatLngBounds,
  LayerInfo,
  MapServerImageFormat,
  useArcGISServiceSettings,
  useMapServerInfo,
} from "./arcgis";
import { AnyLayer, Map } from "mapbox-gl";
import { ArcGISVectorSourceOptions } from "@seasketch/mapbox-gl-esri-sources";
import DefinitionList from "../../../components/DefinitionList";
import Switch from "../../../components/Switch";
import { ArcGISLayerTree } from "./ArcGISLayerTree";
import { OverlayConfig } from "./OverlayManager";
import SegmentControl from "../../../components/SegmentControl";
import InputBlock from "../../../components/InputBlock";
import Button from "../../../components/Button";
import SettingsIcon from "../../../components/SettingsIcon";
import { ArcGISBrowserColumnProps } from "./ArcGISBrowserColumn";
import OutgoingLinkIcon from "../../../components/OutgoingLinkIcon";

export default function MapServerColumn(props: {
  item: ArcGISBrowserColumnProps;
  map: Map | null;
  onUpdateOverlays?: (overlays: OverlayConfig) => void;
  onVectorSettingsClick?: (item: LayerInfo) => void;
}) {
  const { data, loading, error } = useMapServerInfo(props.item.url);
  const rootElRef = useRef<HTMLDivElement>(null);
  const [sourceType, setSourceType] = useState<
    "arcgis-dynamic-mapservice" | "arcgis-vector-source"
  >("arcgis-dynamic-mapservice");
  const [enableHighDpi, setEnableHighDpi] = useState(true);
  const [imageFormat, setImageFormat] = useState<MapServerImageFormat>("PNG");
  const [visibleLayers, setVisibleLayers] = useState<number[]>();
  const [hostCopy, setHostCopy] = useState(true);
  const [renderUnder, setRenderUnder] = useState<"labels" | "land" | "none">(
    "none"
  );

  useEffect(() => {
    if (rootElRef && rootElRef.current) {
      rootElRef.current.scrollTo(0, 0);
    }
  }, [data]);

  const calculateOverlays = (): OverlayConfig => {
    const overlays: OverlayConfig = [];
    if (data) {
      if (sourceType === "arcgis-dynamic-mapservice") {
        overlays.push({
          id: props.item.url,
          type: "ArcGISDynamicMapService",
          url: props.item.url,
          options: {
            supportsDynamicLayers: data.mapServerInfo.supportsDynamicLayers,
            useDevicePixelRatio: enableHighDpi,
            layers: visibleLayers
              ? visibleLayers.map((lyr) => ({ sublayer: lyr }))
              : undefined,
            queryParameters: {
              format: imageFormat,
            },
          },
        });
      } else if (sourceType === "arcgis-vector-source") {
        for (const sublayerId of visibleLayers || []) {
          const layerInfo = data.layerInfo.find((l) => l.id === sublayerId);
          if (layerInfo && layerInfo.type === "Feature Layer") {
            overlays.push({
              id: layerInfo.generatedId,
              type: "ArcGISVectorSource",
              url: `${props.item.url}/${sublayerId}`,
              imageList: layerInfo.imageList,
              layers: layerInfo.mapboxLayers as AnyLayer[],
              options: {
                supportsPagination:
                  layerInfo.advancedQueryCapabilities.supportsPagination,
                bytesLimit: 5000000,
              } as ArcGISVectorSourceOptions,
            });
          }
        }
      } else {
        throw new Error("Unknown source type");
      }
    }
    return overlays;
  };

  useEffect(() => {
    if (data && props.map) {
      const mapServerInfo = data.mapServerInfo;
      if (data.mapServerInfo.fullExtent || data.mapServerInfo.initialExtent) {
        const bounds = extentToLatLngBounds(
          data.mapServerInfo.fullExtent || mapServerInfo.initialExtent
        );
        if (bounds) {
          props.map.fitBounds(bounds, { duration: 0, padding: 40 });
        }
      }
    }
  }, [data, props.map]);

  useEffect(() => {
    if (props.onUpdateOverlays) {
      props.onUpdateOverlays(calculateOverlays());
    }
  }, [
    data,
    visibleLayers,
    sourceType,
    enableHighDpi,
    imageFormat,
    visibleLayers,
  ]);

  const updateVisibleLayers = (layerIds: number[]) => {
    if (layerIds.join(",") != (visibleLayers || []).join(",")) {
      setVisibleLayers(layerIds);
    }
  };

  if (loading) {
    return <div>loading</div>;
  }
  if (error) {
    return <div>error. {error.toString()}</div>;
  }
  if (data) {
    const mapServerInfo = data.mapServerInfo;
    let hasVectorLayers = false;
    for (const layer of data.layerInfo) {
      if (layer.type === "Feature Layer") {
        hasVectorLayers = true;
        break;
      }
    }
    const supportedImageFormats = mapServerInfo?.supportedImageFormatTypes.split(
      ","
    );
    const acceptableImageFormats = [
      "PNG",
      "PNG8",
      "PNG24",
      "PNG32",
      "GIF",
      "JPG",
    ].filter((format) => supportedImageFormats.indexOf(format) !== -1);
    const definitionListItems: [string, string | ReactNode][] = [
      [
        "Description",
        mapServerInfo.serviceDescription || mapServerInfo.description,
      ],
      ["Author", mapServerInfo.documentInfo.Author],
      ["Subject", mapServerInfo.documentInfo.Subject],
      ["Comments", mapServerInfo.documentInfo.Comments],
      ["Copyright", mapServerInfo.copyrightText],
      ["Keywords", mapServerInfo.documentInfo.Keywords],
      [
        "Projection",

        <a
          className="underline"
          target="_blank"
          href={`https://epsg.io/${
            mapServerInfo.spatialReference.latestWkid ||
            mapServerInfo.spatialReference.wkid
          }`}
        >
          {mapServerInfo.spatialReference.latestWkid ||
            mapServerInfo.spatialReference.wkid}
        </a>,
      ],
    ];

    return (
      <div
        ref={rootElRef}
        className="p-2 overflow-y-scroll bg-white md:w-1/2 shadow"
        style={{ minWidth: 340 }}
      >
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {mapServerInfo?.documentInfo.Title || props.item.name}
            <a target="_blank" href={props.item.url}>
              <OutgoingLinkIcon />
            </a>
          </h3>
        </div>
        <DefinitionList items={definitionListItems} />
        <div className="mt-10 px-6">
          <div className="mx-auto mb-4 max-w-md">
            <SegmentControl
              segments={["Image Source", "Vector Sources"]}
              value={
                sourceType === "arcgis-dynamic-mapservice"
                  ? "Image Source"
                  : "Vector Sources"
              }
              onClick={(segment) =>
                segment === "Image Source"
                  ? setSourceType("arcgis-dynamic-mapservice")
                  : setSourceType("arcgis-vector-source")
              }
            />
          </div>

          {sourceType === "arcgis-dynamic-mapservice" && (
            <p className="text-sm text-gray-600">
              Image sources display data as full-screen images, typical of how
              most web mapping portals work. Each time the user pans or zooms
              the map a new image will be requested and displayed with the
              requested layers.
            </p>
          )}

          {sourceType === "arcgis-vector-source" && (
            <p className="text-sm text-gray-600">
              When using vector sources, SeaSketch loads actual geometry data
              and uses the user's browser to render it. This can result in a
              much faster, sharper, and more interactive map but takes a little
              more work to configure. Each layer can be styled and configured
              independently (click{" "}
              <SettingsIcon className="w-4 h-4 inline-block" />
              ).
            </p>
          )}

          <ArcGISLayerTree
            onVectorSettingsClick={(item) => {
              if (props.onVectorSettingsClick) {
                props.onVectorSettingsClick(item);
              }
            }}
            vectorMode={sourceType === "arcgis-vector-source"}
            mapServiceInfo={data.mapServerInfo}
            layers={data.layerInfo}
            onVisibleLayersChanged={(layerIds) => updateVisibleLayers(layerIds)}
          />

          {sourceType === "arcgis-vector-source" && (
            <div className="mt-6 mb-5 bg-gray-100 rounded py-2 px-4 pb-3">
              <h3 className="font-medium">Import Layers</h3>
              <p className="text-sm text-gray-600 mt-1 mb-2">
                Before importing vector sources, SeaSketch needs to analyze
                these layers for compatability and file size issues. Once
                completed you will receive recommendations on how to best use
                them in your project.
              </p>
              <Button className="mr-4" label={`Analyze services`} />
              <Button disabled={true} primary={true} label={`Import layers`} />
            </div>
          )}

          {sourceType === "arcgis-dynamic-mapservice" && (
            <div className="mt-6 mb-5 bg-gray-100 rounded py-2 px-4 pb-3">
              <h3 className="font-medium">Import Layers</h3>
              <p className="text-sm text-gray-600 mt-1 mb-2">
                Layers from this map server will be added to your project's
                table of contents using the options below. Once imported they
                can be reorganized as needed.
              </p>
              <Button
                primary={true}
                label={`Add all ${
                  data.layerInfo.filter((lyr) => lyr.type !== "Group Layer")
                    .length
                } layers`}
              />
            </div>
          )}

          {sourceType === "arcgis-dynamic-mapservice" && (
            <InputBlock
              title="Enable High-DPI Requests"
              className="mt-4 text-sm"
              input={
                <Switch
                  isToggled={enableHighDpi}
                  onClick={() => setEnableHighDpi(!enableHighDpi)}
                />
              }
            >
              Request higher resolution images when the user has a "Retina" or
              4k display. Maps will be much more detailed, but it demands more
              of the data server.
            </InputBlock>
          )}

          {sourceType === "arcgis-dynamic-mapservice" && (
            <InputBlock
              className="mt-4 text-sm"
              title="Image Format"
              input={
                <select
                  id="imageFormat"
                  className="form-select block w-full pl-3 pr-4 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
                  value={imageFormat}
                  onChange={(e) => {
                    setImageFormat(e.target.value as MapServerImageFormat);
                  }}
                >
                  {acceptableImageFormats.map((f) => (
                    <option key={f} value={f}>
                      {f.toLocaleLowerCase()}
                    </option>
                  ))}
                </select>
              }
            >
              Imagery data looks best using <code>jpg</code>, for others{" "}
              <code>png</code> is a good choice.
            </InputBlock>
          )}

          {sourceType === "arcgis-vector-source" && (
            <InputBlock
              className="mt-4 text-sm"
              title="Enable Instant Layers"
              input={
                <Switch
                  isToggled={hostCopy}
                  onClick={() => setHostCopy(!hostCopy)}
                />
              }
            >
              Creates an optimized copy of these data that will be hosted on our
              content delivery network for quick and reliable access anywhere in
              the world. This copy can be manually updated whenever data changes
              at the source.
            </InputBlock>
          )}

          {sourceType === "arcgis-dynamic-mapservice" && (
            <InputBlock
              className="mt-4 text-sm"
              title="Rendering order"
              input={
                <select
                  id="renderUnder"
                  className="form-select block w-full pl-3 pr-8 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
                  value={renderUnder}
                  onChange={(e) => {
                    setRenderUnder(
                      e.target.value as "none" | "labels" | "land"
                    );
                  }}
                >
                  <option value={"none"}>Cover basemap</option>
                  <option value={"labels"}>Under labels</option>
                  <option value={"land"}>Under land</option>
                </select>
              }
            >
              If your basemaps are configured to identify these special layers,
              you can render this service underneath labels or land.
            </InputBlock>
          )}
        </div>
      </div>
    );
  }
  return null;
}
