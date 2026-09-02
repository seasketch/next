import { DownloadIcon, ReplyIcon } from "@heroicons/react/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useTranslation } from "react-i18next";
import { CHANGE_LOG_TOOLTIP_DELAY_MS } from "./FieldGroupListItemBase";

function downloadWithFilename(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export default function DataTableReplacementVersionMenu({
  versionLabel,
  fromVersion,
  tableName,
  downloadUrl,
  canRollback,
  onRollback,
  rollbackLoading,
}: {
  versionLabel: string;
  fromVersion: number;
  tableName: string;
  downloadUrl?: string;
  canRollback: boolean;
  onRollback: () => void;
  rollbackLoading: boolean;
}) {
  const { t } = useTranslation("admin:data");

  const downloadFilename =
    // eslint-disable-next-line i18next/no-literal-string -- download filename
    `${tableName}_v${fromVersion}.parquet`;

  return (
    <Tooltip.Root delayDuration={CHANGE_LOG_TOOLTIP_DELAY_MS}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full cursor-help items-center gap-1 align-baseline text-sm font-medium leading-5 text-blue-600 underline decoration-blue-400 decoration-dotted underline-offset-4 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 data-[state=open]:text-blue-700"
        >
          <span className="min-w-0 font-mono">{versionLabel}</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content
        align="start"
        side="top"
        sideOffset={6}
        collisionPadding={8}
        className="change-log-details-tooltip change-log-data-table-version-menu z-[999999]"
      >
        <div className="px-2.5 py-1.5 text-xs font-medium text-gray-500">
          {t("Version {{version}}", { version: fromVersion })}
        </div>
        <div className="my-0.5 h-px bg-gray-100" />
        {downloadUrl ? (
          <button
            type="button"
            onClick={() => {
              downloadWithFilename(downloadUrl, downloadFilename);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
          >
            <DownloadIcon
              className="h-4 w-4 shrink-0 text-gray-400"
              aria-hidden
            />
            <span>{t("Download previous version")}</span>
          </button>
        ) : null}
        {canRollback ? (
          <button
            type="button"
            disabled={rollbackLoading}
            onClick={onRollback}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ReplyIcon
              className="h-4 w-4 shrink-0 text-indigo-500"
              aria-hidden
            />
            <span>{t("Rollback to previous version")}</span>
          </button>
        ) : null}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
