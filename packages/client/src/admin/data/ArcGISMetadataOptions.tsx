import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import Switch from "../../components/Switch";
import {
  GetMetadataDocument,
  useUpdateHideArcGisRestLinkMutation,
} from "../../generated/graphql";
import { layerSettingsChangeLogRefetchQueries } from "../changelogs/layerSettingsChangeLogRefetch";

export default function ArcGISMetadataOptions({
  itemId,
  esriRestUrl,
  hideArcGisRestLink,
  customizedMetadata,
  onUseDynamicMetadata,
  useDynamicMetadataLoading,
}: {
  itemId?: number;
  esriRestUrl?: string | null;
  hideArcGisRestLink: boolean;
  customizedMetadata?: boolean;
  onUseDynamicMetadata?: () => void;
  useDynamicMetadataLoading?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const [mutation, mutationState] = useUpdateHideArcGisRestLinkMutation();

  if (!esriRestUrl && !customizedMetadata) {
    return null;
  }

  return (
    <div className="flex-none border-t border-gray-200 bg-gray-50 px-4">
      {customizedMetadata && onUseDynamicMetadata && (
        <div className="py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 text-sm font-medium text-gray-900">
              {t("Customized service metadata")}
            </div>
            <Button
              small
              loading={useDynamicMetadataLoading}
              label={t("Use dynamic service metadata")}
              onClick={onUseDynamicMetadata}
            />
          </div>
          <p className="mt-0.5 text-xs text-gray-500 leading-snug pr-2">
            {t("Origin server updates will no longer appear.")}
          </p>
        </div>
      )}
      {esriRestUrl && itemId != null && (
        <div
          className={`py-2.5 ${
            customizedMetadata ? "border-t border-gray-200" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 text-sm font-medium text-gray-900">
              {t("Show ESRI REST URL")}
            </div>
            <Switch
              mini
              disabled={mutationState.loading}
              isToggled={!hideArcGisRestLink}
              onClick={(next) => {
                mutation({
                  variables: {
                    id: itemId,
                    hideArcGisRestLink: !next,
                  },
                  optimisticResponse: {
                    __typename: "Mutation",
                    updateTableOfContentsItem: {
                      __typename: "UpdateTableOfContentsItemPayload",
                      tableOfContentsItem: {
                        __typename: "TableOfContentsItem",
                        id: itemId,
                        hideArcGisRestLink: !next,
                      },
                    },
                  },
                  refetchQueries: [
                    ...layerSettingsChangeLogRefetchQueries(itemId),
                    {
                      query: GetMetadataDocument,
                      variables: { itemId },
                    },
                  ],
                });
              }}
            />
          </div>
          <p className="mt-0.5 text-xs text-gray-500 leading-snug pr-2">
            {t(
              "Lets users open the GIS service from the public metadata page."
            )}
          </p>
        </div>
      )}
    </div>
  );
}
