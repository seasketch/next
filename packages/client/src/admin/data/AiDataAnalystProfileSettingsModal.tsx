import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import {
  MyProfileDocument,
  useMyProfileQuery,
  useUpdateAiDataAnalystSettingsMutation,
} from "../../generated/graphql";
import type { MyProfileQuery } from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Warning from "../../components/Warning";

export default function AiDataAnalystProfileSettingsModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const { data, loading } = useMyProfileQuery();
  const [mutate, { loading: saving }] = useUpdateAiDataAnalystSettingsMutation({
    onError,
    optimisticResponse: () => ({
      __typename: "Mutation" as const,
      updateAiDataAnalystSettings: {
        __typename: "UpdateAiDataAnalystSettingsPayload" as const,
        boolean: true,
      },
    }),
    update(cache, _result, { variables }) {
      const enableAi = variables?.enableAi;
      if (enableAi === undefined) {
        return;
      }
      const cached = cache.readQuery<MyProfileQuery>({
        query: MyProfileDocument,
      });
      const userId = cached?.me?.profile?.userId;
      if (userId == null) {
        return;
      }
      cache.modify({
        id: cache.identify({ __typename: "Profile", userId }),
        fields: {
          enableAiDataAnalyst: () => enableAi,
        },
      });
    },
  });

  const profile = data?.me?.profile;
  const enabled = Boolean(profile?.enableAiDataAnalyst);

  return (
    <Modal
      title={t("AI layer processing settings")}
      onRequestClose={onRequestClose}
      loading={loading}
      footer={[
        {
          label: t("Close"),
          onClick: onRequestClose,
        },
      ]}
    >
      {!profile && !loading && (
        <Warning level="warning" className="mb-4">
          <Trans ns="admin:data">
            Your profile could not be loaded. Sign in again, then reopen this
            dialog.
          </Trans>
        </Warning>
      )}
      <div className="space-y-3 text-sm text-gray-700">
        <p>
          <Trans ns="admin:data">
            When uploading new layers to SeaSketch, you have the option to
            process layers using our AI Cartographer system. This system can
            assign layers a well-formatted title, attribution, a cartographic
            style, and interactivity settings (e.g. popups).
          </Trans>
        </p>
        <p>
          <Trans ns="admin:data">
            SeaSketch creates a summary of your layer's metadata, including
            statistics and sample column values, and sends it to a third-party
            AI service for analysis. While SeaSketch detects and redacts
            personally identifiable information (PII), we recommend disabling
            this feature when uploading very sensitive data.
          </Trans>
        </p>

        <p>
          <Trans ns="admin:data">
            More information on how this system works{" "}
            <a
              className="text-primary-500 underline"
              href="https://docs.seasketch.org/seasketch-documentation/administrators-guide/overlay-layers/ai-cartographer"
              target="_blank"
            >
              can be found in our documentation
            </a>
            .
          </Trans>
        </p>
      </div>
      <InputBlock
        className="mt-5"
        input={
          <Switch
            disabled={!profile || saving}
            isToggled={enabled}
            onClick={() => {
              if (!profile || saving) {
                return;
              }
              void mutate({ variables: { enableAi: !enabled } });
            }}
          />
        }
        title={t("Enable AI layer processing for my account")}
      />
    </Modal>
  );
}
