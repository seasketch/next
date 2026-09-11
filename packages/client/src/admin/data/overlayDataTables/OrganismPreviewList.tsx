import { OrganismCatalogRow, OrganismResolveConfidence } from "@seasketch/geostats-types";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationCircleIcon,
  PhotographIcon,
} from "@heroicons/react/outline";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Spinner from "../../../components/Spinner";
import {
  InaturalistTaxonPhotoStatus,
  compactInaturalistAttribution,
  inaturalistAttributionParts,
  inaturalistTaxonPhotoStatus,
  useInaturalistTaxonPhotos,
} from "../../../dataLayers/inaturalistTaxonPhotos";
import {
  OrganismPreviewConfidenceFilter,
  filterOrganismPreviewRows,
} from "./dataTableOrganismForm";

const DESCRIPTION_PREVIEW_CHARS = 160;

function confidenceBadgeClass(confidence: OrganismResolveConfidence) {
  if (confidence === "high") {
    return "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30";
  }
  if (confidence === "low") {
    return "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30";
  }
  return "bg-white/10 text-gray-300 ring-1 ring-white/10";
}

function OrganismDescription({ text }: { text: string }) {
  const { t } = useTranslation("admin:data");
  const [expanded, setExpanded] = useState(false);
  const long = text.length > DESCRIPTION_PREVIEW_CHARS;
  const preview = text.slice(0, DESCRIPTION_PREVIEW_CHARS).trim();
  // Catalog descriptions are data; ellipsis is typographic.
  // eslint-disable-next-line i18next/no-literal-string
  const shown = !long || expanded ? text : `${preview}…`;
  return (
    <div className="mt-1.5 text-xs leading-relaxed text-gray-300">
      <p>{shown}</p>
      {long ? (
        <button
          type="button"
          className="mt-0.5 inline-flex items-center gap-0.5 text-sky-300 hover:text-sky-200"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <>
              {t("Show less")}
              <ChevronUpIcon className="h-3.5 w-3.5" aria-hidden />
            </>
          ) : (
            <>
              {t("Show more")}
              <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

function ThumbnailSkeleton() {
  const { t } = useTranslation("admin:data");
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      aria-busy="true"
      aria-label={t("Loading photo")}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-700/90 via-gray-800 to-gray-700/70" />
      <PhotographIcon className="relative h-7 w-7 text-gray-500" aria-hidden />
    </div>
  );
}

function ThumbnailEmpty() {
  const { t } = useTranslation("admin:data");
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-gray-500">
      <PhotographIcon className="h-7 w-7" aria-hidden />
      <span className="sr-only">{t("No photo")}</span>
    </div>
  );
}

function ThumbnailError({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
      <ExclamationCircleIcon
        className="h-6 w-6 text-amber-400/80"
        aria-hidden
      />
      <span className="text-[10px] leading-snug text-gray-400">{message}</span>
    </div>
  );
}

function ThumbnailFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-32 min-h-[5.5rem] shrink-0 self-stretch overflow-hidden rounded-md bg-gray-800 ring-1 ring-white/10">
      {children}
    </div>
  );
}

function OrganismThumbnail({
  photoStatus,
}: {
  photoStatus: InaturalistTaxonPhotoStatus;
}) {
  const { t } = useTranslation("admin:data");
  const photoUrl =
    photoStatus.status === "ready" ? photoStatus.photo.squareUrl : undefined;
  const [imagePhase, setImagePhase] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    setImagePhase("loading");
  }, [photoUrl]);

  if (photoStatus.status === "error" || (photoUrl && imagePhase === "error")) {
    return (
      <ThumbnailFrame>
        <ThumbnailError message={t("Couldn't load photo")} />
      </ThumbnailFrame>
    );
  }
  if (photoStatus.status === "empty") {
    return (
      <ThumbnailFrame>
        <ThumbnailEmpty />
      </ThumbnailFrame>
    );
  }
  if (photoStatus.status === "loading" || !photoUrl) {
    return (
      <ThumbnailFrame>
        <ThumbnailSkeleton />
      </ThumbnailFrame>
    );
  }

  return (
    <ThumbnailFrame>
      {imagePhase === "loading" ? <ThumbnailSkeleton /> : null}
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-1/2 h-[180%] w-[180%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover blur-xl brightness-110 ${
          imagePhase === "ready" ? "" : "invisible"
        }`}
      />
      <img
        src={photoUrl}
        alt=""
        onLoad={() => setImagePhase("ready")}
        onError={() => setImagePhase("error")}
        className={`relative z-10 h-full w-full object-contain ${
          imagePhase === "ready" ? "" : "invisible"
        }`}
      />
    </ThumbnailFrame>
  );
}

function OrganismPhotoCredit({
  attribution,
  licenseCode,
}: {
  attribution: string;
  licenseCode?: string;
}) {
  const parts = inaturalistAttributionParts(attribution, licenseCode);
  return (
    <p className="mt-1 text-[10px] leading-snug text-gray-500">
      {parts.text}
      {parts.licenseUrl && parts.licenseLabel ? (
        <>
          {" "}
          <a
            href={parts.licenseUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sky-300/80 hover:text-sky-200"
          >
            {parts.licenseLabel}
          </a>
        </>
      ) : null}
    </p>
  );
}

function OrganismPreviewRow({
  row,
  photoStatus,
}: {
  row: OrganismCatalogRow;
  photoStatus: InaturalistTaxonPhotoStatus;
}) {
  const { t } = useTranslation("admin:data");
  const confidenceLabel =
    row.confidence === "high"
      ? t("Resolved")
      : row.confidence === "low"
        ? t("Low confidence")
        : t("Unclassified");
  const ancestors = row.ancestor_names.filter(Boolean);
  const extraNames = row.common_names.filter(
    (name) => name && name !== row.common_name
  );
  const readyPhoto = photoStatus.status === "ready" ? photoStatus.photo : null;
  const attribution = compactInaturalistAttribution(readyPhoto?.attribution);

  return (
    <article
      data-organism-value={row.value}
      data-inat-taxon-id={row.inat_taxon_id || undefined}
      className="flex items-stretch gap-3 border-t border-white/5 px-3 py-2.5"
    >
      <OrganismThumbnail photoStatus={photoStatus} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {/* eslint-disable-next-line i18next/no-literal-string -- observation value */}
          <h3 className="font-mono text-sm text-gray-100">{row.value}</h3>
          {row.common_name ? (
            <span className="text-sm text-white">{row.common_name}</span>
          ) : null}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${confidenceBadgeClass(
              row.confidence
            )}`}
          >
            {confidenceLabel}
          </span>
          {row.occurrence_count != null ? (
            <span className="text-[11px] tabular-nums text-gray-400">
              {t("{{n}} rows", {
                n: row.occurrence_count.toLocaleString(),
              })}
            </span>
          ) : null}
        </div>
        {row.scientific_name ? (
          <p className="text-sm italic text-sky-200/90">{row.scientific_name}</p>
        ) : null}
        {extraNames.length > 0 ? (
          <p className="truncate text-xs text-gray-400" title={extraNames.join(" · ")}>
            {extraNames.join(" · ")}
          </p>
        ) : null}
        {ancestors.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {ancestors.join(" · ")}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
          {row.inat_taxon_id ? (
            <a
              href={`https://www.inaturalist.org/taxa/${row.inat_taxon_id}`}
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 hover:text-sky-200"
            >
              {t("iNaturalist {{id}}", { id: row.inat_taxon_id })}
            </a>
          ) : null}
          {row.worms_aphia_id ? (
            <a
              href={`https://www.marinespecies.org/aphia.php?p=taxdetails&id=${row.worms_aphia_id}`}
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 hover:text-sky-200"
            >
              {t("WoRMS {{id}}", { id: row.worms_aphia_id })}
            </a>
          ) : null}
        </div>
        {attribution && readyPhoto ? (
          <OrganismPhotoCredit
            attribution={attribution}
            licenseCode={readyPhoto.licenseCode}
          />
        ) : null}
        {row.description ? <OrganismDescription text={row.description} /> : null}
      </div>
    </article>
  );
}

export default function OrganismPreviewList({
  rows,
  loading,
  error,
}: {
  rows: OrganismCatalogRow[];
  loading?: boolean;
  error?: string | null;
}) {
  const { t } = useTranslation("admin:data");
  const [query, setQuery] = useState("");
  const [confidence, setConfidence] =
    useState<OrganismPreviewConfidenceFilter>("all");

  const filtered = useMemo(
    () => filterOrganismPreviewRows(rows, query, confidence),
    [rows, query, confidence]
  );
  const photoIds = useMemo(
    () => rows.map((row) => row.inat_taxon_id),
    [rows]
  );
  const photoLookup = useInaturalistTaxonPhotos(photoIds);

  const filters: Array<{
    id: OrganismPreviewConfidenceFilter;
    label: string;
    count: number;
  }> = [
    { id: "all", label: t("All"), count: rows.length },
    {
      id: "high",
      label: t("Resolved"),
      count: rows.filter((row) => row.confidence === "high").length,
    },
    {
      id: "low",
      label: t("Low confidence"),
      count: rows.filter((row) => row.confidence === "low").length,
    },
    {
      id: "unresolved",
      label: t("Unclassified"),
      count: rows.filter((row) => row.confidence === "unresolved").length,
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-sm text-gray-300">
        <Spinner color="white" />
        {t("Loading catalog…")}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
        {error}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm italic text-gray-400">
        {t("No catalog rows yet. Enrich this table to build one.")}
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("Filter catalog")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Filter by name, code, taxon…")}
            className="w-full rounded-md border border-white/10 bg-gray-900/40 px-2.5 py-1.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-sky-400/50 focus:outline-none focus:ring-1 focus:ring-sky-400/40"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setConfidence(item.id)}
              className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                confidence === item.id
                  ? "bg-white/15 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              {t("{{label}} ({{count}})", {
                label: item.label,
                count: item.count,
              })}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {t("Showing {{shown}} of {{total}}", {
          shown: filtered.length,
          total: rows.length,
        })}
      </p>
      <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-black/20">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm italic text-gray-500">
            {t("No values match this filter.")}
          </p>
        ) : (
          filtered.map((item) => (
            <OrganismPreviewRow
              key={item.value}
              row={item}
              photoStatus={inaturalistTaxonPhotoStatus(
                item.inat_taxon_id,
                photoLookup
              )}
            />
          ))
        )}
      </div>
    </div>
  );
}
