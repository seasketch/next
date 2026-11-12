import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { FolderIcon, SearchIcon, XIcon } from "@heroicons/react/outline";
import { LayersIcon } from "@radix-ui/react-icons";
import { TFunction } from "i18next";
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

function layersCount(t: TFunction, count: number) {
  return count === 1 ? t("1 layer") : `${count} ${t("layers")}`;
}

function foldersCount(t: TFunction, count: number) {
  return count === 1 ? t("1 folder") : `${count} ${t("folders")}`;
}

function showAllLabel(t: TFunction, items: PublishedLayerName[]) {
  const layers = items.filter((item) => !item.isFolder).length;
  const folders = items.length - layers;
  if (folders === 0) {
    return `${t("Show all")} ${layers}`;
  }
  if (layers === 0) {
    return `${t("Show all")} ${foldersCount(t, folders)}`;
  }
  return `${t("Show all")} ${layersCount(t, layers)}, ${foldersCount(t, folders)}`;
}

function PublishedLayersDialog({
  items,
  onClose,
}: {
  items: PublishedLayerName[];
  onClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter((item) => itemLabel(item).toLowerCase().includes(needle))
    : items;
  const layerCount = items.filter((item) => !item.isFolder).length;
  const folderCount = items.length - layerCount;

  return (
    <Modal
      title={t("Published layers")}
      onRequestClose={onClose}
      scrollable
      tipyTop
      footer={[
        {
          label: t("Close"),
          variant: "secondary",
          onClick: onClose,
        },
      ]}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <LayersIcon className="h-3.5 w-3.5" aria-hidden />
            {layersCount(t, layerCount)}
          </span>
          {folderCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <FolderIcon className="h-3.5 w-3.5" aria-hidden />
              {foldersCount(t, folderCount)}
            </span>
          ) : null}
        </div>
        <label className="relative block sm:ml-auto sm:w-64">
          <span className="sr-only">{t("Search layers")}</span>
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search layers")}
            className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          {query ? (
            <button
              type="button"
              className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
              aria-label={t("Clear search")}
              onClick={() => setQuery("")}
            >
              <XIcon className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
          {t("No matching layers")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {visible.map((item) => (
            <li
              key={item.stableId}
              className={
                item.isFolder
                  ? "flex min-w-0 items-center gap-2.5 rounded-md bg-amber-50 px-2.5 py-1.5 ring-1 ring-amber-100"
                  : "flex min-w-0 items-center gap-2.5 rounded-md bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-100"
              }
            >
              <span
                className={
                  item.isFolder
                    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-amber-700 ring-1 ring-amber-100"
                    : "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200"
                }
              >
                {item.isFolder ? (
                  <FolderIcon className="h-4 w-4" aria-hidden />
                ) : (
                  <LayersIcon className="h-4 w-4" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                {itemLabel(item)}
              </span>
              {item.isFolder ? <span className="sr-only">{t("Folder")}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Modal>
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
                  {showAllLabel(t, items)}
                </button>
              </div>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {modalOpen ? (
        <PublishedLayersDialog
          items={items}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}
