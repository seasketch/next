import { ArrowsExpandIcon, ChevronUpIcon, XIcon } from "@heroicons/react/outline";
import { motion } from "framer-motion";
import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../components/Spinner";
import { fitImageSize } from "../components/bookmarkCardFacts";

const FULL_SIZE_BAR = 64;

function imageSrc(imageId?: string | null) {
  if (!imageId) {
    return null;
  }
  return (
    // eslint-disable-next-line i18next/no-literal-string
    `${process.env.REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT || ""}${imageId}/public`
  );
}

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
  const src = imageSrc(imageId);
  const showSheen =
    !standIn && !broken && (pending || (Boolean(src) && !loaded)) && !failed;
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
  summary,
  label,
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
  summary?: ReactNode;
  label?: string;
}) {
  const { t } = useTranslation("mapBookmarks");
  const [expanded, setExpanded] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(
    null
  );
  const [bounds, setBounds] = useState({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  });
  const src = imageSrc(imageId);
  const canExpand = Boolean(src || standIn);

  useEffect(() => {
    setNatural(null);
  }, [src, standIn]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const update = () => {
      setBounds({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.stopImmediatePropagation();
      event.preventDefault();
      setExpanded(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [expanded]);

  const fitted = natural
    ? fitImageSize(natural, {
        width: bounds.width,
        height: Math.max(bounds.height - FULL_SIZE_BAR, 1),
      })
    : null;

  const fullImage = (
    <img
      alt=""
      src={src || standIn || undefined}
      style={
        fitted
          ? { width: fitted.width, height: fitted.height }
          : undefined
      }
      className={fitted ? "block" : "max-h-full max-w-full object-contain"}
      onLoad={(event) => {
        const img = event.currentTarget;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setNatural({ width: img.naturalWidth, height: img.naturalHeight });
        }
      }}
    />
  );

  if (expanded && canExpand) {
    return createPortal(
      <div
        id="overlay-body"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="fixed inset-0 z-[70] flex flex-col bg-slate-950"
      >
        <div
          className="flex min-h-0 flex-1 items-center justify-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setExpanded(false);
            }
          }}
        >
          {fullImage}
        </div>
        <button
          type="button"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-black/10 hover:text-slate-900"
          onClick={onClose}
          aria-label={t("Close")}
        >
          <XIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-16 w-full flex-none items-center gap-4 border-t border-white/10 bg-white px-5 text-left hover:bg-slate-50"
          onClick={() => setExpanded(false)}
        >
          <div className="min-w-0 flex-1">{summary}</div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
            <ChevronUpIcon className="h-4 w-4" />
            <Trans ns="mapBookmarks">Show card</Trans>
          </span>
        </button>
      </div>,
      document.body
    );
  }

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
          {canExpand && (
            <button
              type="button"
              className="absolute bottom-2.5 left-2.5 flex h-7 w-7 items-center justify-center rounded-md bg-slate-950/30 text-white/85 backdrop-blur-[2px] hover:bg-slate-950/50 hover:text-white"
              onClick={() => setExpanded(true)}
              aria-label={t("View full size")}
            >
              <ArrowsExpandIcon className="h-4 w-4" />
            </button>
          )}
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
