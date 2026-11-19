import { XIcon } from "@heroicons/react/outline";
import { motion } from "framer-motion";
import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../components/Spinner";

function PreviewThumbnail({
  imageId,
  standIn,
  pending,
  failed,
  unavailable,
}: {
  imageId?: string | null;
  standIn?: string | null;
  pending: boolean;
  failed: boolean;
  unavailable?: ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setBroken(false);
  }, [imageId]);
  const src = imageId
    ? // eslint-disable-next-line i18next/no-literal-string
      `${process.env.REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT || ""}${imageId}/public`
    : null;
  const showSheen = !standIn && !broken && (pending || (Boolean(src) && !loaded)) && !failed;
  const showUnavailable = (failed && !src) || (broken && !standIn);
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden bg-primary-700">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-500 to-sky-300" />
      {standIn && !loaded && (
        <img
          alt=""
          src={standIn}
          className="absolute inset-x-0 top-0 h-[107%] w-full object-cover object-top"
        />
      )}
      {showSheen && (
        <>
          <motion.div
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            initial={{ x: "-130%" }}
            animate={{ x: "240%" }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative flex h-full flex-col items-center justify-center gap-3 text-white">
            <Spinner color="white" large />
            <span className="text-sm font-medium tracking-wide text-white/90">
              <Trans ns="mapBookmarks">Rendering preview…</Trans>
            </span>
          </div>
        </>
      )}
      {src && !broken && (
        <motion.img
          alt=""
          src={src}
          className="absolute inset-x-0 top-0 h-[107%] w-full object-cover object-top"
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.35 }}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
      )}
      {showUnavailable && (
        <div className="relative flex h-full items-center justify-center px-8 text-center text-sm leading-relaxed text-white/90">
          {unavailable || (
            <Trans ns="mapBookmarks">The preview could not be created.</Trans>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookmarkCard({
  labelledBy,
  imageId,
  standIn,
  pending,
  failed,
  unavailable,
  onClose,
  children,
  pinned,
  footer,
}: {
  labelledBy: string;
  imageId?: string | null;
  standIn?: string | null;
  pending: boolean;
  failed: boolean;
  unavailable?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  pinned?: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation("mapBookmarks");
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        id="overlay-body"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/5"
      >
        <div className="relative flex-none">
          <PreviewThumbnail
            imageId={imageId}
            standIn={standIn}
            pending={pending}
            failed={failed}
            unavailable={unavailable}
          />
          <button
            type="button"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-black/10 hover:text-slate-900"
            onClick={onClose}
            aria-label={t("Close")}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className={`overflow-y-auto px-6 pt-5 ${footer ? "pb-4" : "pb-6"}`}>
          {children}
        </div>
        {footer && (
          <div className="flex-none border-t border-slate-100 px-6 py-4">
            {footer}
          </div>
        )}
        {pinned}
      </motion.div>
    </div>,
    document.body
  );
}
