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
      title={t("AI-assisted data analysis")}
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
            When enabled, SeaSketch may use AI to help you work with hosted
            layers—for example suggesting titles, attribution, and how layer
            attributes are summarized or presented. These features use
            automated analysis of layer metadata and statistics (geostats), not
            full copies of your raw upload files.
          </Trans>
        </p>
        <p>
          <Trans ns="admin:data">
            That information is sent from SeaSketch to a third-party AI service
            (accessed through SeaSketch&apos;s cloud infrastructure). Do not
            rely on this feature for legally privileged, export-controlled, or
            highly sensitive data.
          </Trans>
        </p>
        <p>
          <Trans ns="admin:data">
            <strong>You are responsible</strong> for layers you upload or connect
            as a project administrator. Only enable this if you are allowed to
            share the layer&apos;s descriptive metadata and statistical
            summaries with an external AI provider under your policies,
            agreements, and applicable law.
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
        title={t("Allow AI-assisted analysis for my account")}
        description={t(
          "Turn off to prevent SeaSketch from sending layer metadata and geostats from your sessions to an AI service. Other project admins make their own choice for their accounts."
        )}
      />
    </Modal>
  );
}
