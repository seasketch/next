import { ChevronDownIcon } from "@heroicons/react/outline";
import { ApolloClient, NormalizedCacheObject, useApolloClient } from "@apollo/client";
import { useContext, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import BookmarkCard from "../dataLayers/BookmarkCard";
import { MapManagerContext } from "../dataLayers/MapContextManager";
import {
  MapBookmarkKind,
  useGetBookmarkQuery,
  useMapBookmarkSubscription,
  WorkerJobStatus,
} from "../generated/graphql";
import MapViewBookmarkBody from "../dataLayers/MapViewBookmarkBody";
import { useGlobalErrorHandler } from "./GlobalErrorHandler";
import {
  bookmarkCamera,
  bookmarkDimensions,
  bookmarkName,
  bookmarkView,
  firstText,
} from "./bookmarkCardFacts";

const coordinateFormatter = Intl.NumberFormat(undefined, {
  maximumFractionDigits: 4,
});

export default function MapBookmarkDetailsOverlay({
  bookmarkId,
  onRequestClose,
}: {
  bookmarkId: string;
  onRequestClose: () => void;
}) {
  const onError = useGlobalErrorHandler();
  const { t } = useTranslation("mapBookmarks");
  const client = useApolloClient() as ApolloClient<NormalizedCacheObject>;
  const { manager, ready } = useContext(MapManagerContext);
  const { data, loading } = useGetBookmarkQuery({
    variables: { id: bookmarkId },
    onError,
    fetchPolicy: "cache-and-network",
  });
  const bookmark = data?.bookmarkById;
  const status = bookmark?.screenshotJobStatus;
  const failed =
    status === WorkerJobStatus.Failed || status === WorkerJobStatus.Error;
  const waiting =
    !failed &&
    !bookmark?.imageId &&
    (loading ||
      status === WorkerJobStatus.Queued ||
      status === WorkerJobStatus.Started ||
      !bookmark);
  useMapBookmarkSubscription({
    variables: { id: bookmarkId },
    skip: Boolean(bookmark?.imageId) || failed,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onRequestClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onRequestClose]);

  // A cold visit opens this card before the table of contents arrives. An empty
  // catalog would mark every saved layer as missing, so wait until it has rows.
  const [catalogSize, setCatalogSize] = useState(0);
  useEffect(() => {
    if (!manager) {
      return;
    }
    let stopped = false;
    let tries = 0;
    let timer = 0;
    const look = () => {
      if (stopped) {
        return;
      }
      tries += 1;
      const size = manager.overlayCatalogSize();
      if (size > 0 || tries > 40) {
        setCatalogSize(size > 0 ? size : -1);
        return;
      }
      timer = window.setTimeout(look, 300);
    };
    look();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [manager]);

  const errors = useMemo(() => {
    if (!bookmark || !manager || !ready) {
      return null;
    }
    const savedLayers = (bookmark.visibleDataLayers || []).filter(
      (id) => typeof id === "string" && id.length > 0
    );
    if (savedLayers.length > 0 && catalogSize === 0) {
      return null;
    }
    return manager.getErrorsForBookmark(bookmark, client);
  }, [bookmark, manager, client, ready, catalogSize]);
  const missingLayers = errors?.missingLayers || [];
  const missingSketches = errors?.missingSketches || [];
  const hasErrors = Boolean(
    errors?.missingBasemap || missingLayers.length || missingSketches.length
  );

  const camera = bookmarkCamera(bookmark?.cameraOptions);
  const view = bookmarkView(bookmark?.cameraOptions);
  const dimensions = bookmarkDimensions(bookmark?.mapDimensions);
  const isMapView = bookmark?.kind === MapBookmarkKind.MapView;
  const authorName = firstText(
    [bookmark?.creator?.fullname, bookmark?.creator?.nickname],
    t("Someone")
  );
  const layers = (bookmark?.visibleDataLayers || []).filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
  const sketches = (bookmark?.visibleSketches || []).filter(
    (id): id is number => typeof id === "number"
  );
  const savedAt = bookmark
    ? new Date(bookmark.createdAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const viewOnMap = async () => {
    if (!manager || !bookmark) {
      return;
    }
    await manager.showMapBookmark(bookmark, true, client);
    onRequestClose();
  };

  return (
    <BookmarkCard
      labelledBy="map-bookmark-title"
      imageId={bookmark?.imageId}
      standIn={bookmark?.clientGeneratedThumbnail}
      pending={waiting}
      failed={failed}
      onClose={onRequestClose}
      onDownload={
        bookmark?.imageId
          ? () =>
              downloadImage(
                // eslint-disable-next-line i18next/no-literal-string
                `${process.env.REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT || ""}${bookmark.imageId}/public`,
                "map-image.png"
              )
          : undefined
      }
      label={t("Map bookmark")}
      summary={
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900">
            {isMapView ? (
              authorName
            ) : (
              <Trans ns="mapBookmarks">Map bookmark</Trans>
            )}
          </div>
          {savedAt && !isMapView && (
            <div className="truncate text-xs text-slate-500">{savedAt}</div>
          )}
        </div>
      }
      footer={
        <button
          type="button"
          className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
          disabled={!manager || !ready || !bookmark}
          onClick={() => {
            void viewOnMap();
          }}
        >
          <Trans ns="mapBookmarks">View on the map</Trans>
        </button>
      }
    >
      {isMapView && bookmark ? (
        <MapViewBookmarkBody
          labelledBy="map-bookmark-title"
          name={authorName}
          picture={bookmark.creator?.picture}
          createdAt={bookmark.createdAt}
          explainSharing={false}
          layers={layers.map((id) => ({
            id,
            name: bookmarkName(bookmark.layerNames, id) || id,
            missing: missingLayers.indexOf(id) !== -1,
          }))}
          basemapName={bookmark.basemapName}
          camera={view}
          dimensions={dimensions}
          notice={
            hasErrors ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-950">
                <Trans ns="mapBookmarks">
                  Some layers or sketches in this view are no longer in the
                  project. The preview is the map as it was saved.
                </Trans>
              </p>
            ) : null
          }
        />
      ) : (
        <>
      <h2
        id="map-bookmark-title"
        className="text-2xl font-semibold tracking-tight text-slate-900"
      >
        <Trans ns="mapBookmarks">Map bookmark</Trans>
      </h2>
      {savedAt && <p className="mt-1 text-sm text-slate-500">{savedAt}</p>}
      {hasErrors && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-950">
          <Trans ns="mapBookmarks">
            Some layers or sketches in this view are no longer in the project.
            The preview is the map as it was saved.
          </Trans>
        </p>
      )}
      {bookmark?.basemapName && (
        <div className="mt-4 flex items-baseline justify-between gap-4 text-sm">
          <span className="text-slate-500">{t("Basemap")}</span>
          <span className="min-w-0 truncate text-right text-slate-900">
            {bookmark.basemapName}
            {errors?.missingBasemap && (
              <span className="ml-2 text-xs text-amber-700">{t("missing")}</span>
            )}
          </span>
        </div>
      )}
      {layers.length > 0 && (
        <CountedList
          label={t("Layers")}
          rows={layers.map((id) => ({
            id,
            name: bookmarkName(bookmark?.layerNames, id) || id,
            missing: missingLayers.indexOf(id) !== -1,
          }))}
        />
      )}
      {sketches.length > 0 && (
        <CountedList
          label={t("Sketches")}
          rows={sketches.map((id) => ({
            id: String(id),
            name: bookmarkName(bookmark?.sketchNames, String(id)) || String(id),
            missing: missingSketches.indexOf(id) !== -1,
          }))}
        />
      )}
      {(camera || dimensions) && (
        <MapFacts camera={camera} dimensions={dimensions} />
      )}
        </>
      )}
    </BookmarkCard>
  );
}

function CountedList({
  label,
  rows,
}: {
  label: string;
  rows: { id: string; name: string; missing: boolean }[];
}) {
  const { t } = useTranslation("mapBookmarks");
  const [open, setOpen] = useState(false);
  const missing = rows.some((row) => row.missing);
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-700"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
            missing ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
          }`}
        >
          {rows.length}
        </span>
        <ChevronDownIcon
          className={`ml-auto h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate text-slate-800">{row.name}</span>
              {row.missing && (
                <span className="shrink-0 text-xs text-amber-700">
                  {t("missing")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MapFacts({
  camera,
  dimensions,
}: {
  camera: { zoom: number; center: [number, number] } | null;
  dimensions: [number, number] | null;
}) {
  const { t } = useTranslation("mapBookmarks");
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-medium text-slate-700"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Trans ns="mapBookmarks">Details</Trans>
        <ChevronDownIcon
          className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {camera && (
            <>
              <div>
                <dt className="text-slate-500">{t("Zoom Level")}</dt>
                <dd className="text-slate-900">
                  {Math.round(camera.zoom * 10) / 10}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("Center")}</dt>
                <dd className="text-slate-900">
                  {coordinateFormatter.format(camera.center[0])}
                  {", "}
                  {coordinateFormatter.format(camera.center[1])}
                </dd>
              </div>
            </>
          )}
          {dimensions && (
            <div>
              <dt className="text-slate-500">{t("Dimensions")}</dt>
              <dd className="text-slate-900">
                {dimensions[0]}
                {
                  // eslint-disable-next-line i18next/no-literal-string
                  " × "
                }
                {dimensions[1]}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

function downloadImage(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
