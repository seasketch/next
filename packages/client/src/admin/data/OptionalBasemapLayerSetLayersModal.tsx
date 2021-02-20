import React, { useState } from "react";
import Modal from "../../components/Modal";
import {
  OptionalBasemapLayer,
  useGetBasemapQuery,
  useUpdateOptionalBasemapLayerLayerListMutation,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import { useMapboxStyle } from "../../useMapboxStyle";
import Spinner from "../../components/Spinner";
import Button from "../../components/Button";

export default function OptionalBasemapLayerSetLayersModal({
  layer,
  onRequestClose,
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
  onRequestClose?: () => void;
}) {
  const { t } = useTranslation(["admin"]);
  const [layers, setLayers] = useState<string[]>(
    layer.layers === null ? [] : (layer.layers as string[])
  );
  const { data, loading, error } = useGetBasemapQuery({
    variables: {
      id: layer.basemapId,
    },
  });
  const styleRequest = useMapboxStyle(data?.basemap?.url);
  const style = styleRequest.data;
  const [
    mutate,
    mutationState,
  ] = useUpdateOptionalBasemapLayerLayerListMutation();

  const onSave = async () => {
    await mutate({
      variables: {
        id: layer.id,
        layers: layers,
      },
    });
    if (onRequestClose) {
      onRequestClose();
    }
  };

  return (
    <Modal
      title={t("Set Layers")}
      open={true}
      footer={
        <div className="text-left">
          <Button
            label={t("Cancel")}
            className="mr-2"
            onClick={onRequestClose}
          />
          <Button
            label={t("Save")}
            primary
            onClick={onSave}
            disabled={mutationState.loading}
            loading={mutationState.loading}
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
                  <li>
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
    </Modal>
  );
}
