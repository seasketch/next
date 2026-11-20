import { ApolloClient, NormalizedCacheObject, useApolloClient } from "@apollo/client";
import { useContext, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import getSlug from "../getSlug";
import BookmarkCard from "../dataLayers/BookmarkCard";
import { MapManagerContext } from "../dataLayers/MapContextManager";
import {
  useGetBookmarkQuery,
  useMapBookmarkSubscription,
  WorkerJobStatus,
} from "../generated/graphql";
import MapViewBookmarkBody from "../dataLayers/MapViewBookmarkBody";
import { useGlobalErrorHandler } from "./GlobalErrorHandler";
import {
  bookmarkDimensions,
  bookmarkName,
  bookmarkView,
  firstText,
} from "./bookmarkCardFacts";

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

  const view = bookmarkView(bookmark?.cameraOptions);
  const dimensions = bookmarkDimensions(bookmark?.mapDimensions);
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
  const topic = bookmark?.forumTopic?.title
    ? {
        title: bookmark.forumTopic.title,
        // eslint-disable-next-line i18next/no-literal-string
        to: `/${getSlug()}/app/forums/${bookmark.forumTopic.forumId}/${bookmark.forumTopic.topicId}`,
      }
    : null;
  const sketchRows = sketches.map((id) => ({
    id: String(id),
    name: bookmarkName(bookmark?.sketchNames, String(id)) || String(id),
    missing: missingSketches.indexOf(id) !== -1,
  }));

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
      onDisplay={
        bookmark
          ? () => {
              void viewOnMap();
            }
          : undefined
      }
      displayDisabled={!manager || !ready || !bookmark}
      summary={
        <span className="block truncate text-sm font-medium text-slate-900">
          {authorName}
        </span>
      }
    >
      {bookmark ? (
        <MapViewBookmarkBody
          labelledBy="map-bookmark-title"
          name={authorName}
          picture={bookmark.creator?.picture}
          createdAt={bookmark.createdAt}
          explainSharing={false}
          topic={topic}
          onTopicClick={onRequestClose}
          layers={layers.map((id) => ({
            id,
            name: bookmarkName(bookmark.layerNames, id) || id,
            missing: missingLayers.indexOf(id) !== -1,
          }))}
          sketches={sketchRows}
          basemapName={bookmark.basemapName}
          camera={view}
          dimensions={dimensions}
          notice={
            hasErrors ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-950">
                <Trans ns="mapBookmarks">
                  Some layers in this view are no longer in the project. The
                  preview is the map as it was saved.
                </Trans>
              </p>
            ) : null
          }
        />
      ) : (
        <h2
          id="map-bookmark-title"
          className="text-2xl font-semibold tracking-tight text-slate-900"
        >
          <Trans ns="mapBookmarks">Map bookmark</Trans>
        </h2>
      )}
    </BookmarkCard>
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
