import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  GeographyClippingSettingsDocument,
  useDeleteGeographyMutation,
  useUpdateGeographyMutation,
  useGeographyByIdQuery,
  GeographyLayerOperation,
  ClippingLayerInput,
  AuthorProfileFragment,
} from "../../generated/graphql";
import TextInput from "../../components/TextInput";
import { useEffect, useMemo, useState, useRef } from "react";
import useDialog from "../../components/useDialog";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ChevronDownIcon,
  InfoCircledIcon,
  MixerHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import InlineAuthor from "../../components/InlineAuthor";
import { ReactNode } from "react";
import LayerChoice from "./components/LayerChoice";
import { Map as MapboxMap } from "mapbox-gl";
import { createPortal } from "react-dom";

// Attribution metadata for known templateIds
const LAYER_ATTRIBUTIONS: Record<
  string,
  {
    label: string;
    url: string;
    tooltip: (
      t: (key: string) => string,
      Trans: typeof import("react-i18next").Trans
    ) => ReactNode;
  }
> = {
  DAYLIGHT_COASTLINE: {
    label: "Daylight Coastline",
    url: "https://daylightmap.org/coastlines.html",
    tooltip: (t, Trans) => (
      <Trans ns="admin:geography">
        © OpenStreetMap contributors available under the Open Database License (
        <AttributionLink
          href="https://www.openstreetmap.org/copyright"
          label="openstreetmap.org/copyright"
        />
        ,&nbsp;
        <AttributionLink
          href="https://daylightmap.org/"
          label="daylightmap.org"
        />
        )
      </Trans>
    ),
  },
  MARINE_REGIONS_EEZ_LAND_JOINED: {
    label: "Exclusive Economic Zones",
    url: "https://www.marineregions.org/",
    tooltip: (t, Trans) => (
      <Trans ns="admin:geography">
        Flanders Marine Institute (2024). The intersect of the Exclusive
        Economic Zones and IHO sea areas, version 5. Available online at{" "}
        <AttributionLink
          href="https://www.marineregions.org/"
          label="marineregions.org"
        />
        .{" "}
        <AttributionLink
          href="https://doi.org/10.14284/699"
          label="doi.org/10.14284/699"
        />
      </Trans>
    ),
  },
  // Add more templateIds here as needed
};

interface LocalClippingLayer extends ClippingLayerInput {
  localMetadata?: {
    title: string;
    createdAt: string;
    authorProfile: AuthorProfileFragment;
  };
}

export default function EditGeographyModal({
  onRequestClose,
  id,
  map,
  showLayerChoice,
  onShowLayerChoiceChange,
}: {
  onRequestClose: () => void;
  id: number;
  map: MapboxMap | null;
  showLayerChoice: boolean;
  onShowLayerChoiceChange: (show: boolean) => void;
}) {
  const { data, loading, error } = useGeographyByIdQuery({
    variables: { id },
    fetchPolicy: "cache-and-network",
  });

  const onError = useGlobalErrorHandler();

  const [deleteMutation, deleteMutationState] = useDeleteGeographyMutation({
    refetchQueries: [GeographyClippingSettingsDocument],
    awaitRefetchQueries: true,
    onError,
  });

  const [updateGeographyMutation, updateGeographyMutationState] =
    useUpdateGeographyMutation({
      refetchQueries: [GeographyClippingSettingsDocument],
      awaitRefetchQueries: true,
    });

  const { t } = useTranslation("admin:geography");
  const [state, setState] = useState<{
    name: string;
    clippingLayers: LocalClippingLayer[];
    error?: string;
  }>({
    name: data?.geography?.name || "",
    clippingLayers: [],
  });

  // Initialize state from server data
  useEffect(() => {
    if (data?.geography) {
      setState({
        name: data.geography.name,
        clippingLayers:
          data.geography.clippingLayers?.map((layer) => {
            const authorProfile = layer.dataSource?.authorProfile;
            return {
              dataLayerId: layer.dataLayer?.id || 0,
              operationType: layer.operationType,
              cql2Query: layer.cql2Query,
              localMetadata: authorProfile
                ? {
                    title: layer.dataLayer?.tableOfContentsItem?.title || "",
                    createdAt: layer.dataSource?.createdAt || "",
                    authorProfile: {
                      __typename: "Profile",
                      picture: authorProfile.picture || null,
                      userId: authorProfile.userId,
                      fullname: authorProfile.fullname || null,
                      affiliations: authorProfile.affiliations || null,
                      email: authorProfile.email || null,
                      nickname: authorProfile.nickname || null,
                    } as AuthorProfileFragment,
                  }
                : undefined,
            };
          }) || [],
      });
    }
  }, [data]);

  const hasChanges = useMemo(() => {
    if (!data?.geography) return false;

    // Name changed?
    const nameChanged = state.name !== data.geography.name;

    // Clipping layers changed?
    const serverLayers = data.geography.clippingLayers || [];
    const clientLayers = state.clippingLayers;

    if (serverLayers.length !== clientLayers.length) return true;

    // Check if any layers have been modified
    for (const serverLayer of serverLayers) {
      const clientLayer = clientLayers.find(
        (l) =>
          l.dataLayerId === serverLayer.dataLayer?.id ||
          l.templateId === serverLayer.templateId
      );
      if (!clientLayer) return true;
      if (clientLayer.operationType !== serverLayer.operationType) return true;
    }

    return nameChanged;
  }, [state, data?.geography]);

  const dialog = useDialog();

  const clippingLayers = state.clippingLayers;
  // Collect templateIds of existing clipping layers for disabling options
  const existingTemplateIds = useMemo(
    () =>
      new Set(
        clippingLayers
          .map((layer) => layer.templateId)
          .filter((id): id is string => !!id)
      ),
    [clippingLayers]
  );

  // Define managed layers with templateId and label
  const managedLayerOptions = [
    {
      label: t("Daylight Coastline"),
      templateId: "DAYLIGHT_COASTLINE",
    },
  ];

  return (
    <>
      {!showLayerChoice ? (
        <Modal
          loading={loading}
          disableBackdropClick={true}
          title={t("Edit Geography")}
          onRequestClose={onRequestClose}
          autoWidth={true}
          panelClassName="!w-[780px] !max-w-none"
          footerClassName="border-t bg-gray-50"
          footer={[
            {
              label: t("Save"),
              variant: "primary",
              loading: updateGeographyMutationState.loading,
              disabled:
                !hasChanges ||
                deleteMutationState.loading ||
                updateGeographyMutationState.loading,

              onClick: async () => {
                if (!state.name) {
                  dialog.alert({
                    message: t("Please enter a name for the geography."),
                  });
                  return;
                }
                try {
                  setState((prev) => ({ ...prev, error: undefined }));
                  await updateGeographyMutation({
                    variables: {
                      id,
                      payload: {
                        name: state.name,
                        clippingLayers: state.clippingLayers.map(
                          ({ localMetadata, ...layer }) => layer
                        ),
                      },
                    },
                  });
                  onRequestClose();
                } catch (error) {
                  setState((prev) => ({
                    ...prev,
                    error:
                      error instanceof Error
                        ? error.message
                        : t("An error occurred while saving"),
                  }));
                }
              },
            },
            {
              label: t("Cancel"),
              onClick: async () => {
                if (hasChanges) {
                  const answer = await dialog.confirm(
                    t("Are you sure you want to discard your changes?"),
                    {
                      primaryButtonText: t("Discard changes"),
                    }
                  );
                  if (answer) {
                    onRequestClose();
                  } else {
                    return;
                  }
                } else {
                  onRequestClose();
                }
              },
              disabled:
                deleteMutationState.loading ||
                updateGeographyMutationState.loading,
            },
            {
              label: t("Delete"),
              variant: "trash",
              loading: deleteMutationState.loading,
              disabled:
                deleteMutationState.loading ||
                updateGeographyMutationState.loading,
              onClick: async () => {
                await dialog.confirmDelete({
                  message: t("Are you sure you want to delete this geography?"),
                  description: t(
                    "This action cannot be undone. Related data layers will remain in the table of contents until you remove them."
                  ),
                  onDelete: async () => {
                    await deleteMutation({
                      variables: { id },
                    });
                    onRequestClose();
                  },
                });
              },
            },
          ]}
        >
          <div className="">
            <Tooltip.Provider>
              <TextInput
                autocomplete="off"
                name="geography-name"
                description={t(
                  "This name is visible within the administrative interface when configuring sketch classes, and used as a default label if this geography if used in reports."
                )}
                label={t("Name")}
                value={state.name}
                onChange={(val) => {
                  setState((prev) => ({
                    ...prev,
                    name: val,
                  }));
                }}
              />
              <div className="py-4">
                <h3 className="text-sm font-medium">{t("Clipping Layers")}</h3>
                <p className="text-sm text-gray-500">
                  <Trans ns="admin:geography">
                    These layers define the bounds of this geography, performing
                    intersection or difference operations against user-drawn
                    sketches. You will usually want one intersection layer to
                    define the geography bounds and one or more difference
                    layers to remove areas from that primary layer.
                  </Trans>
                </p>
                <div className="border mt-2 rounded-sm">
                  {clippingLayers.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">
                      {t("No clipping layers configured.")}
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("Layer")}
                          </th>
                          <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                            {t("Operation")}
                          </th>
                          <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                            {t("Filter")}
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("Last Updated By")}
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {clippingLayers.map((layer, index) => (
                          <tr key={index}>
                            <td className="px-4 py-0 text-sm max-w-56 truncate">
                              {layer.templateId &&
                              LAYER_ATTRIBUTIONS[layer.templateId] ? (
                                <span className="truncate">
                                  {LAYER_ATTRIBUTIONS[layer.templateId].label}
                                  <LayerAttribution
                                    templateId={layer.templateId}
                                  />
                                </span>
                              ) : (
                                <span className="truncate">
                                  {layer.localMetadata?.title || t("Untitled")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-0 text-sm capitalize text-center">
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button
                                    className="inline-flex items-center justify-center gap-2 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 px-2 py-0"
                                    aria-label={t("Change operation")}
                                    type="button"
                                  >
                                    {layer.operationType ===
                                    GeographyLayerOperation.Intersect ? (
                                      <IntersectionIcon size={40} />
                                    ) : (
                                      <DifferenceIcon size={40} />
                                    )}
                                    <ChevronDownIcon
                                      width={20}
                                      height={20}
                                      className="text-gray-400"
                                    />
                                  </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    side="right"
                                    align="start"
                                    className="bg-white rounded-lg shadow-2xl p-4 w-96 z-[1400] border border-gray-200"
                                  >
                                    <div className="flex flex-col gap-4">
                                      <div className="text-base mb-2">
                                        {t("Layer Clipping Operation")}
                                      </div>
                                      <DropdownMenu.Item
                                        onSelect={() => {
                                          setState((prev) => ({
                                            ...prev,
                                            clippingLayers:
                                              prev.clippingLayers.map((l, i) =>
                                                i === index
                                                  ? {
                                                      ...l,
                                                      operationType:
                                                        GeographyLayerOperation.Intersect,
                                                    }
                                                  : l
                                              ),
                                          }));
                                        }}
                                        className={`flex gap-4 items-start rounded-lg p-3 cursor-pointer transition ${
                                          layer.operationType ===
                                          GeographyLayerOperation.Intersect
                                            ? "bg-blue-50 ring-2 ring-blue-200"
                                            : "hover:bg-gray-50"
                                        }`}
                                      >
                                        <IntersectionIcon size={48} />
                                        <div>
                                          <div className="font-medium text-base mb-1">
                                            {t("Intersection")}
                                          </div>
                                          <div className="text-gray-600 text-sm">
                                            {t(
                                              "Only area within this layer will be included in the geography."
                                            )}
                                          </div>
                                        </div>
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onSelect={() => {
                                          setState((prev) => ({
                                            ...prev,
                                            clippingLayers:
                                              prev.clippingLayers.map((l, i) =>
                                                i === index
                                                  ? {
                                                      ...l,
                                                      operationType:
                                                        GeographyLayerOperation.Difference,
                                                    }
                                                  : l
                                              ),
                                          }));
                                        }}
                                        className={`flex gap-4 items-start rounded-lg p-3 cursor-pointer transition ${
                                          layer.operationType ===
                                          GeographyLayerOperation.Difference
                                            ? "bg-blue-50 ring-2 ring-blue-200"
                                            : "hover:bg-gray-50"
                                        }`}
                                      >
                                        <DifferenceIcon size={48} />
                                        <div>
                                          <div className="font-medium text-base mb-1">
                                            {t("Difference")}
                                          </div>
                                          <div className="text-gray-600 text-sm">
                                            {t(
                                              "This area will be removed from the geography."
                                            )}
                                          </div>
                                        </div>
                                      </DropdownMenu.Item>
                                    </div>
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                            </td>
                            <td className="px-4 py-0 text-sm text-center">
                              {layer.cql2Query ? (
                                <Tooltip.Root delayDuration={100}>
                                  <Tooltip.Trigger asChild>
                                    <span>
                                      <MixerHorizontalIcon
                                        className="inline text-blue-500"
                                        width={22}
                                        height={22}
                                        aria-label={t("Layer has a filter")}
                                      />
                                    </span>
                                  </Tooltip.Trigger>
                                  <Tooltip.Portal>
                                    <Tooltip.Content
                                      className="bg-white text-gray-900 rounded shadow-md px-3 py-2 text-xs max-w-xs z-50 border border-black/15"
                                      side="right"
                                      align="center"
                                    >
                                      <div>
                                        {t(
                                          "A filter is applied to this layer using a CQL2 query. Only features matching this query will be included in clipping."
                                        )}
                                      </div>
                                      <code>
                                        {JSON.stringify(
                                          layer.cql2Query,
                                          null,
                                          2
                                        )}
                                      </code>
                                      <Tooltip.Arrow className="fill-white" />
                                    </Tooltip.Content>
                                  </Tooltip.Portal>
                                </Tooltip.Root>
                              ) : (
                                <span className="">
                                  <MixerHorizontalIcon
                                    className="inline text-gray-300"
                                    width={22}
                                    height={22}
                                    aria-label={t("No filter")}
                                  />
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-0 text-sm flex items-center space-x-1 h-14">
                              {layer.localMetadata?.authorProfile && (
                                <>
                                  <InlineAuthor
                                    profile={layer.localMetadata.authorProfile}
                                  />
                                </>
                              )}

                              <span>
                                {layer.localMetadata?.createdAt
                                  ? "on " +
                                    new Date(
                                      layer.localMetadata.createdAt
                                    ).toLocaleDateString()
                                  : ""}
                              </span>
                            </td>
                            <td className="px-4 py-0 text-sm">
                              <button
                                className="text-gray-400 hover:text-red-500 transition-colors duration-150 p-1 rounded-full hover:bg-red-50"
                                onClick={() => {
                                  setState((prev) => ({
                                    ...prev,
                                    clippingLayers: prev.clippingLayers.filter(
                                      (_, i) => i !== index
                                    ),
                                  }));
                                }}
                              >
                                <TrashIcon width={20} height={20} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5} className="px-4 py-3">
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition text-sm font-medium shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                  <PlusIcon width={18} height={18} />
                                  {t("Add Clipping Layer")}
                                </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                  side="top"
                                  align="start"
                                  className="bg-white rounded-lg shadow-xl p-2 w-64 z-[1400] border border-gray-200"
                                >
                                  <DropdownMenu.Item
                                    className="px-3 py-2 rounded hover:bg-gray-100 cursor-pointer text-sm"
                                    onSelect={() => {
                                      onShowLayerChoiceChange(true);
                                    }}
                                  >
                                    {t("Choose from uploaded layers")}
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Separator className="my-1 h-px bg-gray-200" />
                                  <div className="px-3 py-1 text-xs text-gray-500 font-semibold select-none">
                                    {t("SeaSketch Managed Layers")}
                                  </div>
                                  {managedLayerOptions.map((option) => (
                                    <DropdownMenu.Item
                                      key={option.templateId}
                                      className={`px-3 py-2 rounded text-sm ${
                                        existingTemplateIds.has(
                                          option.templateId
                                        )
                                          ? "text-gray-400 cursor-not-allowed"
                                          : "hover:bg-gray-100 cursor-pointer"
                                      }`}
                                      disabled={existingTemplateIds.has(
                                        option.templateId
                                      )}
                                      onSelect={() => {
                                        if (
                                          existingTemplateIds.has(
                                            option.templateId
                                          )
                                        )
                                          return;
                                        const templateLayer = (
                                          data?.geographyClippingLayers || []
                                        ).find(
                                          (layer) =>
                                            layer.dataSource
                                              ?.dataLibraryTemplateId ===
                                            option.templateId
                                        );
                                        if (!templateLayer) {
                                          throw new Error("Layer not found");
                                        }
                                        const authorProfile =
                                          templateLayer.dataSource
                                            ?.authorProfile;

                                        setState((prev) => ({
                                          ...prev,
                                          clippingLayers: [
                                            ...prev.clippingLayers,
                                            {
                                              templateId: option.templateId,
                                              dataLayerId: templateLayer.id,
                                              operationType:
                                                GeographyLayerOperation.Difference,
                                              localMetadata: {
                                                title: option.label,
                                                createdAt:
                                                  templateLayer.dataSource
                                                    ?.createdAt || "",
                                                authorProfile:
                                                  authorProfile as AuthorProfileFragment,
                                              },
                                            },
                                          ],
                                        }));
                                      }}
                                    >
                                      {option.label}
                                    </DropdownMenu.Item>
                                  ))}
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            </Tooltip.Provider>
          </div>
          {state.error && (
            <div className="mt-1 mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
              {state.error}
            </div>
          )}
        </Modal>
      ) : (
        createPortal(
          <div
            className="absolute left-56 top-0 h-full"
            style={{
              width: `calc(100vw - 14rem)`,
            }}
          >
            <SidebarMask />
            <div className="absolute inset-0 flex items-center justify-center">
              <LayerChoice
                map={map}
                onCancel={() => onShowLayerChoiceChange(false)}
                onSubmit={async ({
                  dataLayerId,
                  layerTitle,
                  createdAt,
                  authorProfile,
                }) => {
                  setState((prev) => ({
                    ...prev,
                    clippingLayers: [
                      ...prev.clippingLayers,
                      {
                        dataLayerId,
                        operationType: GeographyLayerOperation.Difference,
                        localMetadata: {
                          createdAt,
                          authorProfile: authorProfile as AuthorProfileFragment,
                          title: layerTitle,
                        },
                      },
                    ],
                  }));
                  onShowLayerChoiceChange(false);
                }}
                mode="clippingLayerAddition"
                excludeDataLayerIds={
                  state.clippingLayers
                    .map((l) => l.dataLayerId)
                    .filter(Boolean) as number[]
                }
              />
            </div>
          </div>,
          document.body
        )
      )}
    </>
  );
}

// Intersection Venn diagram icon
export function IntersectionIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-label="Intersection"
    >
      <circle cx="12" cy="16" r="8" fill="#3B82F6" fillOpacity="0.2" />
      <circle cx="20" cy="16" r="8" fill="#3B82F6" fillOpacity="0.2" />
      <clipPath id="intersectClip">
        <circle cx="12" cy="16" r="8" />
      </clipPath>
      <circle
        cx="20"
        cy="16"
        r="8"
        fill="#3B82F6"
        fillOpacity="0.7"
        clipPath="url(#intersectClip)"
      />
      <circle
        cx="12"
        cy="16"
        r="8"
        stroke="#3B82F6"
        strokeWidth="1.5"
        fill="none"
      />
      <circle
        cx="20"
        cy="16"
        r="8"
        stroke="#3B82F6"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

// Difference Venn diagram icon
export function DifferenceIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="Difference">
      {/* Left circle (blue, except intersection) */}
      <defs>
        <clipPath id="diffClip">
          <circle cx="20" cy="16" r="8" />
        </clipPath>
        <pattern id="dashed" width="4" height="4" patternUnits="userSpaceOnUse">
          <path
            d="M0,2 l4,0"
            stroke="#3B82F6"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        </pattern>
      </defs>
      <circle cx="12" cy="16" r="8" fill="#3B82F6" fillOpacity="0.7" />
      {/* Cut out intersection */}
      <circle
        cx="20"
        cy="16"
        r="8"
        fill="white"
        fillOpacity="1"
        clipPath="url(#diffClip)"
      />
      {/* Dashed intersection */}
      <circle
        cx="20"
        cy="16"
        r="8"
        fill="url(#dashed)"
        clipPath="url(#diffClip)"
        fillOpacity="0.5"
      />
      {/* Outlines */}
      <circle
        cx="12"
        cy="16"
        r="8"
        stroke="#3B82F6"
        strokeWidth="1.5"
        fill="none"
      />
      <circle
        cx="20"
        cy="16"
        r="8"
        stroke="#3B82F6"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

// Reusable attribution tooltip component
function LayerAttribution({ templateId }: { templateId: string }) {
  const attribution = LAYER_ATTRIBUTIONS[templateId];
  const { t } = useTranslation("admin:geography");
  if (!attribution) return null;
  return (
    <Tooltip.Root delayDuration={100}>
      <Tooltip.Trigger asChild>
        <a
          target="_blank"
          href={attribution.url}
          className="ml-1"
          tabIndex={0}
          aria-label={t("Attribution")}
        >
          <InfoCircledIcon className="inline" />
        </a>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-white text-gray-900 rounded shadow-md px-3 py-2 text-xs max-w-xs z-50 border border-black/15"
          side="right"
          align="center"
        >
          {attribution.tooltip(t, Trans)}
          <div className="pt-1">
            <Trans ns="admin:geography">
              The SeaSketch team maintains an updated copy of this authoritative
              data for use in your projects.
            </Trans>
          </div>
          <Tooltip.Arrow className="fill-white" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
// Attribution link component for consistent external links
function AttributionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="underline text-primary-500"
      target="_blank"
      rel="noopener noreferrer"
      href={href}
    >
      {label}
    </a>
  );
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
