import { useState } from "react";
import TextInput from "../../components/TextInput";
import {
  OptionalBasemapLayersGroupType,
  useCreateOptionalLayerMutation,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import RadioGroup from "../../components/RadioGroup";
import Modal from "../../components/Modal";

export interface CreateOptionaLayerProps {
  groupLabel?: string;
  basemapId: number;
  onRequestClose?: () => void;
}

export default function CreateOptionalLayerModal({
  onRequestClose,
  basemapId,
}: CreateOptionaLayerProps) {
  const { t } = useTranslation("admin");
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
      title={<Trans ns="admin">New Optional Layer</Trans>}
      onRequestClose={() => {
        if (onRequestClose) {
          onRequestClose();
        }
      }}
      footer={[
        {
          label: t("Cancel"),
          disabled: isLoading,
          onClick: () => {
            if (onRequestClose) {
              onRequestClose();
            }
          },
        },
        {
          variant: "primary",
          disabled: isLoading,
          label: t("Save"),
          onClick: onSave,
        },
      ]}
    >
      <div className={`space-y-5 mb-5`}>
        <div className="max-w-xs">
          <TextInput
            autoFocus
            error={error ? error.message : undefined}
            name="name"
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
        <div className="">
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
          <div className="max-w-xs">
            <TextInput
              error={error ? error.message : undefined}
              name="firstOptionName"
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
