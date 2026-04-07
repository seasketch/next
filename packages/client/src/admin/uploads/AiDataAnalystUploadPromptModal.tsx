import { Trans, useTranslation } from "react-i18next";
import { useApolloClient } from "@apollo/client";
import { useCallback, useRef, useState } from "react";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import {
  MyProfileDocument,
  useUpdateAiDataAnalysSettingsForMeMutation,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import type ProjectBackgroundJobManager from "./ProjectBackgroundJobManager";

export default function AiDataAnalystUploadPromptModal({
  manager,
  onFinished,
}: {
  manager: ProjectBackgroundJobManager;
  onFinished: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const client = useApolloClient();
  const onError = useGlobalErrorHandler();
  const [saving, setSaving] = useState(false);
  const [flushError, setFlushError] = useState<string | null>(null);
  const chosenEnableAi = useRef<boolean | null>(null);
  /** Which footer action is running (for per-button loading). */
  const [activeAction, setActiveAction] = useState<
    "enable" | "disable" | "retry" | null
  >(null);

  const [updateSettings] = useUpdateAiDataAnalysSettingsForMeMutation();

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
  }, [flushOrThrow, onError, onFinished, t]);

  const choose = useCallback(
    async (enableAi: boolean) => {
      setSaving(true);
      setActiveAction(enableAi ? "enable" : "disable");
      setFlushError(null);
      try {
        await updateSettings({ variables: { enableAi } });
        await client.refetchQueries({ include: [MyProfileDocument] });
        chosenEnableAi.current = enableAi;
        await flushOrThrow(enableAi);
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
    },
    [client, flushOrThrow, onError, onFinished, t, updateSettings]
  );

  return (
    <Modal
      title={t("AI Cartographer notes for your uploads")}
      onRequestClose={() => {}}
      disableBackdropClick
      scrollable
      footer={[
        {
          label: t("Disable for my account"),
          variant: "secondary",
          disabled: saving,
          loading: activeAction === "disable",
          onClick: () => {
            void choose(false);
          },
        },
        {
          label: t("Enable for my account"),
          variant: "primary",
          disabled: saving,
          loading: activeAction === "enable",
          autoFocus: true,
          onClick: () => {
            void choose(true);
          },
        },
      ]}
    >
      <div className="space-y-3 text-sm text-gray-700">
        <p>
          <Trans ns="admin:data">
            SeaSketch can use AI to produce optional &quot;Cartographer
            notes&quot; for layers you upload—suggestions for titles,
            attribution, and how attributes are presented. This uses automated
            analysis of layer metadata and statistics (geostats), not full
            copies of your raw files.
          </Trans>
        </p>
        <p>
          <Trans ns="admin:data">
            That information is sent to a third-party AI service through
            SeaSketch&apos;s infrastructure. Do not use this for legally
            privileged, export-controlled, or highly sensitive data.
          </Trans>
        </p>
        <p>
          <Trans ns="admin:data">
            <strong>You are responsible</strong> for data you upload. Choose
            whether to allow AI analysis for your account before processing
            continues. You can change this later in your profile settings.
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
