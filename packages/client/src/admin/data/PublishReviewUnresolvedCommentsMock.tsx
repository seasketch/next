/* eslint-disable i18next/no-literal-string */
import { useState, useMemo, useRef, useEffect } from "react";
import { CheckIcon } from "@heroicons/react/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import ProfilePhoto from "../users/ProfilePhoto";
import { MOCK_PROFILES, ActorProfile } from "./AuditEventTimeline";
import { getMockLayerCommentBody } from "./TableOfContentsItemEditor/LayerCommentThreadMock";

function formatThreadTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

type SeedReply = { id: string; author: ActorProfile; body: string; at: Date };

type ThreadDef = {
  id: string;
  layerTitle: string;
  /** Full first message (optionally starts with @mention for highlight) */
  initialBody: string;
  mentionPrefix?: string;
  startedAt: Date;
  seedReplies: SeedReply[];
};

function makeSeed(
  id: string,
  author: ActorProfile,
  body: string,
  hoursAgo: number
): SeedReply {
  const at = new Date();
  at.setHours(at.getHours() - hoursAgo);
  return { id, author, body, at };
}

const FIJI_LAYER_TITLE = "Territorial Sea: Fiji";

const MOCK_THREADS: ThreadDef[] = [
  {
    id: "fiji",
    layerTitle: FIJI_LAYER_TITLE,
    initialBody: getMockLayerCommentBody(FIJI_LAYER_TITLE),
    mentionPrefix: "@NickAlcaraz",
    startedAt: (() => {
      const d = new Date();
      d.setHours(13, 54, 0, 0);
      return d;
    })(),
    seedReplies: [
      makeSeed(
        "r1",
        MOCK_PROFILES.nick,
        `Thanks — I compared it to ${FIJI_LAYER_TITLE} original. The February publish looks right; go ahead and retire the old layer when you’re ready.`,
        1
      ),
    ],
  },
  {
    id: "seamounts",
    layerTitle: "Seamounts",
    initialBody:
      "Needs work on the cartography — contour labels overlap at 1:500k and the halos clip on export.",
    startedAt: (() => {
      const d = new Date();
      d.setHours(10, 20, 0, 0);
      return d;
    })(),
    seedReplies: [
      makeSeed(
        "r2",
        MOCK_PROFILES.sammi,
        "I can bump text-minzoom and widen halos in the style — will push a draft today.",
        3
      ),
    ],
  },
  {
    id: "triple",
    layerTitle: "Triple Benefit Ranking",
    initialBody:
      "Following up with Will on source so I can complete the metadata — waiting on the official data dictionary link.",
    startedAt: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(16, 5, 0, 0);
      return d;
    })(),
    seedReplies: [],
  },
  {
    id: "fish",
    layerTitle: "Fish Density by Trophic Group",
    initialBody:
      "Needs sign off by @NickAlcaraz before we publish this alongside the fisheries briefing.",
    mentionPrefix: "@NickAlcaraz",
    startedAt: (() => {
      const d = new Date();
      d.setHours(9, 0, 0, 0);
      return d;
    })(),
    seedReplies: [],
  },
];

function PublishThreadCard({ thread }: { thread: ThreadDef }) {
  const replyInputId = useMemo(
    () => `pub-reply-${thread.id}-${Math.random().toString(36).slice(2)}`,
    [thread.id]
  );
  const [resolved, setResolved] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replies, setReplies] = useState<
    { id: string; body: string; author: ActorProfile; at: Date }[]
  >(() =>
    thread.seedReplies.map((s) => ({
      id: s.id,
      body: s.body,
      author: s.author,
      at: s.at,
    }))
  );
  const [replyAreaActive, setReplyAreaActive] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const replyAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resolved) setReplyAreaActive(false);
  }, [resolved]);

  const handleReplyAreaBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && replyAreaRef.current?.contains(next)) return;
    setReplyAreaActive(false);
  };

  const cancelReply = () => {
    setReplyDraft("");
    setReplyAreaActive(false);
    replyInputRef.current?.blur();
  };

  const submitReply = (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyDraft.trim();
    if (!text || resolved) return;
    setReplies((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        body: text,
        author: MOCK_PROFILES.nick,
        at: new Date(),
      },
    ]);
    setReplyDraft("");
    setReplyAreaActive(false);
    replyInputRef.current?.blur();
  };

  const canSubmitReply = replyDraft.trim().length > 0 && !resolved;

  const initialBodyDisplay = thread.mentionPrefix
    ? (() => {
        const p = thread.mentionPrefix;
        if (thread.initialBody.startsWith(p)) {
          return (
            <>
              <span className="text-blue-700 font-medium">{p}</span>
              {thread.initialBody.slice(p.length)}
            </>
          );
        }
        const idx = thread.initialBody.indexOf(p);
        if (idx >= 0) {
          return (
            <>
              {thread.initialBody.slice(0, idx)}
              <span className="text-blue-700 font-medium">{p}</span>
              {thread.initialBody.slice(idx + p.length)}
            </>
          );
        }
        return thread.initialBody;
      })()
    : thread.initialBody;

  return (
    <section className="rounded-lg border border-gray-200/90 bg-gray-50/60 overflow-hidden">
      <div className="border-b border-gray-200/80 bg-white/80 px-3 py-2">
        <h4 className="text-sm font-semibold text-gray-900">
          {thread.layerTitle}
        </h4>
      </div>

      {resolved && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50/80 border-b border-emerald-100/80 text-xs text-emerald-900">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckIcon className="h-3 w-3" aria-hidden />
          </span>
          <span className="font-medium">Resolved</span>
          <button
            type="button"
            className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-800"
            onClick={() => setResolved(false)}
          >
            Reopen
          </button>
        </div>
      )}

      <div className="p-3">
        <div className="flex gap-2.5">
          <div className="h-8 w-8 flex-shrink-0 rounded-full overflow-hidden ring-1 ring-black/5">
            <ProfilePhoto
              fullname={MOCK_PROFILES.chad.fullname}
              email={MOCK_PROFILES.chad.email}
              canonicalEmail={MOCK_PROFILES.chad.email}
              picture={MOCK_PROFILES.chad.picture}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 pt-0.5">
                <div className="font-semibold text-gray-900 text-sm leading-tight">
                  {MOCK_PROFILES.chad.fullname}
                </div>
                <time
                  dateTime={thread.startedAt.toISOString()}
                  className="text-xs text-gray-500"
                >
                  {formatThreadTime(thread.startedAt)} ·{" "}
                  {thread.startedAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
              <Tooltip.Provider>
                <Tooltip.Root delayDuration={200}>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      aria-label={
                        resolved
                          ? "Mark thread as unresolved"
                          : "Mark thread as resolved"
                      }
                      className={`flex-shrink-0 p-1 rounded-full transition-colors ${
                        resolved
                          ? "text-emerald-700 bg-emerald-50"
                          : "text-blue-600 hover:bg-gray-100"
                      }`}
                      onClick={() => setResolved((r) => !r)}
                    >
                      <CheckIcon className="h-4 w-4" aria-hidden />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="top"
                      align="center"
                      sideOffset={6}
                      className="z-[100] max-w-[15rem] rounded-md border border-gray-600 bg-gray-900 px-2.5 py-2 text-xs leading-snug text-gray-100 shadow-lg"
                    >
                      {resolved
                        ? "Reopen this thread if you need to continue the discussion."
                        : "Mark as resolved when this discussion is finished. You can reopen it anytime."}
                      <Tooltip.Arrow className="fill-gray-900 stroke-gray-600" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
            <p className="mt-1.5 text-sm text-gray-800 leading-snug whitespace-pre-wrap">
              {initialBodyDisplay}
            </p>
          </div>
        </div>

        {replies.length > 0 && (
          <ul className="mt-3 space-y-3 pl-10 border-l border-gray-200/80 ml-3">
            {replies.map((r) => (
              <li key={r.id} className="relative">
                <div className="flex gap-3 -ml-px">
                  <div className="h-7 w-7 flex-shrink-0 rounded-full overflow-hidden ring-1 ring-black/5">
                    <ProfilePhoto
                      fullname={r.author.fullname}
                      email={r.author.email}
                      canonicalEmail={r.author.email}
                      picture={r.author.picture}
                    />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {r.author.fullname}
                      </span>
                      <time
                        dateTime={r.at.toISOString()}
                        className="text-xs text-gray-500"
                      >
                        {r.at.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">
                      {r.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submitReply} className="mt-3">
          <div
            ref={replyAreaRef}
            onBlur={handleReplyAreaBlur}
            className="rounded-md"
          >
            <label htmlFor={replyInputId} className="sr-only">
              Reply to thread
            </label>
            <div
              className={`rounded-full bg-white px-3 py-1.5 border-2 transition-colors ${
                resolved
                  ? "border-gray-200/80 opacity-60"
                  : replyAreaActive
                  ? "border-blue-500"
                  : "border-gray-100"
              }`}
            >
              <input
                ref={replyInputRef}
                id={replyInputId}
                type="text"
                autoComplete="off"
                disabled={resolved}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                onFocus={() => {
                  if (!resolved) setReplyAreaActive(true);
                }}
                placeholder="Reply or add others with @"
                className="w-full min-h-0 appearance-none bg-transparent text-[13px] leading-normal text-gray-900 placeholder:text-gray-400 border-0 p-0 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 disabled:text-gray-400"
              />
            </div>
            {replyAreaActive && !resolved && (
              <div className="flex justify-end items-center gap-2.5 mt-2 pr-0.5">
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 py-0.5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={cancelReply}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitReply}
                  className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
                    canSubmitReply
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-200/90 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Reply
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

export default function PublishReviewUnresolvedCommentsMock() {
  return (
    <div className="space-y-4 max-h-[min(520px,58vh)] overflow-y-auto pr-1 -mr-1">
      {MOCK_THREADS.map((thread) => (
        <PublishThreadCard key={thread.id} thread={thread} />
      ))}
    </div>
  );
}
