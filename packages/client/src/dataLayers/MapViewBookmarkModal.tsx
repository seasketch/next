import { ClipboardCopyIcon } from "@heroicons/react/outline";
import { useContext, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import { ToastViewport, useToast } from "../components/Toast";
import {
  useCreateMapViewBookmarkMutation,
  useGetBookmarkQuery,
  useMapBookmarkSubscription,
  useProjectMetadataQuery,
  WorkerJobStatus,
} from "../generated/graphql";
import getSlug from "../getSlug";
import { copyTextToClipboard } from "../projects/Forums/InlineAuthorDetails";
import { MapManagerContext } from "./MapContextManager";
import BookmarkCard from "./BookmarkCard";
import MapViewBookmarkBody from "./MapViewBookmarkBody";
import {
  MapViewOmissions,
  mapBookmarkUrl,
} from "./mapViewBookmark";
import {
  bookmarkDimensions,
  bookmarkView,
  firstText,
} from "../components/bookmarkCardFacts";

function namesFromLayerNames(names: unknown) {
  if (!names || typeof names !== "object" || Array.isArray(names)) {
    return [];
  }
  return Object.keys(names)
    .map((key) => (names as { [key: string]: unknown })[key])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

export default function MapViewBookmarkModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { t } = useTranslation("mapBookmarks");
  const { toast } = useToast();
  const auth0 = useAuth0();
  const slug = getSlug();
  const { manager, ready } = useContext(MapManagerContext);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [basemapName, setBasemapName] = useState("");
  const [layerNames, setLayerNames] = useState<string[]>([]);
  const [omissions, setOmissions] = useState<MapViewOmissions>({
    sketches: false,
    unsharedSketches: false,
    unsavedDrawing: false,
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(true);
  const [pollPreview, setPollPreview] = useState(true);
  const [camera, setCamera] = useState<ReturnType<typeof bookmarkView>>(null);
  const [dimensions, setDimensions] = useState<[number, number] | null>(null);
  const [openedAt] = useState(() => new Date().toISOString());
  const started = useRef(false);
  const [createBookmark] = useCreateMapViewBookmarkMutation();
  const metadata = useProjectMetadataQuery({
    variables: { slug },
    skip: !slug,
  });
  const signedIn = Boolean(metadata.data?.me);

  const bookmarkQuery = useGetBookmarkQuery({
    variables: { id: createdId || "" },
    skip: !createdId,
    fetchPolicy: "cache-and-network",
    pollInterval: createdId && pollPreview ? 2500 : 0,
  });
  const bookmark = bookmarkQuery.data?.bookmarkById;
  const status = bookmark?.screenshotJobStatus;
  const failed =
    status === WorkerJobStatus.Failed || status === WorkerJobStatus.Error;
  const waitingForImage = Boolean(
    createdId &&
      !bookmark?.imageId &&
      !failed &&
      status !== WorkerJobStatus.Finished
  );
  useEffect(() => {
    setPollPreview(waitingForImage);
  }, [waitingForImage]);
  useMapBookmarkSubscription({
    variables: { id: createdId || "" },
    skip: !createdId || !waitingForImage,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (started.current || metadata.loading || !signedIn) {
      if (!metadata.loading && !signedIn) {
        setCreating(false);
      }
      return;
    }
    if (!manager || !ready) {
      return;
    }
    started.current = true;
    let cancelled = false;
    setCreating(true);
    setCreateError(null);
    (async () => {
      try {
        const draft = await manager.getMapViewBookmarkData();
        if (cancelled) {
          return;
        }
        setThumbnail(
          typeof draft.clientGeneratedThumbnail === "string"
            ? draft.clientGeneratedThumbnail
            : null
        );
        setBasemapName(draft.basemapName);
        setLayerNames(namesFromLayerNames(draft.layerNames));
        setOmissions(draft.omissions);
        setCamera(bookmarkView(draft.cameraOptions));
        setDimensions(bookmarkDimensions(draft.mapDimensions));
        const result = await createBookmark({
          variables: {
            slug,
            style: draft.style,
            visibleDataLayers: draft.visibleDataLayers,
            selectedBasemap: draft.selectedBasemap,
            basemapOptionalLayerStates: draft.basemapOptionalLayerStates,
            cameraOptions: draft.cameraOptions,
            mapDimensions: draft.mapDimensions,
            sidebarState: draft.sidebarState,
            basemapName: draft.basemapName,
            layerNames: draft.layerNames,
            clientGeneratedThumbnail:
              typeof draft.clientGeneratedThumbnail === "string"
                ? draft.clientGeneratedThumbnail
                : null,
            dataTableStates: draft.dataTableStates,
          },
        });
        const id = result.data?.createMapViewBookmark?.mapBookmark?.id;
        if (!id) {
          const message = result.errors?.map((error) => error.message).join(" ");
          throw new Error(message || "Failed to create map bookmark");
        }
        if (!cancelled) {
          setCreatedId(id);
          setCreating(false);
        }
      } catch (error) {
        if (!cancelled) {
          setCreating(false);
          const message =
            error instanceof Error ? error.message : t("Could not create this map bookmark.");
          setCreateError(
            /rate limit/i.test(message)
              ? t("Please wait a moment and try again.")
              : message
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Capture once, when the map and the signed-in session are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata.loading, signedIn, manager, ready, slug]);

  const url = createdId ? mapBookmarkUrl(slug, createdId) : "";
  const savedLayers = namesFromLayerNames(bookmark?.layerNames);
  const shownLayers = savedLayers.length > 0 ? savedLayers : layerNames;
  const shownBasemap = bookmark?.basemapName || basemapName;
  const profile = metadata.data?.me?.profile;
  const authorName = firstText(
    [
      bookmark?.creator?.fullname,
      bookmark?.creator?.nickname,
      profile?.fullname,
      profile?.nickname,
    ],
    t("Someone")
  );
  const authorPicture = bookmark?.creator?.picture || profile?.picture;
  const shownCamera = bookmarkView(bookmark?.cameraOptions) || camera;
  const shownDimensions =
    bookmarkDimensions(bookmark?.mapDimensions) || dimensions;
  const layerRows = shownLayers.map((layerName, index) => ({
    id: `${index}-${layerName}`,
    name: layerName,
  }));
  const notes = [
    signedIn && omissions.sketches
      ? t(
          "Sketches currently on screen are private to your account, and so are not included in the bookmark."
        )
      : null,
    signedIn && omissions.unsavedDrawing
      ? t(
          "Unsaved drawings on the map are not included. The preview and the saved image leave them out."
        )
      : null,
  ].filter((note): note is string => Boolean(note));

  const copy = async () => {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      copyTextToClipboard(url);
    }
    toast(t("Link copied"));
  };

  return (
    <BookmarkCard
      labelledBy="map-view-bookmark-title"
      imageId={bookmark?.imageId}
      standIn={thumbnail}
      pending={signedIn && (creating || waitingForImage || (!bookmark && !createError))}
      failed={failed}
      unavailable={
        <Trans ns="mapBookmarks">
          The preview image could not be created. The link still opens this
          map.
        </Trans>
      }
      onClose={onClose}
      label={t("Map bookmark")}
      summary={
        <span className="block truncate text-sm font-medium text-slate-900">
          {authorName}
        </span>
      }
      footer={
        url ? (
          <div className="flex items-center gap-2">
            <input
              id="map-view-bookmark-url"
              readOnly
              value={url}
              aria-label={t("Link")}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 shadow-none focus:border-slate-300 focus:ring-0"
            />
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              onClick={() => {
                void copy();
              }}
            >
              <ClipboardCopyIcon className="h-4 w-4" />
              <Trans ns="mapBookmarks">Copy</Trans>
            </button>
          </div>
        ) : undefined
      }
      pinned={
        <ToastViewport className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2" />
      }
    >
      {createError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {createError}
        </p>
      )}
      {signedIn && (
        <MapViewBookmarkBody
          labelledBy="map-view-bookmark-title"
          name={authorName}
          picture={authorPicture}
          createdAt={bookmark?.createdAt || openedAt}
          explainSharing
          layers={layerRows}
          basemapName={shownBasemap}
          camera={shownCamera}
          dimensions={shownDimensions}
          notes={notes}
        />
      )}
      {!signedIn && !metadata.loading && (
        <div className="mt-4 space-y-3">
          <h2
            id="map-view-bookmark-title"
            className="text-base font-medium text-slate-900"
          >
            <Trans ns="mapBookmarks">Map bookmark</Trans>
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            {t("Sign in to save a link to this map.")}
          </p>
          <button
            type="button"
            className="rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
            onClick={() =>
              auth0.loginWithRedirect({
                appState: { returnTo: window.location.pathname },
              })
            }
          >
            <Trans ns="mapBookmarks">Sign in</Trans>
          </button>
        </div>
      )}
    </BookmarkCard>
  );
}
