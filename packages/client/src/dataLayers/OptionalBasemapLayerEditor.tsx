import { useState } from "react";
import Button from "../components/Button";
import OptionalBasemapLayerControl from "./OptionalBasemapLayerControl";
import { useTranslation } from "react-i18next";
import {
  useUpdateOptionalLayerMutation,
  useDeleteOptionalLayerMutation,
  OptionalBasemapLayersGroupType,
  useUpdateOptionalBasemapLayerOptionsMutation,
  useGetOptionalBasemapLayerQuery,
} from "../generated/graphql";
import { useApolloClient, gql } from "@apollo/client";

import OptionalBasemapLayerSetLayersModal from "../admin/data/OptionalBasemapLayerSetLayersModal";
import Spinner from "../components/Spinner";
import OptionalLayerMetadataEditor from "../admin/data/OptionalLayerMetadataEditor";

export default function OptionalBasemapLayerEditor({
  layerId,
}: {
  layerId: number;
}) {
  const { t } = useTranslation(["admin"]);
  const [mutate, mutationState] = useUpdateOptionalLayerMutation();
  const [del, deleteState] = useDeleteOptionalLayerMutation();
  const layerRequest = useGetOptionalBasemapLayerQuery({
    variables: {
      id: layerId,
    },
  });
  const layer = layerRequest.data?.optionalBasemapLayer;
  const [layersModalOpen, setLayersModalOpen] = useState(false);
  const [optionalLayerMetadataModalOpen, setOptionalLayerMetadataModalOpen] =
    useState<number | undefined>();
  const [currentOptionName, setCurrentOptionName] =
    useState<string | null>(null);
  const client = useApolloClient();
  const [updateOptionsMutation, updateOptionsMutationState] =
    useUpdateOptionalBasemapLayerOptionsMutation();

  if (!layer || layerRequest.loading) {
    return <Spinner />;
  }

  let options = layer.options as {
    name: string;
    description?: string;
    layers?: string[];
  }[];
  if (
    layer.groupType !== OptionalBasemapLayersGroupType.None &&
    !Array.isArray(options)
  ) {
    options = [];
  }

  const updateOptions = (
    options: {
      name: string;
      description?: string;
      layers?: string[];
    }[]
  ) => {
    const layerId = client.cache.identify({
      __typename: "OptionalBasemapLayer",
      id: layer.id,
    });

    client.writeFragment({
      id: layerId,
      fragment: gql`
        fragment NewLayerOptions on OptionalBasemapLayer {
          options
        }
      `,
      data: {
        options,
      },
    });

    updateOptionsMutation({
      variables: {
        id: layer.id,
        options,
      },
    });
  };

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
        {layer.groupType === OptionalBasemapLayersGroupType.None && (
          <Button
            className="m-1"
            small
            label={t("Set layers") + ` (${layer.layers.length})`}
            onClick={() => setLayersModalOpen(true)}
          />
        )}
        <Button
          className="m-1"
          small
          label={t("Edit metadata")}
          onClick={() => setOptionalLayerMetadataModalOpen(layer.id)}
        />
        {layer.metadata && (
          <Button
            className="m-1"
            small
            label={t("Clear metadata")}
            onClick={() =>
              mutate({
                variables: {
                  id: layer.id,
                  metadata: null,
                },
              })
            }
          />
        )}
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
        {layer.groupType === OptionalBasemapLayersGroupType.None && (
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
        )}
        {layer.groupType !== OptionalBasemapLayersGroupType.None && (
          <div className="p-2">
            <h4 className="text-gray-500">{t("Options")}</h4>
            <div className="py-2">
              {options.map((option, i) => (
                <div className="" key={option.name + i}>
                  <span className="">{option.name}</span>
                  <Button
                    className="m-1"
                    small
                    label={t(`Change name`)}
                    onClick={() => {
                      const name = window.prompt(t("New name"), option.name);
                      if (name && name.length) {
                        const index = options.indexOf(option);
                        updateOptions([
                          ...options.slice(0, index),
                          {
                            ...option,
                            name,
                          },
                          ...options.slice(index + 1),
                        ]);
                      }
                    }}
                  />
                  <Button
                    className="m-1"
                    small
                    label={t(`Set layers`) + `(${option.layers?.length || 0})`}
                    onClick={() => {
                      setCurrentOptionName(option.name);
                      setLayersModalOpen(true);
                    }}
                  />
                  {layer.groupType === OptionalBasemapLayersGroupType.Radio && (
                    <Button
                      className="m-1"
                      small
                      label={t("Change description")}
                      onClick={() => {
                        const description = window.prompt(
                          t("New description"),
                          option.description
                        );
                        if (description) {
                          const index = options.indexOf(option);
                          updateOptions([
                            ...options.slice(0, index),
                            {
                              ...option,
                              description,
                            },
                            ...options.slice(index + 1),
                          ]);
                        }
                      }}
                    />
                  )}
                  <Button
                    className="m-1"
                    small
                    label={t("Delete")}
                    onClick={() => {
                      updateOptions(
                        options.filter((o) => o.name !== option.name)
                      );
                    }}
                  />
                </div>
              ))}
            </div>
            <Button
              className="mt-2"
              small
              label={
                layer.groupType === OptionalBasemapLayersGroupType.Radio
                  ? t("Add Radio Option")
                  : t("Add Select Option")
              }
              onClick={() => {
                const name = window.prompt(t("Option name"));
                if (name && name.length > 0) {
                  updateOptions([...options, { name }]);
                }
              }}
            />
          </div>
        )}
      </div>
      {layersModalOpen && (
        <OptionalBasemapLayerSetLayersModal
          onRequestClose={() => setLayersModalOpen(false)}
          layer={layer}
          optionName={currentOptionName}
        />
      )}
      {optionalLayerMetadataModalOpen && (
        <OptionalLayerMetadataEditor
          id={optionalLayerMetadataModalOpen}
          onRequestClose={() => setOptionalLayerMetadataModalOpen(undefined)}
        />
      )}
    </>
  );
}
