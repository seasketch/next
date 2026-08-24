import { Cross2Icon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { useFocusGuards } from "@radix-ui/react-focus-guards";
import { Portal } from "@radix-ui/react-portal";
import { useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";

export function TimeSeriesProcessingModal({
  open,
  current,
  total,
  error,
  onDismiss,
}: {
  open: boolean;
  current: number;
  total: number;
  error: string | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("admin:reports");
  useFocusGuards();
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
        <FocusScope loop trapped>
          <DismissableLayer
            disableOutsidePointerEvents
            onEscapeKeyDown={(event) => {
              if (!error) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (!error) event.preventDefault();
            }}
            onDismiss={error ? onDismiss : undefined}
            className="relative outline-none"
            tabIndex={-1}
          >
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 shadow-lg text-sm text-gray-800"
            >
              {error ? (
                <>
                  <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-600 flex-none" />
                  <span className="max-w-xs truncate text-red-700">
                    {error}
                  </span>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="flex-none p-0.5 rounded text-gray-400 hover:text-gray-700"
                    aria-label={t("Close")}
                  >
                    <Cross2Icon className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Spinner mini />
                  <span>
                    {t(
                      "Submitting layers for processing ({{current}}/{{total}})…",
                      { current, total }
                    )}
                  </span>
                </>
              )}
            </div>
          </DismissableLayer>
        </FocusScope>
      </div>
    </Portal>
  );
}
