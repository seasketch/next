import React, { useState } from "react";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import TextInput from "../../components/TextInput";
import {
  OptionalBasemapLayersGroupType,
  useCreateOptionalLayerMutation,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import RadioGroup from "../../components/RadioGroup";

export interface CreateOptionaLayerProps {
  groupLabel?: string;
  basemapId: number;
  onRequestClose?: () => void;
}

export default function CreateOptionalLayerModal({
  onRequestClose,
  basemapId,
}: CreateOptionaLayerProps) {
  const { t } = useTranslation(["admin"]);
  const [state, setState] = useState<{
    name: string;
    firstOptionName?: string;
    groupType: OptionalBasemapLayersGroupType;
  }>({
    name: "",
    groupType: OptionalBasemapLayersGroupType.None,
  });
  const [createOption, createOptionState] = useCreateOptionalLayerMutation();
  const isLoading = createOptionState.loading;

  const error = createOptionState.error;
  function onSave() {
    let props: any = {};
    if (state.groupType === OptionalBasemapLayersGroupType.None) {
      props = {
        basemapId,
        name: state.name,
        groupType: state.groupType,
      };
    } else {
      props = {
        basemapId,
        name: state.name,
        groupType: state.groupType,
        options: [{ name: state.firstOptionName }],
      };
    }
    createOption({
      variables: props,
      update: (cache, mutationResult) => {
        const basemapId = cache.identify({
          __typename: "Basemap",
          id: props.basemapId,
        });

        const layer =
          mutationResult.data?.createOptionalBasemapLayer?.optionalBasemapLayer;
        if (layer) {
          cache.modify({
            id: basemapId,
            fields: {
              optionalBasemapLayers(existingOptionalLayerRefs, { readField }) {
                return [...existingOptionalLayerRefs, layer];
              },
            },
          });
        }
      },
    })
      .then(() => {
        if (onRequestClose) {
          onRequestClose();
        }
      })
      .catch((e) => {
        console.error(e);
      });
  }

  return (
    <Modal
      open={true}
      footer={
        <>
          {" "}
          <Button
            disabled={isLoading}
            label={t("Cancel")}
            onClick={() => {
              if (onRequestClose) {
                onRequestClose();
              }
            }}
          />{" "}
          <Button
            disabled={isLoading}
            loading={isLoading}
            className="ml-2"
            primary
            label={t("Save")}
            onClick={onSave}
          />
        </>
      }
    >
      <div className={`w-96 md:w-144`}>
        <h2 className="text-lg font-semibold mb-4">
          <Trans ns="admin">New Optional Layer</Trans>
        </h2>
        <div className="max-w-xs">
          <TextInput
            autoFocus
            error={error ? error.message : undefined}
            id="name"
            label={t("Name")}
            disabled={isLoading}
            value={state.name}
            onChange={(val) =>
              setState((prev) => ({
                ...prev,
                name: val,
              }))
            }
          />
        </div>
        <div className="mt-5">
          <RadioGroup
            legend={t("Option Type")}
            value={state.groupType}
            onChange={(v) => setState((prev) => ({ ...prev, groupType: v }))}
            items={[
              {
                label: "Switch",
                value: OptionalBasemapLayersGroupType.None,
                description: t(
                  "Simple switch to toggle a set of optional layers"
                ),
              },
              {
                label: "Dropdown Menu",
                value: OptionalBasemapLayersGroupType.Select,
                description: t(
                  "Groups of mutually exclusive layers can be chosen from a dropdown menu"
                ),
              },
              {
                label: "Radio Button",
                value: OptionalBasemapLayersGroupType.Radio,
                description: t(
                  "Groups of mutually exclusive layers can be chosen from a list of radio options"
                ),
              },
            ]}
          />
        </div>
        {state.groupType !== OptionalBasemapLayersGroupType.None && (
          <div className="max-w-xs mt-5">
            <TextInput
              error={error ? error.message : undefined}
              id="firstOptionName"
              label={t("Default option name")}
              disabled={isLoading}
              value={state.firstOptionName || ""}
              onChange={(val) =>
                setState((prev) => ({
                  ...prev,
                  firstOptionName: val,
                }))
              }
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
