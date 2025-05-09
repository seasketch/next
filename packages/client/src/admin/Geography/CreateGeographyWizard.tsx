import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { ReactNode, useEffect, useState } from "react";
import { CircleIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { CheckCircleIcon } from "@heroicons/react/solid";
import Button from "../../components/Button";
import RadioGroup from "../../components/RadioGroup";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import {
  ClippingLayerDetailsFragment,
  CreateGeographyArgs,
  GeographyClippingSettingsDocument,
  GeographyLayerOperation,
  useCreateGeographiesMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useFeaturePicker from "./hooks/useFeaturePicker";
import FeaturePicker from "./components/FeaturePicker";
import { labelForEEZ } from "./useEEZChoices";
import Spinner from "../../components/Spinner";

export type CreateGeographyWizardState = {
  active: boolean;
  usedTemplates: string[];
  step: "chooseTemplate" | "eezPicker" | "layerPicker" | "config";
  template?:
    | "MARINE_REGIONS_EEZ_LAND_JOINED"
    | "DAYLIGHT_COASTLINE"
    | "MARINE_REGIONS_TERRITORIAL_SEA"
    | "MARINE_REGIONS_HIGH_SEAS";
  selectedEEZs?: number[];
  multipleEEZHandling: "separate" | "combine";
  eraseLand: boolean;
  savingTemplate?: string;
};

export default function CreateGeographyWizard({
  state,
  onRequestClose,
  setState,
  landLayerId,
  eezLayerId,
  eezLayer,
  usedTemplates,
  map,
}: {
  state: CreateGeographyWizardState;
  onRequestClose: () => void;
  setState: (
    updater:
      | ((prevState: CreateGeographyWizardState) => CreateGeographyWizardState)
      | CreateGeographyWizardState
  ) => void;
  landLayerId: number;
  eezLayerId: number;
  eezLayer: ClippingLayerDetailsFragment; // TODO: Add proper type from GraphQL schema
  usedTemplates: string[];
  map: mapboxgl.Map | null;
}) {
  const { t } = useTranslation("admin:geography");
  const onError = useGlobalErrorHandler();

  const [mutation, mutationState] = useCreateGeographiesMutation({
    onError,
    refetchQueries: [GeographyClippingSettingsDocument],
    awaitRefetchQueries: true,
  });

  const eezPicker = useFeaturePicker({
    map,
    sourceId: "eez",
    sourceUrl: eezLayer.dataSource!.url!,
    sourceLayer: eezLayer.sourceLayer!,
    idProperty: "MRGID_EEZ",
    customLabelFn: labelForEEZ,
    initialSelection: state.selectedEEZs,
    dataset: eezLayer.vectorObjectKey!,
    includeProperties: ["MRGID_EEZ", "UNION", "POL_TYPE", "SOVEREIGN1"],
  });

  useEffect(() => {
    if (state.step === "eezPicker") {
      eezPicker.startPicking();
    } else {
      eezPicker.stopPicking();
    }
  }, [state.step]);

  return (
    <>
      {state.step === "eezPicker" ? (
        <FeaturePicker
          title={t("Select one or more Exclusive Economic Zones")}
          description={t(
            "Nations may have more than one polygon associated with their EEZ. You should select all those where users will be doing planning within this project. Use the list below to select areas, or click polygons on the map."
          )}
          choices={eezPicker.state.choices}
          selectedFeatures={eezPicker.state.selectedFeatures}
          onSelectionChange={(selectedIds) => {
            eezPicker.updateSelection(selectedIds);
            setState((prev) => ({
              ...prev,
              selectedEEZs: selectedIds,
            }));
            if (selectedIds.length > 0) {
              const lastSelected = eezPicker.state.choices.find(
                (choice) => choice.value === selectedIds[selectedIds.length - 1]
              );
              if (lastSelected?.data.__bbox && map) {
                map.fitBounds(
                  [
                    [lastSelected.data.__bbox[0], lastSelected.data.__bbox[1]],
                    [lastSelected.data.__bbox[2], lastSelected.data.__bbox[3]],
                  ],
                  { padding: 50 }
                );
              }
            }
          }}
          onRequestClose={() => {
            setState((prev) => ({
              ...prev,
              step: "chooseTemplate",
            }));
          }}
          onRequestSubmit={() => {
            setState((prev) => ({
              ...prev,
              step: "config",
              selectedEEZs: eezPicker.state.selectedFeatures,
            }));
          }}
          loading={eezPicker.state.loading}
          error={eezPicker.state.error}
          saving={eezPicker.state.saving}
        />
      ) : (
        <Modal
          title={t("")}
          autoWidth={true}
          onRequestClose={onRequestClose}
          className="bg-white border-black border"
          zeroPadding={true}
          disableBackdropClick={state.step !== "chooseTemplate"}
        >
          {state.step === "chooseTemplate" && (
            <div className="bg-white w-128 border-collapse pb-1 z-50">
              <GeographyTypeChoice
                disabled={mutationState.loading}
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
                disabled={mutationState.loading}
                checked={usedTemplates.includes("eez")}
                label={t("Exclusive Economic Zones (EEZ)")}
                description={t(
                  "Choose one or more EEZ's using data from MarineRegions.org"
                )}
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    step: "eezPicker",
                    template: "MARINE_REGIONS_EEZ_LAND_JOINED",
                    selectedEEZs: [],
                  }));
                }}
              />
              <GeographyTypeChoice
                label={t("Territorial Sea")}
                disabled={mutationState.loading}
                checked={usedTemplates.includes("territorial_sea")}
                description={t(
                  "Include nearshore, 12nm boundaries for one or more nations based on data from MarineRegions.org"
                )}
                onClick={() => {}}
              />
              <GeographyTypeChoice
                label={t("High Seas")}
                disabled={mutationState.loading}
                checked={usedTemplates.includes("high_seas")}
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
                disabled={mutationState.loading}
                saving={
                  mutationState.loading &&
                  state.savingTemplate === "DAYLIGHT_COASTLINE"
                }
                checked={usedTemplates.includes("terrestrial_areas")}
                description={t(
                  "Design and evaluate sketches on land using OpenStreetMap"
                )}
                onClick={() => {
                  const input: CreateGeographyArgs = {
                    slug: getSlug(),
                    name: "Terrestrial Areas",
                    clientTemplate: "terrestrial_areas",
                    clippingLayers: [
                      {
                        templateId: "DAYLIGHT_COASTLINE",
                        dataLayerId: landLayerId,
                        operationType: GeographyLayerOperation.Intersect,
                      },
                    ],
                  };
                  setState((prev) => ({
                    ...prev,
                    savingTemplate: "DAYLIGHT_COASTLINE",
                  }));
                  mutation({
                    variables: {
                      geographies: [input],
                    },
                  }).then(() => {
                    onRequestClose();
                  });
                }}
              />
            </div>
          )}
          {state.step === "config" &&
            state.template === "MARINE_REGIONS_HIGH_SEAS" && (
              <div className="w-144 bg-white">
                <div className="p-4">
                  <h3 className="text-sm text-gray-500">{t("High Seas")}</h3>
                  <p className="py-2">
                    <Trans ns="admin:geography">
                      This geography can be used to clip sketches exclusively to
                      areas beyond national jurisdiction and is based on data
                      from{" "}
                      <a
                        target="_blank"
                        className="text-primary-500 underline"
                        href="https://marineregions.org"
                      >
                        MarineRegions.org
                      </a>
                      .
                    </Trans>
                  </p>
                </div>
                <div className="bg-gray-100 border-t p-2 px-4 space-x-2 mt-2">
                  <Button
                    disabled={mutationState.loading}
                    label={t("Cancel")}
                    onClick={onRequestClose}
                  />
                  <Button
                    disabled={mutationState.loading}
                    loading={mutationState.loading}
                    label={t("Create Geography")}
                    primary
                    autofocus
                    onClick={() => {
                      const input: CreateGeographyArgs[] = [];
                      input.push({
                        slug: getSlug(),
                        name: "High Seas",
                        clientTemplate: "high_seas",
                        clippingLayers: [
                          {
                            templateId: "MARINE_REGIONS_HIGH_SEAS",
                            dataLayerId: eezLayerId,
                            operationType: GeographyLayerOperation.Intersect,
                          },
                        ],
                      });
                      mutation({
                        variables: {
                          geographies: input,
                        },
                      }).then(() => {
                        onRequestClose();
                      });
                    }}
                  />
                </div>
              </div>
            )}
          {state.step === "config" &&
            state.template === "MARINE_REGIONS_EEZ_LAND_JOINED" &&
            state.selectedEEZs?.length && (
              <div className="w-144 bg-white">
                <div className="p-4">
                  <h3 className="text-sm text-gray-500">
                    {state.selectedEEZs.length > 1
                      ? t("Exclusive Economic Zones")
                      : t("Exclusive Economic Zone")}
                  </h3>
                  {state.selectedEEZs.length && (
                    <h4 className="space-x-2 text-xl font-semibold">
                      <span>
                        {eezPicker.state.choices
                          .filter((c) => state.selectedEEZs?.includes(c.value))
                          .map((c) => c.label)
                          .join(", ")}
                      </span>
                    </h4>
                  )}
                  <div className="py-2 space-y-1">
                    <h5 className="">{t("Geography Options")}</h5>
                    {state.selectedEEZs.length > 1 && (
                      <>
                        <RadioGroup
                          className="pb-2"
                          items={[
                            {
                              label: t(
                                "Create a separate Geography for each EEZ"
                              ),
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
                          onChange={(value: "separate" | "combine") => {
                            setState((prev) => ({
                              ...prev,
                              multipleEEZHandling: value,
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
                        onClick={(val: boolean) => {
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
                  <Button
                    disabled={mutationState.loading}
                    label={t("Cancel")}
                    onClick={onRequestClose}
                  />
                  <Button
                    disabled={mutationState.loading}
                    loading={mutationState.loading}
                    label={
                      state.multipleEEZHandling === "separate" &&
                      state.selectedEEZs &&
                      state.selectedEEZs.length > 1
                        ? t("Create Geographies")
                        : t("Create Geography")
                    }
                    primary
                    autofocus
                    onClick={() => {
                      if (!eezLayerId) {
                        throw new Error(
                          "EEZ data layer ID is not available. Please check the EEZ choices."
                        );
                      }
                      if (
                        !state.selectedEEZs ||
                        state.selectedEEZs.length === 0
                      ) {
                        throw new Error(
                          "No EEZs selected. Please select at least one EEZ."
                        );
                      }
                      const input: CreateGeographyArgs[] = [];
                      if (state.multipleEEZHandling === "separate") {
                        for (const eez of state.selectedEEZs) {
                          const label = eezPicker.state.choices.find(
                            (c) => c.value === eez
                          )?.label;
                          input.push(
                            buildCreateGeographyInputForEEZ(
                              eezLayerId,
                              [eez],
                              "EEZ: " + label!,
                              state.eraseLand,
                              landLayerId
                            )
                          );
                        }
                      } else {
                        input.push(
                          buildCreateGeographyInputForEEZ(
                            eezLayerId,
                            state.selectedEEZs!,
                            state.selectedEEZs.length > 1
                              ? "EEZ: " +
                                  eezPicker.state.choices
                                    .filter((c) =>
                                      state.selectedEEZs?.includes(c.value)
                                    )
                                    .map((c) => c.label)
                                    .join(", ")
                              : "EEZ: " +
                                  eezPicker.state.choices.find(
                                    (c) => c.value === state.selectedEEZs![0]
                                  )?.label!,
                            state.eraseLand,
                            landLayerId
                          )
                        );
                      }
                      mutation({
                        variables: {
                          geographies: input,
                        },
                      }).then(() => {
                        onRequestClose();
                      });
                    }}
                  />
                </div>
              </div>
            )}
        </Modal>
      )}
    </>
  );
}

function GeographyTypeChoice({
  label,
  description,
  onClick,
  checked,
  autoFocus,
  saving,
  disabled,
}: {
  label: string | ReactNode;
  description?: string;
  onClick?: () => void;
  checked?: boolean;
  autoFocus?: boolean;
  saving?: boolean;
  disabled?: boolean;
}) {
  let icon = <CircleIcon className="w-[16px] h-[16px]" />;
  if (saving) {
    icon = <Spinner />;
  } else if (checked) {
    icon = <CheckCircleIcon className="w-[19px] h-[19px]" />;
  }

  return (
    <button
      disabled={disabled || saving}
      autoFocus={autoFocus}
      className={`p-4 border hover:bg-indigo-300/5 ${
        saving ? "bg-indigo-300/10" : ""
      } w-full text-left border-b-0 flex space-x-3 ${
        disabled && !saving ? "opacity-50" : ""
      }`}
      onClick={(e) => {
        if (onClick && !disabled) {
          onClick();
        }
      }}
    >
      {checked !== undefined && (
        <div
          className={`w-5 flex items-center justify-center ${
            checked || saving ? "text-gray-400" : "opacity-20"
          }`}
        >
          {icon}
        </div>
      )}
      <div className="flex-1">
        <h4 className="font-semibold">{label}</h4>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
    </button>
  );
}

function buildCreateGeographyInputForEEZ(
  eezDataLayerId: number,
  choices: number[],
  name: string,
  clipToLand: boolean,
  landDataLayerId: number
): CreateGeographyArgs {
  const payload: CreateGeographyArgs = {
    slug: getSlug(),
    name,
    clientTemplate: "eez",
    clippingLayers: [
      {
        dataLayerId: eezDataLayerId,
        templateId: "MARINE_REGIONS_EEZ_LAND_JOINED",
        operationType: GeographyLayerOperation.Intersect,
        cql2Query: JSON.stringify(
          choices.length === 1
            ? {
                op: "=",
                args: [
                  {
                    property: "MRGID_EEZ",
                  },
                  choices[0],
                ],
              }
            : {
                op: "in",
                args: [{ property: "MRGID_EEZ" }, choices],
              }
        ),
      },
      ...(clipToLand
        ? [
            {
              dataLayerId: landDataLayerId,
              templateId: "DAYLIGHT_COASTLINE",
              operationType: GeographyLayerOperation.Difference,
            },
          ]
        : []),
    ],
  };
  return payload;
}
