import React, { useState } from "react";
import Button from "../components/Button";
import OptionalBasemapLayerControl from "./OptionalBasemapLayerControl";
import { useTranslation, Trans } from "react-i18next";
import {
  OptionalBasemapLayer,
  useUpdateOptionalLayerMutation,
  useDeleteOptionalLayerMutation,
} from "../generated/graphql";
import OptionalBasemapLayerSetLayersModal from "../admin/data/OptionalBasemapLayerSetLayersModal";

export default function OptionalBasemapLayerEditor({
  layer,
}: {
  layer: Pick<
    OptionalBasemapLayer,
    | "id"
    | "name"
    | "groupLabel"
    | "groupType"
    | "defaultVisibility"
    | "description"
    | "layers"
    | "basemapId"
  >;
}) {
  const { t } = useTranslation(["admin"]);
  const [mutate, mutationState] = useUpdateOptionalLayerMutation();
  const [del, deleteState] = useDeleteOptionalLayerMutation();
  const [layersModalOpen, setLayersModalOpen] = useState(false);

  return (
    <>
      {" "}
      <div className="bg-gray-50 rounded-t border-t border-r border-l py-1 pt-2 px-4">
        <OptionalBasemapLayerControl layer={layer} />
      </div>
      <div className="p-2 border-r border-l border rounded-b text-sm mt-0">
        <Button
          className="m-1"
          small
          label={t("Change label")}
          onClick={() => {
            const newName = window.prompt(t("Enter a new label"), layer.name);
            if (newName?.length) {
              mutate({
                variables: {
                  id: layer.id,
                  name: newName,
                },
              });
            }
          }}
        />
        <Button
          className="m-1"
          small
          label={
            layer.description?.length
              ? t("Edit description")
              : t("Add description")
          }
          onClick={() => {
            const newDescription = window.prompt(
              t("Enter a new description"),
              layer.description || ""
            );
            mutate({
              variables: {
                id: layer.id,
                description: newDescription || "",
              },
            });
          }}
        />
        <Button
          className="m-1"
          small
          label={t("Set layers") + ` (${layer.layers.length})`}
          onClick={() => setLayersModalOpen(true)}
        />
        <Button
          className="m-1"
          small
          label={t("Delete")}
          onClick={() => {
            if (
              window.confirm(t("Are you sure you want to delete this layer?"))
            ) {
              del({
                variables: {
                  id: layer.id,
                },
                update: (cache) => {
                  const basemapId = cache.identify({
                    __typename: "Basemap",
                    id: layer.basemapId,
                  });

                  cache.evict({
                    id: cache.identify(layer),
                  });

                  cache.modify({
                    id: basemapId,
                    fields: {
                      optionalBasemapLayers(
                        existingOptionalLayerRefs,
                        { readField }
                      ) {
                        return existingOptionalLayerRefs.filter(
                          // @ts-ignore
                          (layerRef) => {
                            return layer.id !== readField("id", layerRef);
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
        <Button
          className="m-1"
          small
          label={layer.defaultVisibility ? t("Default on") : t("Default off")}
          primary={layer.defaultVisibility}
          loading={mutationState.loading}
          onClick={() => {
            mutate({
              variables: {
                id: layer.id,
                defaultVisibility: !layer.defaultVisibility,
              },
            });
          }}
        />
      </div>
      {layersModalOpen && (
        <OptionalBasemapLayerSetLayersModal
          onRequestClose={() => setLayersModalOpen(false)}
          layer={layer}
        />
      )}
    </>
  );
}
