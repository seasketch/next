import React, { useContext, useEffect, useState } from "react";
import Button from "../../components/Button";
import { ClientBasemap, MapContext } from "../../dataLayers/MapContextManager";
import {
  useGetBasemapsQuery,
  useDeleteBasemapMutation,
  useGetProjectBySlugQuery,
} from "../../generated/graphql";
import BasemapEditorPanel from "./BasemapEditorPanel";
import CreateBasemapModal from "./CreateBasemapModal";
import { useTranslation } from "react-i18next";
import { useApolloClient } from "@apollo/client";
import { useParams } from "react-router-dom";
import BasemapControl from "../../dataLayers/BasemapControl";

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
              label={t("Add basemap")}
              onClick={() => setAddModalOpen(true)}
            />
            <Button
              className="ml-2"
              small
              disabled={!mapContext.selectedBasemap}
              label={t("Edit")}
              onClick={() => setEditModalOpen(true)}
            />
            <Button
              className="ml-2"
              small
              disabled={
                !mapContext.selectedBasemap || deleteMutationState.loading
              }
              label={t("Delete")}
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
          <BasemapControl
            basemaps={(data?.projectBySlug?.basemaps || []) as ClientBasemap[]}
          />
        </div>
        {editModalOpen && mapContext.selectedBasemap && (
          <BasemapEditorPanel
            onRequestClose={() => setEditModalOpen(false)}
            basemapId={parseInt(mapContext.selectedBasemap)}
          />
        )}
      </div>
    </>
  );
}
