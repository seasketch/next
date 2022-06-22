import React, { useRef, useEffect, useState } from "react";
import InputBlock from "../../../components/InputBlock";
import OutgoingLinkIcon from "../../../components/OutgoingLinkIcon";
import {
  ArcGISServiceSettings,
  esriFieldTypesToTileJSONTypes,
  LayerInfo,
  MapServerCatalogInfo,
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
import { fetchFeatureLayerData } from "mapbox-gl-esri-feature-layers";
import slugify from "slugify";
import ArcGISServiceMetadata from "./ArcGISServiceMetadata";
import Warning from "../../../components/Warning";
import { RenderUnderType } from "../../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
require("codemirror/addon/lint/lint");
require("codemirror/addon/lint/json-lint");
require("codemirror/mode/javascript/javascript");
// @ts-ignore
window.jsonlint = require("jsonlint-mod");

// const VECTOR_BYTES_LIMIT = 5_000_000;

export function FeatureLayerSettings(props: {
  layer: LayerInfo;
  service: MapServerCatalogInfo;
  settings: ArcGISServiceSettings;
  updateSettings: (settings: ArcGISServiceSettings) => void;
}) {
  const { t } = useTranslation("admin");
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
    importType: "geojson",
    renderUnder: RenderUnderType.Labels,
    ignoreByteLimit: false,
    outFields: "*",
  };
  const rootElRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<string>();
  const debouncedStyle = useDebounce(style, 200);
  const [styleErrors, setStyleErrors] = useState<Error[]>([]);
  const [jsonErrors, setJsonErrors] = useState<boolean>(false);
  const sizeData = useFeatureLayerSizeData(
    layer.generatedId,
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
      // eslint-disable-next-line
      a.download = `${slugify(layer.name)}.json`;
      a.href = url;
      // eslint-disable-next-line
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
            // eslint-disable-next-line
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

  const toggleField = (alias: string) => {
    let outFields = `${layerSettings.outFields}`;
    if (outFields === "*") {
      outFields = layer.fields
        .map((f) => f.alias)
        .filter((f) => f !== alias)
        .join(",");
    } else {
      const currentFields = outFields.split(",");
      if (currentFields.indexOf(alias) !== -1) {
        // remove
        outFields = currentFields.filter((f) => f !== alias).join(",");
      } else {
        // add
        outFields = [...currentFields, alias].join(",");
      }
    }
    updateSettings("outFields", outFields);
  };

  return (
    <div
      ref={rootElRef}
      className="p-2 overflow-y-scroll bg-white border-l max-h-full border-gray-300 max-w-full md:w-128 lg:w-144 flex-grow-0 flex-shrink-0"
      style={{ minWidth: 340 }}
    >
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          {props.layer.name}
          <a target="_blank" href={props.layer.url} rel="noreferrer">
            <OutgoingLinkIcon />
          </a>
        </h3>
      </div>

      <ArcGISServiceMetadata layer={layer} serviceInfo={props.service} />

      <div className="p-2 px-4">
        <div className="py-2">
          <h3 className="font-medium text-sm py-2">
            {t("Vector Dataset Statistics")}
          </h3>
          <div>
            <span className="text-2xl">
              {sizeData.data ? (
                bytes(sizeData.data.geoJsonBytes)
              ) : sizeData.error ? (
                // eslint-disable-next-line
                `Error: ${sizeData.error.message}`
              ) : (
                <Spinner className="w-5 h-5" />
              )}
            </span>{" "}
            <span className="font-light text-gray-700">
              {sizeData.data
                ? // eslint-disable-next-line
                  `${bytes(sizeData.data.gzipBytes)} gzip`
                : ""}
            </span>
          </div>
          <div>
            {t("download time")} <Lightning className="text-gray-400 inline" />{" "}
            {downloadTime(20, sizeData.data?.gzipBytes)} -{" "}
            {downloadTime(20 / 4, sizeData.data?.gzipBytes)}{" "}
            {`seconds when hosted
            on SeaSketch`}
          </div>
          <div>
            {sizeData?.data?.objects || 0} {t("features")},{" "}
            {sizeData.data?.attributes || 0} {t("attributes")},{" "}
            {Math.round(sizeData.data?.areaKm || 0)} {t("sq kilometers")}
          </div>
          {/* {(sizeData.data?.geoJsonBytes || 0) > VECTOR_BYTES_LIMIT ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-2">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm leading-5 text-yellow-700">
                    Layer hidden due to file size.{" "}
                    <input
                      id="showLargeLayer"
                      className="form-checkbox"
                      type="checkbox"
                      checked={layerSettings.ignoreByteLimit}
                      onChange={() =>
                        updateSettings(
                          "ignoreByteLimit",
                          !layerSettings.ignoreByteLimit
                        )
                      }
                    />{" "}
                    <label htmlFor="showLargeLayer">Show layer</label>
                  </p>
                </div>
              </div>
            </div>
          ) : null} */}
        </div>
        <div className="py-2">
          <h3 className="font-medium text-sm py-2">
            {t("Data Source Options")}
          </h3>

          <div className="relative flex items-start p-2">
            <div className="flex items-center h-5">
              <input
                id="geojson"
                name="importType"
                type="radio"
                onChange={() => updateSettings("importType", "geojson")}
                checked={layerSettings.importType === "geojson"}
                className="form-radio h-4 w-4 text-primary-600 transition duration-150 ease-in-out"
              />
            </div>
            <div className="ml-3 text-sm leading-5">
              <label htmlFor="offers" className="font-medium text-gray-700">
                <Trans ns="admin">Import a copy into SeaSketch</Trans>
              </label>
              <p className="text-gray-500">
                <Trans ns="admin">
                  A copy of this dataset will be hosted on our global content
                  delivery network. This option offers better performance and
                  enables custom styling, creation of vector tiles, and offline
                  access (coming soon).
                </Trans>
              </p>
              <p className="text-gray-500 mt-1">
                <Trans ns="admin">
                  You can also{" "}
                  <button
                    className={`underline text-primary-600 ${
                      isDownloading ? "pointer-events-none" : ""
                    }`}
                    disabled={isDownloading}
                    onClick={download}
                  >
                    download
                  </button>{" "}
                  this dataset and{" "}
                  <button className={`underline text-primary-600`}>
                    upload
                  </button>{" "}
                  a revised copy. We suggest removing complex coastlines (use
                  the render under land option) and simplifying geometry to only
                  the precision needed for visualization.
                </Trans>
              </p>
              {(sizeData.data?.warnings || [])
                .filter((w) => w.type === "geojson")
                .map((w, i) => (
                  <Warning
                    key={i}
                    level={w.level}
                    disabled={layerSettings.importType === "dynamic"}
                  >
                    {w.message}
                  </Warning>
                ))}
            </div>
          </div>

          <div className="relative flex items-start p-2">
            <div className="flex items-center h-5">
              <input
                id="dynamic"
                name="importType"
                onChange={() => updateSettings("importType", "dynamic")}
                checked={layerSettings.importType === "dynamic"}
                type="radio"
                className="form-radio h-4 w-4 text-primary-600 transition duration-150 ease-in-out"
              />
            </div>
            <div className="ml-3 text-sm leading-5">
              <label htmlFor="offers" className="font-medium text-gray-700">
                <Trans ns="admin">Link dynamically to origin server</Trans>
              </label>
              <p className="text-gray-500">
                <Trans ns="admin">
                  With this option selected data and cartographic styling will
                  be downloaded from the origin server by each user. Updates to
                  data and cartography are immediately available in SeaSketch
                  but performance is poorer and features are limited.
                </Trans>
              </p>
              {(sizeData.data?.warnings || [])
                .filter((w) => w.type === "arcgis")
                .map((w, i) => (
                  <Warning
                    key={i}
                    level={w.level}
                    disabled={layerSettings.importType === "geojson"}
                  >
                    {w.message}
                  </Warning>
                ))}
            </div>
          </div>
        </div>

        {/* <InputBlock
          title="Vector Dataset Statistics"
          className="mt-4 text-sm"
          input={<div></div>}
        >
          {sizeData.loading ? (
            <Spinner />
          ) : sizeData.data ? (
            <div>
              Size: {bytes(sizeData.data.geoJsonBytes)}. Geobuf size:{" "}
              {bytes(sizeData.data.gzipBytes, {
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
        </InputBlock> */}

        <InputBlock
          className="mt-4 text-sm"
          title={t("Geometry Precision")}
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
          <Trans ns="admin">
            Using a lower level of precision reduces a dataset's size,
            increasing download speed and improving map performance. Does not
            apply to uploads.
          </Trans>
        </InputBlock>

        {/* <InputBlock
          className="mt-4 text-sm"
          title="Rendering order"
          input={
            <select
              id="renderUnder"
              className="form-select block w-full pl-3 pr-8 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
              value={layerSettings.renderUnder}
              onChange={(e) => {
                updateSettings(
                  "renderUnder",
                  e.target.value as RenderUnderType
                );
              }}
            >
              <option value={RenderUnderType.None}>Cover basemap</option>
              <option value={RenderUnderType.Labels}>Under labels</option>
            </select>
          }
        >
          If your basemaps are configured to identify these special layers, you
          can render this service underneath labels or land.
        </InputBlock> */}

        <div className="py-2">
          <h3 className="font-medium text-sm py-2">
            <Trans ns="admin">Included Fields</Trans>
          </h3>
          <p className="text-sm text-gray-700">
            <Trans ns="admin">
              Limit the fields included in this dataset in order to reduce
              download size. Does not apply to uploaded revisions. Be careful
              not to remove fields used in styles.
            </Trans>
          </p>

          <div className="flex flex-col mt-3">
            <div className="overflow-x-auto sm:-mx-2 lg:-mx-2">
              <div className="py-2 align-middle inline-block min-w-full sm:px-2 lg:px-2">
                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">
                          <Trans ns="admin">Field</Trans>
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">
                          <Trans ns="admin">Type</Trans>
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-center text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">
                          <Trans ns="admin">Included</Trans>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="max-h-1/2 overflow-y-scroll">
                      {layer.fields
                        .filter((f) => f.alias !== "Shape")
                        .map((field, index) => {
                          return (
                            <tr
                              key={field.alias}
                              className={
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm leading-5 font-medium text-gray-900">
                                {field.alias}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm leading-5 text-gray-500">
                                {esriFieldTypesToTileJSONTypes[field.type]}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm leading-5 text-gray-500 text-center">
                                {field.type === "esriFieldTypeOID" ? (
                                  "Required"
                                ) : (
                                  <input
                                    onChange={() => toggleField(field.alias)}
                                    type="checkbox"
                                    className="form-checkbox"
                                    checked={
                                      layerSettings.outFields === "*" ||
                                      layerSettings.outFields
                                        .split(",")
                                        .indexOf(field.alias) !== -1
                                    }
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {layerSettings.importType !== "dynamic" && (
          <>
            <InputBlock
              className="mt-4 text-sm mb-4"
              title={t("Rendering Style")}
              input={<div />}
            >
              <Trans ns="admin">
                Vector layers in SeaSketch are rendered using{" "}
                <a
                  className="text-primary-500 hover:underline"
                  target="_blank"
                  href="https://docs.mapbox.com/mapbox-gl-js/style-spec/"
                  rel="noreferrer"
                >
                  MapBox GL Styles
                </a>
                . Cartographic information from ArcGIS Server has been converted
                into this stylesheet format for you. Below you can adjust this
                style information.
              </Trans>
            </InputBlock>
            <CodeMirror
              className={`h-auto border ${
                styleErrors.length > 0 || jsonErrors ? "border-red-300" : "my-2"
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
              <div
                className="text-sm bg-red-200 p-1 px-2"
                style={{ fontSize: 13 }}
              >
                {styleErrors.map((e, i) => (
                  <p key={i}>{e.message.toString()}</p>
                ))}
              </div>
            )}
            <button
              disabled={style === undefined}
              className={`text-sm underline text-primary-600 ${
                style === undefined ? "pointer-events-none opacity-50" : ""
              }`}
              onClick={() => {
                if (
                  window.confirm("Are you sure you want to clear your changes?")
                ) {
                  updateSettings("mapboxLayers", undefined);
                }
              }}
            >
              <Trans ns="admin">Reset to server style</Trans>
            </button>
          </>
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

function downloadTime(mbps: number, sizeBytes?: number) {
  if (!sizeBytes) {
    return "--";
  } else {
    const seconds =
      sizeBytes / ((mbps * 1000_000) / 8) +
      // general latency of s3 -> cloudflare
      0.12;
    if (seconds > 4) {
      return Math.round(seconds).toString();
    } else if (seconds < 0.06) {
      return "< 0.1";
    } else {
      return (Math.round(seconds * 10) / 10).toString();
    }
  }
}

function Lightning(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      height="48"
      width="48"
      focusable="false"
      role="img"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-gray-500 w-3 h-3 ${props.className}`}
    >
      <path
        fillRule="evenodd"
        d="M11.251.068a.5.5 0 01.227.58L9.677 6.5H13a.5.5 0 01.364.843l-8 8.5a.5.5 0 01-.842-.49L6.323 9.5H3a.5.5 0 01-.364-.843l8-8.5a.5.5 0 01.615-.09z"
      ></path>
    </svg>
  );
}
