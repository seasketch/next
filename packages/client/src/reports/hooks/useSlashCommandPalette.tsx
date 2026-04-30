/* eslint-disable i18next/no-literal-string */
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Schema } from "prosemirror-model";
import { setBlockType } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { VariableSizeList } from "react-window";
import {
  CommandPaletteGroup,
  CommandPaletteItem,
} from "../commandPalette/types";
import Spinner from "../../components/Spinner";
import {
  uploadImageWithPlaceholder,
  insertBlockImage,
} from "../widgets/prosemirror/imageDropPlugin";
import {
  flattenPaletteChildren as flattenChildren,
  SlashCommandPaletteVirtualList,
  SlashCommandPaletteSimpleList,
  VIRTUAL_LIST_COMMAND_THRESHOLD,
  type CommandPalettePreviewItem,
  type SubmenuNav,
  type PaletteRowSharedProps,
  type SlashCommandPaletteVirtualItemData,
} from "./SlashCommandPaletteList";

type TriggerSource = "slash" | "manual";

type TriggerState = {
  from: number;
  to: number;
  query: string;
  coords: { left: number; right: number; top: number; bottom: number };
  source: TriggerSource;
};

type UseSlashCommandPaletteOptions = {
  viewRef: RefObject<EditorView | undefined>;
  state?: EditorState;
  schema: Schema;
  groups?: CommandPaletteGroup[];
  /** When provided, "Upload Image" and "Image by URL" commands are added to the Basic Blocks group. */
  imageUploadFile?: (file: File) => Promise<string>;
  requestedPreviewKey?: string | null;
  onPreviewKeyApplied?: () => void;
};

function ImageByUrlPopover({
  onInsert,
  onCancel,
}: {
  onInsert: (src: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      setError("URL must start with http:// or https://");
      return;
    }
    setError(null);
    onInsert(trimmed);
  };

  return (
    <div className="w-72 rounded-md border border-gray-200 bg-white shadow-xl p-3">
      <div className="text-sm font-semibold text-gray-800 mb-2">
        Image by URL
      </div>
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="https://example.com/image.png"
      />
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          className="text-sm px-2 py-1 rounded text-gray-600 hover:bg-gray-100"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={handleSubmit}
        >
          Insert
        </button>
      </div>
    </div>
  );
}

function buildBaseGroups(
  schema: Schema,
  imageUploadFile?: (file: File) => Promise<string>,
  viewRef?: RefObject<EditorView | undefined>
): CommandPaletteGroup[] {
  const formatting: CommandPalettePreviewItem[] = [];
  const blocks: CommandPalettePreviewItem[] = [];

  // if (schema.marks.strong) {
  //   formatting.push({
  //     id: "strong",
  //     label: "Bold",
  //     keywords: ["strong"],
  //     run: (state, dispatch) => {
  //       toggleMark(schema.marks.strong)(state, dispatch);
  //     },
  //     isEnabled: (state) => !!toggleMark(schema.marks.strong)(state),
  //   });
  // }

  // if (schema.marks.em) {
  //   formatting.push({
  //     id: "em",
  //     label: "Italic",
  //     keywords: ["emphasis", "italics"],
  //     run: (state, dispatch) => {
  //       toggleMark(schema.marks.em)(state, dispatch);
  //     },
  //     isEnabled: (state) => !!toggleMark(schema.marks.em)(state),
  //   });
  // }

  // if (schema.nodes.paragraph) {
  //   blocks.push({
  //     id: "paragraph",
  //     label: "Paragraph",
  //     description: "Normal text",
  //     keywords: ["text"],
  //     run: (state, dispatch) => {
  //       setBlockType(schema.nodes.paragraph)(state, dispatch);
  //     },
  //     isEnabled: (state) => !!setBlockType(schema.nodes.paragraph)(state),
  //   });
  // }

  if (schema.nodes.heading) {
    const headingScreenshots: Record<number, string> = {
      2: "/slashCommands/h2.png",
      3: "/slashCommands/h3.png",
    };
    [2, 3].forEach((level) => {
      blocks.push({
        id: `heading-${level}`,
        label: `Heading ${level}`,
        description: level === 2 ? "Largest heading" : "Smaller heading",
        keywords: ["title", "heading"],
        screenshotSrc: headingScreenshots[level],
        run: (state, dispatch) => {
          setBlockType(schema.nodes.heading, { level })(state, dispatch);
        },
        isEnabled: (state) =>
          !!setBlockType(schema.nodes.heading, { level })(state),
      });
    });
  }

  // if (schema.nodes.h2) {
  //   blocks.push({
  //     id: "report-heading",
  //     label: "Section Heading",
  //     description: "Report section title",
  //     keywords: ["heading", "section"],
  //     run: (state, dispatch) => {
  //       setBlockType(schema.nodes.h2)(state, dispatch);
  //     },
  //     isEnabled: (state) => !!setBlockType(schema.nodes.h2)(state),
  //   });
  // }

  // if (schema.nodes.blockquote) {
  //   blocks.push({
  //     id: "blockquote",
  //     label: "Blockquote",
  //     description: "Emphasize a long quote",
  //     keywords: ["quote"],
  //     run: (state, dispatch) => {
  //       wrapIn(schema.nodes.blockquote)(state, dispatch);
  //     },
  //     isEnabled: (state) => !!wrapIn(schema.nodes.blockquote)(state),
  //   });
  // }

  if (schema.nodes.bullet_list && schema.nodes.list_item) {
    blocks.push({
      id: "bullet-list",
      label: "Bulleted list",
      description: "Start a bulleted list",
      keywords: ["list", "bullets"],
      screenshotSrc: "/slashCommands/list.png",
      run: (state, dispatch) => {
        wrapInList(schema.nodes.bullet_list)(state, dispatch);
      },
      isEnabled: (state) => !!wrapInList(schema.nodes.bullet_list)(state),
    });
  }

  if (schema.nodes.ordered_list && schema.nodes.list_item) {
    blocks.push({
      id: "ordered-list",
      label: "Numbered list",
      description: "Start a numbered list",
      keywords: ["list", "ordered", "numbers"],
      screenshotSrc: "/slashCommands/ordered-list.png",
      run: (state, dispatch) => {
        wrapInList(schema.nodes.ordered_list)(state, dispatch);
      },
      isEnabled: (state) => !!wrapInList(schema.nodes.ordered_list)(state),
    });
  }

  if (schema.nodes.details) {
    blocks.push({
      id: "collapsible-block",
      label: "Collapsible Block",
      description: "Accordion-style container with an editable heading.",
      screenshotSrc: "/slashCommands/collapsible-block.png",
      run: (state, dispatch, view) => {
        const { schema } = state;
        const detailsType = schema.nodes.details;
        const summaryType = schema.nodes.summary;
        const paragraphType = schema.nodes.paragraph;
        if (!detailsType || !summaryType || !paragraphType) return false;

        const summary = summaryType.create(null, schema.text("Learn more"));
        const paragraph =
          paragraphType.createAndFill() || paragraphType.create();
        const node = detailsType.create({ open: true }, [summary, paragraph]);
        if (dispatch) {
          const tr = state.tr.replaceSelectionWith(node).scrollIntoView();
          dispatch(tr);
        }
        return true;
      },
    });
  }

  if (schema.nodes.resultsParagraph) {
    blocks.push({
      id: "results-paragraph",
      label: "Results Paragraph",
      description: "Highlighted paragraph used to emphasize information.",
      keywords: ["results", "highlight", "box"],
      screenshotSrc: "/slashCommands/results-paragraph.png",
      run: (state, dispatch) => {
        const resultsParagraphType = schema.nodes.resultsParagraph;
        if (!resultsParagraphType) return false;
        setBlockType(resultsParagraphType)(state, dispatch);
        return true;
      },
      isEnabled: (state) =>
        !!setBlockType(schema.nodes.resultsParagraph)(state),
    });
  }

  // if (schema.nodes.horizontal_rule) {
  //   blocks.push({
  //     id: "horizontal-rule",
  //     label: "Divider",
  //     description: "Insert a horizontal divider",
  //     keywords: ["hr", "rule", "divider"],
  //     run: (state, dispatch) => {
  //       const hrNode = schema.nodes.horizontal_rule.create();
  //       const tr = state.tr.replaceSelectionWith(hrNode).scrollIntoView();
  //       dispatch(tr);
  //     },
  //     isEnabled: () => !!schema.nodes.horizontal_rule,
  //   });
  // }

  if (schema.nodes.image && imageUploadFile && viewRef) {
    blocks.push({
      id: "upload-image",
      label: "Upload Image",
      screenshotSrc: "/slashCommands/image.png",
      description: "Upload an image from your computer",
      keywords: ["image", "picture", "photo", "img", "upload"],
      run: (_state, _dispatch, view) => {
        if (!view) return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file || !view) return;
          uploadImageWithPlaceholder(view, file, imageUploadFile, schema);
        };
        input.click();
      },
    });
    blocks.push({
      id: "image-by-url",
      label: "Image by URL",
      screenshotSrc: "/slashCommands/image.png",
      description: "Embed an image from a URL",
      keywords: ["image", "picture", "photo", "img", "url", "link", "embed"],
      customPopoverContent: ({ closePopover, apply }) => {
        return (
          <ImageByUrlPopover
            onInsert={(src) => {
              apply({
                id: "image-by-url-insert",
                label: "Image by URL",
                run: (_state, _dispatch, view) => {
                  if (!view) return;
                  insertBlockImage(view, { src }, schema);
                },
              });
              closePopover();
            }}
            onCancel={closePopover}
          />
        );
      },
    });
  }

  const groups: CommandPaletteGroup[] = [];

  if (formatting.length) {
    groups.push({
      id: "formatting",
      label: "Formatting",
      items: formatting,
    });
  }

  if (blocks.length) {
    groups.push({
      id: "blocks",
      label: "Basic Blocks",
      items: blocks,
    });
  }

  return groups;
}

/**
 * When true, standard (non-submenu) items show their screenshot preview
 * popover on keyboard highlight, not just on mouse hover.
 * Set to false to revert to hover-only previews.
 */
const SHOW_PREVIEW_ON_KEYBOARD_FOCUS = true;

export function useSlashCommandPalette({
  viewRef,
  state,
  schema,
  groups = [],
  imageUploadFile,
  requestedPreviewKey,
  onPreviewKeyApplied,
}: UseSlashCommandPaletteOptions) {
  const baseGroups = useMemo(
    () => buildBaseGroups(schema, imageUploadFile, viewRef),
    [schema, imageUploadFile, viewRef]
  );
  const combinedGroups = useMemo(
    () => [...baseGroups, ...groups],
    [baseGroups, groups]
  );
  const [trigger, setTrigger] = useState<TriggerState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [activatedKey, setActivatedKey] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const paletteContainerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const virtualListRef =
    useRef<VariableSizeList<SlashCommandPaletteVirtualItemData>>(null);
  const hydratedKeysRef = useRef(new Set<string>());
  const [hydratedKeyVersion, setHydratedKeyVersion] = useState(0);
  const ensureRowHydrated = useCallback((refKey: string) => {
    if (!hydratedKeysRef.current.has(refKey)) {
      hydratedKeysRef.current.add(refKey);
      setHydratedKeyVersion((v) => v + 1);
    }
  }, []);
  const [submenuNav, setSubmenuNav] = useState<SubmenuNav>(null);

  const filtered = useMemo<{
    groups: CommandPaletteGroup[];
    flatItems: { item: CommandPalettePreviewItem; groupId: string }[];
  }>(() => {
    const currentState = viewRef.current?.state ?? state;
    const query = (trigger?.query || "").toLowerCase();
    const filteredGroups = combinedGroups
      .map((group) => {
        const items = group.items.filter((item) => {
          const enabled = currentState
            ? item.isEnabled
              ? item.isEnabled(currentState)
              : true
            : true;
          if (!enabled) {
            return false;
          }
          if (!query) {
            return true;
          }
          const haystack = `${item.label} ${(item.keywords || []).join(
            " "
          )}`.toLowerCase();
          return haystack.includes(query);
        });
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);

    const flatItems = filteredGroups.flatMap((group) =>
      group.items.map((item) => ({ item, groupId: group.id }))
    );

    return { groups: filteredGroups, flatItems };
  }, [combinedGroups, trigger?.query, state, viewRef]);

  useEffect(() => {
    setActiveIndex(0);
    setSubmenuNav(null);
  }, [trigger?.query, filtered.flatItems.length]);

  useEffect(() => {
    if (!submenuNav) return;
    const entry = filtered.flatItems.find(
      (e) => `${e.groupId}:${e.item.id}` === submenuNav.parentKey
    );
    if (!entry) return;
    const item = entry.item as CommandPalettePreviewItem;
    const newChildren = flattenChildren(item);
    const hasFooter = !!item.popoverFooter;
    const oldIds = submenuNav.flatChildren.map((c) => c.id).join(",");
    const newIds = newChildren.map((c) => c.id).join(",");
    if (oldIds !== newIds || submenuNav.hasFooter !== hasFooter) {
      setSubmenuNav({
        parentKey: submenuNav.parentKey,
        flatChildren: newChildren,
        activeChildIndex: 0,
        hasFooter,
      });
    }
  }, [filtered.flatItems, submenuNav]);

  const updateTriggerFromSlash = useCallback(
    (currentState: EditorState, view: EditorView) => {
      const selection = currentState.selection;
      if (!selection || !selection.$from || !selection.empty) {
        if (trigger && trigger.source !== "manual") {
          setTrigger(null);
        }
        return;
      }

      const $from = selection.$from;
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 200),
        $from.parentOffset,
        undefined,
        "\ufffc"
      );
      const slashIndex = textBefore.lastIndexOf("/");
      const slashAllowed =
        slashIndex >= 0 &&
        (slashIndex === 0 || /\s/.test(textBefore[slashIndex - 1] || ""));

      if (slashAllowed) {
        const query = textBefore.slice(slashIndex + 1);
        const from = $from.start() + slashIndex;
        const to = $from.start() + textBefore.length;
        const coords = view.coordsAtPos(selection.from);

        setTrigger((prev) => {
          if (
            prev &&
            prev.source === "slash" &&
            prev.from === from &&
            prev.to === to &&
            prev.query === query &&
            prev.coords.left === coords.left &&
            prev.coords.right === coords.right &&
            prev.coords.top === coords.top &&
            prev.coords.bottom === coords.bottom
          ) {
            return prev;
          }
          return {
            from,
            to,
            query,
            coords: {
              left: coords.left,
              right: coords.right,
              top: coords.top,
              bottom: coords.bottom,
            },
            source: "slash",
          };
        });
        return;
      }

      if (trigger?.source === "manual") {
        const coords = view.coordsAtPos(selection.from);
        setTrigger((prev) =>
          prev
            ? {
                ...prev,
                from: selection.from,
                to: selection.from,
                coords: {
                  left: coords.left,
                  right: coords.right,
                  top: coords.top,
                  bottom: coords.bottom,
                },
              }
            : prev
        );
        return;
      }

      if (trigger) {
        setTrigger(null);
      }
    },
    [trigger]
  );

  useEffect(() => {
    if (!state || !viewRef.current) {
      return;
    }
    updateTriggerFromSlash(state, viewRef.current);
  }, [state, viewRef, updateTriggerFromSlash]);

  const openManualPalette = useCallback(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const selection = view.state.selection;
    const coords = view.coordsAtPos(selection.from);
    setTrigger({
      from: selection.from,
      to: selection.from,
      query: "",
      coords: {
        left: coords.left,
        right: coords.right,
        top: coords.top,
        bottom: coords.bottom,
      },
      source: "manual",
    });
    setActiveIndex(0);
  }, [viewRef]);

  const applyCommand = useCallback(
    (item?: CommandPaletteItem) => {
      const view = viewRef.current;
      if (!view || !item) {
        return;
      }
      if (!item.run) {
        return;
      }
      const currentTrigger = trigger;
      const size = view.state.doc.content.size;
      view.focus();

      if (currentTrigger) {
        const from = Math.max(0, Math.min(currentTrigger.from, size));
        const to = Math.max(from, Math.min(currentTrigger.to, size));
        if (to > from) {
          const tr = view.state.tr.delete(from, to);
          tr.setSelection(
            TextSelection.near(
              tr.doc.resolve(Math.min(from, tr.doc.content.size))
            )
          );
          view.dispatch(tr);
        }
      }

      const nextState = view.state;
      if (!item.isEnabled || item.isEnabled(nextState)) {
        item.run(nextState, view.dispatch, view);
      }

      setTrigger(null);
      setActiveIndex(0);
    },
    [trigger, viewRef]
  );

  const enterSubmenu = useCallback(
    (selected: CommandPalettePreviewItem, key: string) => {
      const children = flattenChildren(selected);
      const hasFooter = !!selected.popoverFooter;
      setPreviewKey(key);
      setActivatedKey(key);
      if (children.length || hasFooter) {
        setSubmenuNav({
          parentKey: key,
          flatChildren: children,
          activeChildIndex: 0,
          hasFooter,
        });
      }
    },
    []
  );

  const exitSubmenu = useCallback(() => {
    setSubmenuNav(null);
    setActivatedKey(null);
    setPreviewKey(null);
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (!trigger) {
        return;
      }

      // --- Submenu mode ---
      if (submenuNav) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSubmenuNav((prev) => {
            if (!prev) return prev;
            const max =
              prev.flatChildren.length - 1 + (prev.hasFooter ? 1 : 0);
            return {
              ...prev,
              activeChildIndex: Math.min(max, prev.activeChildIndex + 1),
            };
          });
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSubmenuNav((prev) =>
            prev
              ? {
                  ...prev,
                  activeChildIndex: Math.max(0, prev.activeChildIndex - 1),
                }
              : prev
          );
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const isFooterActive =
            submenuNav.hasFooter &&
            submenuNav.activeChildIndex >= submenuNav.flatChildren.length;
          if (isFooterActive) {
            const btn = footerRef.current?.querySelector("button");
            btn?.click();
          } else {
            const child =
              submenuNav.flatChildren[submenuNav.activeChildIndex];
            if (child) {
              applyCommand(child);
              setPreviewKey(null);
              setSubmenuNav(null);
            }
          }
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "Escape") {
          event.preventDefault();
          exitSubmenu();
          return;
        }
        // While in submenu, block other keys from reaching the editor
        // (except modifier-only presses)
        return;
      }

      // --- Main list mode ---
      if (event.key === "Escape") {
        setTrigger(null);
        return;
      }

      if (event.key === "ArrowDown") {
        if (!filtered.flatItems.length) {
          return;
        }
        event.preventDefault();
        setPreviewKey(null);
        setActivatedKey(null);
        setActiveIndex((index) =>
          Math.min(filtered.flatItems.length - 1, index + 1)
        );
        return;
      }

      if (event.key === "ArrowUp") {
        if (!filtered.flatItems.length) {
          return;
        }
        event.preventDefault();
        setPreviewKey(null);
        setActivatedKey(null);
        setActiveIndex((index) => Math.max(0, index - 1));
        return;
      }

      if (event.key === "ArrowRight") {
        if (!filtered.flatItems.length) {
          return;
        }
        const selected = filtered.flatItems[activeIndex]?.item as
          | CommandPalettePreviewItem
          | undefined;
        if (!selected) return;
        const key = `${filtered.flatItems[activeIndex]?.groupId}:${selected.id}`;
        const hasChildren =
          !!selected.children?.length ||
          !!selected.childGroups?.length ||
          !!selected.customPopoverContent;
        if (hasChildren) {
          event.preventDefault();
          enterSubmenu(selected, key);
        }
        return;
      }

      if (event.key === "Enter") {
        if (!filtered.flatItems.length) {
          return;
        }
        event.preventDefault();
        const selected = filtered.flatItems[activeIndex]?.item as
          | CommandPalettePreviewItem
          | undefined;
        const key = `${filtered.flatItems[activeIndex]?.groupId}:${selected?.id}`;
        const hasChildren =
          !!selected?.children?.length ||
          !!selected?.childGroups?.length ||
          !!selected?.customPopoverContent;
        if (hasChildren) {
          enterSubmenu(selected!, key);
        } else {
          applyCommand(selected);
        }
      }
    };

    // Use capture to ensure we intercept before ProseMirror keymaps handle Enter
    // which would otherwise insert a newline while the palette is open.
    view.dom.addEventListener("keydown", handler, { capture: true });
    return () =>
      view.dom.removeEventListener("keydown", handler, {
        capture: true,
      } as any);
  }, [
    activeIndex,
    applyCommand,
    enterSubmenu,
    exitSubmenu,
    filtered.flatItems,
    openManualPalette,
    submenuNav,
    trigger,
    viewRef,
  ]);

  useEffect(() => {
    if (!trigger || !filtered.flatItems.length) {
      setActiveIndex(0);
    } else if (activeIndex >= filtered.flatItems.length) {
      setActiveIndex(filtered.flatItems.length - 1);
    }
  }, [activeIndex, filtered.flatItems.length, trigger]);

  useEffect(() => {
    if (!trigger) {
      setPreviewKey(null);
      setActivatedKey(null);
      setSubmenuNav(null);
    }
  }, [trigger]);

  const lookup = useMemo(() => {
    const map = new Map<string, number>();
    filtered.flatItems.forEach((entry, index) => {
      map.set(`${entry.groupId}:${entry.item.id}`, index);
    });
    return map;
  }, [filtered.flatItems]);

  useEffect(() => {
    if (requestedPreviewKey) {
      const idx = lookup.get(requestedPreviewKey);
      if (idx !== undefined) {
        setActiveIndex(idx);
        setPreviewKey(requestedPreviewKey);
        onPreviewKeyApplied?.();
      }
    }
  }, [lookup, onPreviewKeyApplied, requestedPreviewKey]);

  useEffect(() => {
    if (!trigger || !filtered.flatItems.length) {
      return;
    }
    if (filtered.flatItems.length >= VIRTUAL_LIST_COMMAND_THRESHOLD) {
      return;
    }
    const entry = filtered.flatItems[activeIndex];
    if (!entry) {
      return;
    }
    const key = `${entry.groupId}:${entry.item.id}`;
    const el = itemRefs.current.get(key);
    if (el?.scrollIntoView) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, filtered.flatItems, trigger]);

  useEffect(() => {
    if (
      submenuNav?.hasFooter &&
      submenuNav.activeChildIndex >= submenuNav.flatChildren.length
    ) {
      footerRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [submenuNav]);

  useEffect(() => {
    if (!trigger) {
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const container = paletteContainerRef.current;
    const handler = (event: WheelEvent | TouchEvent) => {
      if (!container) {
        return;
      }
      const target = event.target as Node | null;
      if (target && container.contains(target)) {
        return;
      }
      event.preventDefault();
    };

    const opts: AddEventListenerOptions = { passive: false, capture: true };
    window.addEventListener("wheel", handler, opts);
    window.addEventListener("touchmove", handler, opts);

    return () => {
      window.removeEventListener("wheel", handler, opts);
      window.removeEventListener("touchmove", handler, opts);
    };
  }, [trigger]);

  const renderStatusIcon = useCallback(
    (status?: CommandPaletteItem["status"]) => {
      if (!status) return null;
      const normalized = status?.state?.toLowerCase();
      if (normalized === "processing" || normalized === "queued") {
        return <Spinner mini />;
      }
      return null;
    },
    []
  );

  const palettePosition = useMemo(() => {
    if (!trigger) {
      return null;
    }

    const margin = 8;
    const offset = 6;
    const paletteWidth = 288; // tailwind w-72

    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : null;
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : null;

    const availableBelow =
      viewportHeight != null
        ? viewportHeight - (trigger.coords.bottom + offset) - margin
        : null;
    const availableAbove =
      viewportHeight != null ? trigger.coords.top - offset - margin : null;

    const desiredHeight = 416;
    const shouldOpenUp =
      viewportHeight != null &&
      availableAbove != null &&
      availableBelow != null &&
      trigger.coords.bottom + offset + desiredHeight + margin >
        viewportHeight &&
      availableAbove > availableBelow;

    const availableHeight = shouldOpenUp ? availableAbove : availableBelow;
    const maxHeight = viewportHeight
      ? Math.max(120, Math.min(416, Math.max(0, availableHeight ?? 416)))
      : 416;

    const rawTop = shouldOpenUp
      ? trigger.coords.top - offset - maxHeight
      : trigger.coords.bottom + offset;
    const top = viewportHeight
      ? Math.max(margin, Math.min(rawTop, viewportHeight - maxHeight - margin))
      : rawTop;

    const rawLeft = trigger.coords.left;
    const left = viewportWidth
      ? Math.max(
          margin,
          Math.min(rawLeft, viewportWidth - paletteWidth - margin)
        )
      : rawLeft;

    return { left, top, maxHeight };
  }, [trigger]);

  useEffect(() => {
    if (!trigger) {
      hydratedKeysRef.current.clear();
      setHydratedKeyVersion((n) => n + 1);
    }
  }, [trigger]);

  const paletteRowShared: PaletteRowSharedProps = useMemo(
    () => ({
      viewRef,
      itemRefs,
      footerRef,
      submenuNav,
      previewKey,
      activatedKey,
      SHOW_PREVIEW_ON_KEYBOARD_FOCUS,
      applyCommand,
      enterSubmenu,
      setPreviewKey,
      setActivatedKey,
      setSubmenuNav,
      setActiveIndex,
      renderStatusIcon,
      ensureRowHydrated,
    }),
    [
      viewRef,
      submenuNav,
      previewKey,
      activatedKey,
      applyCommand,
      enterSubmenu,
      setActiveIndex,
      renderStatusIcon,
      ensureRowHydrated,
    ]
  );

  const useVirtualCommandList =
    filtered.flatItems.length >= VIRTUAL_LIST_COMMAND_THRESHOLD;

  const previewGroups = filtered.groups as {
    id: string;
    label: string;
    items: CommandPalettePreviewItem[];
  }[];

  const palette = trigger
    ? createPortal(
        <div
          className="fixed z-50"
          style={{
            left: palettePosition?.left ?? trigger.coords.left,
            top: palettePosition?.top ?? trigger.coords.bottom + 6,
          }}
          data-report-command-palette="true"
          ref={paletteContainerRef}
        >
          <div className="relative">
            {filtered.groups.length === 0 ? (
              <div className="w-72 rounded-md border border-gray-200 bg-white shadow-xl px-3 py-2 text-sm text-gray-500">
                No commands
              </div>
            ) : useVirtualCommandList ? (
              <SlashCommandPaletteVirtualList
                filteredGroups={previewGroups}
                flatItemsLength={filtered.flatItems.length}
                activeIndex={activeIndex}
                paletteMaxHeight={palettePosition?.maxHeight ?? 416}
                listContainerRef={listContainerRef}
                virtualListRef={virtualListRef}
                itemRefs={itemRefs}
                footerRef={footerRef}
                hydratedKeyVersion={hydratedKeyVersion}
                hydratedKeysRef={hydratedKeysRef}
                ensureRowHydrated={ensureRowHydrated}
                shared={paletteRowShared}
              />
            ) : (
              <div
                className="w-72 overflow-auto rounded-md border border-gray-200 bg-white shadow-xl"
                style={{ maxHeight: palettePosition?.maxHeight ?? 416 }}
                ref={listContainerRef}
              >
                <SlashCommandPaletteSimpleList
                  filteredGroups={previewGroups}
                  flatItemsLength={filtered.flatItems.length}
                  activeIndex={activeIndex}
                  hydratedKeysRef={hydratedKeysRef}
                  ensureRowHydrated={ensureRowHydrated}
                  shared={paletteRowShared}
                />
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return { palette };
}
