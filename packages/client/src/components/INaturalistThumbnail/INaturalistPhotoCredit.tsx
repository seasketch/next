import React from "react";
import { CameraIcon } from "@heroicons/react/solid";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import CreativeCommonsLicenseIcons from "../CreativeCommonsLicenseIcons/CreativeCommonsLicenseIcons";
import { inaturalistAttributionParts } from "../../dataLayers/inaturalistTaxonPhotos";

const SIZE = {
  sm: {
    text: "text-[9px] leading-none",
    icon: "h-2.5 w-2.5",
  },
  md: {
    text: "text-[11px] leading-none",
    icon: "h-3 w-3",
  },
};

export default function INaturalistPhotoCredit({
  attribution,
  licenseCode,
  photoId,
  className,
  size = "md",
}: {
  attribution: string;
  licenseCode?: string | null;
  photoId?: number | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const { t } = useTranslation("homepage");
  const parts = inaturalistAttributionParts(attribution, licenseCode, photoId);
  if (!parts.text && !parts.licenseLabel) {
    return null;
  }
  const scale = SIZE[size];
  const resolvedLicense =
    licenseCode ||
    (parts.rightsKind === "cc0"
      ? "cc0"
      : parts.rightsKind === "public-domain"
      ? "pd"
      : undefined);

  return (
    <p
      className={clsx(
        "flex flex-wrap items-center text-current",
        scale.text,
        className
      )}
    >
      {parts.text ? (
        <span className="inline-flex items-center gap-1">
          <CameraIcon className={clsx("flex-none", scale.icon)} aria-hidden />
          <span className="sr-only">{t("Photo")}</span>
          {parts.photographerUrl ? (
            <a
              href={parts.photographerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-inherit hover:opacity-80"
              onClick={(event) => event.stopPropagation()}
            >
              {parts.text}
            </a>
          ) : (
            <span>{parts.text}</span>
          )}
        </span>
      ) : null}
      {parts.licenseLabel ? (
        <CreativeCommonsLicenseIcons
          licenseCode={resolvedLicense}
          className={clsx(parts.text && "ml-1.5", "text-inherit")}
          iconClassName={scale.icon}
        />
      ) : null}
    </p>
  );
}
