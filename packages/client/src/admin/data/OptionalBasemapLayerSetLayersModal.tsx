import React, { useState } from "react";
import ModalDeprecated from "../../components/ModalDeprecated";
import {
  OptionalBasemapLayer,
  useGetBasemapQuery,
  useUpdateOptionalBasemapLayerLayerListMutation,
  useUpdateOptionalBasemapLayerOptionsMutation,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import { useMapboxStyle } from "../../useMapboxStyle";
import Spinner from "../../components/Spinner";
import Button from "../../components/Button";

export default function OptionalBasemapLayerSetLayersModal({
  layer,
  onRequestClose,
  optionName,
}: {
  layer: Pick<
    OptionalBasemapLayer,
    | "id"
    | "name"
    | "options"
    | "groupType"
    | "defaultVisibility"
    | "description"
    | "layers"
    | "basemapId"
  >;
  onRequestClose?: () => void;
  optionName?: string | null;
}) {
  const { t } = useTranslation(["admin"]);
  let initialLayers: string[] = Array.isArray(layer.layers)
    ? (layer.layers as string[])
    : [];

  if (optionName) {
    const option = (layer.options || []).find(
      (o: { name: string }) => o.name === optionName
    );
    if (!option) {
      /* eslint-disable-next-line */
      throw Error(`Could not find option with name ${optionName}`);
    }
    initialLayers = option.layers || [];
  }
  const [layers, setLayers] = useState<string[]>(initialLayers);
  const { data, loading, error } = useGetBasemapQuery({
    variables: {
      id: layer.basemapId,
    },
  });
  const styleRequest = useMapboxStyle(data?.basemap?.url);
  const style = styleRequest.data;
  const [mutate, mutationState] =
    useUpdateOptionalBasemapLayerLayerListMutation();
  const [updateOptionsMutation, updateOptionsMutationState] =
    useUpdateOptionalBasemapLayerOptionsMutation();

  const onSave = async () => {
    if (optionName) {
      const options = [...layer.options];
      let option = options.find((o: { name: string }) => o.name === optionName);
      if (!option) {
        /* eslint-disable-next-line */
        throw new Error(`Could not find option named ${optionName}`);
      }
      const i = options.indexOf(option);
      const newOptions = [
        ...options.slice(0, i),
        {
          ...option,
          layers,
        },
        ...options.slice(i + 1),
      ];
      await updateOptionsMutation({
        variables: {
          id: layer.id,
          options: newOptions,
        },
      });
    } else {
      await mutate({
        variables: {
          id: layer.id,
          layers: layers,
        },
      });
    }
    if (onRequestClose) {
      onRequestClose();
    }
  };

  return (
    <ModalDeprecated
      title={t("Set Layers")}
      open={true}
      footer={
        <div className="text-left">
          <Button
            small
            className="float-right ml-2 mt-1"
            label={t("Select All")}
            onClick={() => setLayers(style?.layers?.map((l) => l.id) || [])}
          />
          <Button
            small
            className="float-right mt-1"
            label={t("Select None")}
            onClick={() => setLayers([])}
          />
          <Button
            label={t("Cancel")}
            className="mr-2"
            onClick={onRequestClose}
          />
          <Button
            label={t("Save")}
            primary
            onClick={onSave}
            disabled={
              mutationState.loading || updateOptionsMutationState.loading
            }
            loading={
              mutationState.loading || updateOptionsMutationState.loading
            }
          />
        </div>
      }
    >
      <div className="w-128 h-96">
        {loading || (styleRequest.loading && <Spinner />)}
        {style && (
          <>
            <p className="text-gray-500 text-sm mb-4">
              <Trans ns={["admin"]}>
                Select all layers in the basemap that will be controlled by this
                option. When added to an Optional Layer, these layers will be
                hidden unless an associated control has been toggled.
              </Trans>
            </p>
            <ul>
              {style.layers?.map((lyr) => {
                const checked = layers.indexOf(lyr.id) !== -1;
                return (
                  <li key={lyr.id}>
                    <input
                      id={lyr.id}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded m-2"
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setLayers((prev) =>
                          checked
                            ? [...prev].filter((l) => l !== lyr.id)
                            : [...prev, lyr.id]
                        );
                      }}
                    ></input>
                    <label htmlFor={lyr.id}>{lyr.id}</label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </ModalDeprecated>
  );
}
