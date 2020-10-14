import React, { useRef, useEffect, useState } from "react";
import InputBlock from "../../../components/InputBlock";
import OutgoingLinkIcon from "../../../components/OutgoingLinkIcon";
import Switch from "../../../components/Switch";
import { ArcGISServiceSettings, LayerInfo } from "./arcgis";

export function FeatureLayerSettings(props: {
  layer: LayerInfo;
  settings: ArcGISServiceSettings;
  updateSettings: (settings: ArcGISServiceSettings) => void;
}) {
  const { layer, settings } = props;
  const updateSettings = (key: string, value: any) => {
    props.updateSettings({
      ...settings,
      vectorSublayerSettings: [
        ...settings.vectorSublayerSettings.filter(
          (s) => s.sublayer !== layer.id
        ),
        {
          ...layerSettings,
          [key]: value,
        },
      ],
    });
  };
  const layerSettings = settings.vectorSublayerSettings.find(
    (s) => s.sublayer === layer.id
  ) || {
    sublayer: layer.id,
    geometryPrecision: 6,
    instantLayers: true,
    renderUnder: "labels",
    ignoreByteLimit: false,
  };
  const rootElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rootElRef && rootElRef.current) {
      rootElRef.current.scrollTo(0, 0);
    }
  }, [props.layer]);

  return (
    <div
      ref={rootElRef}
      className="p-2 overflow-y-scroll bg-white md:w-1/2 shadow"
      style={{ minWidth: 340 }}
    >
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          {props.layer.name}
          <a target="_blank" href={props.layer.url}>
            <OutgoingLinkIcon />
          </a>
        </h3>
      </div>

      <InputBlock
        title="Ignore size limit"
        className="mt-4 text-sm"
        input={
          <Switch
            isToggled={layerSettings.ignoreByteLimit}
            onClick={() =>
              updateSettings("ignoreByteLimit", !layerSettings.ignoreByteLimit)
            }
          />
        }
      >
        SeaSketch by default limits vector layers to 5 megabytes of uncompressed
        GeoJSON. You may bypass the limit for this layer but be aware that large
        datasets take longer to download and exceptionally large ones can slow
        down or crash the browser.
      </InputBlock>

      <InputBlock
        className="mt-4 text-sm"
        title="Geometry Precision"
        input={
          <select
            id="geometryPrecision"
            className="form-select block w-full pl-3 pr-8 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
            value={layerSettings.geometryPrecision.toString()}
            onChange={(e) => {
              updateSettings("geometryPrecision", parseInt(e.target.value));
            }}
          >
            <option value="4">4 (10 meter)</option>
            <option value="5">5 (1 meter)</option>
            <option value="6">6 (10 cm)</option>
          </select>
        }
      >
        Choosing a lower level of precision is a great way to reduce a dataset's
        size, increasing download speed and improving map performance.
      </InputBlock>
    </div>
  );
}
