import { LinkIcon } from "@heroicons/react/outline";
import { AnimatePresence, motion } from "framer-motion";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { Mark, Schema } from "prosemirror-model";
import {
  EditorState,
  Selection,
  StateField,
  Transaction,
} from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { ReactNode, useState } from "react";
import { TFunction, useTranslation } from "react-i18next";
import { getActiveMarks } from "./EditorMenuBar";
import { markActive } from "./utils";

export default function TooltipMenu({
  state,
  schema,
  view,
}: {
  schema: Schema;
  view?: EditorView;
  state?: EditorState<any>;
}) {
  const { t } = useTranslation("admin:surveys");
  let commands: Command[] = [];
  let left = "-10000px";
  let bottom = "-10000px";
  if (
    state &&
    view &&
    state.selection &&
    state.selection.to - state.selection.from > 0
  ) {
    commands = Commands.filter((command) => {
      return !command.isDisabled(schema, state);
    });
    if (commands.length) {
      let { from, to } = state.selection;
      let start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      let box = view.dom.getBoundingClientRect();
      left =
        Math.max((start.left + end.left) / 2, start.left + 3) - box.left + "px";
      bottom = box.bottom - start.top + 5 + "px";
    }
  }
  let activeMarks: { [id: string]: boolean } = {};
  if (state) {
    activeMarks = getActiveMarks(state, [schema.marks.strong, schema.marks.em]);
  }
  return (
    <AnimatePresence>
      {commands.length > 0 ? (
        <motion.div
          initial={{
            opacity: 0,
            scale: 0,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          exit={{ opacity: 0, scale: 1 }}
          key="tooltip"
          className={`bg-black px-0 text-white rounded shadow-lg absolute text-center z-10 flex overflow-hidden`}
          style={{
            left,
            bottom,
            marginLeft: -16 * commands.length,
          }}
        >
          {commands.map((c) => (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                c.toggle(schema, state!, view!.dispatch, t);
                e.preventDefault();
                return false;
              }}
              className={`w-8 h-8 justify-center items-center flex ${
                !!activeMarks[c.id] ? "bg-gray-800" : ""
              }`}
              key={c.id}
            >
              {c.icon}
            </button>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface Command {
  id: string;
  icon: ReactNode;
  isDisabled: (schema: Schema, state: EditorState<any>) => boolean;
  toggle: (
    schema: Schema,
    state: EditorState<any>,
    dispatch: (tr: Transaction) => void,
    t: TFunction<string>
  ) => void;
}

const Commands: Command[] = [
  {
    id: "strong",
    icon: "B",
    isDisabled: (schema, state) => !toggleMark(schema.marks.strong)(state),
    toggle: (schema, state, dispatch) => {
      toggleMark(schema.marks.strong)(state, dispatch);
    },
  },
  {
    id: "em",
    // eslint-disable-next-line i18next/no-literal-string
    icon: <em>i</em>,
    isDisabled: (schema, state) => !toggleMark(schema.marks.em)(state),
    toggle: (schema, state, dispatch) => {
      toggleMark(schema.marks.em)(state, dispatch);
    },
  },
  {
    id: "link",
    icon: <LinkIcon className="w-3.5 h-3.5" />,
    isDisabled: (schema, state) => !toggleMark(schema.marks.link)(state),
    toggle: (schema, state, dispatch, t) => {
      const links = getActiveLinks(state);
      const existingUrl =
        links && links.length ? links[0]?.attrs?.href : "https://";
      const url = window.prompt(t("Enter a URL"), existingUrl);
      if (url === null || url === existingUrl) {
        return;
      } else {
        if (url.length === 0) {
          toggleMark(schema.marks.link, { href: null })(state, dispatch);
        } else {
          toggleMark(schema.marks.link, { href: url })(state, dispatch);
        }
      }
    },
  },
  {
    id: "paragraph",
    icon: "¶",
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.paragraph)(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.paragraph)(state, dispatch);
    },
  },
  {
    id: "h1",
    icon: "H1",
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.heading, { level: 1 })(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.heading, { level: 1 })(state, dispatch);
    },
  },
  {
    id: "h2",
    // eslint-disable-next-line i18next/no-literal-string
    icon: "H2",
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.heading, { level: 2 })(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.heading, { level: 2 })(state, dispatch);
    },
  },
  {
    id: "h2b",
    // eslint-disable-next-line i18next/no-literal-string
    icon: <strong>H</strong>,
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.h2)(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.h2)(state, dispatch);
    },
  },
  {
    id: "h3",
    icon: "H3",
    isDisabled: (schema, state) => {
      return !setBlockType(schema.nodes.heading, { level: 3 })(state);
    },
    toggle: (schema, state, dispatch) => {
      setBlockType(schema.nodes.heading, { level: 3 })(state, dispatch);
    },
  },
];

export function getActiveLinks(state: EditorState) {
  if (!state.selection.empty) {
    const links: Mark<any>[] = [];
    state.doc.nodesBetween(
      state.selection.from,
      state.selection.to,
      (node, position) => {
        node.marks.forEach((mark) => {
          if (mark.type.name === "link" && links.indexOf(mark) === -1) {
            links.push(mark);
          }
        });
      }
    );
    return links;
  }
}
