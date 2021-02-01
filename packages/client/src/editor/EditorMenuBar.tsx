import { EditorView } from "prosemirror-view";
import React, { useEffect, useState } from "react";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { MarkType, NodeType } from "prosemirror-model";
import { schema } from "./config";
import { EditorState } from "prosemirror-state";
import { cursorTo } from "readline";
import { markActive, marks } from "./utils";
import Modal from "../components/Modal";
import Button from "../components/Button";
import TextInput from "../components/TextInput";
import { link } from "fs";

interface EditorMenuBarProps {
  state?: EditorState;
  view?: EditorView;
  className?: string;
  style?: any;
}

export default function EditorMenuBar(props: EditorMenuBarProps) {
  const [menuState, setMenuState] = useState<any>({});
  const [linkModalState, setLinkModalState] = useState<{
    href: string;
    title?: string;
  } | null>(null);

  useEffect(() => {
    if (props.state) {
      // @ts-ignore
      setMenuState({
        disabled: {
          strong: !toggleMark(schema.marks.strong)(props.state),
          em: !toggleMark(schema.marks.em)(props.state),
          p: !setBlockType(schema.nodes.paragraph)(props.state),
          h1: !setBlockType(schema.nodes.heading, { level: 1 })(props.state),
          h2: !setBlockType(schema.nodes.heading, { level: 2 })(props.state),
          h3: !setBlockType(schema.nodes.heading, { level: 3 })(props.state),
          link: !toggleMark(schema.marks.link)(props.state), // ||
          // (props.state!.selection.empty &&
          //   !schema.marks.link.isInSet(
          //     props.state!.storedMarks || props.state!.selection.$from.marks()
          //   )),
        },
        active: {
          ...getActiveMarks(props.state, [
            schema.marks.strong,
            schema.marks.em,
            schema.marks.link,
          ]),
        },
      });
    }
  }, [props.state]);

  return (
    <div
      style={{ ...props.style }}
      className={`${props.className} px-4 border-b`}
    >
      <button
        disabled={menuState?.disabled?.strong}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          toggleMark(schema.marks.strong)(
            props.view!.state,
            props.view?.dispatch
          );
          return false;
        }}
        className={`font-bold text-sm p-2  mx-1 ${
          menuState?.active?.strong ? "bg-gray-100" : ""
        }`}
      >
        B
      </button>
      <button
        disabled={menuState?.disabled?.em}
        className={`italic font-serif text-sm p-2 mx-1 ${
          menuState?.active?.em ? "bg-gray-100" : ""
        }`}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          toggleMark(schema.marks.em)(props.view!.state, props.view?.dispatch);
          return false;
        }}
      >
        I
      </button>
      <button
        disabled={menuState?.disabled?.p}
        className="text-sm font-medium p-2"
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          setBlockType(schema.nodes.paragraph)(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        ¶
      </button>

      <button
        disabled={menuState?.disabled?.h1}
        className="text-sm font-medium p-2"
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          setBlockType(schema.nodes.heading, { level: 1 })(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        H1
      </button>
      <button
        disabled={menuState?.disabled?.h2}
        className="text-sm font-medium p-2"
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          setBlockType(schema.nodes.heading, { level: 2 })(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        H2
      </button>
      <button
        disabled={menuState?.disabled?.h3}
        className="text-sm font-medium p-2"
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          setBlockType(schema.nodes.heading, { level: 3 })(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        H3
      </button>
      <button
        className={`text-sm font-medium p-2 relative w-8 ${
          menuState?.active?.link ? "bg-gray-100" : ""
        } ${
          menuState?.disabled?.link ? "text-gray-500 pointer-events-none" : ""
        }`}
        disabled={menuState?.disabled?.link}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          const linkMarks = marks(props.state!, schema.marks.link);
          // if (linkMarks.length > 1) {
          //   window.confirm("More than one link selected. Clear these links?");
          if (markActive(props.state!, schema.marks.link)) {
            toggleMark(schema.marks.link)(
              props.view!.state,
              props.view?.dispatch
            );
            //   console.log(
            //     "node",
            //     props.state!.doc.nodeAt(props.state!.selection.anchor)
            //   );
            //   setLinkModalState({
            //     href: linkMarks[0].attrs.href,
            //     title: linkMarks[0].attrs.title,
            //   });
          } else {
            setLinkModalState({
              href: "https://",
              title: "",
            });
          }
        }}
      >
        &nbsp;
        <svg
          className={`w-4 h-4 absolute top-2.5 left-2 ${
            menuState?.disabled?.link
              ? "text-gray-400 pointer-events-none"
              : "text-gray-800"
          }`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <Modal
        title={`Edit Link`}
        open={!!linkModalState}
        footer={
          <>
            <Button label="Cancel" onClick={() => setLinkModalState(null)} />
            <Button
              className="ml-2"
              primary={true}
              label="Save"
              onClick={() => {
                toggleMark(schema.marks.link, {
                  href: linkModalState!.href,
                  title: linkModalState!.title,
                })(props.view!.state, props.view?.dispatch);
                setLinkModalState(null);
              }}
            />
          </>
        }
      >
        <div className="w-128">
          <TextInput
            autoFocus
            id="href"
            value={linkModalState?.href || ""}
            label="href"
            required={true}
            onChange={(href) =>
              setLinkModalState({
                ...linkModalState,
                href,
              })
            }
          />
        </div>
        <div className="mt-2">
          <TextInput
            id="title"
            value={linkModalState?.title || ""}
            label="title"
            required={false}
            onChange={(title) =>
              setLinkModalState({
                ...linkModalState!,
                title,
              })
            }
          />
        </div>
      </Modal>
    </div>
  );
}

function getActiveMarks(state: EditorState, markTypes: MarkType[]) {
  const marks: { [markType: string]: boolean } = {};
  for (const mark of markTypes) {
    marks[mark.name] = markActive(state, mark);
  }
  return marks;
}
