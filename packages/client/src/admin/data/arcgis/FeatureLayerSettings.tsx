import React, { useRef, useEffect, useState } from "react";
import InputBlock from "../../../components/InputBlock";
import OutgoingLinkIcon from "../../../components/OutgoingLinkIcon";
import Switch from "../../../components/Switch";
import {
  ArcGISServiceSettings,
  LayerInfo,
  useFeatureLayerSizeData,
} from "./arcgis";
import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror-colorpicker/dist/codemirror-colorpicker.css";
import "codemirror-colorpicker";
import "codemirror/addon/lint/lint.css";
// @ts-ignore
import { validate } from "@mapbox/mapbox-gl-style-spec";
import useDebounce from "../../../useDebounce";
import Spinner from "../../../components/Spinner";
import bytes from "bytes";
import Button from "../../../components/Button";
import { fetchFeatureLayerData } from "@seasketch/mapbox-gl-esri-sources/dist/src/ArcGISVectorSource";
import slugify from "slugify";
require("codemirror/addon/lint/lint");
require("codemirror/addon/lint/json-lint");
require("codemirror/mode/javascript/javascript");
// @ts-ignore
window.jsonlint = require("jsonlint-mod");

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
  const [style, setStyle] = useState<string>();
  const debouncedStyle = useDebounce(style, 200);
  const [styleErrors, setStyleErrors] = useState<Error[]>([]);
  const [jsonErrors, setJsonErrors] = useState<boolean>(false);
  const sizeData = useFeatureLayerSizeData(
    layer.url,
    settings.vectorSublayerSettings.find((s) => s.sublayer === layer.id)!
  );
  const [isDownloading, setIsDownloading] = useState(false);

  function download() {
    setIsDownloading(true);
    fetchFeatureLayerData(
      layer.url,
      "*",
      (e) => {
        setIsDownloading(false);
        alert(e.message);
      },
      6
    ).then((featureCollection) => {
      var json = JSON.stringify(featureCollection);
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.download = `${slugify(layer.name)}.json`;
      a.href = url;
      a.textContent = `${slugify(layer.name)}.json`;
      setIsDownloading(false);
      a.click();
    });
  }

  useEffect(() => {
    setStyle(undefined);
    setStyleErrors([]);
    setJsonErrors(false);
  }, [layer]);

  useEffect(() => {
    if (debouncedStyle) {
      try {
        const styleJSON = JSON.parse(debouncedStyle);
        const errors = validate({
          version: 8,
          name: "Mapbox Streets",
          layers: styleJSON.map((layer: any, index: number) => ({
            ...layer,
            source: "1",
            id: index.toString(),
          })),
          sources: { 1: {} },
        });
        setStyleErrors(errors.slice(0, -1));
      } catch (e) {
        setStyleErrors([]);
      }
    } else {
      setStyleErrors([]);
    }
  }, [debouncedStyle]);

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

      <div className="p-2 px-4">
        <InputBlock
          title="Ignore size limit"
          className="mt-4 text-sm"
          input={
            <Switch
              isToggled={layerSettings.ignoreByteLimit}
              onClick={() =>
                updateSettings(
                  "ignoreByteLimit",
                  !layerSettings.ignoreByteLimit
                )
              }
            />
          }
        >
          SeaSketch by default limits vector layers to 5 megabytes of
          uncompressed GeoJSON. You may bypass the limit for this layer but be
          aware that large datasets take longer to download and exceptionally
          large ones can slow down or crash the browser.
        </InputBlock>

        <InputBlock
          title="Vector Dataset Size"
          className="mt-4 text-sm"
          input={<div></div>}
        >
          {sizeData.loading ? (
            <Spinner />
          ) : sizeData.data ? (
            <div>
              Size: {bytes(sizeData.data.geoJsonBytes)}. Geobuf size:{" "}
              {bytes(sizeData.data.geobufBytes, {
                decimalPlaces: 0,
              })}
              . Area: {Math.round(sizeData.data.areaKm)} sq km.
            </div>
          ) : (
            <div>{sizeData.error?.message}</div>
          )}
          <Button
            loading={isDownloading}
            onClick={download}
            label="Download dataset as GeoJSON"
          />
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
              <option value="5">1 meter</option>
              <option value="6">10 cm</option>
            </select>
          }
        >
          Choosing a lower level of precision is a great way to reduce a
          dataset's size, increasing download speed and improving map
          performance.
        </InputBlock>

        <InputBlock
          className="mt-4 text-sm mb-4"
          title="Rendering Style"
          input={<div />}
        >
          Vector layers in SeaSketch are rendered using{" "}
          <a
            className="text-primary-500 hover:underline"
            target="_blank"
            href="https://docs.mapbox.com/mapbox-gl-js/style-spec/"
          >
            MapBox GL Styles
          </a>
          . Cartographic information from ArcGIS Server has been converted into
          this stylesheet format for you. Below you can adjust this style
          information.
        </InputBlock>
        <CodeMirror
          className={`h-auto border ${
            styleErrors.length > 0 || jsonErrors ? "border-red-300" : "mb-10"
          }`}
          value={
            style ||
            JSON.stringify(
              removeSourceAndId(
                layerSettings.mapboxLayers || layer.mapboxLayers
              ),
              null,
              "  "
            )
          }
          options={{
            mode: "application/json",
            gutters: ["CodeMirror-lint-markers"],
            lint: true,
            lineNumbers: true,
            // colorpicker: true,
            colorpicker: {
              mode: "edit",
            },
          }}
          editorDidMount={(editor, value) => {
            // fix for colors not immediately showing up
            editor.refresh();
          }}
          onBeforeChange={(editor, data, value) => {
            setStyle(value);
            try {
              const s = JSON.parse(value);
              setJsonErrors(false);
              updateSettings("mapboxLayers", s);
            } catch (e) {
              setJsonErrors(true);
            }
          }}
          onChange={(editor, data, value) => {}}
        />
        {styleErrors.length > 0 && (
          <div className="text-sm bg-red-200 p-1 px-2" style={{ fontSize: 13 }}>
            {styleErrors.map((e, i) => (
              <p key={i}>{e.message.toString()}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function removeSourceAndId(layers: { source?: string; id?: string }[]) {
  const copy = [...layers];
  for (const layer of copy) {
    delete layer["source"];
    delete layer["id"];
  }
  return copy;
}
