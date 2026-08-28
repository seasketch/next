import { useTranslation } from "react-i18next";
import MetadataFooterSetting from "./MetadataFooterSetting";
import Switch from "../components/Switch";
import {
  GetMetadataDocument,
  useUpdateHideArcGisRestLinkMutation,
} from "../generated/graphql";
import { layerSettingsChangeLogRefetchQueries } from "../admin/changelogs/layerSettingsChangeLogRefetch";

export default function HideArcGISRestLinkControl({
  itemId,
  hideArcGisRestLink,
}: {
  itemId: number;
  hideArcGisRestLink: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const [mutation, mutationState] = useUpdateHideArcGisRestLinkMutation();
  const showRestUrl = !hideArcGisRestLink;

  return (
    <MetadataFooterSetting
      title={t("Show ESRI REST URL")}
      description={t(
        "Adds a link to the ArcGIS REST service on the public metadata page."
      )}
    >
      <Switch
        disabled={mutationState.loading}
        isToggled={showRestUrl}
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
    </MetadataFooterSetting>
  );
}
