import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {
  KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Mark, MarkType, Node } from "prosemirror-model";
import { forumPosts as editorConfig, forumPosts } from "../../editor/config";
import { createReactNodeView } from "./ReactNodeView";
import { useReactNodeViewPortals } from "./ReactNodeView/PortalProvider";
import SketchNodeView from "./SketchNodeView";
import EditorMenuBar from "../../editor/EditorMenuBar";
import {
  MapBookmarkDetailsFragment,
  useCreateMapBookmarkMutation,
} from "../../generated/graphql";
import { Trans } from "react-i18next";
import { MapContext } from "../../dataLayers/MapContextManager";
import getSlug from "../../getSlug";
import cloneDeep from "lodash.clonedeep";
import BookmarksList from "./BookmarksList";
import { toggleMark } from "prosemirror-commands";
import { Transform } from "prosemirror-transform";
import { m } from "framer-motion";

export default function PostContentEditor({
  initialContent,
  onChange,
  autofocus,
  onSubmit,
  disabled,
}: {
  initialContent: any;
  onChange: (content: any) => void;
  autofocus?: boolean;
  onSubmit?: (content: any) => void;
  disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();
  const viewRef = useRef<EditorView>();
  const { schema, plugins } = editorConfig;
  const editable = useRef(!disabled);
  const { createPortal, removePortal, setSelection } =
    useReactNodeViewPortals();

  const [createBookmark, createBookmarkState] = useCreateMapBookmarkMutation();
  useEffect(() => {
    editable.current = !disabled;
    if (viewRef.current && state) {
      viewRef.current.updateState(state!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const [hoveredBookmarkId, setHoveredBookmarkId] = useState<string | null>(
    null
  );

  // fire onChange when attachments change
  useEffect(() => {
    if (viewRef.current?.state) {
      onChange({ ...viewRef.current.state.doc.toJSON() });
    }
  }, [onChange]);

  useEffect(() => {
    const el = root.current;
    if (el) {
      const mouseoverListener = (e: MouseEvent) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-attachment-id");
          const type = e.target.getAttribute("data-type");
          if (id && type === "MapBookmark") {
            setHoveredBookmarkId(id);
          }
        }
      };
      el.addEventListener("mouseover", mouseoverListener);
      const mouseoutListener = (e: MouseEvent) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-attachment-id");
          const type = e.target.getAttribute("data-type");
          if (id && type === "MapBookmark") {
            setHoveredBookmarkId(null);
          }
        }
      };
      el.addEventListener("mouseout", mouseoutListener);

      return () => {
        el.removeEventListener("mouseover", mouseoverListener);
        el.removeEventListener("mouseout", mouseoutListener);
      };
    }
  }, [root]);

  useEffect(() => {
    console.log("hovered over", hoveredBookmarkId);
  }, [hoveredBookmarkId]);

  const bookmarkAttachments = useMemo(() => {
    if (state?.doc) {
      return attachmentsFromState(state?.doc).filter(
        (a) => a.type === "MapBookmark"
      );
    } else {
      return [];
    }
  }, [state]);

  const mapContext = useContext(MapContext);
  const createMapBookmark = useCallback(async () => {
    if (mapContext.manager) {
      const bookmark = mapContext.manager.getMapBookmarkData();
      const data = await createBookmark({
        variables: {
          slug: getSlug(),
          ...bookmark,
          isPublic: false,
        },
      });
      if (data.data?.createMapBookmark?.mapBookmark?.id) {
        const fragment = data.data.createMapBookmark.mapBookmark;
        return fragment;
        // const bookmarkId = fragment.id;
        // console.log("bookmark data", fragment);
        // setAttachments((prev) => [...prev, bookmarkToAttachment(fragment)]);
        // return bookmarkId;
      } else {
        throw new Error("Failed to create bookmark");
      }
    } else {
      throw new Error("MapContext not ready to create map bookmarks");
    }
  }, [createBookmark, mapContext.manager]);

  useEffect(() => {
    let doc: Node | undefined;
    try {
      doc = initialContent ? Node.fromJSON(schema, initialContent) : undefined;
    } catch (e) {
      doc = undefined;
    }
    const state = EditorState.create({
      schema,
      plugins,
      doc,
    });
    setState(state);
    const view = new EditorView(root.current!, {
      state,
      menu: false,
      editable: () => {
        return editable.current;
      },
      nodeViews: {
        // @ts-ignore
        sketch(node, view, getPos, decorations) {
          return createReactNodeView({
            node,
            view,
            getPos,
            // @ts-ignore
            decorations,
            component: SketchNodeView,
            onCreatePortal: createPortal,
            onDestroy: removePortal,
          });
        },
      },
      dispatchTransaction: (transaction) => {
        const view = viewRef.current!;
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        setState(newState);
        if (newState.selection) {
          setSelection({
            anchorPos: newState.selection.$anchor.pos,
            headPos: newState.selection.$head.pos,
          });
        } else {
          setSelection(null);
        }
        if (transaction.docChanged) {
          onChange({
            ...newState.doc.toJSON(),
          });
        }
      },
    });
    viewRef.current = view;
    if (autofocus) {
      viewRef.current.focus();
      placeCaretAtEnd(viewRef.current.dom);
    }
    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, plugins, schema, createPortal, removePortal]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<any>) => {
      if (onSubmit && state) {
        if (e.metaKey && e.key === "Enter") {
          onSubmit({
            ...state.doc.toJSON(),
          });
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    [state, onSubmit]
  );

  return (
    <>
      <div
        className={`prosemirror-body forum-post new-forum-post ${
          disabled === true ? "opacity-50" : "opacity-100"
        }`}
        onKeyDown={onKeyDown}
        ref={root}
      ></div>
      <BookmarksList
        removeBookmark={(id: string) => {
          if (!viewRef.current) {
            throw new Error("viewRef not set");
          } // remove attachment from state
          const transform = new Transform(viewRef.current.state.doc);
          console.log(viewRef.current.state.doc.toString());
          const marks = collectMarks(
            viewRef.current.state.doc,
            schema.marks.attachmentLink
          );
          console.log("all makrs", marks);
          const matchingId = collectMarks(
            viewRef.current.state.doc,
            schema.marks.attachmentLink,
            { "data-attachment-id": id }
          );
          console.log(matchingId);
          for (const mark of matchingId) {
            console.log(
              transform
                .removeMark(0, viewRef.current.state.doc.content.size, mark)
                .toString()
            );
          }
          // transform.removeMatchingMarks(
          //   0,
          //   viewRef.current.state.doc.content.size,
          //   schema.marks.attachmentLink,
          //   {
          //     "data-id": id,
          //   }
          // );

          console.log(transform.doc.toString());
          // setAttachments((prev) => prev.filter((b) => b.id !== id));
          // // Remove any references in content via attachment links
          // const cmd = toggleMark(schema.marks.attachmentLink, {
          //   "data-attachment-id": id,
          //   "data-type": "MapBookmark",
          // });
          // cmd(viewRef.current?.state, viewRef.current?.dispatch);
        }}
        bookmarks={bookmarkAttachments}
      />
      {/* <div>
        {attachments.filter((a) => a.type === "MapBookmark").length}{" "}
        <Trans>Bookmarks</Trans>
      </div> */}
      <EditorMenuBar
        createMapBookmark={createMapBookmark}
        view={viewRef.current}
        className=" border-t"
        style={{
          backgroundColor: "rgb(252, 252, 252)",
        }}
        state={state}
        schema={schema}
      />
    </>
  );
}

// from https://stackoverflow.com/questions/4233265/contenteditable-set-caret-at-the-end-of-the-text-cross-browser
function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  if (
    typeof window.getSelection != "undefined" &&
    typeof document.createRange != "undefined"
  ) {
    var range = document.createRange();
    // @ts-ignore
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // @ts-ignore
  } else if (typeof document.body.createTextRange != "undefined") {
    // @ts-ignore
    var textRange = document.body.createTextRange();
    textRange.moveToElementText(el);
    textRange.collapse(false);
    textRange.select();
  }
}

export type MapBookmarkAttachment = {
  type: "MapBookmark";
  attachment: MapBookmarkDetailsFragment;
  id: string;
};

function bookmarkToAttachment(
  bookmark: MapBookmarkDetailsFragment
): MapBookmarkAttachment {
  return {
    attachment: cloneDeep(bookmark),
    type: "MapBookmark",
    id: bookmark.id,
  };
}

function collectMarks(
  doc: Node,
  type: MarkType,
  attrs: { [key: string]: number | string } = {},
  marks: Mark[] = []
) {
  for (const mark of doc.marks) {
    if (mark.type === type) {
      let matches = true;
      for (const key in attrs) {
        if (!(key in mark.attrs) || mark.attrs[key] !== attrs[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        marks.push(mark);
      }
    }
  }
  doc.forEach((node) => {
    collectMarks(node, type, attrs, marks);
  });
  return marks;
}

function attachmentsFromState(state: Node): MapBookmarkAttachment[] {
  if (state && state.type && state.content.size) {
    let node: Node | null = null;
    state.forEach((n) => {
      if (n.type === forumPosts.schema.nodes.attachments) {
        node = n;
      }
    });
    if (node !== null) {
      const attachments: MapBookmarkAttachment[] = [];
      (node as Node).forEach((n) => {
        if (n.attrs?.attachment) {
          attachments.push(n.attrs as MapBookmarkAttachment);
        }
      });
      return attachments;
    } else {
      return [];
    }
  } else {
    return [];
  }
}
