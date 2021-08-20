import { gql, useApolloClient } from "@apollo/client";
import { Map } from "mapbox-gl";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import TextInput from "../../components/TextInput";
import { BasemapType, useCreateBasemapMutation } from "../../generated/graphql";
import { useMapboxStyle } from "../../useMapboxStyle";
import useProjectId from "../../useProjectId";
import { createImageBlobFromDataURI } from "./arcgis/arcgis";

const THUMBNAIL_SIZE = 240;
const IMAGE_SIZE = THUMBNAIL_SIZE * window.devicePixelRatio;

export default function CreateBasemapModal({
  onSave,
  onRequestClose,
}: {
  onSave?: () => void;
  onRequestClose?: () => void;
}) {
  const [state, setState] = useState<{
    type: BasemapType;
    name: string;
    description?: string;
    url: string;
    mapPreview: boolean;
  }>({
    type: BasemapType.Mapbox,
    name: "",
    url: "",
    mapPreview: false,
  });
  const { t } = useTranslation("admin");
  const projectId = useProjectId();
  const [mutate, mutationState] = useCreateBasemapMutation({
    update: (cache, { data }) => {
      if (data?.createBasemap?.basemap) {
        const newBasemapData = data.createBasemap.basemap;
        cache.modify({
          id: cache.identify({
            __typename: "Project",
            id: projectId,
          }),
          fields: {
            basemaps(existingBasemapRefs = [], { readField }) {
              const newBasemapRef = cache.writeFragment({
                data: newBasemapData,
                fragment: gql`
                  fragment NewBasemap on Basemap {
                    id
                    projectId
                    attribution
                    description
                    labelsLayerId
                    name
                    nodeId
                    terrainExaggeration
                    terrainOptional
                    url
                    type
                    tileSize
                    thumbnail
                    terrainUrl
                    terrainTileSize
                  }
                `,
              });

              return [...existingBasemapRefs, newBasemapRef];
            },
          },
        });
      }
    },
  });
  const client = useApolloClient();

  const mapboxStyleInfo = useMapboxStyle(
    state.type === BasemapType.Mapbox ? state.url : undefined
  );

  useEffect(() => {
    if (mapboxStyleInfo.data?.name && !state.name) {
      setState((old) => ({
        ...old,
        name: mapboxStyleInfo.data?.name || "",
      }));
    }
  }, [mapboxStyleInfo]);

  const mapRef = useRef<Map>();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (state.mapPreview && mapDivRef.current) {
      const map = new Map({
        container: mapDivRef.current,
        style: state.url,
        attributionControl: false,
        preserveDrawingBuffer: true,
      });
      mapRef.current = map;
    }
    return () => {
      mapRef.current?.remove();
    };
  }, [state.mapPreview, mapDivRef.current]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={IMAGE_SIZE}
        height={IMAGE_SIZE}
        style={{ zIndex: 10000, height: THUMBNAIL_SIZE, width: THUMBNAIL_SIZE }}
        className="absolute left-0 top-0 bg-gray-400 hidden"
      ></canvas>
      <Modal
        open={true}
        title={t("Custom Basemap")}
        zeroPadding
        footer={
          <div className="text-right">
            <Button
              onClick={onRequestClose}
              label={t("Cancel")}
              className="mr-2"
            />
            <Button
              primary
              onClick={() => {
                if (state.mapPreview) {
                  const dataUrl = mapRef.current?.getCanvas().toDataURL();
                  const img = new Image();
                  img.src = dataUrl!;
                  img.onload = () => {
                    // TODO: Test using different devicePixelRatio settings
                    const context = canvasRef.current!.getContext("2d");
                    context!.drawImage(
                      img,
                      (img.width - IMAGE_SIZE) / 2,
                      (img.height - IMAGE_SIZE) / 2,
                      IMAGE_SIZE,
                      IMAGE_SIZE,
                      0,
                      0,
                      IMAGE_SIZE,
                      IMAGE_SIZE
                    );
                    context?.save();
                    const cropped = canvasRef.current!.toDataURL();
                    createImageBlobFromDataURI(IMAGE_SIZE, IMAGE_SIZE, cropped)
                      .then((blob) => {
                        mutate({
                          variables: {
                            projectId: projectId!,
                            name: state.name,
                            thumbnail: blob,
                            type: state.type,
                            url: state.url,
                          },
                        }).then((d) => {
                          if (onRequestClose) {
                            onRequestClose();
                          }
                        });
                      })
                      .catch((e) => {
                        alert(e.toString());
                      });
                  };
                } else {
                  setState((old) => ({ ...old, mapPreview: true }));
                }
              }}
              label={state.mapPreview ? "Capture and Save" : "Continue"}
              disabled={mutationState.loading}
              loading={mutationState.loading}
            />
          </div>
        }
      >
        {!state.mapPreview && (
          <div className="w-128 h-72">
            <div className="p-4">
              <div className="mb-4">
                <label
                  htmlFor="type"
                  className="block text-sm mb-1 font-medium leading-5 text-gray-700"
                >
                  {t("Basemap Type")}
                </label>
                <select
                  id="type"
                  value={state?.type}
                  onChange={(e) => {
                    const type = e.target.value as BasemapType;
                    setState((old) => ({ ...old, type }));
                  }}
                  className="bg-white text-sm overflow-visible p-2 px-4 pr-7 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 rounded-md focus:ring focus:ring-blue-200 focus:ring-opacity-50 text-md sm:leading-5"
                  style={{ lineHeight: 1, backgroundSize: "1em 1em" }}
                >
                  <option value={BasemapType.Mapbox}>
                    {t("Mapbox GL Style")}
                  </option>
                  <option value={BasemapType.RasterUrlTemplate}>
                    {t("Raster tile url template")}
                  </option>
                </select>
              </div>
              <div className="mb-2">
                <TextInput
                  placeholder={
                    state.type === BasemapType.Mapbox
                      ? "mapbox://styles/mapbox/satellite-v9"
                      : "https://example.com/wms?bbox={bbox-epsg-3857}&request=GetMap&format=image/png&service=WMS&version=1.1.1&srs=EPSG:3857&width=256&height=256&layers=example"
                  }
                  inputChildNode={
                    mapboxStyleInfo.loading ? (
                      <div className="absolute right-2 top-2">
                        <Spinner />
                      </div>
                    ) : null
                  }
                  description={
                    state.type === BasemapType.Mapbox ? (
                      <>
                        <Trans ns="admin">
                          Enter a{" "}
                          <code className="bg-gray-100 p-0.5 rounded">
                            mapbox://
                          </code>{" "}
                          type url or the direct url to a mapbox-gl style hosted
                          on another platform.
                        </Trans>
                      </>
                    ) : (
                      <Trans ns="admin">
                        Enter a{" "}
                        <a
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-500 underline"
                          href="https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources"
                        >
                          url template
                        </a>{" "}
                        the tells SeaSketch how to load a raster tile data
                        source.
                      </Trans>
                    )
                  }
                  name="url"
                  value={state.url}
                  label="URL"
                  onChange={(url) => {
                    setState((old) => ({
                      ...old,
                      url,
                    }));
                  }}
                />
              </div>
              <div className="mt-4">
                <TextInput
                  label={t("Basemap Name")}
                  name="name"
                  value={state.name}
                  onChange={(name) => setState((old) => ({ ...old, name }))}
                />
              </div>

              {/* 
          # key info needed
          
          * type
          * url
          * tileSize if RASTER_URL_TEMPLATE
          * name
          * description
          * thumbnail
          * whether to include terrain
          *           
        */}
            </div>
          </div>
        )}
        {state.mapPreview && (
          <>
            <div ref={mapDivRef} className="w-128 h-72 bg-gray-300 relative">
              <div className="absolute w-128 h-72 left-0 top-0 z-10 pointer-events-none flex items-center justify-center">
                <div className="absolute top-0 text-sm bg-yellow-200 px-1">
                  <Trans ns="admin">
                    Create a thumbnail image that best represents this basemap
                  </Trans>
                </div>
                <div
                  className="absolute border border-black border-opacity-50 pointer-events-none rounded-md shadow-2xl select-none"
                  style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
                >
                  &nbsp;
                  <div
                    className="absolute top-0 left-0 border-2 border-white border-opacity-50 pointer-events-none rounded-md select-none"
                    style={{
                      width: THUMBNAIL_SIZE - 2,
                      height: THUMBNAIL_SIZE - 2,
                    }}
                  >
                    &nbsp;
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
