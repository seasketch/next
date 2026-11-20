import { ChevronDownIcon } from "@heroicons/react/outline";
import { ReactNode, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  bookmarkExtent,
  formatExtent,
} from "../components/bookmarkCardFacts";

export type MapViewLayerRow = {
  id: string;
  name: string;
  missing?: boolean;
};

export type MapViewCamera = {
  zoom: number;
  center: [number, number];
  bearing: number;
  pitch: number;
};

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "?";
}

function AuthorMark({ name, picture }: { name: string; picture?: string | null }) {
  if (picture) {
    return (
      <img
        src={picture}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800 ring-1 ring-sky-200"
    >
      {initials(name)}
    </span>
  );
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-slate-200">
      <button
        type="button"
        className="flex w-full items-center gap-3 py-3 text-left text-sm font-medium text-slate-800"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

export default function MapViewBookmarkBody({
  labelledBy,
  name,
  picture,
  createdAt,
  explainSharing,
  layers,
  sketches,
  topic,
  onTopicClick,
  basemapName,
  camera,
  dimensions,
  notes,
  notice,
  children,
}: {
  labelledBy: string;
  name: string;
  picture?: string | null;
  createdAt: string;
  explainSharing: boolean;
  layers: MapViewLayerRow[];
  sketches?: MapViewLayerRow[];
  topic?: { title: string; to: string } | null;
  onTopicClick?: () => void;
  basemapName?: string | null;
  camera: MapViewCamera | null;
  dimensions: [number, number] | null;
  notes?: string[];
  notice?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation("mapBookmarks");
  const date = new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const sketchRows = sketches || [];
  const title = topic?.title || "";
  const extent = camera && dimensions ? bookmarkExtent(camera, dimensions) : null;
  const zoomLabel = camera ? (Math.round(camera.zoom * 10) / 10).toString() : "";
  const showBearing = Boolean(camera && Math.abs(camera.bearing) >= 0.5);
  const showPitch = Boolean(camera && Math.abs(camera.pitch) >= 0.5);

  return (
    <div>
      <div className="flex items-start gap-3">
        <AuthorMark name={name} picture={picture} />
        <div className="min-w-0 pt-0.5">
          <h2 id={labelledBy} className="leading-snug">
            <span className="block text-base font-medium text-slate-900">{name}</span>
            <span className="mt-0.5 block text-sm font-normal text-slate-500">
              <Trans ns="mapBookmarks">
                created this map bookmark on {{ date }}
              </Trans>
            </span>
          </h2>
          {topic && (
            <p className="mt-1 truncate text-sm text-slate-500">
              <Trans ns="mapBookmarks">
                Included in{" "}
                <Link
                  to={topic.to}
                  onClick={onTopicClick}
                  className="font-medium text-primary-600 underline decoration-primary-600/40 underline-offset-2"
                >
                  {{ title }}
                </Link>
              </Trans>
            </p>
          )}
        </div>
      </div>
      {explainSharing && (
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          <Trans ns="mapBookmarks">
            Sharing this link will give other visitors the ability to sync
            their map to this view, as well as access the rendered image for
            posterity.
          </Trans>
        </p>
      )}
      {notice}
      {notes && notes.length > 0 && (
        <div className="mt-4 space-y-2">
          {notes.map((note) => (
            <p
              key={note}
              className="rounded-lg bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950"
            >
              {note}
            </p>
          ))}
        </div>
      )}
      <div className="mt-4 border-b border-slate-200">
        {layers.length > 0 && (
          <Disclosure title={t("Layers ({{count}})", { count: layers.length })}>
            <ul className="space-y-1.5">
              {layers.map((layer) => (
                <li key={layer.id} className="flex items-baseline gap-2 text-sm text-slate-700">
                  <span className="min-w-0 truncate">{layer.name}</span>
                  {layer.missing && (
                    <span className="shrink-0 text-xs text-amber-700">{t("missing")}</span>
                  )}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        {sketchRows.length > 0 && (
          <Disclosure title={t("Sketches ({{count}})", { count: sketchRows.length })}>
            <ul className="space-y-1.5">
              {sketchRows.map((sketch) => (
                <li key={sketch.id} className="flex items-baseline gap-2 text-sm text-slate-700">
                  <span className="min-w-0 truncate">{sketch.name}</span>
                  {sketch.missing && (
                    <span className="shrink-0 text-xs text-amber-700">{t("missing")}</span>
                  )}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        <Disclosure title={t("Details")}>
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm">
            {basemapName && (
              <>
                <dt className="text-slate-500">{t("Basemap")}</dt>
                <dd className="text-slate-900">{basemapName}</dd>
              </>
            )}
            {extent && (
              <>
                <dt className="text-slate-500">{t("Extent")}</dt>
                <dd className="text-slate-900">{formatExtent(extent)}</dd>
              </>
            )}
            {camera && (
              <>
                <dt className="text-slate-500">{t("Zoom")}</dt>
                <dd className="text-slate-900">{zoomLabel}</dd>
              </>
            )}
            {showBearing && camera && (
              <>
                <dt className="text-slate-500">{t("Bearing")}</dt>
                <dd className="text-slate-900">
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  {`${Math.round(camera.bearing)}°`}
                </dd>
              </>
            )}
            {showPitch && camera && (
              <>
                <dt className="text-slate-500">{t("Pitch")}</dt>
                <dd className="text-slate-900">
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  {`${Math.round(camera.pitch)}°`}
                </dd>
              </>
            )}
          </dl>
        </Disclosure>
      </div>
      {children}
    </div>
  );
}
