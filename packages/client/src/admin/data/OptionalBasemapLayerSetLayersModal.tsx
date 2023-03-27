import { useState } from "react";
import {
  OptionalBasemapLayer,
  useGetBasemapQuery,
  useUpdateOptionalBasemapLayerLayerListMutation,
  useUpdateOptionalBasemapLayerOptionsMutation,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import { useMapboxStyle } from "../../useMapboxStyle";
import Spinner from "../../components/Spinner";
import Modal from "../../components/Modal";

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
  const { t } = useTranslation("admin");
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
  const { data, loading } = useGetBasemapQuery({
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
    <Modal
      scrollable={true}
      title={
        <>
          <h3>{t("Set Layers")}</h3>
          <p className="text-gray-500 text-sm mt-4">
            <Trans ns={["admin"]}>
              Select all layers in the basemap that will be controlled by this
              option. When added to an Optional Layer, these layers will be
              hidden unless an associated control has been toggled.
            </Trans>
          </p>
        </>
      }
      onRequestClose={() => {}}
      footer={[
        {
          label: t("Save"),
          variant: "primary",
          disabled: mutationState.loading || updateOptionsMutationState.loading,
          loading: mutationState.loading || updateOptionsMutationState.loading,
          onClick: onSave,
        },
        {
          label: t("Cancel"),
          onClick: onRequestClose,
        },
        {
          label: t("Select All"),
          onClick: () => setLayers(style?.layers?.map((l) => l.id) || []),
        },
        {
          label: t("Select None"),
          onClick: () => setLayers([]),
        },
      ]}
    >
      <div className="">
        {loading || (styleRequest.loading && <Spinner />)}
        {style && (
          <>
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
    </Modal>
  );
}
