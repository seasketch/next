import React, { useContext, useEffect, useState } from "react";
import Button from "../../components/Button";
import { MapContext } from "../../dataLayers/MapContextManager";
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

export default function BaseMapEditor() {
  const mapContext = useContext(MapContext);
  const { slug } = useParams<{ slug: string }>();
  const { data } = useGetBasemapsQuery({
    variables: {
      slug: slug,
    },
  });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteBasemap, deleteMutationState] = useDeleteBasemapMutation();
  const { t } = useTranslation("admin");
  const projectData = useGetProjectBySlugQuery({ variables: { slug } });
  const client = useApolloClient();
  useEffect(() => {
    if (data?.projectBySlug?.basemaps && mapContext.manager) {
      mapContext.manager.setBasemaps(data.projectBySlug.basemaps);
    }
  }, [data?.projectBySlug?.basemaps, mapContext.manager]);

  const { confirmDelete } = useDialog();
  return (
    <>
      <div>
        <div className="p-4">
          <div className="mb-4">
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
                      update: (cache) => {
                        const id = cache.identify(
                          data!.projectBySlug!.basemaps!.find(
                            (b) =>
                              b.id === parseInt(mapContext.selectedBasemap!)
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
                    }).catch((e) => {
                      console.error(e);
                      throw e;
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
                mapContext.manager?.setSelectedBasemap(id.toString());
              }}
            />
          )}
          <BasemapControl basemaps={data?.projectBySlug?.basemaps || []} />
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
