import React, { useEffect, useRef, useState } from "react";
import { ExclamationCircleIcon, PhotographIcon } from "@heroicons/react/outline";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import INaturalistPhotoCredit from "./INaturalistPhotoCredit";
import {
  InaturalistTaxonPhotoSize,
  inaturalistTaxonPhotoDisplayUrl,
  useInaturalistTaxonPhoto,
} from "../../dataLayers/inaturalistTaxonPhotos";

export type INaturalistThumbnailSize = "sm" | "md" | "lg";
export type INaturalistThumbnailTone = "light" | "dark";

const SIZE_TO_PHOTO: Record<
  INaturalistThumbnailSize,
  InaturalistTaxonPhotoSize
> = {
  sm: "square",
  md: "small",
  lg: "medium",
};

const SIZE_FRAME: Record<INaturalistThumbnailSize, string> = {
  sm: "h-10 w-14",
  md: "h-20 w-28",
  lg: "w-40 min-h-[5.5rem] self-stretch",
};

export default function INaturalistThumbnail({
  sourceId,
  size = "md",
  tone = "light",
  showAttribution = false,
  root,
  rootMargin = "160px 0px",
  className,
}: {
  sourceId?: number | null;
  size?: INaturalistThumbnailSize;
  tone?: INaturalistThumbnailTone;
  showAttribution?: boolean;
  /** Scrollport. `undefined` uses the viewport. `null` prefetches until a root exists. */
  root?: Element | null;
  rootMargin?: string;
  className?: string;
}) {
  const { t } = useTranslation("homepage");
  const frameRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined"
  );
  const status = useInaturalistTaxonPhoto(
    sourceId,
    Boolean(sourceId),
    visible ? "visible" : "prefetch"
  );
  const photoUrl =
    status.status === "ready"
      ? inaturalistTaxonPhotoDisplayUrl(status.photo, SIZE_TO_PHOTO[size])
      : undefined;
  const [imagePhase, setImagePhase] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    setImagePhase("loading");
  }, [photoUrl]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    if (root === null) {
      setVisible(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { root: root ?? undefined, rootMargin, threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [root, rootMargin]);

  const dark = tone === "dark";
  const imageError = Boolean(photoUrl && imagePhase === "error");
  const showError = status.status === "error" || imageError;
  const showEmpty =
    !showError &&
    (sourceId == null || sourceId <= 0 || status.status === "empty");
  const showReady = status.status === "ready" && photoUrl && !imageError;

  return (
    <div
      ref={frameRef}
      className={clsx(
        "relative shrink-0 overflow-hidden rounded-md",
        SIZE_FRAME[size],
        dark
          ? "bg-gray-800 ring-1 ring-white/10"
          : "bg-gray-100 ring-1 ring-black/5",
        className
      )}
    >
      {showError ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-center">
          <ExclamationCircleIcon
            className={clsx(
              "h-5 w-5",
              dark ? "text-amber-400/80" : "text-amber-500"
            )}
            aria-hidden
          />
          {size !== "sm" ? (
            <span
              className={clsx(
                "text-[10px] leading-snug",
                dark ? "text-gray-400" : "text-gray-500"
              )}
            >
              {t("Couldn't load photo")}
            </span>
          ) : (
            <span className="sr-only">{t("Couldn't load photo")}</span>
          )}
        </div>
      ) : showEmpty ? (
        <div
          className={clsx(
            "flex h-full w-full flex-col items-center justify-center",
            dark ? "text-gray-500" : "text-gray-400"
          )}
        >
          <PhotographIcon className="h-6 w-6" aria-hidden />
          <span className="sr-only">{t("No photo")}</span>
        </div>
      ) : (
        <>
          {imagePhase !== "ready" || !showReady ? (
            <div
              className="relative flex h-full w-full items-center justify-center overflow-hidden"
              aria-busy="true"
              aria-label={t("Loading photo")}
            >
              <div
                className={clsx(
                  "absolute inset-0 animate-pulse",
                  dark
                    ? "bg-gradient-to-br from-gray-700/90 via-gray-800 to-gray-700/70"
                    : "bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200"
                )}
              />
              <PhotographIcon
                className={clsx(
                  "relative h-6 w-6",
                  dark ? "text-gray-500" : "text-gray-300"
                )}
                aria-hidden
              />
            </div>
          ) : null}
          {showReady ? (
            <>
              <img
                src={photoUrl}
                alt=""
                aria-hidden
                className={clsx(
                  "pointer-events-none absolute left-1/2 top-1/2 h-[180%] w-[180%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover blur-xl brightness-110",
                  imagePhase === "ready" ? "" : "invisible"
                )}
              />
              <img
                src={photoUrl}
                alt=""
                onLoad={() => setImagePhase("ready")}
                onError={() => setImagePhase("error")}
                className={clsx(
                  "relative z-10 h-full w-full object-contain",
                  imagePhase === "ready" ? "" : "invisible"
                )}
              />
              {showAttribution &&
              imagePhase === "ready" &&
              status.status === "ready" ? (
                <INaturalistPhotoCredit
                  attribution={status.photo.attribution}
                  licenseCode={status.photo.licenseCode}
                  photoId={status.photo.photoId}
                  size="sm"
                  className={clsx(
                    "absolute inset-x-0 bottom-0 z-20 px-1 py-0.5",
                    dark
                      ? "bg-black/55 text-gray-200"
                      : "bg-white/80 text-gray-600"
                  )}
                />
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
