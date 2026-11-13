import {
  ChevronDownIcon,
  ClipboardCopyIcon,
  LockClosedIcon,
  XIcon,
} from "@heroicons/react/outline";
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
import { useHistory } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import { useToast, ToastViewport } from "../components/Toast";
import Spinner from "../components/Spinner";
import {
  MapBookmarkKind,
  useEnsureLayerLinkMutation,
  useGetBookmarkQuery,
  useGetMetadataQuery,
  useLayerLinkAccessQuery,
  useLayerLinkSharingQuery,
  useMapBookmarkSubscription,
  useProjectMetadataQuery,
  usePublishedTableOfContentsQuery,
  WorkerJobStatus,
} from "../generated/graphql";
import MetadataDocumentView from "./MetadataDocumentView";
import { esriRestUrlFromMetadataItem } from "./esriRestUrl";
import EsriRestUrlFooter from "./EsriRestUrlFooter";
import getSlug from "../getSlug";
import { copyTextToClipboard } from "../projects/Forums/InlineAuthorDetails";
import {
  MapManagerContext,
  MapOverlayContext,
} from "./MapContextManager";
import {
  isLayerLinkSharing,
  layerLinkCreatorChoices,
  layerLinkNotices,
  layerLinkPath,
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
    <div className="relative aspect-[3/2] w-full overflow-hidden bg-primary-700">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-500 to-sky-300" />
      {(pending || (src && !loaded)) && !failed && (
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
      {src && (
        <motion.img
          alt=""
          src={src}
          className="absolute inset-x-0 top-0 h-[107%] w-full object-cover object-top"
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.35 }}
          onLoad={() => setLoaded(true)}
        />
      )}
      {failed && !src && (
        <div className="relative flex h-full items-center justify-center px-8 text-center text-sm leading-relaxed text-white/90">
          <Trans ns="mapBookmarks">
            The preview image could not be created. The link still opens this
            layer.
          </Trans>
        </div>
      )}
    </div>
  );
}

function LayerLinkMetadata({
  itemId,
  stableId,
}: {
  itemId?: number | null;
  stableId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const metadata = useGetMetadataQuery({
    variables: {
      itemId: itemId ?? undefined,
      stableId: stableId ?? undefined,
    },
    skip: !open || (!itemId && !stableId),
  });
  const item = metadata.data?.tableOfContentsItemByIdentifier;
  const esriRestUrl = useMemo(() => {
    if (!item || item.hideArcGisRestLink) {
      return null;
    }
    return esriRestUrlFromMetadataItem(item);
  }, [item]);
  const xml = item?.metadataXml;

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-medium text-slate-700"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Trans ns="mapBookmarks">Metadata</Trans>
        <ChevronDownIcon
          className={`h-4 w-4 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="metadata mt-3 max-h-48 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2">
          {metadata.loading && (
            <div className="flex justify-center py-2">
              <Spinner mini />
            </div>
          )}
          {item?.computedMetadata && (
            <MetadataDocumentView
              document={item.computedMetadata}
              className="ProseMirror"
            />
          )}
          {xml?.url && (
            <p className="mt-2 text-sm text-slate-600">
              <a
                href={xml.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 underline"
                download={xml.filename}
              >
                <Trans ns="homepage">Download</Trans>
              </a>
            </p>
          )}
          {esriRestUrl && <EsriRestUrlFooter url={esriRestUrl} className="mt-2" />}
        </div>
      )}
    </div>
  );
}

function AdminOnlyNote() {
  const { t } = useTranslation("mapBookmarks");
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-950">
      <LockClosedIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <span>
        {t(
          "This link requires signing in. Only project administrators can open it."
        )}
      </span>
    </p>
  );
}

function VersionSwitch({
  draftTarget,
  onChange,
}: {
  draftTarget: boolean;
  onChange: (draft: boolean) => void;
}) {
  const { t } = useTranslation("mapBookmarks");
  const option = (draft: boolean, label: string) => {
    const selected = draftTarget === draft;
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onChange(draft)}
        className={`rounded-full px-3.5 py-1 text-sm font-medium transition ${
          selected
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-500">{t("Link to")}</span>
      <div
        role="group"
        aria-label={t("Which version this link opens")}
        className="flex rounded-full bg-slate-100 p-0.5 ring-1 ring-inset ring-slate-200/80"
      >
        {option(true, t("Admin"))}
        {option(false, t("Published"))}
      </div>
    </div>
  );
}

export default function LayerLinkModal({
  mode,
  place = "published",
  stableId,
  bookmarkId,
  onClose,
}: {
  mode: "create" | "view";
  place?: "admin" | "published";
  stableId?: string;
  bookmarkId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("mapBookmarks");
  const { toast } = useToast();
  const history = useHistory();
  const auth0 = useAuth0();
  const slug = getSlug();
  const client = useApolloClient() as ApolloClient<NormalizedCacheObject>;
  const { manager, ready } = useContext(MapManagerContext);
  const overlay = useContext(MapOverlayContext);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState(true);
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
  const accessGate = useLayerLinkAccessQuery({
    variables: { id: bookmarkId || "" },
    skip: mode !== "view" || !bookmarkId,
  });
  const gate = accessGate.data?.layerLinkAccess;
  const waitingForImage = Boolean(
    activeId &&
      gate !== "admins_only" &&
      gate !== "missing" &&
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

  const tocQuery = usePublishedTableOfContentsQuery({
    variables: { slug },
    skip: !slug || (place !== "admin" && mode !== "view"),
  });
  const publishedVersion = useMemo(() => {
    const items = tocQuery.data?.projectBySlug?.tableOfContentsItems || [];
    return items.some((item) => item.stableId === stableId && !item.isFolder);
  }, [tocQuery.data, stableId]);
  const choices = layerLinkCreatorChoices({
    place,
    publishedVersion,
    draftTarget,
  });
  const sharingQuery = useLayerLinkSharingQuery({
    variables: { slug, stableId: stableId || "" },
    skip: mode !== "create" || !stableId || choices.targetDraft,
  });
  const sharing = isLayerLinkSharing(sharingQuery.data?.layerLinkSharing)
    ? sharingQuery.data?.layerLinkSharing
    : null;
  const notices = sharing ? layerLinkNotices(sharing) : null;

  const metadata = useProjectMetadataQuery({
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
    setCreatedId(null);
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
            draft: choices.targetDraft,
            refresh: choices.refresh,
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
    // ensureLink is stable enough for this capture. Switching version recaptures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stableId, manager, ready, slug, choices.targetDraft, choices.refresh]);

  const subjectId =
    bookmark?.subjectStableId ||
    stableId ||
    (bookmark?.visibleDataLayers && bookmark.visibleDataLayers[0]) ||
    null;
  const tocItems = useMemo(() => {
    if (place === "admin") {
      return overlay.tableOfContentsItems || [];
    }
    return (
      tocQuery.data?.projectBySlug?.tableOfContentsItems ||
      overlay.tableOfContentsItems ||
      []
    );
  }, [
    place,
    tocQuery.data?.projectBySlug?.tableOfContentsItems,
    overlay.tableOfContentsItems,
  ]);
  const subjectItem = tocItems.find((item) => item.stableId === subjectId);
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

  const linkIsDraft =
    mode === "create" ? choices.targetDraft : Boolean(bookmark?.subjectIsDraft);
  const url = activeId ? layerLinkUrl(slug, activeId, linkIsDraft) : "";
  const isLayerLink =
    !bookmark || bookmark.kind === MapBookmarkKind.LayerLink || mode === "create";
  const failed =
    status === WorkerJobStatus.Failed || status === WorkerJobStatus.Error;
  const signedIn = Boolean(metadata.data?.me);
  const sessionIsAdmin = Boolean(metadata.data?.project?.sessionIsAdmin);
  useEffect(() => {
    if (
      place === "published" &&
      bookmark?.subjectIsDraft &&
      sessionIsAdmin &&
      bookmark.id
    ) {
      history.replace(layerLinkPath(slug, bookmark.id, true));
    }
  }, [place, bookmark?.subjectIsDraft, bookmark?.id, sessionIsAdmin, history, slug]);
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

  const adminsOnlyGate =
    mode === "view" && accessGate.data?.layerLinkAccess === "admins_only";
  let access: ReactNode = null;
  if (adminsOnlyGate || (mode === "view" && bookmark?.subjectIsDraft)) {
    access = (
      <div className="space-y-3">
        <AdminOnlyNote />
        {adminsOnlyGate && !signedIn && (
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
        )}
      </div>
    );
  } else if (mode === "create" && choices.warnAdminsOnly) {
    access = <AdminOnlyNote />;
  } else if (
    mode === "create" &&
    notices &&
    sharing &&
    notices.tone === "restricted"
  ) {
    access = (
      <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-950">
        <NoticeCopy summary={sharing} blocks={notices.blocks} />
      </div>
    );
  } else if (mode === "view" && accessGate.data?.layerLinkAccess === "missing") {
    access = (
      <p className="text-sm text-slate-600">
        {t("This link is no longer available.")}
      </p>
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
        )}
      </div>
    );
  }

  const showView =
    mode === "view" && bookmark && (isLayerLink ? canSeeLayer : true);

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="layer-link-title"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/5"
      >
        <div className="relative flex-none">
          <PreviewThumbnail
            imageId={bookmark?.imageId}
            pending={creating || waitingForImage || (!bookmark && !createError)}
            failed={failed}
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
        <div className="overflow-y-auto px-6 pb-6 pt-5">
          {createError && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {createError}
            </p>
          )}
          {bookmark && !isLayerLink && (
            <p className="mb-3 text-sm text-slate-600">
              <Trans ns="mapBookmarks">
                This link is a saved map view, not a link to a single layer.
              </Trans>
            </p>
          )}
          <h2
            id="layer-link-title"
            className="truncate text-2xl font-semibold tracking-tight text-slate-900"
          >
            {title}
          </h2>
          {folderTitles.length > 0 && (
            <p className="mt-1 truncate text-sm text-slate-500">
              {folderTitles.join(" · ")}
            </p>
          )}
          {sourceAttribution && (
            <div
              className="mt-1 text-sm leading-snug text-slate-500 [&_a]:text-primary-600 [&_a]:underline [&_a]:decoration-primary-600/40 [&_a]:underline-offset-2"
              dangerouslySetInnerHTML={{ __html: sourceAttribution }}
            />
          )}
          {boundsNote && mode === "create" && (
            <p className="mt-3 text-sm text-slate-500">
              {t(
                "This layer has no stored extent, so the preview uses the map view that was on screen when the link was saved."
              )}
            </p>
          )}
          {mode === "create" && choices.showSwitch && (
            <div className="mt-4">
              <VersionSwitch
                draftTarget={choices.targetDraft}
                onChange={setDraftTarget}
              />
            </div>
          )}
          {access && (
            <div
              className={
                mode === "create" && choices.warnAdminsOnly ? "mt-2.5" : "mt-4"
              }
            >
              {access}
            </div>
          )}
          {subjectItem?.hasMetadata && (subjectId || subjectItem.id) && (
            <LayerLinkMetadata
              itemId={subjectItem.id}
              stableId={subjectId}
            />
          )}
          {mode === "create" && url && (
            <div className="mt-5 flex items-center gap-2">
              <input
                id="layer-link-url"
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
          )}
          {showView && (
            <button
              type="button"
              className="mt-5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
              disabled={!manager || !ready}
              onClick={() => {
                void viewOnMap();
              }}
            >
              <Trans ns="mapBookmarks">View on the map</Trans>
            </button>
          )}
        </div>
        <ToastViewport className="pointer-events-none absolute bottom-4 right-4 z-10" />
      </motion.div>
    </div>,
    document.body
  );
}
