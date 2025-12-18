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
import { setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {
  CommandPaletteGroup,
  CommandPaletteItem,
} from "../commandPalette/types";

type TriggerSource = "slash" | "manual";

type TriggerState = {
  from: number;
  to: number;
  query: string;
  coords: { left: number; top: number; bottom: number };
  source: TriggerSource;
};

type UseSlashCommandPaletteOptions = {
  viewRef: RefObject<EditorView | undefined>;
  state?: EditorState;
  schema: Schema;
  groups?: CommandPaletteGroup[];
};

function buildBaseGroups(schema: Schema): CommandPaletteGroup[] {
  const formatting: CommandPaletteItem[] = [];
  const blocks: CommandPaletteItem[] = [];

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
    [2, 3].forEach((level) => {
      blocks.push({
        id: `heading-${level}`,
        label: `Heading ${level}`,
        description: `Title level ${level}`,
        keywords: ["title", "heading"],
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
      description: "Accordion-style container with editable heading.",
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
      description: "Highlighted paragraph for calculated results.",
      keywords: ["results", "highlight", "box"],
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
      label: "Blocks & Lists",
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
}: UseSlashCommandPaletteOptions) {
  const baseGroups = useMemo(() => buildBaseGroups(schema), [schema]);
  const combinedGroups = useMemo(
    () => [...baseGroups, ...groups],
    [baseGroups, groups]
  );
  const [trigger, setTrigger] = useState<TriggerState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const filtered = useMemo(() => {
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
            prev.coords.bottom === coords.bottom
          ) {
            return prev;
          }
          return { from, to, query, coords, source: "slash" };
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
                coords,
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
      coords,
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
        const selected = filtered.flatItems[activeIndex]?.item;
        applyCommand(selected);
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

  const lookup = useMemo(() => {
    const map = new Map<string, number>();
    filtered.flatItems.forEach((entry, index) => {
      map.set(`${entry.groupId}:${entry.item.id}`, index);
    });
    return map;
  }, [filtered.flatItems]);

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

  const palette = trigger
    ? createPortal(
        <div
          className="fixed z-50"
          style={{
            left: trigger.coords.left,
            top: trigger.coords.bottom + 6,
          }}
          data-report-command-palette="true"
        >
          <div className="w-80 max-h-80 overflow-auto rounded-md border border-gray-200 bg-white shadow-xl">
            {filtered.groups.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No commands</div>
            ) : (
              filtered.groups.map((group, groupIdx) => (
                <div
                  key={group.id}
                  className={
                    groupIdx < filtered.groups.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  }
                >
                  <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const itemIndex = lookup.get(`${group.id}:${item.id}`) ?? 0;
                    const isActive = itemIndex === activeIndex;
                    const refKey = `${group.id}:${item.id}`;
                    return (
                      <button
                        key={item.id}
                        ref={(el) => itemRefs.current.set(refKey, el)}
                        className={`w-full px-3 py-2 text-left transition-colors ${
                          isActive
                            ? "bg-blue-50 text-blue-900"
                            : "hover:bg-gray-50 text-gray-900"
                        }`}
                        onClick={(e) => {
                          console.log("clicked", item);
                          e.preventDefault();
                          applyCommand(item);
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {item.label}
                          </span>
                          {item.description ? (
                            <span className="text-xs text-gray-500">
                              {item.description}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return { palette };
}
