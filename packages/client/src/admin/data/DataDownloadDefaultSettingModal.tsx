import { useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import {
  useProjectDownloadSettingQuery,
  useUpdateEnableDownloadByDefaultMutation,
  useUpdateEnableDownloadMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

export default function DataDownloadDefaultSettingModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const { data, loading } = useProjectDownloadSettingQuery({
    variables: {
      slug: getSlug(),
    },
  });
  const onError = useGlobalErrorHandler();
  const [mutate, mState] = useUpdateEnableDownloadByDefaultMutation({
    onError,
  });

  return (
    <Modal
      title={t("Data download feature settings")}
      onRequestClose={onRequestClose}
      loading={loading}
      footer={[
        {
          label: t("Close"),
          onClick: onRequestClose,
        },
      ]}
    >
      <InputBlock
        className="mt-1"
        input={
          <Switch
            isToggled={Boolean(data?.projectBySlug?.enableDownloadByDefault)}
            onClick={() => {
              if (data?.projectBySlug?.id) {
                const projectId = data.projectBySlug.id;
                mutate({
                  variables: {
                    projectId,
                    enableDownload: !Boolean(
                      data?.projectBySlug?.enableDownloadByDefault
                    ),
                  },
                  optimisticResponse: (data) => {
                    return {
                      __typename: "Mutation",
                      updateProject: {
                        __typename: "UpdateProjectPayload",
                        project: {
                          __typename: "Project",
                          id: projectId,
                          enableDownloadByDefault: data.enableDownload!,
                        },
                      },
                    };
                  },
                });
              }
            }}
          />
        }
        title={t("Enable data download by default")}
        description={t(
          "When enabled, newly added data layers will be downloadable by default. This setting can be changed for each layer individually after creation. Changing this setting can help you avoid having to manually enable or disable data download for each layer. Note that this setting will not impact existing layers. To change the setting for existing layers, use Edit menu or individual layer edit window."
        )}
      />
    </Modal>
  );
}
