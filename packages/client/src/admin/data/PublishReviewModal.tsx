/* eslint-disable i18next/no-literal-string */
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Modal from "../../components/Modal";
import {
  LayersAndSourcesForItemsDocument,
  PublishedTableOfContentsDocument,
  useDraftTableOfContentsQuery,
  usePublishTableOfContentsMutation,
} from "../../generated/graphql";
import useProjectId from "../../useProjectId";
import ProfilePhoto from "../users/ProfilePhoto";
import {
  PencilIcon,
  PlusIcon,
  MinusIcon,
  ExternalLinkIcon,
  EyeIcon,
} from "@heroicons/react/outline";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/Tooltip";
import * as Popover from "@radix-ui/react-popover";
import {
  MOCK_PROFILES,
  daysAgo,
  formatRelativeDate,
  EventTimeline,
  CompareButton,
  ActorProfile,
  AuditEvent,
  AuditEventType,
} from "./AuditEventTimeline";
import { LayerEditingContext } from "./LayerEditingContext";
import PublishReviewUnresolvedCommentsMock from "./PublishReviewUnresolvedCommentsMock";
import { useParams } from "react-router-dom";

function formatResolvedDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CommentThreadPopover({
  body,
  showResolvedFooter,
  resolvedOn,
}: {
  body: React.ReactNode;
  showResolvedFooter?: boolean;
  /** Shown in the footer when `showResolvedFooter` is true */
  resolvedOn?: Date;
}) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleOpen = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  const handleLeave = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 200);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Anchor asChild>
        <button
          type="button"
          className="font-medium text-blue-700 underline decoration-dotted decoration-blue-400/80 underline-offset-2 hover:text-blue-900"
          onPointerEnter={handleOpen}
          onPointerLeave={handleLeave}
        >
          comment
        </button>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="z-[200] w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-3 shadow-lg outline-none"
          sideOffset={6}
          collisionPadding={12}
          onPointerEnter={handleOpen}
          onPointerLeave={handleLeave}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Comment thread
          </p>
          <div className="max-h-56 overflow-y-auto space-y-3 text-xs leading-snug">
            {body}
          </div>
          {showResolvedFooter && resolvedOn && (
            <div className="mt-3 pt-2 border-t border-emerald-100 flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50/80 -mx-3 -mb-3 px-3 py-2 rounded-b-md">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                ✓
              </span>
              Marked resolved on {formatResolvedDate(resolvedOn)}
            </div>
          )}
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ThreadAuthorBlock({
  profile,
  when,
  children,
}: {
  profile: ActorProfile;
  when: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="h-7 w-7 flex-shrink-0 rounded-full overflow-hidden ring-1 ring-black/5">
        <ProfilePhoto
          fullname={profile.fullname}
          email={profile.email}
          canonicalEmail={profile.email}
          picture={profile.picture}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <span className="font-semibold text-gray-900">{profile.fullname}</span>
          <span className="text-gray-500">{when}</span>
        </div>
        <div className="text-gray-800 mt-0.5">{children}</div>
      </div>
    </div>
  );
}

/** Initial post only — used on the “added a comment” audit row. */
const MANGROVES_COMMENT_INITIAL = (
  <ThreadAuthorBlock profile={MOCK_PROFILES.nick} when="5 days ago">
    <p>
      Can you add the official FWC survey year to the layer abstract and
      citation? We shouldn&apos;t publish until that&apos;s complete.
    </p>
  </ThreadAuthorBlock>
);

/** Full thread — used on the “resolved a comment” row (popover + footer). */
const MANGROVES_METADATA_THREAD = (
  <>
    <ThreadAuthorBlock profile={MOCK_PROFILES.nick} when="5 days ago">
      <p>
        Can you add the official FWC survey year to the layer abstract and
        citation? We shouldn&apos;t publish until that&apos;s complete.
      </p>
    </ThreadAuthorBlock>
    <ThreadAuthorBlock profile={MOCK_PROFILES.sammi} when="4 days ago">
      <p>
        Updated the abstract and source lineage in the metadata editor — same
        change as the metadata update in this review.
      </p>
    </ThreadAuthorBlock>
  </>
);

const MPA_BOUNDARY_THREAD = (
  <ThreadAuthorBlock profile={MOCK_PROFILES.nick} when="3 days ago">
    <p>
      Flagging that the MPA boundary labels clip on mobile — can we bump label
      minzoom or simplify the stack before publish?
    </p>
  </ThreadAuthorBlock>
);

interface LayerSummary {
  name: string;
  changes: AuditEvent[];
  editors: ActorProfile[];
  latestDate: Date;
}

type ViewMode = "summary" | "chronological" | "comments";

function buildMockEvents(): AuditEvent[] {
  const mangrovesCommentResolvedDate = daysAgo(4, 9, 50);

  return [
    {
      id: "e1",
      type: "title_change",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(2, 14, 12),
      layerName: "Mangroves 2016",
      shortSummary: "Mangroves_FWC_2016 → Mangroves 2016",
      description: (
        <span>
          changed <span className="font-medium text-gray-900">title</span> from{" "}
          <code className="text-sm bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded line-through">
            Mangroves_FWC_2016
          </code>{" "}
          to{" "}
          <code className="text-sm bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">
            Mangroves 2016
          </code>
        </span>
      ),
    },
    {
      id: "e2",
      type: "acl_change",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(2, 14, 8),
      layerName: "Mangroves 2016",
      shortSummary: "public → group-only",
      description: (
        <span>
          changed <span className="font-medium text-gray-900">access</span> from{" "}
          <span className="font-medium">public</span> to{" "}
          <Tooltip>
            <TooltipTrigger>
              <span className="font-medium text-blue-600 underline decoration-dotted cursor-help">
                group-only
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs max-w-xs">
                <p className="font-medium mb-1">Restricted to:</p>
                <ul className="list-disc ml-3 space-y-0.5">
                  <li>Project Admins</li>
                  <li>Marine Biologists Working Group</li>
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </span>
      ),
    },
    {
      id: "e3",
      type: "cartography_update",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(3, 11, 45),
      layerName: "Marine Protected Areas",
      description: (
        <span>
          updated <span className="font-medium text-gray-900">cartography</span>{" "}
          <CompareButton />
        </span>
      ),
    },
    {
      id: "e3b",
      type: "comment_added",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(3, 12, 30),
      layerName: "Marine Protected Areas",
      description: (
        <span>
          added a <CommentThreadPopover body={MPA_BOUNDARY_THREAD} /> about
          cartography
        </span>
      ),
    },
    {
      id: "e4a",
      type: "comment_added",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(5, 11, 0),
      layerName: "Mangroves 2016",
      description: (
        <span>
          added a <CommentThreadPopover body={MANGROVES_COMMENT_INITIAL} /> about
          the metadata abstract
        </span>
      ),
    },
    {
      id: "e4",
      type: "metadata_update",
      actor: MOCK_PROFILES.sammi,
      date: daysAgo(4, 9, 20),
      layerName: "Mangroves 2016",
      description: (
        <span>
          updated <span className="font-medium text-gray-900">metadata</span>{" "}
          <CompareButton />
        </span>
      ),
    },
    {
      id: "e4b",
      type: "comment_resolved",
      actor: MOCK_PROFILES.sammi,
      date: mangrovesCommentResolvedDate,
      layerName: "Mangroves 2016",
      description: (
        <span>
          resolved a{" "}
          <CommentThreadPopover
            body={MANGROVES_METADATA_THREAD}
            showResolvedFooter
            resolvedOn={mangrovesCommentResolvedDate}
          />.
        </span>
      ),
    },
    {
      id: "e5",
      type: "layer_created",
      actor: MOCK_PROFILES.sammi,
      date: daysAgo(5, 16, 0),
      layerName: "Coral Reef Monitoring Sites",
      description: (
        <span>
          uploaded{" "}
          <code className="text-sm bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
            Coral_Reef_Monitoring_Sites.zip
          </code>
        </span>
      ),
    },
    {
      id: "e6",
      type: "acl_change",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(6, 10, 30),
      layerName: "Fishing Zones",
      shortSummary: "admins-only → public",
      description: (
        <span>
          changed <span className="font-medium text-gray-900">access</span> from{" "}
          <span className="font-medium">admins-only</span> to{" "}
          <span className="font-medium">public</span>
        </span>
      ),
    },
    {
      id: "e7",
      type: "cartography_update",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(7, 15, 10),
      layerName: "Fishing Zones",
      description: (
        <span>
          updated <span className="font-medium text-gray-900">cartography</span>{" "}
          <CompareButton />
        </span>
      ),
    },
    {
      id: "e8",
      type: "layer_created",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(8, 13, 0),
      layerName: "Protected Species Sightings 2025",
      description: (
        <span>
          uploaded{" "}
          <code className="text-sm bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
            Protected_Species_Sightings_2025.zip
          </code>
        </span>
      ),
    },
    {
      id: "e9",
      type: "layer_removed",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(3, 9, 15),
      layerName: "Bathymetry (Legacy)",
      description: (
        <span>
          removed{" "}
          <span className="font-medium text-gray-900 line-through">
            Bathymetry (Legacy)
          </span>
        </span>
      ),
    },
    {
      id: "e10",
      type: "metadata_update",
      actor: MOCK_PROFILES.sammi,
      date: daysAgo(5, 11, 0),
      layerName: "Marine Protected Areas",
      description: (
        <span>
          updated <span className="font-medium text-gray-900">metadata</span>{" "}
          <CompareButton />
        </span>
      ),
    },
    {
      id: "e11",
      type: "title_change",
      actor: MOCK_PROFILES.sammi,
      date: daysAgo(8, 9, 0),
      layerName: "Fishing Zones",
      shortSummary: "Commercial_Fishing_Zones_v2 → Fishing Zones",
      description: (
        <span>
          changed <span className="font-medium text-gray-900">title</span> from{" "}
          <code className="text-sm bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded line-through">
            Commercial_Fishing_Zones_v2
          </code>{" "}
          to{" "}
          <code className="text-sm bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">
            Fishing Zones
          </code>
        </span>
      ),
    },
  ];
}

export default function PublishReviewModal(props: {
  onRequestClose: () => void;
}) {
  const [publish, publishState] = usePublishTableOfContentsMutation({
    refetchQueries: [
      PublishedTableOfContentsDocument,
      LayersAndSourcesForItemsDocument,
    ],
  });
  const projectId = useProjectId();
  const [viewMode, setViewMode] = useState<ViewMode>("summary");
  const { slug } = useParams<{ slug: string }>();
  const layerEditingContext = useContext(LayerEditingContext);

  const tocQuery = useDraftTableOfContentsQuery({ variables: { slug } });
  const tocItems = tocQuery.data?.projectBySlug?.draftTableOfContentsItems;

  const navigateToLayer = useCallback(
    (layerName: string) => {
      const item = tocItems?.find(
        (i) => !i.isFolder
      );
      if (item) {
        props.onRequestClose();
        layerEditingContext.setOpenEditor({
          id: item.id,
          isFolder: false,
          title: item.title,
        });
      }
    },
    [tocItems, props, layerEditingContext]
  );

  const mockEvents = useMemo(() => buildMockEvents(), []);

  const { added, removed, updated } = useMemo(() => {
    const addedLayers: LayerSummary[] = [];
    const removedLayers: LayerSummary[] = [];
    const updatedMap = new Map<string, LayerSummary>();

    for (const evt of mockEvents) {
      if (evt.type === "layer_created") {
        addedLayers.push({
          name: evt.layerName!,
          changes: [evt],
          editors: [evt.actor],
          latestDate: evt.date,
        });
      } else if (evt.type === "layer_removed") {
        removedLayers.push({
          name: evt.layerName!,
          changes: [evt],
          editors: [evt.actor],
          latestDate: evt.date,
        });
      } else {
        const key = evt.layerName!;
        const existing = updatedMap.get(key);
        if (existing) {
          existing.changes.push(evt);
          if (!existing.editors.find((e) => e.userId === evt.actor.userId)) {
            existing.editors.push(evt.actor);
          }
          if (evt.date > existing.latestDate) {
            existing.latestDate = evt.date;
          }
        } else {
          updatedMap.set(key, {
            name: key,
            changes: [evt],
            editors: [evt.actor],
            latestDate: evt.date,
          });
        }
      }
    }

    return {
      added: addedLayers,
      removed: removedLayers,
      updated: Array.from(updatedMap.values()).sort(
        (a, b) => b.latestDate.getTime() - a.latestDate.getTime()
      ),
    };
  }, [mockEvents]);

  const chronologicalEvents = useMemo(
    () => [...mockEvents].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [mockEvents]
  );

  const totalChanges = mockEvents.length;

  return (
    <Modal
      title="Review Changes Before Publishing"
      onRequestClose={props.onRequestClose}
      scrollable
      panelClassName={
        viewMode === "comments" ? "sm:max-w-4xl" : "sm:max-w-2xl"
      }
      footer={[
        {
          autoFocus: true,
          label: "Publish",
          disabled: publishState.loading,
          loading: publishState.loading,
          variant: "primary",
          onClick: async () => {
            await publish({
              variables: { projectId: projectId! },
            })
              .then((val) => {
                if (!val.errors) {
                  props.onRequestClose();
                }
              })
              .catch((e) => {
                console.error(e);
              });
          },
        },
        {
          label: "Cancel",
          onClick: props.onRequestClose,
        },
      ]}
    >
      <div className="text-left">
        {viewMode === "comments" ? (
          <p className="text-sm text-gray-500 mb-4">
            Open comment threads are listed below. You can reply or mark threads
            resolved here as a preview — this does not persist until comments are
            wired to the server.
          </p>
        ) : (
          <p className="text-sm text-gray-500 mb-4">
            {totalChanges} changes across{" "}
            {added.length + removed.length + updated.length} layers since the last
            publish. Review these changes before making them available to project
            users.
          </p>
        )}

        <div className="flex bg-gray-100 rounded-lg p-0.5 mb-5 gap-0.5">
          <button
            className={`flex-1 text-xs sm:text-sm font-medium py-1.5 px-2 sm:px-3 rounded-md transition-colors leading-tight ${
              viewMode === "summary"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setViewMode("summary")}
          >
            Summarized Changes
          </button>
          <button
            className={`flex-1 text-xs sm:text-sm font-medium py-1.5 px-2 sm:px-3 rounded-md transition-colors leading-tight ${
              viewMode === "chronological"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setViewMode("chronological")}
          >
            All Changes
          </button>
          <button
            className={`flex-1 text-xs sm:text-sm font-medium py-1.5 px-2 sm:px-3 rounded-md transition-colors leading-tight ${
              viewMode === "comments"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setViewMode("comments")}
          >
            Unresolved Comments
          </button>
        </div>

        {viewMode === "summary" ? (
          <SummarizedView added={added} removed={removed} updated={updated} onLayerClick={navigateToLayer} />
        ) : viewMode === "chronological" ? (
          <EventTimeline events={chronologicalEvents} maxHeight={450} onLayerClick={navigateToLayer} />
        ) : (
          <PublishReviewUnresolvedCommentsMock />
        )}

        {publishState.error && (
          <p className="text-red-800 mt-4 text-sm">
            Error: {publishState.error.message}
          </p>
        )}
      </div>
    </Modal>
  );
}

function SummarizedView({
  added,
  removed,
  updated,
  onLayerClick,
}: {
  added: LayerSummary[];
  removed: LayerSummary[];
  updated: LayerSummary[];
  onLayerClick: (layerName: string) => void;
}) {
  return (
    <div className="space-y-5">
      {added.length > 0 && (
        <SummarySection
          title="Added"
          count={added.length}
          badgeColor="bg-green-100 text-green-700"
          icon={PlusIcon}
          iconColor="text-green-600"
        >
          {added.map((layer) => (
            <AddedRemovedRow key={layer.name} layer={layer} type="added" onLayerClick={onLayerClick} />
          ))}
        </SummarySection>
      )}

      {removed.length > 0 && (
        <SummarySection
          title="Removed"
          count={removed.length}
          badgeColor="bg-red-100 text-red-700"
          icon={MinusIcon}
          iconColor="text-red-600"
        >
          {removed.map((layer) => (
            <AddedRemovedRow key={layer.name} layer={layer} type="removed" onLayerClick={onLayerClick} />
          ))}
        </SummarySection>
      )}

      {updated.length > 0 && (
        <SummarySection
          title="Updated"
          count={updated.length}
          badgeColor="bg-blue-100 text-blue-700"
          icon={PencilIcon}
          iconColor="text-blue-600"
        >
          {updated.map((layer) => (
            <UpdatedRow key={layer.name} layer={layer} onLayerClick={onLayerClick} />
          ))}
        </SummarySection>
      )}
    </div>
  );
}

function SummarySection({
  title,
  count,
  badgeColor,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  count: number;
  badgeColor: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </h4>
        <span
          className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badgeColor}`}
        >
          {count}
        </span>
      </div>
      <div className="border rounded-lg divide-y overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function AddedRemovedRow({
  layer,
  type,
  onLayerClick,
}: {
  layer: LayerSummary;
  type: "added" | "removed";
  onLayerClick: (layerName: string) => void;
}) {
  const actor = layer.editors[0];
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-white">
      <button
        onClick={() => onLayerClick(layer.name)}
        className={`font-medium text-sm text-left hover:underline ${
          type === "removed"
            ? "text-gray-400 line-through"
            : "text-gray-900"
        }`}
      >
        {layer.name}
      </button>
      <div className="flex items-center gap-1.5 ml-auto flex-none">
        <div className="h-4 w-4 flex-none">
          <ProfilePhoto
            fullname={actor.fullname}
            email={actor.email}
            canonicalEmail={actor.email}
            picture={actor.picture}
          />
        </div>
        <span className="text-xs text-gray-500">{actor.fullname}</span>
        <span className="text-xs text-gray-400">
          {formatRelativeDate(layer.latestDate)}
        </span>
      </div>
    </div>
  );
}

const COMPARE_TYPES = new Set<AuditEventType>([
  "metadata_update",
  "cartography_update",
]);

function ChangeChip({
  type,
  changes,
}: {
  type: AuditEventType;
  changes: AuditEvent[];
}) {
  const changeLabels: Record<string, string> = {
    title_change: "title",
    acl_change: "access",
    cartography_update: "cartography",
    metadata_update: "metadata",
    comment_added: "comment",
    comment_resolved: "resolved comment",
  };

  const label = changeLabels[type] || type;
  const relevant = changes.filter((c) => c.type === type);
  const latest = relevant.sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )[0];

  if (COMPARE_TYPES.has(type)) {
    return (
      <button className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors">
        {label}
        <ExternalLinkIcon className="w-3 h-3 text-gray-400" />
      </button>
    );
  }

  if (latest?.shortSummary) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded cursor-help">
            {label}
            <EyeIcon className="w-3 h-3 text-gray-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="text-xs">{latest.shortSummary}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}

function UpdatedRow({
  layer,
  onLayerClick,
}: {
  layer: LayerSummary;
  onLayerClick: (layerName: string) => void;
}) {
  const changeTypes = Array.from(
    new Set(layer.changes.map((c) => c.type))
  ) as AuditEventType[];
  const primaryEditor = layer.editors[0];
  const otherCount = layer.editors.length - 1;

  return (
    <div className="px-3 py-2.5 bg-white">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onLayerClick(layer.name)}
          className="font-medium text-sm text-gray-900 hover:underline truncate text-left"
        >
          {layer.name}
        </button>
        <div className="flex items-center gap-1.5 flex-none ml-auto">
          {changeTypes.map((ct) => (
            <ChangeChip key={ct} type={ct} changes={layer.changes} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <div className="flex items-center -space-x-1">
          {layer.editors.map((editor) => (
            <div
              key={editor.userId}
              className="h-4 w-4 flex-none rounded-full ring-2 ring-white"
            >
              <ProfilePhoto
                fullname={editor.fullname}
                email={editor.email}
                canonicalEmail={editor.email}
                picture={editor.picture}
              />
            </div>
          ))}
        </div>
        <span className="text-xs text-gray-500">
          {primaryEditor.fullname}
          {otherCount > 0 && (
            <span className="text-gray-400">
              {" "}
              +{otherCount} other{otherCount > 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span className="text-gray-300 text-xs">&middot;</span>
        <span className="text-xs text-gray-400">
          {layer.changes.length} change{layer.changes.length > 1 ? "s" : ""}
        </span>
        <span className="text-gray-300 text-xs">&middot;</span>
        <span className="text-xs text-gray-400">
          last {formatRelativeDate(layer.latestDate)}
        </span>
      </div>
    </div>
  );
}
