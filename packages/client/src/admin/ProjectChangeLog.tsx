/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useState } from "react";
import {
  PencilIcon,
  PlusIcon,
  MinusIcon,
  ShieldCheckIcon,
  SearchIcon,
  XIcon,
  FilterIcon,
  ShareIcon,
  TrashIcon,
  UserAddIcon,
  UserRemoveIcon,
  CogIcon,
  ChatAlt2Icon,
  PhotographIcon,
  LockClosedIcon,
  GlobeAltIcon,
  EyeIcon,
  ArchiveIcon,
  ClipboardListIcon,
  ColorSwatchIcon,
  DocumentTextIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
} from "@heroicons/react/outline";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/Tooltip";
import ProfilePhoto from "./users/ProfilePhoto";

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

interface ActorProfile {
  fullname: string;
  email: string;
  picture: string;
  userId: number;
}

type EventCategory =
  | "data_layers"
  | "forums"
  | "sketch_classes"
  | "users_groups"
  | "settings"
  | "surveys";

type EventAction =
  | "created"
  | "updated"
  | "deleted"
  | "published"
  | "access_changed"
  | "invited"
  | "removed"
  | "approved"
  | "archived"
  | "restored"
  | "configured"
  | "enabled"
  | "disabled"
  | "renamed"
  | "moved"
  | "locked"
  | "unlocked"
  | "downloaded";

interface ProjectEvent {
  id: string;
  category: EventCategory;
  action: EventAction;
  actor: ActorProfile;
  date: Date;
  entityName: string;
  description: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Visual config
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<
  EventCategory,
  { label: string; icon: React.ElementType; color: string }
> = {
  data_layers: {
    label: "Data Layers",
    icon: EyeIcon,
    color: "text-blue-600 bg-blue-50",
  },
  forums: {
    label: "Forums",
    icon: ChatAlt2Icon,
    color: "text-purple-600 bg-purple-50",
  },
  sketch_classes: {
    label: "Sketch Classes",
    icon: ColorSwatchIcon,
    color: "text-amber-600 bg-amber-50",
  },
  users_groups: {
    label: "Users & Groups",
    icon: UserAddIcon,
    color: "text-emerald-600 bg-emerald-50",
  },
  settings: {
    label: "Settings",
    icon: CogIcon,
    color: "text-gray-600 bg-gray-100",
  },
  surveys: {
    label: "Surveys",
    icon: ClipboardListIcon,
    color: "text-rose-600 bg-rose-50",
  },
};

const ACTION_ICONS: Record<
  EventAction,
  { icon: React.ElementType; color: string }
> = {
  created: { icon: PlusIcon, color: "text-green-600 bg-green-50" },
  updated: { icon: PencilIcon, color: "text-gray-600 bg-gray-100" },
  deleted: { icon: TrashIcon, color: "text-red-600 bg-red-50" },
  published: { icon: ShareIcon, color: "text-blue-600 bg-blue-50" },
  access_changed: {
    icon: ShieldCheckIcon,
    color: "text-red-600 bg-red-50",
  },
  invited: { icon: UserAddIcon, color: "text-emerald-600 bg-emerald-50" },
  removed: { icon: UserRemoveIcon, color: "text-red-600 bg-red-50" },
  approved: { icon: UserAddIcon, color: "text-green-600 bg-green-50" },
  archived: { icon: ArchiveIcon, color: "text-gray-600 bg-gray-100" },
  restored: { icon: ArchiveIcon, color: "text-blue-600 bg-blue-50" },
  configured: { icon: CogIcon, color: "text-gray-600 bg-gray-100" },
  enabled: { icon: PlusIcon, color: "text-green-600 bg-green-50" },
  disabled: { icon: MinusIcon, color: "text-red-600 bg-red-50" },
  renamed: { icon: PencilIcon, color: "text-gray-600 bg-gray-100" },
  moved: { icon: ArchiveIcon, color: "text-gray-600 bg-gray-100" },
  locked: { icon: LockClosedIcon, color: "text-red-600 bg-red-50" },
  unlocked: { icon: GlobeAltIcon, color: "text-green-600 bg-green-50" },
  downloaded: { icon: DownloadIcon, color: "text-indigo-600 bg-indigo-50" },
};

// ---------------------------------------------------------------------------
// Mock actors
// ---------------------------------------------------------------------------

const ACTORS: Record<string, ActorProfile> = {
  chad: {
    fullname: "Chad Burt",
    email: "chad@underbluewaters.net",
    picture:
      "http://www.gravatar.com/avatar/b0a4285bfc440a2efad5036bb95d68a9?d=retro&r=g&s=200",
    userId: 1,
  },
  sammi: {
    fullname: "Sammi",
    email: "sammi@example.com",
    picture:
      "https://d2f6qufqioogvc.cloudfront.net/671be4c8-b594-4332-afb1-54e5e912ed65.jpg",
    userId: 2,
  },
  nick: {
    fullname: "Nick Alcaraz",
    email: "nick@example.com",
    picture:
      "https://ui-avatars.com/api/?name=Nick+Alcaraz&background=3b82f6&color=fff&size=200",
    userId: 3,
  },
  alex: {
    fullname: "Alex Rivera",
    email: "alex@example.com",
    picture:
      "https://ui-avatars.com/api/?name=Alex+Rivera&background=059669&color=fff&size=200",
    userId: 4,
  },
  maya: {
    fullname: "Maya Chen",
    email: "maya@example.com",
    picture:
      "https://ui-avatars.com/api/?name=Maya+Chen&background=d946ef&color=fff&size=200",
    userId: 5,
  },
};

// ---------------------------------------------------------------------------
// Mock events — a rich, realistic project history
// ---------------------------------------------------------------------------

function d(n: number, h: number, m: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(h, m, 0, 0);
  return date;
}

function buildProjectEvents(): ProjectEvent[] {
  return [
    // ---- Data Layers ----
    {
      id: "dl-1",
      category: "data_layers",
      action: "published",
      actor: ACTORS.nick,
      date: d(1, 10, 0),
      entityName: "Data Layers List",
      description: <span>published the data layers list</span>,
    },
    {
      id: "dl-2",
      category: "data_layers",
      action: "renamed",
      actor: ACTORS.chad,
      date: d(2, 14, 12),
      entityName: "Mangroves 2016",
      description: (
        <span>
          renamed{" "}
          <code className="text-sm bg-gray-100 text-gray-500 px-1 py-0.5 rounded line-through">
            Mangroves_FWC_2016
          </code>{" "}
          →{" "}
          <code className="text-sm bg-gray-100 text-gray-800 px-1 py-0.5 rounded">
            Mangroves 2016
          </code>
        </span>
      ),
    },
    {
      id: "dl-3",
      category: "data_layers",
      action: "access_changed",
      actor: ACTORS.chad,
      date: d(2, 14, 8),
      entityName: "Mangroves 2016",
      description: (
        <span>
          changed access from <span className="font-medium">public</span> to{" "}
          <span className="font-medium">group-only</span>
        </span>
      ),
    },
    {
      id: "dl-4",
      category: "data_layers",
      action: "updated",
      actor: ACTORS.nick,
      date: d(3, 11, 45),
      entityName: "Marine Protected Areas",
      description: <span>updated cartography</span>,
    },
    {
      id: "dl-5",
      category: "data_layers",
      action: "updated",
      actor: ACTORS.sammi,
      date: d(4, 9, 20),
      entityName: "Mangroves 2016",
      description: <span>updated metadata</span>,
    },
    {
      id: "dl-6",
      category: "data_layers",
      action: "created",
      actor: ACTORS.sammi,
      date: d(5, 16, 0),
      entityName: "Coral Reef Monitoring Sites",
      description: (
        <span>
          uploaded{" "}
          <code className="text-sm bg-gray-100 text-gray-700 px-1 py-0.5 rounded">
            Coral_Reef_Monitoring_Sites.zip
          </code>
        </span>
      ),
    },
    {
      id: "dl-7",
      category: "data_layers",
      action: "deleted",
      actor: ACTORS.chad,
      date: d(3, 9, 15),
      entityName: "Bathymetry (Legacy)",
      description: (
        <span>
          removed layer{" "}
          <span className="line-through">Bathymetry (Legacy)</span>
        </span>
      ),
    },
    {
      id: "dl-8",
      category: "data_layers",
      action: "created",
      actor: ACTORS.nick,
      date: d(8, 13, 0),
      entityName: "Protected Species Sightings 2025",
      description: (
        <span>
          uploaded{" "}
          <code className="text-sm bg-gray-100 text-gray-700 px-1 py-0.5 rounded">
            Protected_Species_Sightings_2025.zip
          </code>
        </span>
      ),
    },
    {
      id: "dl-9",
      category: "data_layers",
      action: "updated",
      actor: ACTORS.nick,
      date: d(7, 15, 10),
      entityName: "Fishing Zones",
      description: <span>updated cartography</span>,
    },
    {
      id: "dl-10",
      category: "data_layers",
      action: "published",
      actor: ACTORS.chad,
      date: d(14, 11, 0),
      entityName: "Data Layers List",
      description: <span>published the data layers list</span>,
    },

    // ---- Forums ----
    {
      id: "f-1",
      category: "forums",
      action: "created",
      actor: ACTORS.chad,
      date: d(1, 8, 30),
      entityName: "Stakeholder Feedback",
      description: <span>created forum</span>,
    },
    {
      id: "f-2",
      category: "forums",
      action: "renamed",
      actor: ACTORS.chad,
      date: d(1, 9, 15),
      entityName: "Stakeholder Feedback",
      description: (
        <span>
          renamed from{" "}
          <code className="text-sm bg-gray-100 text-gray-500 px-1 py-0.5 rounded line-through">
            Public Input
          </code>{" "}
          →{" "}
          <code className="text-sm bg-gray-100 text-gray-800 px-1 py-0.5 rounded">
            Stakeholder Feedback
          </code>
        </span>
      ),
    },
    {
      id: "f-3",
      category: "forums",
      action: "access_changed",
      actor: ACTORS.alex,
      date: d(2, 10, 0),
      entityName: "Internal Discussion",
      description: (
        <span>
          restricted access to{" "}
          <span className="font-medium">Project Admins</span>
        </span>
      ),
    },
    {
      id: "f-4",
      category: "forums",
      action: "locked",
      actor: ACTORS.chad,
      date: d(6, 14, 0),
      entityName: "Phase 1 Comments",
      description: <span>locked forum — no new posts allowed</span>,
    },
    {
      id: "f-5",
      category: "forums",
      action: "archived",
      actor: ACTORS.chad,
      date: d(12, 11, 0),
      entityName: "Phase 1 Comments",
      description: <span>archived forum</span>,
    },
    {
      id: "f-6",
      category: "forums",
      action: "created",
      actor: ACTORS.maya,
      date: d(15, 16, 30),
      entityName: "Internal Discussion",
      description: <span>created forum</span>,
    },
    {
      id: "f-7",
      category: "forums",
      action: "deleted",
      actor: ACTORS.chad,
      date: d(18, 9, 0),
      entityName: "Test Forum (delete me)",
      description: <span>deleted forum</span>,
    },

    // ---- Sketch Classes ----
    {
      id: "sc-1",
      category: "sketch_classes",
      action: "created",
      actor: ACTORS.nick,
      date: d(2, 11, 30),
      entityName: "Marine Reserve",
      description: (
        <span>
          created sketch class with geometry type{" "}
          <span className="font-medium">Polygon</span>
        </span>
      ),
    },
    {
      id: "sc-2",
      category: "sketch_classes",
      action: "configured",
      actor: ACTORS.nick,
      date: d(2, 12, 45),
      entityName: "Marine Reserve",
      description: (
        <span>
          added reporting template{" "}
          <span className="font-medium">Habitat Protection</span>
        </span>
      ),
    },
    {
      id: "sc-3",
      category: "sketch_classes",
      action: "renamed",
      actor: ACTORS.chad,
      date: d(4, 10, 0),
      entityName: "No-Take Zone",
      description: (
        <span>
          renamed from{" "}
          <code className="text-sm bg-gray-100 text-gray-500 px-1 py-0.5 rounded line-through">
            Protected Area
          </code>{" "}
          →{" "}
          <code className="text-sm bg-gray-100 text-gray-800 px-1 py-0.5 rounded">
            No-Take Zone
          </code>
        </span>
      ),
    },
    {
      id: "sc-4",
      category: "sketch_classes",
      action: "access_changed",
      actor: ACTORS.alex,
      date: d(5, 15, 0),
      entityName: "Marine Reserve",
      description: (
        <span>
          changed access from <span className="font-medium">admins only</span>{" "}
          to <span className="font-medium">all participants</span>
        </span>
      ),
    },
    {
      id: "sc-5",
      category: "sketch_classes",
      action: "configured",
      actor: ACTORS.nick,
      date: d(6, 9, 0),
      entityName: "No-Take Zone",
      description: (
        <span>
          set preprocessing function to{" "}
          <span className="font-medium">Clip to EEZ</span>
        </span>
      ),
    },
    {
      id: "sc-6",
      category: "sketch_classes",
      action: "created",
      actor: ACTORS.chad,
      date: d(10, 14, 0),
      entityName: "Aquaculture Site",
      description: (
        <span>
          created sketch class with geometry type{" "}
          <span className="font-medium">Point</span>
        </span>
      ),
    },
    {
      id: "sc-7",
      category: "sketch_classes",
      action: "deleted",
      actor: ACTORS.chad,
      date: d(11, 10, 0),
      entityName: "Test Sketch Class",
      description: <span>deleted sketch class</span>,
    },
    {
      id: "sc-8",
      category: "sketch_classes",
      action: "configured",
      actor: ACTORS.maya,
      date: d(3, 16, 30),
      entityName: "Marine Reserve",
      description: (
        <span>
          updated form — added attribute{" "}
          <span className="font-medium">Designation Level</span>
        </span>
      ),
    },

    // ---- Users & Groups ----
    {
      id: "ug-1",
      category: "users_groups",
      action: "invited",
      actor: ACTORS.chad,
      date: d(1, 7, 0),
      entityName: "alex@example.com",
      description: (
        <span>
          sent invitation to <span className="font-medium">Alex Rivera</span>
        </span>
      ),
    },
    {
      id: "ug-2",
      category: "users_groups",
      action: "approved",
      actor: ACTORS.chad,
      date: d(1, 7, 15),
      entityName: "Maya Chen",
      description: <span>approved join request</span>,
    },
    {
      id: "ug-3",
      category: "users_groups",
      action: "created",
      actor: ACTORS.chad,
      date: d(3, 10, 0),
      entityName: "Marine Biologists Working Group",
      description: (
        <span>
          created group with{" "}
          <span className="font-medium">12 initial members</span>
        </span>
      ),
    },
    {
      id: "ug-4",
      category: "users_groups",
      action: "updated",
      actor: ACTORS.alex,
      date: d(4, 14, 30),
      entityName: "Marine Biologists Working Group",
      description: (
        <span>
          added <span className="font-medium">3 members</span>
        </span>
      ),
    },
    {
      id: "ug-5",
      category: "users_groups",
      action: "removed",
      actor: ACTORS.chad,
      date: d(7, 11, 0),
      entityName: "john.doe@example.com",
      description: (
        <span>
          removed user from project — reason:{" "}
          <span className="font-medium">inactivity</span>
        </span>
      ),
    },
    {
      id: "ug-6",
      category: "users_groups",
      action: "access_changed",
      actor: ACTORS.chad,
      date: d(8, 9, 30),
      entityName: "Sammi",
      description: (
        <span>
          promoted to <span className="font-medium">admin</span>
        </span>
      ),
    },
    {
      id: "ug-7",
      category: "users_groups",
      action: "invited",
      actor: ACTORS.sammi,
      date: d(9, 10, 0),
      entityName: "Batch Invitation",
      description: (
        <span>
          sent <span className="font-medium">45 invitations</span> via CSV
          upload
        </span>
      ),
    },
    {
      id: "ug-8",
      category: "users_groups",
      action: "deleted",
      actor: ACTORS.chad,
      date: d(20, 15, 0),
      entityName: "Temporary Reviewers",
      description: <span>deleted group</span>,
    },

    // ---- Settings ----
    {
      id: "s-1",
      category: "settings",
      action: "updated",
      actor: ACTORS.chad,
      date: d(0, 9, 0),
      entityName: "Project Logo",
      description: <span>uploaded new project logo</span>,
    },
    {
      id: "s-2",
      category: "settings",
      action: "renamed",
      actor: ACTORS.chad,
      date: d(5, 10, 0),
      entityName: "Project Name",
      description: (
        <span>
          changed from{" "}
          <code className="text-sm bg-gray-100 text-gray-500 px-1 py-0.5 rounded line-through">
            Florida Keys Planning v2
          </code>{" "}
          →{" "}
          <code className="text-sm bg-gray-100 text-gray-800 px-1 py-0.5 rounded">
            Florida Keys Marine Spatial Plan
          </code>
        </span>
      ),
    },
    {
      id: "s-3",
      category: "settings",
      action: "enabled",
      actor: ACTORS.chad,
      date: d(10, 11, 0),
      entityName: "Offline Support",
      description: <span>enabled offline support for the project</span>,
    },
    {
      id: "s-4",
      category: "settings",
      action: "configured",
      actor: ACTORS.chad,
      date: d(12, 14, 0),
      entityName: "Basemap",
      description: (
        <span>
          added basemap{" "}
          <span className="font-medium">Satellite (Mapbox)</span>
        </span>
      ),
    },
    {
      id: "s-5",
      category: "settings",
      action: "updated",
      actor: ACTORS.maya,
      date: d(15, 9, 0),
      entityName: "Project Description",
      description: <span>updated project description</span>,
    },
    {
      id: "s-6",
      category: "settings",
      action: "configured",
      actor: ACTORS.chad,
      date: d(16, 10, 30),
      entityName: "Translations",
      description: (
        <span>
          enabled translation for{" "}
          <span className="font-medium">Spanish (es)</span>
        </span>
      ),
    },
    {
      id: "s-7",
      category: "settings",
      action: "disabled",
      actor: ACTORS.chad,
      date: d(22, 11, 0),
      entityName: "Public Access",
      description: (
        <span>
          set project visibility to{" "}
          <span className="font-medium">invite-only</span>
        </span>
      ),
    },
    {
      id: "s-8",
      category: "settings",
      action: "enabled",
      actor: ACTORS.chad,
      date: d(8, 16, 0),
      entityName: "Public Access",
      description: (
        <span>
          set project visibility to <span className="font-medium">public</span>
        </span>
      ),
    },

    // ---- Surveys ----
    {
      id: "sv-1",
      category: "surveys",
      action: "created",
      actor: ACTORS.maya,
      date: d(3, 13, 0),
      entityName: "Coastal Use Survey 2026",
      description: (
        <span>
          created survey with <span className="font-medium">14 questions</span>
        </span>
      ),
    },
    {
      id: "sv-2",
      category: "surveys",
      action: "published",
      actor: ACTORS.maya,
      date: d(2, 9, 0),
      entityName: "Coastal Use Survey 2026",
      description: <span>published survey — now accepting responses</span>,
    },
    {
      id: "sv-3",
      category: "surveys",
      action: "updated",
      actor: ACTORS.maya,
      date: d(2, 16, 0),
      entityName: "Coastal Use Survey 2026",
      description: (
        <span>
          added question{" "}
          <span className="font-medium">
            "How often do you visit the coast?"
          </span>
        </span>
      ),
    },
    {
      id: "sv-4",
      category: "surveys",
      action: "disabled",
      actor: ACTORS.chad,
      date: d(13, 15, 0),
      entityName: "Initial Stakeholder Assessment",
      description: <span>closed survey — no longer accepting responses</span>,
    },
    {
      id: "sv-5",
      category: "surveys",
      action: "access_changed",
      actor: ACTORS.alex,
      date: d(4, 11, 0),
      entityName: "Coastal Use Survey 2026",
      description: (
        <span>
          restricted to{" "}
          <span className="font-medium">
            Marine Biologists Working Group
          </span>
        </span>
      ),
    },
    {
      id: "sv-6",
      category: "surveys",
      action: "downloaded",
      actor: ACTORS.alex,
      date: d(1, 15, 30),
      entityName: "Coastal Use Survey 2026",
      description: (
        <span>
          downloaded survey results —{" "}
          <span className="font-medium">247 responses</span> as CSV
        </span>
      ),
    },
    {
      id: "sv-7",
      category: "surveys",
      action: "downloaded",
      actor: ACTORS.chad,
      date: d(6, 10, 15),
      entityName: "Initial Stakeholder Assessment",
      description: (
        <span>
          downloaded survey results —{" "}
          <span className="font-medium">89 responses</span> as CSV
        </span>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? "s" : ""} ago`;
  }
  return date.toLocaleDateString();
}

function formatDateGroup(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  if (diffDays < 14) return "Last week";
  if (diffDays < 30) return "This month";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border px-4 py-3 flex items-center gap-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-semibold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: ProjectEvent }) {
  const { icon: ActionIcon, color: actionColor } = ACTION_ICONS[event.action];
  const catMeta = CATEGORY_META[event.category];

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
      <div
        className={`flex h-8 w-8 flex-none items-center justify-center rounded-full mt-0.5 ${actionColor}`}
      >
        <ActionIcon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-500 leading-snug">
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 flex-none">
              <span className="h-4 w-4 flex-none">
                <ProfilePhoto
                  fullname={event.actor.fullname}
                  email={event.actor.email}
                  canonicalEmail={event.actor.email}
                  picture={event.actor.picture}
                />
              </span>
              <span className="font-semibold text-gray-900">
                {event.actor.fullname}
              </span>
            </span>
            <span className="font-medium text-gray-700">
              {event.entityName}
            </span>
            {" \u2014 "}
            {event.description}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Tooltip>
            <TooltipTrigger>
              <time
                dateTime={event.date.toISOString()}
                className="text-xs text-gray-400 cursor-help"
              >
                {formatRelativeDate(event.date)}
              </time>
            </TooltipTrigger>
            <TooltipContent>
              {event.date.toLocaleString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </TooltipContent>
          </Tooltip>
          <span
            className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${catMeta.color}`}
          >
            <catMeta.icon className="w-3 h-3" />
            {catMeta.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

export default function ProjectChangeLog() {
  const allEvents = useMemo(() => buildProjectEvents(), []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<
    Set<EventCategory>
  >(new Set());
  const [selectedActions, setSelectedActions] = useState<Set<EventAction>>(
    new Set()
  );
  const [selectedEditor, setSelectedEditor] = useState<string>("all");
  const [showActionFilters, setShowActionFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const editors = useMemo(() => {
    const map = new Map<number, ActorProfile>();
    for (const evt of allEvents) {
      if (!map.has(evt.actor.userId)) {
        map.set(evt.actor.userId, evt.actor);
      }
    }
    return Array.from(map.values());
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    let events = [...allEvents].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter(
        (e) =>
          e.entityName.toLowerCase().includes(q) ||
          e.actor.fullname.toLowerCase().includes(q)
      );
    }
    if (selectedCategories.size > 0) {
      events = events.filter((e) => selectedCategories.has(e.category));
    }
    if (selectedActions.size > 0) {
      events = events.filter((e) => selectedActions.has(e.action));
    }
    if (selectedEditor !== "all") {
      const editorId = parseInt(selectedEditor, 10);
      events = events.filter((e) => e.actor.userId === editorId);
    }
    return events;
  }, [allEvents, searchQuery, selectedCategories, selectedActions, selectedEditor]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategories.size > 0 ||
    selectedActions.size > 0 ||
    selectedEditor !== "all";

  const toggleCategory = (cat: EventCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  };

  const toggleAction = (action: EventAction) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategories(new Set());
    setSelectedActions(new Set());
    setSelectedEditor("all");
    setVisibleCount(PAGE_SIZE);
  };

  // Group events by date for section headers
  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: ProjectEvent[] }[] = [];
    let currentLabel = "";
    for (const evt of visibleEvents) {
      const label = formatDateGroup(evt.date);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, events: [evt] });
      } else {
        groups[groups.length - 1].events.push(evt);
      }
    }
    return groups;
  }, [visibleEvents]);

  // Summary stats
  const stats = useMemo(() => {
    const last30 = allEvents.filter(
      (e) =>
        e.date.getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    );
    const categoryCounts = new Map<EventCategory, number>();
    for (const e of last30) {
      categoryCounts.set(e.category, (categoryCounts.get(e.category) || 0) + 1);
    }
    return {
      total: last30.length,
      categoryCounts,
      uniqueEditors: new Set(last30.map((e) => e.actor.userId)).size,
    };
  }, [allEvents]);

  const UNIQUE_ACTIONS = useMemo(() => {
    const set = new Set<EventAction>();
    for (const e of allEvents) set.add(e.action);
    return Array.from(set).sort();
  }, [allEvents]);

  const ACTION_LABELS: Record<string, string> = {
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    published: "Published",
    access_changed: "Access changed",
    invited: "Invited",
    removed: "Removed",
    approved: "Approved",
    archived: "Archived",
    restored: "Restored",
    configured: "Configured",
    enabled: "Enabled",
    disabled: "Disabled",
    renamed: "Renamed",
    moved: "Moved",
    locked: "Locked",
    unlocked: "Unlocked",
    downloaded: "Downloaded",
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Change Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            A complete record of administrative actions across the project.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Events (30 days)"
            value={stats.total}
            icon={DocumentTextIcon}
            color="text-blue-600 bg-blue-50"
          />
          <StatCard
            label="Active editors"
            value={stats.uniqueEditors}
            icon={UserAddIcon}
            color="text-emerald-600 bg-emerald-50"
          />
          <StatCard
            label="Data layer changes"
            value={stats.categoryCounts.get("data_layers") || 0}
            icon={EyeIcon}
            color="text-indigo-600 bg-indigo-50"
          />
          <StatCard
            label="User & group changes"
            value={stats.categoryCounts.get("users_groups") || 0}
            icon={UserAddIcon}
            color="text-amber-600 bg-amber-50"
          />
        </div>

        {/* Filters */}
        <div className="bg-white border rounded-lg p-4 mb-6 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Search by name, entity, or editor..."
              className="w-full pl-9 pr-8 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setVisibleCount(PAGE_SIZE);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <XIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Category chips + editor dropdown */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Area
            </span>
            {(Object.keys(CATEGORY_META) as EventCategory[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const active = selectedCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <meta.icon className="w-3 h-3" />
                  {meta.label}
                </button>
              );
            })}

            <div className="h-4 w-px bg-gray-200" />

            <select
              value={selectedEditor}
              onChange={(e) => {
                setSelectedEditor(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="text-xs border rounded-md px-2.5 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All editors</option>
              {editors.map((editor) => (
                <option key={editor.userId} value={editor.userId.toString()}>
                  {editor.fullname}
                </option>
              ))}
            </select>
          </div>

          {/* Expandable action filters */}
          <div>
            <button
              onClick={() => setShowActionFilters(!showActionFilters)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {showActionFilters ? (
                <ChevronUpIcon className="w-3 h-3" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" />
              )}
              Action type filters
              {selectedActions.size > 0 && (
                <span className="bg-gray-800 text-white text-xs px-1.5 rounded-full">
                  {selectedActions.size}
                </span>
              )}
            </button>
            {showActionFilters && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {UNIQUE_ACTIONS.map((action) => {
                  const active = selectedActions.has(action);
                  const { icon: AIcon } = ACTION_ICONS[action];
                  return (
                    <button
                      key={action}
                      onClick={() => toggleAction(action)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        active
                          ? "bg-gray-800 text-white border-gray-800"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <AIcon className="w-3 h-3" />
                      {ACTION_LABELS[action] || action}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active filter summary */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-1 border-t">
              <span className="text-xs text-gray-500">
                {filteredEvents.length === allEvents.length
                  ? `${filteredEvents.length} events`
                  : `Showing ${filteredEvents.length} of ${allEvents.length} events`}
              </span>
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Event list */}
        <div className="bg-white border rounded-lg overflow-hidden">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <FilterIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No events match your filters.
            </div>
          ) : (
            <>
              {groupedEvents.map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 bg-gray-50 border-b border-t first:border-t-0 px-4 py-1.5">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {group.label}
                    </span>
                  </div>
                  <div className="divide-y">
                    {group.events.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="text-center py-4 border-t">
                  <button
                    onClick={() =>
                      setVisibleCount((prev) => prev + PAGE_SIZE)
                    }
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Show more ({filteredEvents.length - visibleCount} remaining)
                  </button>
                </div>
              )}
              {!hasMore && filteredEvents.length > PAGE_SIZE && (
                <div className="text-center py-3 border-t">
                  <span className="text-xs text-gray-400">
                    Showing all {filteredEvents.length} events
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
