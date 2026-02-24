/* eslint-disable i18next/no-literal-string */
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  type AuditEvent,
  type AuditEventType,
  type ActorProfile,
  MOCK_PROFILES,
  EVENT_ICONS,
  daysAgo,
  formatRelativeDate,
  EventTimeline,
  CompareButton,
} from "./AuditEventTimeline";
import ProfilePhoto from "../users/ProfilePhoto";
import {
  PencilIcon,
  PlusIcon,
  MinusIcon,
  ExternalLinkIcon,
  EyeIcon,
  SearchIcon,
  FilterIcon,
  XIcon,
} from "@heroicons/react/outline";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/Tooltip";
import { LayerEditingContext } from "./LayerEditingContext";
import { useDraftTableOfContentsQuery } from "../../generated/graphql";
import { useParams } from "react-router-dom";

type ViewMode = "all" | "summary";

interface LayerSummary {
  name: string;
  changes: AuditEvent[];
  editors: ActorProfile[];
  latestDate: Date;
}

const EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  title_change: "Title change",
  publish: "Publish",
  metadata_update: "Metadata",
  layer_created: "Layer added",
  layer_removed: "Layer removed",
  acl_change: "Access control",
  cartography_update: "Cartography",
};

function buildAllTimeEvents(): AuditEvent[] {
  return [
    {
      id: "a1",
      type: "publish",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(1, 10, 0),
      description: <span>published the data layers list</span>,
    },
    {
      id: "a2",
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
      id: "a3",
      type: "acl_change",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(2, 14, 8),
      layerName: "Mangroves 2016",
      shortSummary: "public → group-only",
      description: (
        <span>
          changed <span className="font-medium text-gray-900">access</span> from{" "}
          <span className="font-medium">public</span> to{" "}
          <span className="font-medium">group-only</span>
        </span>
      ),
    },
    {
      id: "a4",
      type: "cartography_update",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(3, 11, 45),
      layerName: "Marine Protected Areas",
      description: (
        <span>
          updated{" "}
          <span className="font-medium text-gray-900">cartography</span>{" "}
          <CompareButton />
        </span>
      ),
    },
    {
      id: "a5",
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
      id: "a6",
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
      id: "a7",
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
      id: "a8",
      type: "cartography_update",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(7, 15, 10),
      layerName: "Fishing Zones",
      description: (
        <span>
          updated{" "}
          <span className="font-medium text-gray-900">cartography</span>{" "}
          <CompareButton />
        </span>
      ),
    },
    {
      id: "a9",
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
      id: "a10",
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
      id: "a11",
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
      id: "a12",
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
    // --- Older historical events (pre last-publish) ---
    {
      id: "a13",
      type: "publish",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(14, 11, 0),
      description: <span>published the data layers list</span>,
    },
    {
      id: "a14",
      type: "layer_created",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(16, 9, 30),
      layerName: "Marine Protected Areas",
      description: (
        <span>
          uploaded{" "}
          <code className="text-sm bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
            Marine_Protected_Areas_FL.zip
          </code>
        </span>
      ),
    },
    {
      id: "a15",
      type: "metadata_update",
      actor: MOCK_PROFILES.sammi,
      date: daysAgo(15, 14, 20),
      layerName: "Marine Protected Areas",
      description: (
        <span>
          updated <span className="font-medium text-gray-900">metadata</span>{" "}
          <CompareButton />
        </span>
      ),
    },
    {
      id: "a16",
      type: "cartography_update",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(15, 10, 0),
      layerName: "Marine Protected Areas",
      description: (
        <span>
          updated{" "}
          <span className="font-medium text-gray-900">cartography</span>{" "}
          <CompareButton />
        </span>
      ),
    },
    {
      id: "a17",
      type: "layer_created",
      actor: MOCK_PROFILES.sammi,
      date: daysAgo(20, 11, 0),
      layerName: "Mangroves 2016",
      description: (
        <span>
          uploaded{" "}
          <code className="text-sm bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
            Mangroves_FWC_2016.zip
          </code>
        </span>
      ),
    },
    {
      id: "a18",
      type: "title_change",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(22, 16, 0),
      layerName: "Bathymetry (Legacy)",
      shortSummary: "Bathy_NOAA_2019 → Bathymetry (Legacy)",
      description: (
        <span>
          changed <span className="font-medium text-gray-900">title</span> from{" "}
          <code className="text-sm bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded line-through">
            Bathy_NOAA_2019
          </code>{" "}
          to{" "}
          <code className="text-sm bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">
            Bathymetry (Legacy)
          </code>
        </span>
      ),
    },
    {
      id: "a19",
      type: "layer_created",
      actor: MOCK_PROFILES.nick,
      date: daysAgo(25, 14, 30),
      layerName: "Bathymetry (Legacy)",
      description: (
        <span>
          uploaded{" "}
          <code className="text-sm bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
            Bathy_NOAA_2019.zip
          </code>
        </span>
      ),
    },
    {
      id: "a20",
      type: "publish",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(26, 9, 0),
      description: <span>published the data layers list</span>,
    },
    {
      id: "a21",
      type: "layer_created",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(30, 10, 0),
      layerName: "Fishing Zones",
      description: (
        <span>
          uploaded{" "}
          <code className="text-sm bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
            Commercial_Fishing_Zones_v2.zip
          </code>
        </span>
      ),
    },
    {
      id: "a22",
      type: "acl_change",
      actor: MOCK_PROFILES.chad,
      date: daysAgo(29, 11, 0),
      layerName: "Fishing Zones",
      shortSummary: "public → admins-only",
      description: (
        <span>
          changed <span className="font-medium text-gray-900">access</span> from{" "}
          <span className="font-medium">public</span> to{" "}
          <span className="font-medium">admins-only</span>
        </span>
      ),
    },
    {
      id: "a23",
      type: "metadata_update",
      actor: MOCK_PROFILES.sammi,
      date: daysAgo(28, 15, 0),
      layerName: "Fishing Zones",
      description: (
        <span>
          updated <span className="font-medium text-gray-900">metadata</span>{" "}
          <CompareButton />
        </span>
      ),
    },
  ];
}

const LAST_PUBLISH_DATE = daysAgo(1, 10, 0);

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

export default function ChangeLogView() {
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<AuditEventType>>(
    new Set()
  );
  const [selectedEditor, setSelectedEditor] = useState<string>("all");
  const { slug } = useParams<{ slug: string }>();
  const layerEditingContext = useContext(LayerEditingContext);
  const tocQuery = useDraftTableOfContentsQuery({ variables: { slug } });
  const tocItems = tocQuery.data?.projectBySlug?.draftTableOfContentsItems;

  const allEvents = useMemo(() => buildAllTimeEvents(), []);
  const editors = useMemo(() => {
    const map = new Map<number, ActorProfile>();
    for (const evt of allEvents) {
      if (!map.has(evt.actor.userId)) {
        map.set(evt.actor.userId, evt.actor);
      }
    }
    return Array.from(map.values());
  }, [allEvents]);

  const navigateToLayer = useCallback(
    (layerName: string) => {
      const item = tocItems?.find((i) => !i.isFolder);
      if (item) {
        layerEditingContext.setOpenEditor({
          id: item.id,
          isFolder: false,
          title: item.title,
        });
      }
    },
    [tocItems, layerEditingContext]
  );

  const filteredEvents = useMemo(() => {
    let events = [...allEvents].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter(
        (e) => e.layerName && e.layerName.toLowerCase().includes(q)
      );
    }
    if (selectedTypes.size > 0) {
      events = events.filter((e) => selectedTypes.has(e.type));
    }
    if (selectedEditor !== "all") {
      const editorId = parseInt(selectedEditor, 10);
      events = events.filter((e) => e.actor.userId === editorId);
    }
    return events;
  }, [allEvents, searchQuery, selectedTypes, selectedEditor]);

  const sinceLastPublish = useMemo(() => {
    return allEvents
      .filter(
        (e) =>
          e.type !== "publish" && e.date.getTime() > LAST_PUBLISH_DATE.getTime()
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allEvents]);

  const { added, removed, updated } = useMemo(() => {
    const addedLayers: LayerSummary[] = [];
    const removedLayers: LayerSummary[] = [];
    const updatedMap = new Map<string, LayerSummary>();

    for (const evt of sinceLastPublish) {
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
  }, [sinceLastPublish]);

  const toggleType = (type: AuditEventType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedTypes.size > 0 ||
    selectedEditor !== "all";

  return (
    <div className="max-w-2xl mx-auto py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Change Log</h2>
        <span className="text-xs text-gray-400">
          {allEvents.length} total events
        </span>
      </div>

      <div className="flex bg-gray-100 rounded-lg p-0.5 mb-5">
        <button
          className={`flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-colors ${
            viewMode === "all"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setViewMode("all")}
        >
          All Changes
        </button>
        <button
          className={`flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-colors ${
            viewMode === "summary"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setViewMode("summary")}
        >
          Summarized Changes
        </button>
      </div>

      {viewMode === "all" && (
        <>
          <div className="space-y-3 mb-5">
            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search layers..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <XIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Event type filter chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <FilterIcon className="w-3.5 h-3.5 text-gray-400 flex-none" />
                {(
                  Object.keys(EVENT_TYPE_LABELS) as AuditEventType[]
                ).map((type) => {
                  const active = selectedTypes.has(type);
                  const { icon: Icon } = EVENT_ICONS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                        active
                          ? "bg-gray-800 text-white border-gray-800"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {EVENT_TYPE_LABELS[type]}
                    </button>
                  );
                })}
              </div>

              {/* Editor dropdown */}
              <select
                value={selectedEditor}
                onChange={(e) => setSelectedEditor(e.target.value)}
                className="text-xs border rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All editors</option>
                {editors.map((editor) => (
                  <option key={editor.userId} value={editor.userId.toString()}>
                    {editor.fullname}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTypes(new Set());
                    setSelectedEditor("all");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              No events match your filters.
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-400 mb-3">
                {filteredEvents.length === allEvents.length
                  ? `${filteredEvents.length} events`
                  : `${filteredEvents.length} of ${allEvents.length} events`}
              </div>
              <EventTimeline
                events={filteredEvents}
                onLayerClick={navigateToLayer}
              />
            </>
          )}
        </>
      )}

      {viewMode === "summary" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {sinceLastPublish.length} changes across{" "}
            {added.length + removed.length + updated.length} layers since the
            last publish.
          </p>
          <SummarizedView
            added={added}
            removed={removed}
            updated={updated}
            onLayerClick={navigateToLayer}
          />
        </div>
      )}
    </div>
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
            <AddedRemovedRow
              key={layer.name}
              layer={layer}
              type="added"
              onLayerClick={onLayerClick}
            />
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
            <AddedRemovedRow
              key={layer.name}
              layer={layer}
              type="removed"
              onLayerClick={onLayerClick}
            />
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
            <UpdatedRow
              key={layer.name}
              layer={layer}
              onLayerClick={onLayerClick}
            />
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
          type === "removed" ? "text-gray-400 line-through" : "text-gray-900"
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
