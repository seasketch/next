import React, { useContext, useEffect, useState } from "react";
import Button from "../../components/Button";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import { ClientBasemap, MapContext } from "../../dataLayers/MapContextManager";
import {
  useGetBasemapsQuery,
  useDeleteBasemapMutation,
  useGetProjectBySlugQuery,
  OptionalBasemapLayersGroupType,
} from "../../generated/graphql";
import BasemapEditorPanel from "./BasemapEditorPanel";
import CreateBasemapModal from "./CreateBasemapModal";
import { useTranslation, Trans } from "react-i18next";
import { useApolloClient } from "@apollo/client";
import { useParams } from "react-router-dom";
import OptionalBasemapLayerControl from "../../dataLayers/OptionalBasemapLayerControl";

export default function BaseMapEditor() {
  const mapContext = useContext(MapContext);
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useGetBasemapsQuery({
    variables: {
      slug: slug,
    },
  });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteBasemap, deleteMutationState] = useDeleteBasemapMutation();
  const { t } = useTranslation(["admin"]);
  const projectData = useGetProjectBySlugQuery({ variables: { slug } });
  const client = useApolloClient();
  useEffect(() => {
    if (data?.projectBySlug?.basemaps && mapContext.manager) {
      mapContext.manager.setBasemaps(
        data.projectBySlug.basemaps as ClientBasemap[]
      );
    }
  }, [data?.projectBySlug?.basemaps, mapContext.manager]);

  const selectedBasemap = mapContext.manager?.getSelectedBasemap();
  const terrainOptional =
    selectedBasemap &&
    selectedBasemap.terrainUrl &&
    selectedBasemap.terrainOptional;
  const showBasemapOptions =
    selectedBasemap &&
    (selectedBasemap.optionalBasemapLayers.length || terrainOptional);
  return (
    <>
      <div>
        <div className="p-4">
          <div className="mb-4">
            <Button
              small
              label="Add basemap"
              onClick={() => setAddModalOpen(true)}
            />
            <Button
              className="ml-2"
              small
              disabled={!mapContext.selectedBasemap}
              label="Edit"
              onClick={() => setEditModalOpen(true)}
            />
            <Button
              className="ml-2"
              small
              disabled={
                !mapContext.selectedBasemap || deleteMutationState.loading
              }
              label="Delete"
              onClick={() => {
                if (
                  window.confirm(
                    t("Are you sure you want to delete the basemap?")
                  )
                ) {
                  deleteBasemap({
                    variables: {
                      id: parseInt(mapContext.selectedBasemap!),
                    },
                    update: (cache) => {
                      const id = cache.identify(
                        data!.projectBySlug!.basemaps!.find(
                          (b) => b.id === parseInt(mapContext.selectedBasemap!)
                        )!
                      );

                      client.cache.evict({
                        id,
                      });

                      const projectId = cache.identify(
                        projectData.data!.projectBySlug!
                      );
                      cache.modify({
                        id: projectId,
                        fields: {
                          basemaps(existingBasemapRefs, { readField }) {
                            return existingBasemapRefs.filter(
                              // @ts-ignore
                              (basemapRef) => {
                                return (
                                  mapContext.selectedBasemap !==
                                  readField("id", basemapRef)
                                );
                              }
                            );
                          },
                        },
                      });
                    },
                  });
                }
              }}
            />
          </div>
          {addModalOpen && (
            <CreateBasemapModal onRequestClose={() => setAddModalOpen(false)} />
          )}
          <div className="w-full flex flex-wrap justify-center">
            {[...(data?.projectBySlug?.basemaps || [])]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((b) => (
                <BasemapSquareItem
                  selected={mapContext.selectedBasemap === b.id.toString()}
                  error={mapContext.basemapError}
                  key={b.id}
                  basemap={b}
                  onClick={() => {
                    // if (selectedBasemap !== b.id) {
                    mapContext.manager?.setSelectedBasemap(b.id.toString());
                    // setSelectedBasemap(b.id);
                    // managerContext.manager?.changeBasemap(b.url);
                    // }
                  }}
                />
              ))}
          </div>
        </div>
        {editModalOpen && mapContext.selectedBasemap && (
          <BasemapEditorPanel
            onRequestClose={() => setEditModalOpen(false)}
            basemapId={parseInt(mapContext.selectedBasemap)}
          />
        )}
        {showBasemapOptions && (
          <div
            className="p-5 bottom-0 border-t w-128"
            style={{ minHeight: "20%" }}
          >
            <h4 className="pb-2 font-semibold">Basemap Options</h4>
            {terrainOptional && (
              <div className="">
                <InputBlock
                  title={<span className="font-light">3d Terrain</span>}
                  input={
                    <Switch
                      isToggled={mapContext.terrainEnabled}
                      onClick={() => {
                        if (
                          mapContext.manager?.map &&
                          !mapContext.prefersTerrainEnabled &&
                          mapContext.manager.map.getPitch() === 0
                        ) {
                          // turning on, add some pitch
                          mapContext.manager.map.easeTo({ pitch: 75 });
                        }
                        mapContext.manager?.toggleTerrain();
                      }}
                    />
                  }
                ></InputBlock>
              </div>
            )}
            {(
              mapContext.manager!.getSelectedBasemap()!.optionalBasemapLayers ||
              []
            ).map((layer) => {
              return (
                <OptionalBasemapLayerControl key={layer.id} layer={layer} />
              );
            })}
            <button
              className="underline text-gray-500 text-sm"
              onClick={() => {
                if (mapContext.manager) {
                  mapContext.manager.clearOptionalBasemapSettings();
                  mapContext.manager.clearTerrainSettings();
                }
              }}
            >
              reset to defaults
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function BasemapSquareItem({
  basemap,
  selected,
  onClick,
  error,
}: {
  basemap: { name: string; thumbnail: string; id: number };
  selected: boolean;
  error?: Error;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col m-2 cursor-pointer" onClick={onClick}>
      <div
        className={`w-32 h-32 rounded-md mb-1 ${
          selected
            ? error
              ? "ring-4 ring-red-700 shadow-xl"
              : "ring-4 ring-blue-500 shadow-xl"
            : "shadow-md"
        }`}
        style={{
          background: `grey url(${basemap.thumbnail})`,
          backgroundSize: "cover",
        }}
      >
        &nbsp;
      </div>
      <h4
        className={`w-32 truncate text-center font-medium  text-sm px-2 ${
          selected ? "text-gray-800 " : "text-gray-600"
        }`}
      >
        {basemap.name}
      </h4>
    </div>
  );
}
