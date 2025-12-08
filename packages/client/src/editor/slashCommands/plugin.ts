import { Schema } from "prosemirror-model";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import React from "react";
import {
  DividerHorizontalIcon,
  QuoteIcon,
  SymbolIcon,
} from "@radix-ui/react-icons";
import {
  insertHorizontalRule,
  insertBlockquote,
  insertMetric,
} from "./commands";

export interface SlashCommandRange {
  from: number;
  to: number;
}

export interface SlashCommandItem {
  id: string;
  title: string;
  description: string;
  /**
   * Icon to display for this command. Should be a ReactNode (e.g., an icon component).
   */
  icon: React.ReactNode;
  isEnabled: (schema: Schema) => boolean;
  run: (args: { view: EditorView; range: SlashCommandRange }) => boolean;
  /**
   * Optional group name for organizing commands in the palette.
   * Commands without a group will appear in an "Other" group.
   */
  group?: string;
}

export interface SlashCommandPluginState {
  active: boolean;
  query: string;
  range: SlashCommandRange | null;
  selectedIndex: number;
}

type SlashCommandMeta =
  | { type: "set-selected-index"; index: number }
  | { type: "close" };

const initialState: SlashCommandPluginState = {
  active: false,
  query: "",
  range: null,
  selectedIndex: 0,
};

export const slashCommandPluginKey = new PluginKey<SlashCommandPluginState>(
  "reportCardSlashCommand"
);

function clampIndex(index: number, listLength: number): number {
  if (listLength <= 0) {
    return 0;
  }
  if (index < 0) {
    return listLength - 1;
  }
  if (index >= listLength) {
    return 0;
  }
  return index;
}

function detectSlashCommand(
  state: EditorState,
  previous: SlashCommandPluginState
): SlashCommandPluginState {
  const { selection } = state;
  if (!selection.empty) {
    return initialState;
  }

  const $from = selection.$from;
  if (!$from.parent.isTextblock) {
    return initialState;
  }

  const textBefore = $from.parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    "\ufffc"
  );
  const match = textBefore.match(/(?:^|\s)\/([^\s]*)$/);
  if (!match) {
    return initialState;
  }

  const query = match[1];
  const slashLength = query.length + 1;
  const from = $from.pos - slashLength;
  const to = $from.pos;

  if (from < $from.start() - 1) {
    return initialState;
  }

  const shouldPreserveSelection =
    previous.active &&
    previous.range &&
    previous.range.from === from &&
    previous.range.to === to;

  return {
    active: true,
    query,
    range: { from, to },
    selectedIndex: shouldPreserveSelection ? previous.selectedIndex : 0,
  };
}

/**
 * Default list of slash command items.
 * Consumers can use this directly, filter it, or build their own list
 * using the exported command functions from ./commands.
 */
export const defaultSlashCommandItems: SlashCommandItem[] = [
  {
    id: "horizontal-rule",
    title: "Divider",
    description: "Insert a horizontal rule",
    icon: React.createElement(DividerHorizontalIcon, {
      className: "h-4 w-4",
    }),
    isEnabled: (schema) =>
      Boolean(schema.nodes.horizontal_rule && schema.nodes.paragraph),
    run: ({ view, range }) => insertHorizontalRule(view, range),
    group: "Basic Blocks",
  },
  {
    id: "blockquote",
    title: "Quote",
    description: "Insert a blockquote",
    icon: React.createElement(QuoteIcon, {
      className: "h-4 w-4",
    }),
    isEnabled: (schema) =>
      Boolean(schema.nodes.blockquote && schema.nodes.paragraph),
    run: ({ view, range }) => insertBlockquote(view, range),
    group: "Basic Blocks",
  },
  {
    id: "total_area_sketches",
    title: "Total Area",
    description:
      "Insert the total area of the sketch or collection in a variety of units.",
    icon: React.createElement(SymbolIcon, {
      className: "h-4 w-4",
    }),
    isEnabled: (schema) => Boolean(schema.nodes.metric),
    run: ({ view, range }) => {
      return insertMetric(view, range, {
        metrics: [
          {
            type: "total_area",
            subjectType: "fragments",
          },
        ],
        componentSettings: {
          presentation: "total_area",
        },
      });
    },
    group: "Metrics",
  },
  {
    id: "percent_of_clipping_geography",
    title: "Percent of Geography",
    description:
      "Insert the area of the sketch or collection as a percentage of the geography.",
    icon: React.createElement(SymbolIcon, {
      className: "h-4 w-4",
    }),
    isEnabled: (schema) => Boolean(schema.nodes.metric),
    run: ({ view, range }) => {
      return insertMetric(view, range, {
        componentSettings: {
          presentation: "percent_area",
        },
        metrics: [
          {
            type: "total_area",
            subjectType: "fragments",
          },
          {
            type: "total_area",
            subjectType: "geographies",
          },
        ],
      });
    },
    group: "Metrics",
  },
];

export function filterSlashCommandItems(
  schema: Schema,
  query: string,
  items: SlashCommandItem[] = defaultSlashCommandItems
): SlashCommandItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items
    .filter((item) => item.isEnabled(schema))
    .filter((item) => {
      if (!normalizedQuery) {
        return true;
      }
      const haystack = (item.title + " " + item.description).toLowerCase();
      return haystack.includes(normalizedQuery);
    });
}

export function createSlashCommandPlugin(
  items: SlashCommandItem[] = defaultSlashCommandItems
): Plugin {
  return new Plugin({
    key: slashCommandPluginKey,
    state: {
      init: () => initialState,
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(slashCommandPluginKey) as SlashCommandMeta;
        if (meta?.type === "close") {
          return initialState;
        }

        const detected = detectSlashCommand(newState, prev);
        if (!detected.active) {
          return initialState;
        }

        let nextState = detected;

        if (meta?.type === "set-selected-index") {
          nextState = { ...nextState, selectedIndex: meta.index };
        }

        const filtered = filterSlashCommandItems(
          newState.schema,
          nextState.query,
          items
        );

        return {
          ...nextState,
          selectedIndex: clampIndex(nextState.selectedIndex, filtered.length),
        };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const pluginState = slashCommandPluginKey.getState(view.state);
        if (!pluginState?.active || !pluginState.range) {
          return false;
        }

        const filtered = filterSlashCommandItems(
          view.state.schema,
          pluginState.query,
          items
        );

        if (!filtered.length && event.key === "Enter") {
          event.preventDefault();
          dispatchClose(view);
          return true;
        }

        switch (event.key) {
          case "ArrowDown":
          case "ArrowUp": {
            if (!filtered.length) {
              return false;
            }
            event.preventDefault();
            const offset = event.key === "ArrowDown" ? 1 : -1;
            const nextIndex = clampIndex(
              pluginState.selectedIndex + offset,
              filtered.length
            );
            dispatchSetSelectedIndex(view, nextIndex);
            return true;
          }
          case "Enter": {
            if (!filtered.length) {
              return false;
            }
            event.preventDefault();
            const item =
              filtered[clampIndex(pluginState.selectedIndex, filtered.length)];
            if (item) {
              const ran = item.run({
                view,
                range: pluginState.range,
              });
              if (ran) {
                dispatchClose(view);
                return true;
              }
            }
            return false;
          }
          case "Escape": {
            event.preventDefault();
            dispatchClose(view);
            return true;
          }
          default:
            return false;
        }
      },
    },
  });
}

function dispatchSetSelectedIndex(view: EditorView, index: number) {
  const tr = view.state.tr.setMeta(slashCommandPluginKey, {
    type: "set-selected-index",
    index,
  } satisfies SlashCommandMeta);
  view.dispatch(tr);
}

function dispatchClose(view: EditorView) {
  const tr = view.state.tr.setMeta(slashCommandPluginKey, {
    type: "close",
  } satisfies SlashCommandMeta);
  view.dispatch(tr);
  view.focus();
}

export function closeSlashCommand(view: EditorView) {
  dispatchClose(view);
}

export function setSlashCommandSelectedIndex(view: EditorView, index: number) {
  dispatchSetSelectedIndex(view, index);
}
