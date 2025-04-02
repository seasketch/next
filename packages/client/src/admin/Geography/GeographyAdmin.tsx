import { DotsHorizontalIcon, FileTextIcon } from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
import {
  GeographyClippingLayersDocument,
  useGeographyClippingLayersQuery,
  useUpdateLandClippingSettingsMutation,
} from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import Warning from "../../components/Warning";
import { ReactNode, useState } from "react";
import Switch from "../../components/Switch";
import getSlug from "../../getSlug";
import LandClippingModal from "./LandClippingModal";
import EEZClippingModal from "./EEZClippingModal";

const EEZ = "MARINE_REGIONS_EEZ_LAND_JOINED";
const COASTLINE = "DAYLIGHT_COASTLINE";

export default function GeographyAdmin() {
  const { t } = useTranslation("admin:geography");
  const slug = getSlug();
  const { data, loading, error } = useGeographyClippingLayersQuery({
    variables: { slug },
    skip: !slug,
  });
  const [openModalsState, setOpenModalsState] = useState<{
    land: boolean;
    eez: boolean;
  }>({ land: false, eez: false });

  const [updateLandClippingMutation, updateLandClippingState] =
    useUpdateLandClippingSettingsMutation();

  const coastline = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === COASTLINE
  );

  const eez = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === EEZ
  );

  const hasBuiltInLayers = Boolean(coastline) && Boolean(eez);

  return (
    <div className="w-full h-full flex">
      <nav className="w-96 bg-white h-full overflow-y-auto border-r border-black border-opacity-10 flex flex-col">
        <h1 className="p-4 font-semibold">
          <Trans ns="admin:geograpy">Geography</Trans>
        </h1>
        <p className="px-4 text-sm">
          <Trans ns="admin:geography">
            Geographies represent spatial areas where sketches can be drawn and
            define regions where you would like to aggregate metrics for
            reporting. Your project can use built-in land and eez layers to
            start with, and add custom boundary layers if needed.
          </Trans>
        </p>
        <p className="text-sm p-4">
          <a href="" className="flex items-center space-x-1 text-primary-500">
            <FileTextIcon />
            <span>
              <Trans ns="admin:geography">
                Read the geography documentation
              </Trans>
            </span>
          </a>
        </p>
        <div className="flex flex-col overflow-y-auto bg-gray-200 h-full shadow-inner">
          {loading && (
            <div className="w-full text-center p-5">
              <Spinner />
            </div>
          )}
          {!hasBuiltInLayers && !loading && (
            <Warning level="error">
              <Trans ns="admin:geography">
                SeaSketch has not been configured correctly with {EEZ} and{" "}
                {COASTLINE} layers. Contact{" "}
                <a className="underline" href="mailto:support@seasketch.org">
                  support@seasketch.org
                </a>{" "}
                for assistance.
              </Trans>
            </Warning>
          )}
          {!loading && (
            <ul className="w-full p-2">
              <GeographyLayerItem
                name="Remove Land"
                enabled={Boolean(
                  data?.projectBySlug?.geographySettings?.enableLandClipping
                )}
                onEdit={() => setOpenModalsState({ land: true, eez: false })}
                onToggle={(enabled) => {
                  updateLandClippingMutation({
                    variables: { enable: enabled, slug },
                    optimisticResponse: {
                      __typename: "Mutation",
                      updateLandClippingSettings: {
                        __typename: "UpdateLandClippingSettingsPayload",
                        projectGeographySetting: {
                          id: data?.projectBySlug?.geographySettings?.id,
                          __typename: "ProjectGeographySetting",
                          enableLandClipping: enabled,
                          projectId: data?.projectBySlug?.id,
                          eezSelections:
                            data?.projectBySlug?.geographySettings
                              ?.eezSelections,
                        },
                      },
                    },
                  });
                }}
              />
              <GeographyLayerItem
                name="Limit to Exclusive Economic Zone"
                enabled={Boolean(
                  data?.projectBySlug?.geographySettings?.enableEezClipping &&
                    data?.projectBySlug?.geographySettings?.eezSelections
                      ?.length
                )}
                onEdit={() => {
                  setOpenModalsState({ land: false, eez: true });
                }}
                description={
                  data?.projectBySlug?.geographySettings?.eezSelections?.length
                    ? data.projectBySlug.geographySettings.eezSelections.join(
                        ", "
                      )
                    : t("Choose an EEZ to enable this layer")
                }
                onToggle={(enabled) => {
                  if (
                    (
                      data?.projectBySlug?.geographySettings?.eezSelections ||
                      []
                    ).length === 0
                  ) {
                    setOpenModalsState({ land: false, eez: true });
                  } else {
                    // do the mutation
                  }
                }}
              />
            </ul>
          )}
        </div>
      </nav>
      {openModalsState.land && (
        <LandClippingModal
          onRequestClose={() => setOpenModalsState({ land: false, eez: false })}
          enabled={Boolean(
            data?.projectBySlug?.geographySettings?.enableLandClipping
          )}
          lastUpdated={new Date(coastline?.dataSource?.createdAt)}
          author={coastline?.dataSource?.authorProfile!}
          // project={data?.projectBySlug}
        />
      )}
      {openModalsState.eez && (
        <EEZClippingModal
          onRequestClose={() => setOpenModalsState({ land: false, eez: false })}
          enabled={Boolean(
            data?.projectBySlug?.geographySettings?.enableEezClipping &&
              data?.projectBySlug?.geographySettings?.eezSelections?.length
          )}
          lastUpdated={new Date(eez?.dataSource?.createdAt)}
          author={eez?.dataSource?.authorProfile!}
        />
      )}
      <div className="flex-1"></div>
    </div>
  );
}

function GeographyLayerItem({
  name,
  description,
  enabled,
  onEdit,
  onToggle,
}: {
  name: ReactNode;
  description?: ReactNode;
  enabled: boolean;
  onEdit?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  return (
    <div className="m-2 rounded-md p-2 border-b border-gray-200 text-sm bg-white shadow-sm flex space-x-2 items-center">
      <Switch
        onClick={onToggle}
        className="transform scale-75"
        isToggled={enabled}
      />
      <div className="flex-1">
        <h2 className="font-semibold">{name}</h2>
        {description && <p className="text-xs">{description}</p>}
      </div>
      <button
        onClick={onEdit}
        className="rounded-full bg-gray-50 text-center w-8 h-8 flex items-center justify-center border border-black border-opacity-5"
      >
        <DotsHorizontalIcon className="inline" />
      </button>
    </div>
  );
}
