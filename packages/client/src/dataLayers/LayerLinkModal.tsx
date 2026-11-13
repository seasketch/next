import { XIcon } from "@heroicons/react/outline";
import {
  ApolloClient,
  NormalizedCacheObject,
  useApolloClient,
} from "@apollo/client";
import { motion } from "framer-motion";
import {
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import Button from "../components/Button";
import { useToast, ToastViewport } from "../components/Toast";
import Spinner from "../components/Spinner";
import {
  MapBookmarkKind,
  useEnsureLayerLinkMutation,
  useGetBookmarkQuery,
  useLayerLinkSharingQuery,
  useMapBookmarkSubscription,
  useProjectMetadataQuery,
  usePublishedTableOfContentsQuery,
  WorkerJobStatus,
} from "../generated/graphql";
import getSlug from "../getSlug";
import { copyTextToClipboard } from "../projects/Forums/InlineAuthorDetails";
import {
  MapManagerContext,
  MapOverlayContext,
} from "./MapContextManager";
import {
  isLayerLinkSharing,
  layerLinkNotices,
  layerLinkUrl,
  LayerLinkNotice,
  LayerLinkSharing,
} from "./layerLinkAccess";

function folderTitlesFromToc(
  items: { stableId: string; parentStableId?: string | null; title: string }[],
  stableId: string
) {
  const byStable = new Map(items.map((item) => [item.stableId, item]));
  const titles: string[] = [];
  const seen = new Set<string>();
  let current = byStable.get(stableId);
  while (current?.parentStableId && !seen.has(current.parentStableId)) {
    seen.add(current.parentStableId);
    const parent = byStable.get(current.parentStableId);
    if (!parent) {
      break;
    }
    titles.unshift(parent.title);
    current = parent;
  }
  return titles;
}

function titleFromNames(names: unknown, stableId: string | null | undefined) {
  if (!stableId || !names || typeof names !== "object" || Array.isArray(names)) {
    return null;
  }
  if (!(stableId in names)) {
    return null;
  }
  const value = (names as { [key: string]: unknown })[stableId];
  return typeof value === "string" ? value : null;
}

function NoticeCopy({
  summary,
  blocks,
}: {
  summary: LayerLinkSharing;
  blocks: LayerLinkNotice[];
}) {
  const { t } = useTranslation("mapBookmarks");
  return (
    <div className="space-y-2">
      {summary.projectAccess === "public" &&
        blocks.some((block) => block.kind !== "fullyOpen") && (
          <p>
            {t(
              "The project is public, so anyone can open this link. The layer itself is still limited."
            )}
          </p>
        )}
      {blocks.map((block, index) => {
        if (block.kind === "fullyOpen") {
          return (
            <p key={index}>
              {t(
                "Anyone with this link can open it without signing in. The map stays as they left it until they choose View on the map."
              )}
            </p>
          );
        }
        if (block.kind === "projectInvite") {
          return (
            <p key={index}>
              {t(
                "{{projectName}} is invite-only. Someone who opens this link must sign in with an account that already has access, or request an invite. Until they do, they will not reach the map.",
                { projectName: block.projectName }
              )}
            </p>
          );
        }
        if (block.kind === "projectAdmins") {
          return (
            <p key={index}>
              {t(
                "{{projectName}} is limited to project administrators. Anyone else who opens this link is told that only administrators can enter.",
                { projectName: block.projectName }
              )}
            </p>
          );
        }
        if (block.kind === "adminsOnly") {
          return (
            <p key={index}>
              {block.isFolder
                ? t(
                    "The folder {{title}} is limited to project administrators. This layer sits inside that folder, so other participants cannot see it.",
                    { title: block.title }
                  )
                : t(
                    "This layer is limited to project administrators. Other participants who open the link are told they do not have access."
                  )}
            </p>
          );
        }
        const groups =
          block.groups.length > 0
            ? block.groups.join(", ")
            : t("a project group");
        return (
          <p key={index}>
            {block.isFolder
              ? t(
                  "The folder {{title}} is shared only with {{groups}}. People outside that list can open the project and still not see this layer.",
                  { title: block.title, groups }
                )
              : t(
                  "This layer is shared only with {{groups}}. Other people who open the link are told they do not have access to it.",
                  { groups }
                )}
          </p>
        );
      })}
    </div>
  );
}

function PreviewThumbnail({
  imageId,
  pending,
  failed,
}: {
  imageId?: string | null;
  pending: boolean;
  failed: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
  }, [imageId]);
  const src = imageId
    ? // eslint-disable-next-line i18next/no-literal-string
      `${process.env.REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT || ""}${imageId}/public`
    : null;
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg bg-slate-200 shadow-inner ring-1 ring-black/10">
      {(pending || (src && !loaded)) && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-200 via-slate-100 to-emerald-100" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.08) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <motion.div
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent"
            initial={{ x: "-120%" }}
            animate={{ x: "220%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative flex h-full flex-col items-center justify-center gap-2 text-slate-600">
            <Spinner />
            <span className="text-sm">
              <Trans ns="mapBookmarks">Rendering preview…</Trans>
            </span>
          </div>
        </div>
      )}
      {src && (
        <motion.img
          alt=""
          src={src}
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          onLoad={() => setLoaded(true)}
        />
      )}
      {failed && !src && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-slate-600">
          <Trans ns="mapBookmarks">
            The preview image could not be created. The link still opens this
            layer.
          </Trans>
        </div>
      )}
    </div>
  );
}

export default function LayerLinkModal({
  mode,
  stableId,
  bookmarkId,
  onClose,
}: {
  mode: "create" | "view";
  stableId?: string;
  bookmarkId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("mapBookmarks");
  const { toast } = useToast();
  const auth0 = useAuth0();
  const slug = getSlug();
  const client = useApolloClient() as ApolloClient<NormalizedCacheObject>;
  const { manager, ready } = useContext(MapManagerContext);
  const overlay = useContext(MapOverlayContext);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [boundsNote, setBoundsNote] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(mode === "create");
  const [pollPreview, setPollPreview] = useState(true);
  const [ensureLink] = useEnsureLayerLinkMutation();

  const activeId = mode === "view" ? bookmarkId || null : createdId;
  const bookmarkQuery = useGetBookmarkQuery({
    variables: { id: activeId || "" },
    skip: !activeId,
    fetchPolicy: "cache-and-network",
    pollInterval: activeId && pollPreview ? 2500 : 0,
  });
  const bookmark = bookmarkQuery.data?.bookmarkById;
  const status = bookmark?.screenshotJobStatus;
  const waitingForImage = Boolean(
    activeId &&
      !bookmark?.imageId &&
      status !== WorkerJobStatus.Failed &&
      status !== WorkerJobStatus.Error &&
      status !== WorkerJobStatus.Finished
  );
  useEffect(() => {
    setPollPreview(waitingForImage);
  }, [waitingForImage]);
  useMapBookmarkSubscription({
    variables: { id: activeId || "" },
    skip: !activeId || !waitingForImage,
  });

  const sharingQuery = useLayerLinkSharingQuery({
    variables: { slug, stableId: stableId || "" },
    skip: mode !== "create" || !stableId,
  });
  const sharing = isLayerLinkSharing(sharingQuery.data?.layerLinkSharing)
    ? sharingQuery.data?.layerLinkSharing
    : null;
  const notices = sharing ? layerLinkNotices(sharing) : null;

  const metadata = useProjectMetadataQuery({
    variables: { slug },
    skip: !slug,
  });
  const tocQuery = usePublishedTableOfContentsQuery({
    variables: { slug },
    skip: !slug,
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
    if (mode !== "create" || !stableId) {
      return;
    }
    if (!manager || !ready) {
      return;
    }
    let cancelled = false;
    setCreating(true);
    setCreateError(null);
    (async () => {
      try {
        const draft = await manager.getLayerLinkBookmarkData(stableId);
        if (cancelled) {
          return;
        }
        setBoundsNote(!draft.boundsAvailable);
        const result = await ensureLink({
          variables: {
            slug,
            stableId,
            style: draft.style,
            selectedBasemap: draft.selectedBasemap,
            basemapOptionalLayerStates: draft.basemapOptionalLayerStates,
            cameraOptions: draft.cameraOptions,
            mapDimensions: draft.mapDimensions,
            basemapName: draft.basemapName,
            layerNames: draft.layerNames,
          },
        });
        const id = result.data?.ensureLayerLink?.mapBookmark?.id;
        if (!id) {
          throw new Error("Failed to create layer link");
        }
        if (!cancelled) {
          setCreatedId(id);
          setCreating(false);
        }
      } catch (error) {
        if (!cancelled) {
          setCreating(false);
          setCreateError(
            error instanceof Error
              ? error.message
              : t("Could not create a link for this layer.")
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // ensureLink is stable enough for this one-shot capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stableId, manager, ready, slug]);

  const subjectId =
    bookmark?.subjectStableId ||
    stableId ||
    (bookmark?.visibleDataLayers && bookmark.visibleDataLayers[0]) ||
    null;
  const tocItems = useMemo(
    () =>
      tocQuery.data?.projectBySlug?.tableOfContentsItems ||
      overlay.tableOfContentsItems ||
      [],
    [
      tocQuery.data?.projectBySlug?.tableOfContentsItems,
      overlay.tableOfContentsItems,
    ]
  );
  const canSeeLayer = Boolean(
    subjectId && tocItems.some((item) => item.stableId === subjectId)
  );
  const tocReady = !tocQuery.loading || tocItems.length > 0;
  const folderTitles =
    sharing?.folderTitles ||
    (subjectId ? folderTitlesFromToc(tocItems, subjectId) : []);
  const title =
    sharing?.title ||
    titleFromNames(bookmark?.layerNames, subjectId) ||
    tocItems.find((item) => item.stableId === subjectId)?.title ||
    t("Layer");
  const sourceAttribution = useMemo(() => {
    if (sharing?.attribution) {
      return sharing.attribution;
    }
    const item = tocItems.find((entry) => entry.stableId === subjectId);
    const layer = overlay.dataLayers?.find(
      (entry) => entry.id === item?.dataLayerId
    );
    const source = overlay.dataSources?.find(
      (entry) => entry.id === layer?.dataSourceId
    );
    return source?.attribution || null;
  }, [sharing?.attribution, tocItems, subjectId, overlay.dataLayers, overlay.dataSources]);

  const url = activeId ? layerLinkUrl(slug, activeId) : "";
  const isLayerLink =
    !bookmark || bookmark.kind === MapBookmarkKind.LayerLink || mode === "create";
  const failed =
    status === WorkerJobStatus.Failed || status === WorkerJobStatus.Error;
  const signedIn = Boolean(metadata.data?.me);
  const supportEmail =
    metadata.data?.project?.supportEmail ||
    metadata.data?.projectPublicDetails?.supportEmail ||
    null;

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

  const viewOnMap = async () => {
    if (!manager || !bookmark) {
      return;
    }
    await manager.showMapBookmark(bookmark, true, client);
    onClose();
  };

  let access: ReactNode = null;
  if (mode === "create" && notices && sharing) {
    access = (
      <div
        className={
          notices.tone === "open"
            ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
            : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        }
      >
        <NoticeCopy summary={sharing} blocks={notices.blocks} />
      </div>
    );
  } else if (mode === "view" && bookmark && isLayerLink && tocReady && !canSeeLayer) {
    access = (
      <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        {signedIn ? (
          <p>
            {t(
              "You can open this project, but this layer is not in the layers shared with your account. It may be limited to administrators or to specific groups, or it may have been removed."
            )}
          </p>
        ) : (
          <p>
            {t(
              "This layer is not in the map you can see. Sign in with an account that has been granted access to the project and to this layer. A public project can still keep individual layers limited to administrators or to specific groups."
            )}
          </p>
        )}
        <p>
          {supportEmail
            ? t(
                "If you believe you should have access, contact the project administrators at {{email}}.",
                { email: supportEmail }
              )
            : t(
                "If you believe you should have access, contact the project administrators."
              )}
        </p>
        {!signedIn && (
          <Button
            primary
            label={<Trans ns="mapBookmarks">Sign in</Trans>}
            onClick={() =>
              auth0.loginWithRedirect({
                appState: { returnTo: window.location.pathname },
              })
            }
          />
        )}
      </div>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="layer-link-title"
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white text-slate-900 shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {mode === "create" ? (
                <Trans ns="mapBookmarks">Link to layer</Trans>
              ) : (
                <Trans ns="mapBookmarks">Shared layer</Trans>
              )}
            </p>
            <h2 id="layer-link-title" className="truncate text-xl font-semibold">
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            aria-label={t("Close")}
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {createError && (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {createError}
            </p>
          )}
          {mode === "create" && creating && !createError && (
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
              <Spinner />
              <Trans ns="mapBookmarks">Preparing the map preview…</Trans>
            </div>
          )}
          {bookmark && !isLayerLink && (
            <p className="mb-4 text-sm text-slate-600">
              <Trans ns="mapBookmarks">
                This link is a saved map view, not a link to a single layer.
              </Trans>
            </p>
          )}
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="min-w-0 flex-1 space-y-3">
              {folderTitles.length > 0 && (
                <p className="text-sm text-slate-500">
                  {t("In {{path}}", { path: folderTitles.join(" / ") })}
                </p>
              )}
              {sourceAttribution && (
                <p className="text-sm text-slate-700">
                  <span className="font-medium">
                    <Trans ns="mapBookmarks">Attribution</Trans>
                  </span>
                  {": "}
                  <span
                    className="[&_a]:text-sky-800 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: sourceAttribution }}
                  />
                </p>
              )}
              {boundsNote && mode === "create" && (
                <p className="text-sm text-slate-500">
                  {t(
                    "This layer has no stored extent, so the preview uses the map view that was on screen when the link was saved."
                  )}
                </p>
              )}
              {access}
              {mode === "create" && url && (
                <div className="space-y-1">
                  <label
                    className="text-xs font-medium uppercase tracking-wide text-slate-500"
                    htmlFor="layer-link-url"
                  >
                    <Trans ns="mapBookmarks">Link</Trans>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="layer-link-url"
                      readOnly
                      value={url}
                      onFocus={(event) => event.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-800"
                    />
                    <Button
                      small
                      primary
                      label={<Trans ns="mapBookmarks">Copy</Trans>}
                      onClick={() => {
                        void copy();
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {t(
                      "This address stays the same for this layer. Opening Link to layer again updates the preview when the layer's appearance has changed."
                    )}
                  </p>
                </div>
              )}
            </div>
            <div className="w-full flex-none sm:w-72">
              <PreviewThumbnail
                imageId={bookmark?.imageId}
                pending={creating || waitingForImage || (!bookmark && !createError)}
                failed={failed}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button
            label={
              mode === "view" ? (
                <Trans ns="mapBookmarks">Dismiss</Trans>
              ) : (
                <Trans ns="mapBookmarks">Close</Trans>
              )
            }
            onClick={onClose}
          />
          {mode === "view" && bookmark && (isLayerLink ? canSeeLayer : true) && (
            <Button
              primary
              label={<Trans ns="mapBookmarks">View on the map</Trans>}
              disabled={!manager || !ready}
              onClick={() => {
                void viewOnMap();
              }}
            />
          )}
        </div>
        <ToastViewport className="pointer-events-none absolute bottom-4 right-4 z-10" />
      </div>
    </div>,
    document.body
  );
}
