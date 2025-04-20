import { useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { ReactNode, useMemo } from "react";
import { CircleIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { CheckCircleIcon } from "@heroicons/react/solid";
import useEEZChoices from "./useEEZChoices";
import Button from "../../components/Button";
import RadioGroup from "../../components/RadioGroup";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";

export type CreateGeographyWizardState = {
  step: "chooseTemplate" | "eezPicker" | "layerPicker" | "config";
  template?:
    | "MARINE_REGIONS_EEZ_LAND_JOINED"
    | "DAYLIGHT_COASTLINE"
    | "MARINE_REGIONS_TERRITORIAL_SEA"
    | "MARINE_REGIONS_CONTIGUOUS_ZONE"
    | "MARINE_REGIONS_HIGH_SEAS";
  selectedEEZs?: number[];
  multipleEEZHandling: "separate" | "combine";
  eraseLand: boolean;
};

export default function CreateGeographyWizard({
  state,
  onRequestClose,
  setState,
  onRequestEEZPicker,
}: {
  state: CreateGeographyWizardState;
  onRequestClose: () => void;
  // react useState setter
  setState: (
    updater:
      | ((prevState: CreateGeographyWizardState) => CreateGeographyWizardState)
      | CreateGeographyWizardState
  ) => void;
  onRequestEEZPicker?: () => Promise<number[]>;
}) {
  const { t } = useTranslation("admin:geography");
  const eezChoices = useEEZChoices();

  const chosenEEZs = useMemo(() => {
    if (state.selectedEEZs && eezChoices) {
      return eezChoices.data.filter((choice) =>
        state.selectedEEZs!.includes(choice.value)
      );
    }
    return [];
  }, [state.selectedEEZs, eezChoices]);

  return (
    <Modal
      title={t("")}
      autoWidth={true}
      onRequestClose={onRequestClose}
      className="bg-white border-black border"
      zeroPadding={true}
      open={state.step !== "eezPicker"}
      // disableBackdropClick={state.step !== "chooseTemplate"}
      disableBackdropClick={state.step !== "chooseTemplate"}
    >
      {state.step === "chooseTemplate" && (
        <div className="bg-white w-128 border-collapse pb-1 z-50">
          {/* <h3 className="p-2">{t("Create a Geography using...")}</h3> */}
          <GeographyTypeChoice
            autoFocus
            label={t("Use a Custom Layer")}
            description={t(
              "Choose from an existing overlay or upload a new polygon layer that represents a geography"
            )}
            onClick={() =>
              setState((prev) => {
                return {
                  ...prev,
                  step: "layerPicker",
                  template: undefined,
                };
              })
            }
          />
          <p className="text-sm font-light px-4 py-2 bg-gray-50 border-t">
            {t("Or, create a Geography using authoritative data sources")}
          </p>
          <GeographyTypeChoice
            checked={false}
            label={t("Exclusive Economic Zones (EEZ)")}
            description={t(
              "Choose one or more EEZ's using data from MarineRegions.org"
            )}
            onClick={async () => {
              setState((prev) => ({
                ...prev,
                step: "eezPicker",
                template: "MARINE_REGIONS_EEZ_LAND_JOINED",
                selectedEEZs: [],
              }));
              if (onRequestEEZPicker) {
                const eezs = await onRequestEEZPicker();
                if (eezs && eezs.length > 0) {
                  setState((prev) => ({
                    ...prev,
                    selectedEEZs: eezs,
                    step: "config",
                    template: "MARINE_REGIONS_EEZ_LAND_JOINED",
                  }));
                } else {
                  onRequestClose();
                }
              }
            }}
          />
          <GeographyTypeChoice
            label={t("Territorial Sea")}
            checked={false}
            description={t(
              "Include 12nm boundaries for one or more nations using data from MarineRegions.org"
            )}
            onClick={() => {}}
          />
          <GeographyTypeChoice
            label={t("Contiguous Zone")}
            checked={false}
            description={t(
              "Represent the 24nm contiguous zone using data from MarineRegions.org"
            )}
            onClick={() => {
              setState((prev) => {
                return {
                  ...prev,
                  step: "config",
                  template: "MARINE_REGIONS_CONTIGUOUS_ZONE",
                };
              });
            }}
          />
          <GeographyTypeChoice
            label={t("High Seas")}
            checked={false}
            description={t(
              "Represent areas beyond national jurisdiction using data from MarineRegions.org"
            )}
            onClick={() => {
              setState((prev) => {
                return {
                  ...prev,
                  step: "config",
                  template: "MARINE_REGIONS_HIGH_SEAS",
                };
              });
            }}
          />
          <GeographyTypeChoice
            label={t("Terrestrial Areas")}
            checked={false}
            description={t(
              "Design and evaluate sketches on land using OpenStreetMap"
            )}
            onClick={() => {
              setState((prev) => {
                return {
                  ...prev,
                  step: "config",
                  template: "DAYLIGHT_COASTLINE",
                };
              });
            }}
          />
        </div>
      )}
      {state.step === "config" &&
        state.template === "MARINE_REGIONS_EEZ_LAND_JOINED" &&
        chosenEEZs?.length && (
          <div className="w-144 bg-white">
            <div className="p-4">
              <h3 className="text-sm text-gray-500">
                {chosenEEZs.length > 1
                  ? t("Exclusive Economic Zones")
                  : t("Exclusive Economic Zone")}
              </h3>
              {chosenEEZs.length && (
                <h4 className="space-x-2 text-xl font-semibold">
                  <span>{chosenEEZs.map((c) => c.label).join(", ")}</span>
                </h4>
              )}
              <div className="py-2 space-y-1">
                <h5 className="">{t("Geography Options")}</h5>
                {chosenEEZs.length > 1 && (
                  <>
                    <RadioGroup
                      className="pb-2"
                      items={[
                        {
                          label: t("Create a separate Geography for each EEZ"),
                          value: "separate",
                          description: t(
                            "Use this option if Sketches will be confined to a single EEZ, or if you need to summarize reporting metrics by individual zones. You may still aggregate metrics for all EEZs in reports."
                          ),
                        },
                        {
                          label: t("Combine EEZs into a single Geography"),
                          value: "combine",
                          description: t(
                            "Use this option if you plan to have Sketches which span multiple zones."
                          ),
                        },
                      ]}
                      value={state.multipleEEZHandling}
                      onChange={(value) => {
                        setState((prev) => ({
                          ...prev,
                          multipleEEZHandling: value as "separate" | "combine",
                        }));
                      }}
                    />
                  </>
                )}
              </div>
              <InputBlock
                input={
                  <Switch
                    isToggled={state.eraseLand}
                    onClick={(val) => {
                      setState((prev) => ({
                        ...prev,
                        eraseLand: val,
                      }));
                    }}
                  />
                }
                title={t("Erase Land")}
                description={t(
                  "If enabled, OpenStreetMap coastline data will be used to remove land from sketches drawn within this geography."
                )}
              />
            </div>
            <div className="bg-gray-100 border-t p-2 px-4 space-x-2 mt-2">
              <Button label={t("Cancel")} onClick={onRequestClose} />
              <Button
                label={
                  state.multipleEEZHandling === "separate" &&
                  state.selectedEEZs &&
                  state.selectedEEZs.length > 1
                    ? t("Create Geographies")
                    : t("Create Geography")
                }
                primary
              />
            </div>
          </div>
        )}
      {/* {state.step === "eezPicker" && <EEZPickerStep state={state} />} */}
      {/* {state.step === "layerPicker" && <LayerPickerStep state={state} />} */}
      {/* {state.step === "config" && <ConfigStep state={state} />} */}
    </Modal>
  );
}

function GeographyTypeChoice({
  label,
  description,
  onClick,
  checked,
  autoFocus,
}: {
  label: string | ReactNode;
  description?: string;
  onClick?: () => void;
  checked?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <button
      autoFocus={autoFocus}
      className="p-4 border hover:bg-indigo-300/5 w-full text-left border-b-0 flex space-x-3"
      onClick={(e) => {
        if (onClick) {
          onClick();
        }
      }}
    >
      {checked !== undefined && (
        <div
          className={`w-5 flex items-center justify-center ${
            checked ? "text-indigo-500" : "opacity-20"
          }`}
        >
          {checked ? (
            <CheckCircleIcon className="w-[19px] h-[19px]" />
          ) : (
            <CircleIcon className="w-[16px] h-[16px]" />
          )}
        </div>
      )}
      <div className="flex-1">
        <h4 className="font-semibold">{label}</h4>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
    </button>
  );
}
