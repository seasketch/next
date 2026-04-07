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
import { SparklesIcon } from "@heroicons/react/outline";

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
      title={
        <span className="flex items-center space-x-2">
          <SparklesIcon
            className="h-5 w-5 shrink-0 text-primary-600"
            aria-hidden
          />
          <span>{t("AI Cartographer")}</span>
          <span className="bg-yellow-300/70 px-2 rounded text-sm">
            {t("New!")}
          </span>
        </span>
      }
      onRequestClose={() => {}}
      disableBackdropClick
      scrollable
      footer={[
        {
          label: t("Disable for now"),
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
            Our AI Cartographer can suggest titles, attribution, cartographic
            styles, and popups for your uploads. To do this, we use an AI
            service to analyze your layer's filename, metadata, statistics, and
            sample column values. We scan for and redact personally identifiable
            information (PII) where found.
          </Trans>
        </p>
        <p>
          <Trans ns="admin:data">
            For more information on how this system works, see{" "}
            <a
              className="text-primary-500 underline"
              href="https://docs.seasketch.org/seasketch-documentation/administrators-guide/overlay-layers/ai-cartographer"
              target="_blank"
              rel="noopener noreferrer"
            >
              our documentation
            </a>
            . You can also toggle this setting later under{" "}
            <b>Settings → AI layer processing</b>.
          </Trans>
        </p>
        <p>
          <Trans ns="admin:data">
            Would you like to enable the AI Cartographer for this upload?
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
