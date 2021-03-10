import { Layer } from "mapbox-gl";
import React, { useEffect, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import Spinner from "../../components/Spinner";
import {
  BasemapType,
  useGetBasemapQuery,
  useUpdateBasemapMutation,
  useUpdateBasemapLabelsLayerMutation,
  useToggle3dTerrainMutation,
  useSet3dTerrainMutation,
  useUpdateTerrainExaggerationMutation,
  useUpdateBasemapUrlMutation,
} from "../../generated/graphql";
import { gql, useApolloClient } from "@apollo/client";

import { useMapboxStyle } from "../../useMapboxStyle";
import MutableAutosaveInput from "../MutableAutosaveInput";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import RadioGroup from "../../components/RadioGroup";
import TextInput from "../../components/TextInput";
import Button from "../../components/Button";
import CreateOptionalLayerModal from "./CreateOptionalLayerModal";
import OptionalBasemapLayerControl from "../../dataLayers/OptionalBasemapLayerControl";
import OptionalBasemapLayerEditor from "../../dataLayers/OptionalBasemapLayerEditor";
import useDebounce from "../../useDebounce";
import InteractivitySettings from "./InteractivitySettings";
import { ClientBasemap } from "../../dataLayers/MapContextManager";

const TERRAIN_URL = "mapbox://mapbox.mapbox-terrain-dem-v1";

export default function BasemapEditorPanel({
  basemapId,
  onRequestClose,
}: {
  basemapId: number;
  onRequestClose?: () => void;
}) {
  const [createOptionOpen, setCreateOptionOpen] = useState(false);
  const { t } = useTranslation(["admin"]);
  const { data, loading, error } = useGetBasemapQuery({
    variables: {
      id: basemapId,
    },
  });
  const [
    updateLabels,
    updateLabelsState,
  ] = useUpdateBasemapLabelsLayerMutation();
  const client = useApolloClient();
  const [mutateItem, mutateItemState] = useUpdateBasemapMutation({});
  const [updateUrl, updateUrlMutationState] = useUpdateBasemapUrlMutation();
  const [set3dTerrain, set3dTerrainMutationState] = useSet3dTerrainMutation();
  const [exaggeration, setExaggeration] = useState<number>(
    data?.basemap?.terrainExaggeration
  );
  const debouncedExaggeration = useDebounce(exaggeration, 50);
  const basemap = data?.basemap;

  useEffect(() => {
    if (basemap && !exaggeration) {
      setExaggeration(parseFloat(basemap.terrainExaggeration));
    }
  }, [basemap]);

  useEffect(() => {
    if (
      basemap &&
      exaggeration &&
      debouncedExaggeration &&
      parseFloat(basemap.terrainExaggeration) !==
        parseFloat(debouncedExaggeration)
    ) {
      client.writeFragment({
        id: `Basemap:${basemap.id}`,
        fragment: gql`
          fragment UpdateTerrainExaggeration on Basemap {
            terrainExaggeration
          }
        `,
        data: {
          terrainExaggeration: debouncedExaggeration,
        },
      });
      updateExaggeration({
        variables: {
          id: basemap.id,
          terrainExaggeration: debouncedExaggeration,
        },
      });
    }
  }, [debouncedExaggeration, basemap]);
  const [
    updateExaggeration,
    updateExaggerationMutationState,
  ] = useUpdateTerrainExaggerationMutation();

  const mapboxStyle = useMapboxStyle(
    basemap && basemap.type === BasemapType.Mapbox ? basemap.url : undefined
  );
  let layerIds: Layer[] = [];
  if (mapboxStyle.data) {
    layerIds = [...(mapboxStyle.data.layers || [])];
    layerIds.reverse();
  }

  let terrainSetting = "NONE";
  if (basemap?.terrainUrl) {
    if (basemap.terrainOptional) {
      if (basemap.terrainVisibilityDefault) {
        terrainSetting = "DEFAULT_ON";
      } else {
        terrainSetting = "DEFAULT_OFF";
      }
    } else {
      terrainSetting = "ALWAYS";
    }
  }

  return (
    <div
      className="bg-white z-20 absolute bottom-0 w-128 flex flex-col"
      style={{ height: "calc(100vh - 3rem)" }}
    >
      <div className="flex-0 p-4 border-b shadow-sm bg-primary-600">
        <button
          className="bg-gray-300 bg-opacity-25 float-right rounded-full p-1 cursor-pointer focus:ring-blue-300"
          onClick={onRequestClose}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="w-5 h-5 text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <h4 className="font-medium text-white">
          <Trans ns={["admin"]}>Edit Basemap</Trans>
        </h4>
      </div>
      {!basemap || mapboxStyle.loading ? (
        <div className="w-full mt-20 flex items-center justify-center text-gray-600">
          <span className="mx-1">{t("Loading style")}</span>
          <Spinner className="ml-0.5" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-scroll px-4 pb-4">
          <div className="md:max-w-sm mt-5">
            <MutableAutosaveInput
              mutation={mutateItem}
              mutationStatus={mutateItemState}
              propName="name"
              value={basemap.name || ""}
              label={t("Name")}
              variables={{ id: basemapId }}
            />
          </div>
          <div className="md:max-w-sm mt-5">
            <MutableAutosaveInput
              mutation={updateUrl}
              mutationStatus={updateUrlMutationState}
              propName="url"
              value={basemap.url}
              label="URL"
              variables={{ id: basemapId }}
            />
          </div>
          <div className="md:max-w-md mt-5">
            <label
              htmlFor="labelLayer"
              className="block text-sm font-medium leading-5 text-gray-700"
            >
              <Trans ns={["admin"]}>Labels Layer</Trans>
            </label>
            <p className="text-sm text-gray-500 py-1">
              <Trans ns={["admin"]}>
                By identifying the lowest labels layer in this basemap you will
                be able to configure layers to render below them.
              </Trans>
            </p>
            <select
              value={basemap.labelsLayerId || ""}
              id="imageFormat"
              disabled={updateLabelsState.loading}
              onChange={(e) => {
                let value: string | null = e.target.value;
                if (value === "") {
                  value = null;
                }
                client.writeFragment({
                  id: `Basemap:${basemap.id}`,
                  fragment: gql`
                    fragment NewLabelsLayer on Basemap {
                      labelsLayerId
                    }
                  `,
                  data: {
                    labelsLayerId: value,
                  },
                });
                updateLabels({
                  variables: {
                    id: basemapId,
                    layer: value,
                  },
                });
              }}
              className="rounded block w-96 pl-3 pr-4 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5 mt-1"
            >
              <option value={""}></option>
              {layerIds.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.id}
                </option>
              ))}
            </select>
          </div>
          <RadioGroup
            className="mt-5"
            legend={t(`3d Terrain`)}
            state={
              set3dTerrainMutationState.called
                ? set3dTerrainMutationState.loading
                  ? "SAVING"
                  : "SAVED"
                : "NONE"
            }
            items={[
              {
                label: t("None"),
                value: "NONE",
                description: t(
                  "Terrain works best with imagery data and is often best disabled otherwise"
                ),
              },
              {
                label: t("Always on"),
                value: "ALWAYS",
                description: t(
                  "Terrain will be enabled whenever this basemap is visible"
                ),
              },
              {
                label: t("On by default"),
                value: "DEFAULT_ON",
                description: t("Users can turn off 3d terrain if desired"),
              },
              {
                label: t("Off by default"),
                value: "DEFAULT_OFF",
                description: t("Users can turn on 3d terrain if desired"),
              },
            ]}
            value={terrainSetting}
            onChange={(v) => {
              let settings = {
                terrainUrl: null as null | string,
                terrainOptional: false,
                terrainVisibilityDefault: true,
              };
              if (v === "ALWAYS") {
                settings.terrainUrl = TERRAIN_URL;
              } else if (v === "DEFAULT_ON") {
                settings.terrainUrl = TERRAIN_URL;
                settings.terrainOptional = true;
              } else if (v === "DEFAULT_OFF") {
                settings.terrainUrl = TERRAIN_URL;
                settings.terrainOptional = true;
                settings.terrainVisibilityDefault = false;
              }
              client.writeFragment({
                id: `Basemap:${basemap.id}`,
                fragment: gql`
                  fragment NewTerrain on Basemap {
                    terrainUrl
                    terrainOptional
                    terrainVisibilityDefault
                  }
                `,
                data: settings,
              });
              set3dTerrain({
                variables: {
                  id: basemap.id,
                  ...settings,
                },
              });
            }}
          />
          <InputBlock
            className={`mt-5 relative ${
              terrainSetting === "NONE"
                ? "text-gray-400 pointer-events-none opacity-20"
                : ""
            }`}
            mutationStatus={updateExaggerationMutationState}
            labelType="small"
            title={t("Terrain Exaggeration")}
            input={
              <>
                <input
                  type="range"
                  value={exaggeration}
                  min={0.5}
                  max={3}
                  step={0.1}
                  onChange={(e) => {
                    setExaggeration(parseFloat(e.target.value));
                  }}
                />
                <div className="absolute right-44">{exaggeration || 1.2}x</div>
              </>
            }
          ></InputBlock>
          <div className="mt-5">
            <h5 className="block text-sm font-medium leading-5 text-gray-700">
              <Trans ns={["admin"]}>Optional Layers</Trans>
            </h5>
            <p className="text-sm text-gray-500 py-1">
              <Trans ns={["admin"]}>
                With Optional Layers you can provide a means for users to toggle
                components of the basemap like labels, or choose among mutually
                exclusive versions of a dataset like annual data
              </Trans>
              <br />
            </p>
            {basemap.optionalBasemapLayers.map((layer) => (
              <div className="my-2" key={layer.id}>
                <OptionalBasemapLayerEditor layerId={layer.id} />
              </div>
            ))}
            <Button
              className="mt-2"
              small
              label={t("Add Option")}
              onClick={() => setCreateOptionOpen(true)}
            />
          </div>
          {basemap.type === BasemapType.Mapbox && (
            <div className="mt-5">
              <InteractivitySettings
                basemap={basemap as ClientBasemap}
                id={basemap.interactivitySettings!.id}
              />
            </div>
          )}
        </div>
      )}
      {createOptionOpen && (
        <CreateOptionalLayerModal
          onRequestClose={() => setCreateOptionOpen(false)}
          basemapId={basemapId}
        />
      )}
    </div>
  );
}
