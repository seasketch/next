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
import * as Popover from "@radix-ui/react-popover";
import {
  CommandPaletteGroup,
  CommandPaletteItem,
} from "../commandPalette/types";
import Spinner from "../../components/Spinner";

type CommandPalettePreviewItem = CommandPaletteItem & {
  screenshotSrc?: string;
  screenshotAlt?: string;
  muted?: boolean;
  activateOnHover?: boolean;
  popoverHeader?: React.ReactNode;
  popoverStatus?: React.ReactNode;
  children?: CommandPalettePreviewItem[];
  childGroups?: {
    id: string;
    label: string;
    items: CommandPalettePreviewItem[];
  }[];
};

/**
 * Renders a single widget child item with a hover-activated preview card
 * showing the screenshot and description. The preview uses Radix Popover
 * with collision detection so it respects viewport bounds.
 */
function ChildItemWithPreview({
  child,
  onApply,
}: {
  child: CommandPalettePreviewItem;
  onApply: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hasPreview = !!(child.screenshotSrc || child.description);

  return (
    <Popover.Root open={hovered && hasPreview}>
      <Popover.Anchor asChild>
        <button
          className="w-full px-3 py-1.5 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
          onClick={(e) => {
            e.preventDefault();
            onApply();
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {child.label}
        </button>
      </Popover.Anchor>
      {hasPreview && hovered && (
        <Popover.Portal>
          <Popover.Content
            side="right"
            align="center"
            sideOffset={8}
            collisionPadding={16}
            avoidCollisions
            className="z-[60] outline-none focus:outline-none pointer-events-none"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div className="w-56 rounded-lg border border-gray-700 bg-gray-800 shadow-xl overflow-hidden">
              {child.screenshotSrc && (
                <div className="p-3 pb-2">
                  <div
                    className="h-20 w-full overflow-hidden rounded bg-gray-700"
                    role="img"
                    aria-label={child.screenshotAlt || `${child.label} preview`}
                    style={{
                      backgroundImage: `url(${child.screenshotSrc})`,
                      backgroundSize: "cover",
                      backgroundPosition: "top",
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                </div>
              )}
              {child.description && (
                <div className={child.screenshotSrc ? "px-3 pb-3" : "p-3"}>
                  <div className="text-xs text-gray-300 whitespace-pre-line">
                    {child.description}
                  </div>
                </div>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}

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
  requestedPreviewKey?: string | null;
  onPreviewKeyApplied?: () => void;
};

function buildBaseGroups(schema: Schema): CommandPaletteGroup[] {
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

export function useSlashCommandPalette({
  viewRef,
  state,
  schema,
  groups = [],
  requestedPreviewKey,
  onPreviewKeyApplied,
}: UseSlashCommandPaletteOptions) {
  const baseGroups = useMemo(() => buildBaseGroups(schema), [schema]);
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
  const previousBodyOverflowRef = useRef<string | null>(null);
  const paletteContainerRef = useRef<HTMLDivElement | null>(null);

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
  }, [trigger?.query, filtered.flatItems.length]);

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

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (!trigger) {
        return;
      }

      if (event.key === "Escape") {
        setTrigger(null);
        return;
      }

      if (event.key === "ArrowDown") {
        if (!filtered.flatItems.length) {
          return;
        }
        event.preventDefault();
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
        setActiveIndex((index) => Math.max(0, index - 1));
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
        if (selected?.children?.length || selected?.customPopoverContent) {
          setPreviewKey(key);
          setActivatedKey(key);
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
    filtered.flatItems,
    openManualPalette,
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

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const body = document.body;
    if (trigger) {
      if (previousBodyOverflowRef.current === null) {
        previousBodyOverflowRef.current = body.style.overflow;
      }
      body.style.overflow = "hidden";
      return () => {
        body.style.overflow = previousBodyOverflowRef.current ?? "";
        previousBodyOverflowRef.current = null;
      };
    } else if (previousBodyOverflowRef.current !== null) {
      body.style.overflow = previousBodyOverflowRef.current ?? "";
      previousBodyOverflowRef.current = null;
    }
  }, [trigger]);

  const statusIsActive = (status?: CommandPaletteItem["status"]) => {
    const normalized = status?.state?.toLowerCase();
    return normalized === "processing" || normalized === "queued";
  };

  const renderStatusIcon = (status?: CommandPaletteItem["status"]) => {
    if (!status) return null;
    if (statusIsActive(status)) {
      return <Spinner mini />;
    }
    return null;
  };

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
            <div
              className="w-72 overflow-auto rounded-md border border-gray-200 bg-white shadow-xl"
              style={{ maxHeight: palettePosition?.maxHeight ?? 416 }}
              ref={listContainerRef}
            >
              {filtered.groups.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No commands
                </div>
              ) : (
                filtered.groups.map((group, groupIdx) => (
                  <div
                    key={group.id}
                    className={
                      groupIdx < filtered.groups.length - 1
                        ? "border-b border-gray-100 pt-1 pb-2"
                        : ""
                    }
                  >
                    <div className="px-3 pt-2 pb-2 text-xs font-semibold  text-gray-500">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const previewItem = item as CommandPalettePreviewItem;
                      const itemIndex =
                        lookup.get(`${group.id}:${previewItem.id}`) ?? 0;
                      const isActive = itemIndex === activeIndex;
                      const refKey = `${group.id}:${previewItem.id}`;
                      const hasChildren =
                        !!previewItem.children?.length ||
                        !!previewItem.childGroups?.length ||
                        !!previewItem.customPopoverContent;
                      const isActivated = activatedKey === refKey;
                      const isDisabled = previewItem.disabled;
                      const isMuted = previewItem.muted;
                      const inlineStatus = renderStatusIcon(previewItem.status);
                      const closePopover = () => {
                        setPreviewKey(null);
                        setActivatedKey(null);
                      };
                      const focusPalette = () => viewRef.current?.focus();
                      return (
                        <Popover.Root
                          key={previewItem.id}
                          open={previewKey === refKey}
                          onOpenChange={(open) => {
                            if (!open) setPreviewKey(null);
                          }}
                        >
                          <Popover.Anchor asChild>
                            <button
                              ref={(el) => itemRefs.current.set(refKey, el)}
                              className={`w-full px-3 py-1.5 text-left transition-colors ${
                                isActive
                                  ? isMuted
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-blue-50 text-blue-900"
                                  : isMuted
                                  ? "text-gray-400 hover:bg-gray-50"
                                  : "hover:bg-gray-50 text-gray-900"
                              } ${
                                isDisabled
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }`}
                              disabled={isDisabled}
                              onClick={(e) => {
                                e.preventDefault();
                                if (isDisabled) return;
                                if (hasChildren) {
                                  setPreviewKey(refKey);
                                  setActivatedKey(refKey);
                                } else {
                                  applyCommand(previewItem);
                                }
                              }}
                              onMouseEnter={() => {
                                setActiveIndex(itemIndex);
                                setPreviewKey(refKey);
                                if (
                                  previewItem.activateOnHover &&
                                  hasChildren
                                ) {
                                  setActivatedKey(refKey);
                                } else {
                                  setActivatedKey(null);
                                }
                              }}
                              onFocus={() => {
                                if (hasChildren) {
                                  setActiveIndex(itemIndex);
                                  setPreviewKey(refKey);
                                }
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  {previewItem.icon ? (
                                    <span className="text-gray-500">
                                      {previewItem.icon}
                                    </span>
                                  ) : null}
                                  <span className="text-sm">{item.label}</span>
                                </div>
                                {!previewItem.activateOnHover && inlineStatus}
                              </div>
                            </button>
                          </Popover.Anchor>
                          <Popover.Content
                            side="right"
                            align="center"
                            sideOffset={12}
                            collisionPadding={12}
                            className="z-50 outline-none focus:outline-none"
                            onOpenAutoFocus={(event) => {
                              event.preventDefault();
                              viewRef.current?.focus();
                            }}
                            onCloseAutoFocus={(event) => {
                              event.preventDefault();
                              viewRef.current?.focus();
                            }}
                            onMouseEnter={() => setPreviewKey(refKey)}
                            onMouseLeave={(event) => {
                              // Don't close if mouse is moving to an element inside the popover
                              const relatedTarget =
                                event.relatedTarget as HTMLElement;
                              if (
                                relatedTarget?.closest?.(
                                  "[data-popover-content]"
                                )
                              ) {
                                return;
                              }
                              setPreviewKey(null);
                            }}
                          >
                            {(() => {
                              if (
                                isActivated &&
                                previewItem.customPopoverContent
                              ) {
                                return previewItem.customPopoverContent({
                                  closePopover: () => {
                                    closePopover();
                                  },
                                  focusPalette,
                                  apply: applyCommand,
                                });
                              }
                              if (isActivated && hasChildren) {
                                return (
                                  <div className="w-64 rounded-md border border-gray-200 bg-white shadow-xl">
                                    <div className="px-3 py-2.5 border-b border-gray-100">
                                      <div className="text-sm font-semibold text-gray-800">
                                        {previewItem.label}
                                      </div>
                                      {previewItem.popoverHeader}
                                      {previewItem.popoverStatus}
                                      {previewItem.description ? (
                                        <div className="mt-1 text-xs text-gray-600">
                                          {previewItem.description}
                                        </div>
                                      ) : null}
                                    </div>
                                    {previewItem.childGroups ? (
                                      previewItem.childGroups.map((grp) => (
                                        <div key={grp.id}>
                                          <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-gray-400 tracking-wide uppercase">
                                            {grp.label}
                                          </div>
                                          <div className="pb-1">
                                            {grp.items.map((child) => (
                                              <ChildItemWithPreview
                                                key={child.id}
                                                child={child}
                                                onApply={() => {
                                                  applyCommand(child);
                                                  setPreviewKey(null);
                                                }}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="py-1">
                                        {previewItem.children?.map((child) => (
                                          <ChildItemWithPreview
                                            key={child.id}
                                            child={child}
                                            onApply={() => {
                                              applyCommand(child);
                                              setPreviewKey(null);
                                            }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              if (previewItem.muted) {
                                return (
                                  <div className="w-56 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden p-3">
                                    <p className="text-xs text-gray-500">
                                      {previewItem.description ||
                                        "Not yet processed for reporting."}
                                    </p>
                                  </div>
                                );
                              }
                              return (
                                <div className="w-56 rounded-lg outline-none border border-gray-700 bg-gray-800 shadow-xl focus:outline-none ring-0 overflow-hidden">
                                  <div className="p-3 pb-2">
                                    <div
                                      className="h-20 w-full overflow-hidden rounded bg-gray-700"
                                      role="img"
                                      aria-label={
                                        previewItem.screenshotSrc
                                          ? previewItem.screenshotAlt ||
                                            `${previewItem.label} preview`
                                          : undefined
                                      }
                                      style={
                                        previewItem.screenshotSrc
                                          ? {
                                              backgroundImage: `url(${previewItem.screenshotSrc})`,
                                              backgroundSize: "cover",
                                              backgroundPosition: "center",
                                              backgroundRepeat: "no-repeat",
                                            }
                                          : undefined
                                      }
                                    >
                                      {!previewItem.screenshotSrc && (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                          Screenshot coming soon
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="px-3 pb-3">
                                    <div className="text-xs text-gray-300 whitespace-pre-line">
                                      {previewItem.description ||
                                        "No description provided yet."}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </Popover.Content>
                        </Popover.Root>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return { palette };
}
