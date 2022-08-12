import React, { useState } from "react";
import ModalDeprecated from "../../components/ModalDeprecated";
import { useUpdateInteractivitySettingsLayersMutation } from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import { useMapboxStyle } from "../../useMapboxStyle";
import Spinner from "../../components/Spinner";
import Button from "../../components/Button";

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

  const onSave = async () => {
    await mutate({
      variables: {
        id,
        layers,
      },
    });
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
            disabled={mutationState.loading}
            loading={mutationState.loading}
          />
        </div>
      }
    >
      <div className="w-128 h-96">
        {mutationState.loading || (styleRequest.loading && <Spinner />)}
        {style && (
          <>
            <p className="text-gray-500 text-sm mb-4">
              <Trans ns={["admin"]}>
                Select all layers in the basemap that you would like to be
                interactive.
              </Trans>
            </p>
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
    </ModalDeprecated>
  );
}
