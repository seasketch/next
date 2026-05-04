import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Node as PMNode } from "prosemirror-model";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { exampleSetup } from "prosemirror-example-setup";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { ParticipantListDetailsFragment } from "../../../generated/graphql";
import "prosemirror-view/style/prosemirror.css";
import { layerCommentSchema } from "./layerCommentSchema";
import { autolinkPlugin } from "./autolinkPlugin";
import { createMentionAtTriggerPlugin } from "./mentionAtTriggerPlugin";
import { isLayerCommentDocEmpty } from "./commentDocEmpty";

const submitShortcutKey = new PluginKey("layerCommentSubmitShortcut");

function emptyDoc(): PMNode {
  return layerCommentSchema.node("doc", null, [
    layerCommentSchema.nodes.paragraph.create(),
  ]);
}

function adminMatchesQuery(
  admin: ParticipantListDetailsFragment,
  q: string
): boolean {
  const s = q.trim().toLowerCase();
  if (!s) {
    return true;
  }
  const nick = admin.profile?.nickname?.toLowerCase() || "";
  const full = admin.profile?.fullname?.toLowerCase() || "";
  const email = admin.canonicalEmail?.toLowerCase() || "";
  return (
    nick.includes(s) ||
    full.includes(s) ||
    email.includes(s) ||
    String(admin.id).includes(s)
  );
}

export default function ResolvableLayerCommentEditor(props: {
  initialDoc?: Record<string, unknown> | null;
  onChange: (doc: Record<string, unknown>) => void;
  disabled?: boolean;
  /** Shown when the document is empty (mockup: light gray, inside pill). */
  placeholder?: string;
  admins: ParticipantListDetailsFragment[];
  minHeightClass?: string;
  /** ⌘↵ / Ctrl+↵ runs this when the document has content (e.g. send reply). */
  onSubmit?: () => void | Promise<void>;
}) {
  const { t } = useTranslation("admin:data");
  const placeholderLabel =
    props.placeholder ?? t("Reply or add others with @");

  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const mentionStartRef = useRef<number | null>(null);
  const onSubmitRef = useRef(props.onSubmit);
  const onChangeRef = useRef(props.onChange);
  onSubmitRef.current = props.onSubmit;
  onChangeRef.current = props.onChange;

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionPos, setMentionPos] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showPlaceholderOverlay, setShowPlaceholderOverlay] = useState(true);

  const dispatchChange = useCallback((state: EditorState) => {
    const json = state.doc.toJSON() as Record<string, unknown>;
    onChangeRef.current(json);
    setShowPlaceholderOverlay(isLayerCommentDocEmpty(json));
  }, []);

  const closeMention = useCallback(() => {
    setMentionOpen(false);
    setMentionPos(null);
    mentionStartRef.current = null;
    setMentionQuery("");
  }, []);

  /** Clicks on padded shell area must still hit the contenteditable (DOM height ≠ pill height). */
  const focusEditorUnlessClickedInsidePm = useCallback(
    (e: React.MouseEvent) => {
      const view = viewRef.current;
      if (!view || props.disabled) {
        return;
      }
      if (!view.dom.contains(e.target as Node)) {
        view.focus();
      }
    },
    [props.disabled]
  );

  const insertMention = useCallback(
    (admin: ParticipantListDetailsFragment) => {
      const view = viewRef.current;
      if (!view || mentionStartRef.current == null) {
        return;
      }
      const start = mentionStartRef.current;
      const end = view.state.selection.from;
      const label =
        admin.profile?.nickname ||
        admin.profile?.fullname ||
        admin.canonicalEmail ||
        String(admin.id);
      const mark = layerCommentSchema.marks.mention.create({
        userId: admin.id,
        label,
      });
      const textNode = layerCommentSchema.text("@" + label + " ", [mark]);
      const tr = view.state.tr.delete(start, end).insert(start, textNode);
      view.dispatch(tr);
      view.focus();
      closeMention();
    },
    [closeMention]
  );

  const onAtInserted = useCallback((view: EditorView, atPos: number) => {
    mentionStartRef.current = atPos;
    try {
      const coords = view.coordsAtPos(atPos + 1);
      setMentionPos({ left: coords.left, top: coords.bottom + 4 });
    } catch {
      const el = rootRef.current?.getBoundingClientRect();
      if (el) {
        setMentionPos({ left: el.left + 8, top: el.bottom + 4 });
      }
    }
    setMentionQuery("");
    setMentionOpen(true);
  }, []);

  const mentionPlugin = useMemo(
    () =>
      createMentionAtTriggerPlugin({
        onAtInserted,
      }),
    [onAtInserted]
  );

  const submitShortcutPlugin = useMemo(
    () =>
      new Plugin({
        key: submitShortcutKey,
        props: {
          handleDOMEvents: {
            keydown: (view, e) => {
              if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") {
                return false;
              }
              const fn = onSubmitRef.current;
              if (!fn) {
                return false;
              }
              const json = view.state.doc.toJSON() as Record<string, unknown>;
              if (isLayerCommentDocEmpty(json)) {
                return false;
              }
              e.preventDefault();
              void Promise.resolve(fn());
              return true;
            },
          },
        },
      }),
    []
  );

  const plugins = useMemo(
    () => [
      ...exampleSetup({ schema: layerCommentSchema, menuBar: false }),
      autolinkPlugin(layerCommentSchema),
      mentionPlugin,
      submitShortcutPlugin,
    ],
    [mentionPlugin, submitShortcutPlugin]
  );

  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) {
      return;
    }

    let docNode: PMNode;
    try {
      docNode = props.initialDoc
        ? PMNode.fromJSON(layerCommentSchema, props.initialDoc)
        : emptyDoc();
    } catch {
      docNode = emptyDoc();
    }

    setShowPlaceholderOverlay(isLayerCommentDocEmpty(docNode.toJSON()));

    const state = EditorState.create({
      schema: layerCommentSchema,
      plugins,
      doc: docNode,
    });

    const view = new EditorView(rootEl, {
      state,
      attributes: {
        // eslint-disable-next-line i18next/no-literal-string
        spellcheck: "false",
      },
      editable: () => !props.disabled,
      dispatchTransaction(tr) {
        const next = view.state.apply(tr);
        view.updateState(next);
        dispatchChange(next);

        const start = mentionStartRef.current;
        if (start != null) {
          const sel = next.selection.from;
          if (sel < start || next.doc.nodeSize < start + 2) {
            closeMention();
            return;
          }
          const atChar = next.doc.textBetween(start, start + 1, "", "");
          if (atChar !== "@") {
            closeMention();
            return;
          }
          const q = next.doc.textBetween(start + 1, sel, "\n", "\0");
          setMentionQuery(q);
        }
      },
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = undefined;
    };
    // Recreate only when this component instance mounts (parents reset via React key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.setProps({
        editable: () => !props.disabled,
      });
    }
  }, [props.disabled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mentionOpen) {
        closeMention();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mentionOpen, closeMention]);

  const filteredAdmins = useMemo(() => {
    const list = props.admins.filter((a) => adminMatchesQuery(a, mentionQuery));
    list.sort((a, b) => {
      const na =
        (a.profile?.fullname ||
          a.profile?.nickname ||
          a.canonicalEmail ||
          "").toLowerCase();
      const nb =
        (b.profile?.fullname ||
          b.profile?.nickname ||
          b.canonicalEmail ||
          "").toLowerCase();
      return na.localeCompare(nb);
    });
    return list;
  }, [props.admins, mentionQuery]);

  /** Keep @ picker aligned while the sidebar scrolls or the caret moves. */
  useLayoutEffect(() => {
    if (!mentionOpen) {
      return;
    }
    const updatePos = () => {
      const view = viewRef.current;
      if (!view || mentionStartRef.current == null) {
        return;
      }
      const from = view.state.selection.from;
      try {
        const coords = view.coordsAtPos(from);
        const left = Math.min(
          coords.left,
          typeof window !== "undefined"
            ? window.innerWidth - 296
            : coords.left
        );
        setMentionPos({
          left: Math.max(8, left),
          top: coords.bottom + 4,
        });
      } catch {
        const pill = rootRef.current?.closest(".layer-comment-pill");
        const rect = pill?.getBoundingClientRect();
        if (rect) {
          setMentionPos({ left: rect.left + 12, top: rect.bottom + 4 });
        }
      }
    };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [mentionOpen, mentionQuery]);

  const shellMinH = props.minHeightClass || "min-h-[3.25rem]";

  return (
    <div
      title={props.onSubmit ? t("Press ⌘↵ or Ctrl+↵ to send") : undefined}
    >
      <div className="relative w-full">
        <div
          className={clsx(
            "layer-comment-pill relative flex w-full flex-col rounded-full border border-gray-200 bg-white px-5 py-3",
            shellMinH,
            "shadow-none ring-0 transition-[box-shadow,border-color]",
            "focus-within:border-gray-300 focus-within:shadow-[inset_0_0_0_1px_rgb(209_213_219)]",
            "[&_.ProseMirror_span.mention]:font-medium [&_.ProseMirror_span.mention]:text-primary-600"
          )}
          onMouseDown={focusEditorUnlessClickedInsidePm}
        >
          {showPlaceholderOverlay ? (
            <div
              className="pointer-events-none absolute left-5 top-1/2 z-0 max-w-[calc(100%-2.5rem)] -translate-y-1/2 text-sm text-gray-400"
              aria-hidden
            >
              {placeholderLabel}
            </div>
          ) : null}
          <div
            ref={rootRef}
            className={clsx(
              // Match FormElement / forum editors: ProseMirrorBody resets contenteditable chrome (index.css).
              "ProseMirrorBody input relative z-[1] flex min-h-0 flex-1 flex-col",
              "w-full min-w-0 text-sm leading-relaxed text-gray-900"
            )}
          />
        </div>
      </div>
      {mentionOpen &&
        mentionPos &&
        createPortal(
          <div
            className="fixed z-[200] max-h-56 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
            style={{
              left: mentionPos.left,
              top: mentionPos.top,
            }}
            role="listbox"
          >
            {filteredAdmins.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500">
                {t("No matching admins.")}
              </p>
            ) : (
              filteredAdmins.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(a);
                  }}
                >
                  <span className="font-medium text-gray-900">
                    {a.profile?.fullname ||
                      a.profile?.nickname ||
                      a.canonicalEmail}
                  </span>
                  {a.profile?.nickname ? (
                    <span className="text-xs text-gray-500">
                      @{a.profile.nickname}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
