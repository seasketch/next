/* eslint-disable i18next/no-literal-string */
import { useState, useMemo, useRef, useEffect } from "react";
import { CheckIcon, DotsVerticalIcon } from "@heroicons/react/outline";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import ProfilePhoto from "../../users/ProfilePhoto";
import { MOCK_PROFILES, ActorProfile } from "../AuditEventTimeline";

/**
 * Shared with layer History / publish-review mocks — same narrative as the comment thread preview.
 * The “original” layer name uses the current layer title so the copy matches whichever layer is open.
 */
export function getMockLayerCommentBody(layerTitle: string): string {
  const nameWithOriginal = `${layerTitle} original`.replace(/"/g, "'");
  return `@NickAlcaraz can you review this layer, and let me know if I can use this as a replacement for the original layer named "${nameWithOriginal}"? It's an updated version published in February. If so, I can delete the original.`;
}

function formatThreadTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Static mock UI for layer comment threads (Google Docs–style). Not wired to the backend.
 */
export default function LayerCommentThreadMock({
  layerTitle,
}: {
  layerTitle: string;
}) {
  const body = useMemo(
    () => getMockLayerCommentBody(layerTitle),
    [layerTitle]
  );
  const replyInputId = useMemo(
    () => `layer-comment-reply-${Math.random().toString(36).slice(2)}`,
    []
  );
  const [resolved, setResolved] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replies, setReplies] = useState<
    { id: string; body: string; author: ActorProfile; at: Date }[]
  >([]);
  const [replyAreaActive, setReplyAreaActive] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const replyAreaRef = useRef<HTMLDivElement>(null);

  const threadStartedAt = useMemo(() => {
    const d = new Date();
    d.setHours(13, 54, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    if (resolved) {
      setReplyAreaActive(false);
    }
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

  return (
    <div className="mt-8">
      <div className="border-t border-gray-200 pt-5 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Comments
        </h3>
        <p className="text-xs text-gray-500 mt-1 leading-snug max-w-md">
          Add comments to identify changes or review from other admins. Mark as
          resolved to clear them when complete.
        </p>
      </div>

      <div
        className={`rounded-lg border border-gray-200/90 bg-gray-50/60 overflow-hidden transition-opacity ${
          resolved ? "opacity-95" : ""
        }`}
      >
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

        <div className="p-2.5 sm:p-3">
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
                    dateTime={threadStartedAt.toISOString()}
                    className="text-xs text-gray-500"
                  >
                    {formatThreadTime(threadStartedAt)} Today
                  </time>
                </div>
                <div
                  className="flex items-center flex-shrink-0 rounded-full border border-gray-200/90 bg-white/90 p-0.5 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                  role="toolbar"
                  aria-label="Comment actions"
                >
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
                          className={`p-1 rounded-full transition-colors ${
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
                          className="z-[60] max-w-[15rem] rounded-md border border-gray-600 bg-gray-900 px-2.5 py-2 text-xs leading-snug text-gray-100 shadow-lg"
                        >
                          {resolved
                            ? "Reopen this thread if you need to continue the discussion."
                            : "Mark as resolved"}
                          <Tooltip.Arrow className="fill-gray-900 stroke-gray-600" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="p-1 rounded-full text-gray-500 hover:bg-gray-100"
                        aria-label="More options"
                      >
                        <DotsVerticalIcon className="h-4 w-4" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="min-w-[10rem] rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg z-50"
                        sideOffset={4}
                        align="end"
                      >
                        <DropdownMenu.Item
                          className="px-3 py-2 outline-none cursor-pointer hover:bg-gray-50"
                          onSelect={() => {}}
                        >
                          Link to this comment
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="px-3 py-2 outline-none cursor-pointer hover:bg-gray-50 text-red-600"
                          onSelect={() => {}}
                        >
                          Delete thread
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>
              <p className="mt-1.5 text-sm text-gray-800 leading-snug whitespace-pre-wrap">
                <span className="text-blue-700 font-medium">@NickAlcaraz</span>
                {body.slice("@NickAlcaraz".length)}
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
                  className="w-full min-h-0 appearance-none bg-transparent text-[13px] leading-normal text-gray-900 placeholder:text-gray-400 border-0 p-0 shadow-none outline-none ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus-visible:outline-none disabled:text-gray-400"
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
      </div>
    </div>
  );
}
