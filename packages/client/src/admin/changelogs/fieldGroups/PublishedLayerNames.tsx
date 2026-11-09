import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Trans, useTranslation } from "react-i18next";
import Modal from "../../../components/Modal";

export interface PublishedLayerName {
  stableId: string;
  title: string;
  isFolder: boolean;
}

const PREVIEW_COUNT = 12;
const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 160;

function itemLabel(item: PublishedLayerName) {
  return item.title.trim() || item.stableId;
}

function NameList({ items }: { items: PublishedLayerName[] }) {
  const { t } = useTranslation("admin:data");
  return (
    <ul className="py-1">
      {items.map((item) => (
        <li
          key={item.stableId}
          className="flex items-baseline gap-2 px-3 py-1 text-sm text-slate-800"
        >
          <span className="min-w-0 flex-1 truncate">{itemLabel(item)}</span>
          {item.isFolder ? (
            <span className="shrink-0 text-xs text-slate-400">{t("Folder")}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * The count inside a publish changelog sentence. Hover or click opens the
 * names that run shipped. A long list stays truncated there and opens in full
 * in a modal.
 */
export default function PublishedLayerNames({
  items,
  label,
}: {
  items: PublishedLayerName[];
  label: string;
}) {
  const { t } = useTranslation("admin:data");
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    },
    []
  );

  if (items.length === 0) {
    return <span className="font-medium text-slate-800">{label}</span>;
  }

  const preview = items.slice(0, PREVIEW_COUNT);
  const hiddenCount = items.length - preview.length;

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleOpen = () => {
    cancelClose();
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_MS);
  };
  const scheduleClose = () => {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="rounded-sm font-medium text-blue-600 underline decoration-blue-400 decoration-dotted underline-offset-4 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={t("Show published layers")}
            onPointerEnter={scheduleOpen}
            onPointerLeave={scheduleClose}
          >
            {label}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={6}
            collisionPadding={8}
            className="z-[999999] w-72 max-w-[calc(100vw-1rem)] rounded-md border border-slate-200 bg-white text-left shadow-lg outline-none"
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Trans ns="admin:data">Published in this update</Trans>
            </p>
            <NameList items={preview} />
            {hiddenCount > 0 ? (
              <div className="border-t border-slate-100 px-3 py-2">
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  onClick={() => {
                    setOpen(false);
                    setModalOpen(true);
                  }}
                >
                  {t("Show all")} {items.length}
                </button>
              </div>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {modalOpen ? (
        <Modal
          title={t("Published layers")}
          onRequestClose={() => setModalOpen(false)}
          scrollable
          tipyTop
          footer={[
            {
              label: t("Close"),
              variant: "secondary",
              onClick: () => setModalOpen(false),
            },
          ]}
        >
          <NameList items={items} />
        </Modal>
      ) : null}
    </>
  );
}
