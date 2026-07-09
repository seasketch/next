import { Trans, useTranslation } from "react-i18next";
import { useApolloClient } from "@apollo/client";
import { useCallback, useRef, useState } from "react";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import {
  MyProfileDocument,
  useMyProfileQuery,
  useUpdateAiDataAnalysSettingsForMeMutation,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import type ProjectBackgroundJobManager from "./ProjectBackgroundJobManager";
import { SparklesIcon } from "@heroicons/react/outline";
import { setAiCartographerUploadReminderConfirmedAt } from "./aiCartographerUploadReminder";

export default function AiDataAnalystUploadReminderModal({
  manager,
  onFinished,
}: {
  manager: ProjectBackgroundJobManager;
  onFinished: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const client = useApolloClient();
  const onError = useGlobalErrorHandler();
  const { data: profileData } = useMyProfileQuery();
  const [saving, setSaving] = useState(false);
  const [flushError, setFlushError] = useState<string | null>(null);
  const chosenEnableAi = useRef<boolean | null>(null);
  const [activeAction, setActiveAction] = useState<
    "continue" | "disable" | "retry" | null
  >(null);

  const [updateSettings] = useUpdateAiDataAnalysSettingsForMeMutation();

  const userId = profileData?.me?.profile?.userId;

  const recordConfirmation = useCallback(() => {
    let id = userId;
    if (id == null) {
      try {
        const data = client.readQuery<{
          me?: { profile?: { userId?: number | null } | null } | null;
        }>({ query: MyProfileDocument });
        id = data?.me?.profile?.userId ?? undefined;
      } catch {
        return;
      }
    }
    if (id != null) {
      setAiCartographerUploadReminderConfirmedAt(id);
    }
  }, [client, userId]);

  const flushOrThrow = useCallback(
    async (enableAiDataAnalyst: boolean) => {
      await manager.flushPendingSubmitsAfterAiPrompt(enableAiDataAnalyst);
    },
    [manager]
  );

  const runFlushOnly = useCallback(async () => {
    const choice = chosenEnableAi.current;
    if (choice === null) {
      return;
    }
    setSaving(true);
    setActiveAction("retry");
    setFlushError(null);
    try {
      await flushOrThrow(choice);
      if (choice) {
        recordConfirmation();
      }
      onFinished();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : t("Could not start processing.");
      setFlushError(message);
      onError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
      setActiveAction(null);
    }
  }, [flushOrThrow, onError, onFinished, recordConfirmation, t]);

  const continueWithAi = useCallback(async () => {
    setSaving(true);
    setActiveAction("continue");
    setFlushError(null);
    try {
      chosenEnableAi.current = true;
      await flushOrThrow(true);
      recordConfirmation();
      onFinished();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : t("Could not start processing.");
      setFlushError(message);
      onError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
      setActiveAction(null);
    }
  }, [flushOrThrow, onError, onFinished, recordConfirmation, t]);

  const disableAndContinue = useCallback(async () => {
    setSaving(true);
    setActiveAction("disable");
    setFlushError(null);
    try {
      await updateSettings({ variables: { enableAi: false } });
      await client.refetchQueries({ include: [MyProfileDocument] });
      chosenEnableAi.current = false;
      await flushOrThrow(false);
      onFinished();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : t("Something went wrong.");
      setFlushError(message);
      onError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
      setActiveAction(null);
    }
  }, [client, flushOrThrow, onError, onFinished, t, updateSettings]);

  return (
    <Modal
      title={
        <span className="flex items-center space-x-2">
          <SparklesIcon
            className="h-5 w-5 shrink-0 text-primary-600"
            aria-hidden
          />
          <span>{t("AI Cartographer is on")}</span>
        </span>
      }
      onRequestClose={() => {}}
      disableBackdropClick
      scrollable
      footer={[
        {
          label: t("Continue with AI"),
          variant: "primary",
          disabled: saving,
          loading: activeAction === "continue",
          autoFocus: true,
          onClick: () => {
            void continueWithAi();
          },
        },
        {
          label: t("Disable and continue"),
          variant: "secondary",
          disabled: saving,
          loading: activeAction === "disable",
          onClick: () => {
            void disableAndContinue();
          },
        },
      ]}
    >
      <div className="space-y-3 text-sm text-gray-700">
        <p>
          <Trans ns="admin:data">
            The AI Cartographer is enabled for your account. This upload will be
            analyzed to suggest a title, attribution, cartographic style, and
            popups. A summary of your layer's metadata and sample values is sent
            to an AI service; personally identifiable information (PII) is
            redacted where found.
          </Trans>
        </p>
        <p>
          <Trans ns="admin:data">
            For more information about how this system works, including handling
            of PII, read{" "}
            <a
              className="text-primary-500 underline"
              href="https://docs.seasketch.org/seasketch-documentation/administrators-guide/overlay-layers/ai-cartographer"
              target="_blank"
              rel="noopener noreferrer"
            >
              our documentation
            </a>
            . You can change this anytime under{" "}
            <b>Settings → AI layer processing</b>.
          </Trans>
        </p>
        {flushError && (
          <p className="text-red-700" role="alert">
            {flushError}
          </p>
        )}
        {chosenEnableAi.current !== null && flushError && (
          <div>
            <button
              type="button"
              className="inline-flex items-center text-sm font-medium text-primary-700 hover:text-primary-800 disabled:opacity-50"
              disabled={saving}
              onClick={() => {
                void runFlushOnly();
              }}
            >
              {t("Try starting processing again")}
              {activeAction === "retry" && (
                <Spinner className="ml-2" color="grey" />
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
