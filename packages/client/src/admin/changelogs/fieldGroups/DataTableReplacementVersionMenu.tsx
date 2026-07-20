import clsx from "clsx";
import { DownloadIcon, ReplyIcon } from "@heroicons/react/outline";
import * as Popover from "@radix-ui/react-popover";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const CLOSE_DELAY_MS = 120;

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
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number>();

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const downloadFilename =
    // eslint-disable-next-line i18next/no-literal-string -- download filename
    `${tableName}_v${fromVersion}.parquet`;

  const triggerClassName = clsx(
    "inline-flex max-w-full cursor-pointer items-center gap-1 align-baseline rounded px-1 py-0.5 text-sm font-medium leading-5 text-blue-600 underline decoration-blue-400 decoration-dotted underline-offset-4 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
    open && "bg-blue-50 text-blue-700",
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={triggerClassName}
          aria-haspopup="menu"
          aria-expanded={open}
          onMouseEnter={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          onFocus={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onBlur={scheduleClose}
        >
          <span className="min-w-0 font-mono">{versionLabel}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          side="top"
          sideOffset={6}
          collisionPadding={8}
          className="change-log-data-table-version-menu z-[999999] w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg outline-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
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
              onClick={() => {
                onRollback();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ReplyIcon
                className="h-4 w-4 shrink-0 text-indigo-500"
                aria-hidden
              />
              <span>{t("Rollback to previous version")}</span>
            </button>
          ) : null}
          <Popover.Arrow className="fill-white drop-shadow-sm" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
