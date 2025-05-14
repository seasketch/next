import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { ReactNode, useEffect, useState, useRef } from "react";
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
import { createPortal } from "react-dom";
import LayerChoice from "./components/LayerChoice";
import { LayerIcon } from "../../projects/ToolbarButtons";
type WizardStep = "chooseTemplate" | "featurePicker" | "layerPicker" | "config";
type TemplateType =
  | "MARINE_REGIONS_EEZ_LAND_JOINED"
  | "DAYLIGHT_COASTLINE"
  | "MARINE_REGIONS_TERRITORIAL_SEA"
  | "MARINE_REGIONS_HIGH_SEAS";

type WizardState = {
  step: WizardStep;
  template?: TemplateType;
  multipleEEZHandling: "separate" | "combine";
  eraseLand: boolean;
  savingTemplate?: string;
  picker?: "eez" | "territorial_sea";
  territorialSeaHandling?: "none" | "single" | "split";
};

type TemplateOption = {
  label: string;
  description: string;
  template?: TemplateType;
  clientTemplate?: string;
  checked?: boolean;
  disabled?: boolean;
  saving?: boolean;
  onClick: () => void;
};

function GeographyTypeChoice({
  label,
  description,
  onClick,
  checked,
  autoFocus,
  saving,
  disabled,
  customIcon,
}: {
  label: string | ReactNode;
  description?: string;
  onClick?: () => void;
  checked?: boolean;
  autoFocus?: boolean;
  saving?: boolean;
  disabled?: boolean;
  customIcon?: ReactNode;
}) {
  let statusIcon = <CircleIcon className="w-[16px] h-[16px]" />;
  if (saving) {
    statusIcon = <Spinner />;
  } else if (checked) {
    statusIcon = <CheckCircleIcon className="w-[19px] h-[19px]" />;
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
          {statusIcon}
        </div>
      )}
      {customIcon && (
        <div className="flex items-center justify-center w-5">
          {/* <div className="w-8 h-8 text-gray-500 flex items-center justify-center"> */}
          {typeof customIcon === "function"
            ? customIcon({ className: "w-5 h-5 text-black/50" })
            : customIcon}
          {/* </div> */}
        </div>
      )}
      <div className="flex-1">
        <h4 className="font-semibold">{label}</h4>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
    </button>
  );
}

function TemplateSelection({
  options,
  onCustomLayerClick,
}: {
  options: TemplateOption[];
  onCustomLayerClick: () => void;
}) {
  const { t } = useTranslation("admin:geography");

  return (
    <div className="bg-white w-128 border-collapse pb-1 z-50">
      <h4 className="text-lg p-4 ">{t("Create a New Geography")}</h4>
      <GeographyTypeChoice
        label={t("Use a Custom Layer")}
        description={t(
          "Choose from an existing overlay or upload a new polygon layer that represents a geography"
        )}
        onClick={onCustomLayerClick}
        customIcon={LayerIcon}
      />
      <p className="text-sm font-light px-4 py-2 bg-gray-50 border-t">
        {t("Or, create a Geography using authoritative data sources")}
      </p>
      {options.map((option) => (
        <GeographyTypeChoice key={option.label} {...option} />
      ))}
    </div>
  );
}

function HighSeasConfig({
  onCancel,
  onCreate,
  loading,
}: {
  onCancel: () => void;
  onCreate: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation("admin:geography");

  return (
    <div className="w-144 bg-white">
      <div className="p-4">
        <h3 className="text-sm text-gray-500">{t("High Seas")}</h3>
        <p className="py-2">
          <Trans ns="admin:geography">
            This geography can be used to clip sketches exclusively to areas
            beyond national jurisdiction and is based on data from{" "}
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
        <Button disabled={loading} label={t("Cancel")} onClick={onCancel} />
        <Button
          disabled={loading}
          loading={loading}
          label={t("Create Geography")}
          primary
          autofocus
          onClick={onCreate}
        />
      </div>
    </div>
  );
}

export default function CreateGeographyWizard({
  active,
  onRequestClose,
  landLayerId,
  eezLayer,
  territorialSeaLayer,
  usedTemplates,
  map,
  usedEEZs,
  onRequestToggleSidebar,
}: {
  active: boolean;
  onRequestClose: () => void;
  landLayerId: number;
  eezLayer: ClippingLayerDetailsFragment;
  territorialSeaLayer: ClippingLayerDetailsFragment;
  usedTemplates: string[];
  usedEEZs: number[];
  map: mapboxgl.Map | null;
  onRequestToggleSidebar: (show: boolean) => void;
}) {
  const { t } = useTranslation("admin:geography");
  const onError = useGlobalErrorHandler();

  const [state, setState] = useState<WizardState>({
    step: "chooseTemplate",
    multipleEEZHandling: "separate",
    eraseLand: true,
  });

  // Handle sidebar visibility based on step
  useEffect(() => {
    if (state.step === "featurePicker" || state.step === "layerPicker") {
      onRequestToggleSidebar(false);
    } else {
      onRequestToggleSidebar(true);
    }
    return () => {
      onRequestToggleSidebar(true);
    };
  }, [state.step]); // Only depend on state.step

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
    initialSelection: [],
    dataset: eezLayer.vectorObjectKey!,
    includeProperties: ["MRGID_EEZ", "UNION", "POL_TYPE", "SOVEREIGN1"],
  });

  const territorialSeaPicker = useFeaturePicker({
    map,
    sourceId: "territorial_sea",
    sourceUrl: territorialSeaLayer.dataSource!.url!,
    sourceLayer: territorialSeaLayer.sourceLayer!,
    idProperty: "MRGID_EEZ",
    customLabelFn: labelForEEZ,
    initialSelection: [],
    dataset: territorialSeaLayer.vectorObjectKey!,
    includeProperties: ["MRGID_EEZ", "UNION", "POL_TYPE", "SOVEREIGN1"],
  });

  const featurePicker =
    state.picker === "territorial_sea" ? territorialSeaPicker : eezPicker;

  useEffect(() => {
    if (state.step === "featurePicker") {
      featurePicker.startPicking();
    } else {
      featurePicker.stopPicking();
    }
  }, [state.step]);

  if (!active) return null;

  const handleCreateTerrestrialAreas = () => {
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
  };

  const handleCreateHighSeas = () => {
    const input: CreateGeographyArgs = {
      slug: getSlug(),
      name: "High Seas",
      clientTemplate: "high_seas",
      clippingLayers: [
        {
          templateId: "MARINE_REGIONS_HIGH_SEAS",
          operationType: GeographyLayerOperation.Intersect,
        },
      ],
    };
    mutation({
      variables: {
        geographies: [input],
      },
    }).then(() => {
      onRequestClose();
    });
  };

  const templateOptions: TemplateOption[] = [
    {
      label: t("Marine Regions National Boundaries"),
      description: t(
        "Create geographies representing Exclusive Economic Zones and Territorial Seas"
      ),
      template: "MARINE_REGIONS_EEZ_LAND_JOINED",
      checked:
        usedTemplates.includes("eez") ||
        usedTemplates.includes("territorial_sea"),
      onClick: () => {
        setState((prev) => ({
          ...prev,
          step: "featurePicker",
          template: "MARINE_REGIONS_EEZ_LAND_JOINED",
          picker: "eez",
          territorialSeaHandling: "split",
        }));
      },
    },
    {
      label: t("High Seas"),
      description: t(
        "Represent areas beyond national jurisdiction using data from MarineRegions.org"
      ),
      template: "MARINE_REGIONS_HIGH_SEAS",
      checked: usedTemplates.includes("high_seas"),
      onClick: () => {
        setState((prev) => ({
          ...prev,
          step: "config",
          template: "MARINE_REGIONS_HIGH_SEAS",
        }));
      },
    },
    {
      label: t("Terrestrial Areas"),
      description: t(
        "Design and evaluate sketches on land using OpenStreetMap"
      ),
      checked: usedTemplates.includes("terrestrial_areas"),
      saving:
        mutationState.loading && state.savingTemplate === "DAYLIGHT_COASTLINE",
      onClick: handleCreateTerrestrialAreas,
    },
  ];

  switch (state.step) {
    case "layerPicker":
      return (
        <>
          <SidebarMask />
          <LayerChoice
            onCancel={onRequestClose}
            onSubmit={async (params) => {
              const inputs = buildGeographyInputForCustomLayer(
                params.dataLayerId,
                params.selectedAttribute,
                params.attributeValues,
                params.eraseLand,
                landLayerId,
                params.layerTitle,
                t
              );

              await mutation({
                variables: {
                  geographies: inputs,
                },
              });
              onRequestClose();
            }}
            map={map}
          />
        </>
      );
    case "featurePicker":
      return (
        <>
          <SidebarMask />
          <FeaturePicker
            title={
              state.picker === "eez"
                ? t("Select one or more Exclusive Economic Zones")
                : t("Select one or more Territorial Seas")
            }
            description={
              state.picker === "eez"
                ? t(
                    "Nations may have more than one polygon associated with their EEZ. You should select all those where users will be doing planning within this project. Use the list below to select areas, or click polygons on the map."
                  )
                : t(
                    "Select all those where users will be doing planning within this project. Use the list below to select areas, or click polygons on the map."
                  )
            }
            choices={featurePicker.state.choices}
            selectedFeatures={featurePicker.state.selection}
            onSelectionChange={(selectedIds) => {
              featurePicker.updateSelection(selectedIds);
              if (selectedIds.length > 0) {
                const lastSelected = featurePicker.state.choices.find(
                  (choice) =>
                    choice.value === selectedIds[selectedIds.length - 1]
                );
                if (lastSelected?.data.__bbox && map) {
                  map.fitBounds(
                    [
                      [
                        lastSelected.data.__bbox[0],
                        lastSelected.data.__bbox[1],
                      ],
                      [
                        lastSelected.data.__bbox[2],
                        lastSelected.data.__bbox[3],
                      ],
                    ],
                    { padding: 50 }
                  );
                }
              }
            }}
            onRequestClose={onRequestClose}
            onRequestSubmit={() => {
              setState((prev) => ({
                ...prev,
                step: "config",
              }));
            }}
            loading={featurePicker.state.loading}
            error={featurePicker.state.error}
            saving={featurePicker.state.saving}
            onRequestToggleSidebar={onRequestToggleSidebar}
          />
        </>
      );
    default:
      return (
        <Modal
          title={t("")}
          autoWidth={true}
          onRequestClose={onRequestClose}
          className="bg-white border-black border"
          zeroPadding={true}
          disableBackdropClick={state.step !== "chooseTemplate"}
        >
          {state.step === "chooseTemplate" && (
            <TemplateSelection
              options={templateOptions}
              onCustomLayerClick={() =>
                setState((prev) => ({
                  ...prev,
                  step: "layerPicker",
                  template: undefined,
                }))
              }
            />
          )}
          {state.step === "config" &&
            state.template === "MARINE_REGIONS_HIGH_SEAS" && (
              <HighSeasConfig
                onCancel={onRequestClose}
                onCreate={handleCreateHighSeas}
                loading={mutationState.loading}
              />
            )}
          {state.step === "config" &&
            state.template === "MARINE_REGIONS_EEZ_LAND_JOINED" &&
            featurePicker.state.selection.length > 0 && (
              <FeatureConfig
                title={t("Marine Regions Boundaries")}
                subtitle={t("EEZ")}
                featurePicker={featurePicker}
                onCreateClick={(config) => {
                  if (featurePicker.state.selection.length === 0) {
                    throw new Error(
                      "No EEZs selected. Please select at least one EEZ."
                    );
                  }
                  const input: CreateGeographyArgs[] = [];
                  if (config.multipleFeatureHandling === "separate") {
                    for (const eez of featurePicker.getSelectedFeatures()) {
                      // Add EEZ geography
                      input.push(
                        buildCreateGeographyInputForEEZ(
                          eezLayer.id,
                          [eez.value],
                          "EEZ: " + eez.label || eez.value.toString(),
                          config.eraseLand,
                          landLayerId
                        )
                      );

                      // Add Territorial Sea geographies based on selection
                      if (config.territorialSeaHandling === "split") {
                        // Add Territorial Sea
                        input.push(
                          buildCreateGeographyInputForTerritorialSeas(
                            territorialSeaLayer.id,
                            [eez.value],
                            "Territorial Sea: " + eez.label ||
                              eez.value.toString(),
                            config.eraseLand,
                            landLayerId
                          )
                        );
                        // Add Offshore
                        input.push(
                          buildCreateGeographyInputForOffshore(
                            territorialSeaLayer.id,
                            eezLayer.id,
                            [eez.value],
                            "Offshore: " + eez.label || eez.value.toString()
                          )
                        );
                      } else if (config.territorialSeaHandling === "single") {
                        // Add only Territorial Sea
                        input.push(
                          buildCreateGeographyInputForTerritorialSeas(
                            territorialSeaLayer.id,
                            [eez.value],
                            "Territorial Sea: " + eez.label ||
                              eez.value.toString(),
                            config.eraseLand,
                            landLayerId
                          )
                        );
                      }
                    }
                  } else {
                    // Add combined EEZ geography
                    input.push(
                      buildCreateGeographyInputForEEZ(
                        eezLayer.id,
                        featurePicker.state.selection,
                        featurePicker.state.selection.length > 1
                          ? "EEZ: " +
                              featurePicker
                                .getSelectedFeatures()
                                .map((c) => c.label)
                                .join(", ")
                          : "EEZ: " +
                              featurePicker.getSelectedFeatures()[0].label!,
                        config.eraseLand,
                        landLayerId
                      )
                    );

                    // Add Territorial Sea geographies based on selection
                    if (config.territorialSeaHandling === "split") {
                      // Add Territorial Sea
                      input.push(
                        buildCreateGeographyInputForTerritorialSeas(
                          territorialSeaLayer.id,
                          featurePicker.state.selection,
                          featurePicker.state.selection.length > 1
                            ? "Territorial Sea: " +
                                featurePicker
                                  .getSelectedFeatures()
                                  .map((c) => c.label)
                                  .join(", ")
                            : "Territorial Sea: " +
                                featurePicker.getSelectedFeatures()[0].label!,
                          config.eraseLand,
                          landLayerId
                        )
                      );
                      // Add Offshore
                      input.push(
                        buildCreateGeographyInputForOffshore(
                          territorialSeaLayer.id,
                          eezLayer.id,
                          featurePicker.state.selection,
                          "Offshore: " +
                            featurePicker
                              .getSelectedFeatures()
                              .map((c) => c.label)
                              .join(", ")
                        )
                      );
                    } else if (config.territorialSeaHandling === "single") {
                      // Add only Territorial Sea
                      input.push(
                        buildCreateGeographyInputForTerritorialSeas(
                          territorialSeaLayer.id,
                          featurePicker.state.selection,
                          featurePicker.state.selection.length > 1
                            ? "Territorial Sea: " +
                                featurePicker
                                  .getSelectedFeatures()
                                  .map((c) => c.label)
                                  .join(", ")
                            : "Territorial Sea: " +
                                featurePicker.getSelectedFeatures()[0].label!,
                          config.eraseLand,
                          landLayerId
                        )
                      );
                    }
                  }
                  mutation({
                    variables: {
                      geographies: input,
                    },
                  }).then(() => {
                    onRequestClose();
                  });
                }}
                loading={mutationState.loading}
                onCancel={onRequestClose}
              />
            )}
        </Modal>
      );
  }
}

type FeatureConfigProps = {
  title: string;
  subtitle: string;
  featurePicker: ReturnType<typeof useFeaturePicker>;
  onCreateClick: (config: {
    eraseLand: boolean;
    multipleFeatureHandling: "separate" | "combine";
    buildOffshoreAndNearshoreComponents?: boolean;
    territorialSeaHandling: "none" | "single" | "split";
  }) => void;
  loading: boolean;
  onCancel: () => void;
  showOffshoreNearshoreChoice?: boolean;
};

type FeatureConfigState = {
  eraseLand: boolean;
  multipleFeatureHandling: "separate" | "combine";
  buildOffshoreAndNearshoreComponents: boolean;
  territorialSeaHandling: "none" | "single" | "split";
};

function FeatureConfig({
  title,
  subtitle,
  featurePicker,
  onCreateClick,
  loading,
  onCancel,
  showOffshoreNearshoreChoice,
}: FeatureConfigProps): JSX.Element {
  const { t } = useTranslation("admin:geography");
  const [config, setConfig] = useState<FeatureConfigState>({
    eraseLand: true,
    multipleFeatureHandling: "separate",
    buildOffshoreAndNearshoreComponents: showOffshoreNearshoreChoice
      ? true
      : false,
    territorialSeaHandling: "split",
  });

  const updateConfig = (updates: Partial<FeatureConfigState>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="w-144 bg-white">
      <div className="p-4">
        <h3 className="text-sm text-gray-500">{title}</h3>
        {featurePicker.state.selection.length > 0 && (
          <h4 className="space-x-2 text-xl font-semibold">
            <span>
              {featurePicker
                .getSelectedFeatures()
                .map((c) => c.label)
                .join(", ")}
            </span>
          </h4>
        )}
        <div className="py-2 space-y-1">
          <h5 className="">{t("Geography Options")}</h5>
          {featurePicker.state.selection.length > 1 && (
            <>
              <RadioGroup
                className="pb-2"
                items={[
                  {
                    label: t("Create a separate Geography for each {{type}}", {
                      type: subtitle,
                    }),
                    value: "separate",
                    description: t(
                      "Recommended. Use this option if Sketches will be confined to a single {{type}}, or if you need to summarize reporting metrics by individual zones. You may still aggregate metrics for all {{type}}s in reports.",
                      { type: subtitle }
                    ),
                  },
                  {
                    label: t("Combine {{type}}s into a single Geography", {
                      type: subtitle,
                    }),
                    value: "combine",
                    description: t(
                      "Use this option if you plan to have Sketches which span multiple zones."
                    ),
                  },
                ]}
                value={config.multipleFeatureHandling}
                onChange={(value: "separate" | "combine") =>
                  updateConfig({ multipleFeatureHandling: value })
                }
              />
            </>
          )}
        </div>
        <div className="space-y-4">
          <InputBlock
            input={
              <Switch
                isToggled={config.eraseLand}
                onClick={() => updateConfig({ eraseLand: !config.eraseLand })}
              />
            }
            title={t("Erase Land")}
            description={t(
              "If enabled, OpenStreetMap coastline data will be used to remove land from sketches drawn within this geography."
            )}
          />
          <div className="space-y-2">
            <h5 className="font-medium">{t("Territorial Seas")}</h5>
            <RadioGroup
              items={[
                {
                  label: t("Create Nearshore and Offshore Geographies"),
                  value: "split",
                  description: t(
                    "Geographies will be created to represent the 0-12nm and 12-200nm areas."
                  ),
                },
                {
                  label: t("Create a Nearshore Territorial Sea Geography"),
                  value: "single",
                  description: t(
                    "Create a single Geography representing the 12nm Territorial Sea boundary."
                  ),
                },
                {
                  label: t("Do not include Territorial Seas"),
                  value: "none",
                  description: t(
                    "Only include the selected Exclusive Economic Zones."
                  ),
                },
              ]}
              value={config.territorialSeaHandling}
              onChange={(value: "none" | "single" | "split") =>
                updateConfig({ territorialSeaHandling: value })
              }
            />
          </div>
        </div>
      </div>
      <div className="bg-gray-100 border-t p-2 px-4 space-x-2 mt-2">
        <Button disabled={loading} label={t("Cancel")} onClick={onCancel} />
        <Button
          disabled={loading}
          loading={loading}
          label={
            config.multipleFeatureHandling === "separate" &&
            featurePicker.state.selection.length > 1
              ? t("Create Geographies")
              : t("Create Geography")
          }
          primary
          autofocus
          onClick={() =>
            onCreateClick({
              ...config,
              ...(showOffshoreNearshoreChoice
                ? {}
                : { buildOffshoreAndNearshoreComponents: undefined }),
            })
          }
        />
      </div>
    </div>
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

function buildCreateGeographyInputForTerritorialSeas(
  territorialSeaDataLayerId: number,
  choices: number[],
  name: string,
  clipToLand: boolean,
  landDataLayerId: number
): CreateGeographyArgs {
  const payload: CreateGeographyArgs = {
    slug: getSlug(),
    name,
    clientTemplate: "territorial_sea",
    clippingLayers: [
      {
        dataLayerId: territorialSeaDataLayerId,
        templateId: "MARINE_REGIONS_TERRITORIAL_SEA",
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

function buildCreateGeographyInputForOffshore(
  territorialSeaDataLayerId: number,
  eezDataLayerId: number,
  choices: number[],
  name: string
) {
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
      {
        dataLayerId: territorialSeaDataLayerId,
        templateId: "MARINE_REGIONS_TERRITORIAL_SEA",
        operationType: GeographyLayerOperation.Difference,
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
    ],
  };
  return payload;
}

function SidebarMask() {
  return createPortal(
    <div
      className="absolute left-0 top-0 h-screen w-56 pointer-events-none bg-blue-800/20"
      style={{
        backdropFilter: "blur(8px)",
      }}
    />,
    document.body
  );
}

function buildGeographyInputForCustomLayer(
  dataLayerId: number,
  selectedAttribute: string | undefined,
  attributeValues: (string | number | boolean)[] | undefined,
  eraseLand: boolean,
  landLayerId: number,
  layerTitle: string,
  t: (key: string, options?: any) => string
): CreateGeographyArgs[] {
  // For single-feature layers or when no attribute is selected
  if (!selectedAttribute || !attributeValues) {
    return [
      {
        slug: getSlug(),
        name: layerTitle,
        clippingLayers: [
          {
            dataLayerId,
            operationType: GeographyLayerOperation.Intersect,
          },
          ...(eraseLand
            ? [
                {
                  dataLayerId: landLayerId,
                  templateId: "DAYLIGHT_COASTLINE",
                  operationType: GeographyLayerOperation.Difference,
                },
              ]
            : []),
        ],
      },
    ];
  }

  // For multi-feature layers with attribute selection
  return attributeValues.map((value) => {
    const cql2Query = JSON.stringify({
      op: "=",
      args: [{ property: selectedAttribute }, value],
    });

    return {
      slug: getSlug(),
      name: value.toString(),
      clippingLayers: [
        {
          dataLayerId,
          operationType: GeographyLayerOperation.Intersect,
          cql2Query,
        },
        ...(eraseLand
          ? [
              {
                dataLayerId: landLayerId,
                templateId: "DAYLIGHT_COASTLINE",
                operationType: GeographyLayerOperation.Difference,
              },
            ]
          : []),
      ],
    };
  });
}
