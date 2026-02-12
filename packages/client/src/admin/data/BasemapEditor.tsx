import React, { useContext, useEffect, useState } from "react";
import Button from "../../components/Button";
import { MapManagerContext } from "../../dataLayers/MapContextManager";
import { BasemapContext } from "../../dataLayers/BasemapContext";
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
import useDialog from "../../components/useDialog";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

export default function BaseMapEditor() {
  const mapContext = useContext(BasemapContext);
  const { manager } = useContext(MapManagerContext);
  const { slug } = useParams<{ slug: string }>();
  const { data } = useGetBasemapsQuery({
    variables: {
      slug: slug,
    },
  });

  useEffect(() => {
    console.log("BasemapEditor: mapContext changed");
  }, [mapContext.selectedBasemap]);

  useEffect(() => {
    console.log("BasemapEditor: manager changed");
  }, [manager]);

  useEffect(() => {
    console.log("BasemapEditor: mounted");
  }, []);

  console.log("BasemapEditor: render");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteBasemap, deleteMutationState] = useDeleteBasemapMutation();
  const { t } = useTranslation("admin");
  const projectData = useGetProjectBySlugQuery({ variables: { slug } });
  const client = useApolloClient();
  useEffect(() => {
    if (data?.projectBySlug?.basemaps && manager) {
      manager.setBasemaps(data.projectBySlug.basemaps);
    }
  }, [data?.projectBySlug?.basemaps, manager]);
  const onError = useGlobalErrorHandler();

  const { confirmDelete } = useDialog();
  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-4 pb-1">
          <Button
            small
            label={t("Add a new map")}
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
              confirmDelete({
                message: t("Are you sure you want to delete this map?"),
                description: t("This action cannot be undone."),
                onDelete: async () => {
                  await deleteBasemap({
                    variables: {
                      id: parseInt(mapContext.selectedBasemap!),
                    },
                    onError,
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
                },
              });
            }}
          />
        </div>
        {addModalOpen && (
          <CreateBasemapModal
            onRequestClose={() => setAddModalOpen(false)}
            onSave={(id) => {
              manager?.setSelectedBasemap(id.toString());
            }}
          />
        )}
        <div className="flex-1 overflow-y-auto">
          <BasemapControl basemaps={data?.projectBySlug?.basemaps || []} />
        </div>
      </div>
      {editModalOpen && mapContext.selectedBasemap && (
        <BasemapEditorPanel
          onRequestClose={() => setEditModalOpen(false)}
          basemapId={parseInt(mapContext.selectedBasemap)}
        />
      )}
    </>
  );
}
