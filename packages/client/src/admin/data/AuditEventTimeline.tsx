/* eslint-disable i18next/no-literal-string */
import React from "react";
import {
  PencilIcon,
  ShareIcon,
  PlusIcon,
  ShieldCheckIcon,
  MinusIcon,
  ExternalLinkIcon,
  ChatAlt2Icon,
  CheckCircleIcon,
} from "@heroicons/react/outline";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/Tooltip";
import ProfilePhoto from "../users/ProfilePhoto";

export interface ActorProfile {
  fullname: string;
  email: string;
  picture: string;
  nickname: string;
  affiliations: string;
  userId: number;
}

export type AuditEventType =
  | "title_change"
  | "publish"
  | "metadata_update"
  | "layer_created"
  | "layer_removed"
  | "acl_change"
  | "cartography_update"
  | "comment_added"
  | "comment_resolved";

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  actor: ActorProfile;
  date: Date;
  layerName?: string;
  description: React.ReactNode;
  /** Short text summary for use in tooltips (e.g. "Mangroves_FWC_2016 → Mangroves 2016") */
  shortSummary?: string;
}

export const EVENT_ICONS: Record<
  AuditEventType,
  { icon: React.ElementType; color: string }
> = {
  title_change: { icon: PencilIcon, color: "text-gray-600 bg-gray-100" },
  publish: { icon: ShareIcon, color: "text-blue-600 bg-blue-50" },
  metadata_update: { icon: PencilIcon, color: "text-gray-600 bg-gray-100" },
  layer_created: { icon: PlusIcon, color: "text-green-600 bg-green-50" },
  layer_removed: { icon: MinusIcon, color: "text-red-600 bg-red-50" },
  acl_change: { icon: ShieldCheckIcon, color: "text-red-600 bg-red-50" },
  cartography_update: {
    icon: PencilIcon,
    color: "text-gray-600 bg-gray-100",
  },
  comment_added: {
    icon: ChatAlt2Icon,
    color: "text-blue-600 bg-blue-50",
  },
  comment_resolved: {
    icon: CheckCircleIcon,
    color: "text-emerald-700 bg-emerald-50",
  },
};

export const MOCK_PROFILES: Record<string, ActorProfile> = {
  chad: {
    fullname: "Chad Burt",
    email: "chad@underbluewaters.net",
    picture:
      "http://www.gravatar.com/avatar/b0a4285bfc440a2efad5036bb95d68a9?d=retro&r=g&s=200",
    nickname: "chad",
    affiliations: "SeaSketch",
    userId: 1,
  },
  sammi: {
    fullname: "Sammi",
    email: "sammi@example.com",
    picture:
      "https://d2f6qufqioogvc.cloudfront.net/671be4c8-b594-4332-afb1-54e5e912ed65.jpg",
    nickname: "sammi",
    affiliations: "",
    userId: 2,
  },
  nick: {
    fullname: "Nick Alcaraz",
    email: "nick@example.com",
    picture:
      "https://ui-avatars.com/api/?name=Nick+Alcaraz&background=3b82f6&color=fff&size=200",
    nickname: "nick",
    affiliations: "",
    userId: 3,
  },
};

export function formatRelativeDate(date: Date): string {
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

export function daysAgo(n: number, hour?: number, minute?: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(
    hour ?? 9 + Math.floor(Math.random() * 8),
    minute ?? Math.floor(Math.random() * 60),
    0,
    0
  );
  return d;
}

export function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setTime(d.getTime() - hours * 60 * 60 * 1000);
  return d;
}

export function CompareButton() {
  return (
    <button className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded-full transition-colors">
      compare
      <ExternalLinkIcon className="w-3 h-3" />
    </button>
  );
}

export function EventTimelineItem({
  event,
  onLayerClick,
}: {
  event: AuditEvent;
  onLayerClick?: (layerName: string) => void;
}) {
  const { icon: Icon, color } = EVENT_ICONS[event.type];
  return (
    <li className="relative flex gap-2.5">
      <div
        className={`relative z-10 flex h-7 w-7 flex-none items-center justify-center rounded-full ring-2 ring-white ${color}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 pt-px">
        <div className="text-sm text-gray-500 leading-snug">
          <span className="flex items-center gap-1.5 flex-wrap">
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
            {event.layerName && (
              <span>
                {onLayerClick ? (
                  <button
                    onClick={() => onLayerClick(event.layerName!)}
                    className="font-medium text-gray-700 hover:underline"
                  >
                    {event.layerName}
                  </button>
                ) : (
                  <span className="font-medium text-gray-700">
                    {event.layerName}
                  </span>
                )}
                {" \u2014 "}
              </span>
            )}
            {event.description}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger>
            <time
              dateTime={event.date.toISOString()}
              className="text-xs text-gray-400 mt-1 block cursor-help"
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
      </div>
    </li>
  );
}

export function EventTimeline({
  events,
  maxHeight,
  onLayerClick,
}: {
  events: AuditEvent[];
  maxHeight?: number;
  onLayerClick?: (layerName: string) => void;
}) {
  return (
    <div
      className="relative overflow-y-auto"
      style={maxHeight ? { maxHeight } : undefined}
    >
      <div
        className="absolute left-[13px] top-5 bottom-5 w-px bg-gray-100"
        aria-hidden="true"
      />
      <ul className="space-y-5">
        {events.map((event) => (
          <EventTimelineItem key={event.id} event={event} onLayerClick={onLayerClick} />
        ))}
      </ul>
    </div>
  );
}
