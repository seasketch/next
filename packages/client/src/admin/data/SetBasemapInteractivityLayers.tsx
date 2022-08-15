import { useState } from "react";
import { useUpdateInteractivitySettingsLayersMutation } from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import { useMapboxStyle } from "../../useMapboxStyle";
import Spinner from "../../components/Spinner";
import Modal from "../../components/Modal";

export default function SetBasemapInteractivityLayers({
  initialLayers,
  onRequestClose,
  styleUrl,
  id,
}: {
  initialLayers: string[];
  onRequestClose?: () => void;
  styleUrl: string;
  id: number;
}) {
  const { t } = useTranslation(["admin"]);
  const [layers, setLayers] = useState<string[]>([...initialLayers]);
  const styleRequest = useMapboxStyle(styleUrl);
  const style = styleRequest.data;

  const [mutate, mutationState] =
    useUpdateInteractivitySettingsLayersMutation();

  return (
    <Modal
      scrollable
      title={
        <>
          <h3>{t("Set Layers")}</h3>
          <p className="text-gray-500 text-sm mt-4">
            <Trans ns={["admin"]}>
              Select all layers in the basemap that you would like to be
              interactive.
            </Trans>
          </p>
        </>
      }
      onRequestClose={onRequestClose!}
      footer={[
        {
          label: t("Save"),
          variant: "primary",
          loading: mutationState.loading,
          disabled: mutationState.loading,
          onClick: async () => {
            await mutate({
              variables: {
                id,
                layers,
              },
            });
            if (onRequestClose) {
              onRequestClose();
            }
          },
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
      <div>
        {mutationState.loading || (styleRequest.loading && <Spinner />)}
        {style && (
          <>
            <ul>
              {style.layers?.map((lyr, i) => {
                const checked = layers.indexOf(lyr.id) !== -1;
                return (
                  <li key={lyr.id + i}>
                    <input
                      id={lyr.id + i}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded m-2"
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setLayers(
                          !e.target.checked
                            ? layers.filter((l) => l !== lyr.id)
                            : [...layers, lyr.id]
                        );
                      }}
                    ></input>
                    <label htmlFor={lyr.id + i}>{lyr.id}</label>
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
