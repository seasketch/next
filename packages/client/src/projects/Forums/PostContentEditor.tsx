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
import { Mark, MarkType, Node, NodeType } from "prosemirror-model";
import {
  forumPosts as editorConfig,
  forumPosts,
  sketchType,
} from "../../editor/config";
import { createReactNodeView } from "./ReactNodeView";
import { useReactNodeViewPortals } from "./ReactNodeView/PortalProvider";
import SketchNodeView from "./SketchNodeView";
import EditorMenuBar, { deleteBookmark } from "../../editor/EditorMenuBar";
import {
  MapBookmarkDetailsFragment,
  useCreateMapBookmarkMutation,
} from "../../generated/graphql";
import { MapContext } from "../../dataLayers/MapContextManager";
import getSlug from "../../getSlug";
import { AnimatePresence } from "framer-motion";
import BookmarkItem from "./BookmarkItem";
import { SketchUIStateContext } from "../Sketches/SketchUIStateContextProvider";

export default function PostContentEditor({
  initialContent,
  onChange,
  autofocus,
  onSubmit,
  disabled,
  accessibleSketchIds,
}: {
  initialContent: any;
  onChange: (content: any, errors: boolean) => void;
  autofocus?: boolean;
  onSubmit?: (content: any, errors: boolean) => void;
  disabled?: boolean;
  accessibleSketchIds: number[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();
  const viewRef = useRef<EditorView>();
  const { schema, plugins } = editorConfig;
  const editable = useRef(!disabled);
  const { createPortal, removePortal, setSelection } =
    useReactNodeViewPortals();

  const [bookmarkErrors, setBookmarkErrors] = useState<
    { id: string; error: string }[]
  >([]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [createBookmark, createBookmarkState] = useCreateMapBookmarkMutation();
  useEffect(() => {
    editable.current = !disabled;
    if (viewRef.current && state) {
      try {
        viewRef.current.updateState(state!);
      } catch (e) {
        console.error(e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const [hoveredBookmarkId, setHoveredBookmarkId] = useState<string | null>(
    null
  );

  // fire onChange when attachments change
  useEffect(() => {
    if (viewRef.current?.state) {
      const errors = getBookmarkErrors(
        viewRef.current.state,
        accessibleSketchIds
      );
      setBookmarkErrors(errors);
      onChange({ ...viewRef.current.state.doc.toJSON() }, errors.length > 0);
    }
  }, [onChange, accessibleSketchIds]);

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
      const onClickListener = (e: MouseEvent) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-attachment-id");
          const type = e.target.getAttribute("data-type");
          if (id && type === "MapBookmark") {
            const attachment = bookmarkAttachments.find((b) => b.id === id);
            if (attachment && mapContext.manager) {
              mapContext.manager.showMapBookmark(attachment.data);
            }
          }
        }
      };
      el.addEventListener("click", onClickListener);
      return () => {
        el.removeEventListener("mouseover", mouseoverListener);
        el.removeEventListener("mouseout", mouseoutListener);
        el.removeEventListener("click", onClickListener);
      };
    }
  }, [root, bookmarkAttachments, mapContext?.manager]);

  const createMapBookmark = useCallback(async () => {
    if (mapContext.manager) {
      const bookmark = mapContext.manager.getMapBookmarkData();
      // TODO: Filter out non-accessible sketches
      if (state?.doc) {
        const sketchIds = [
          ...collectExistingSketchIds(state),
          ...accessibleSketchIds,
        ];
        bookmark.visibleSketches = bookmark.visibleSketches.filter(
          (id) => sketchIds.indexOf(id) !== -1
        );
        // Remove from style
        // Remove sources first and collect source ids
        const removedSources: string[] = [];
        for (const source in bookmark.style.sources) {
          if (/sketch-\d+$/.test(source)) {
            const id = parseInt(source.split("-")[1]);
            if (sketchIds.indexOf(id) === -1) {
              // remove this source
              removedSources.push(source);
              delete bookmark.style.sources[source];
            }
          }
        }
        // Then remove related layers
        bookmark.style.layers = bookmark.style.layers.filter(
          (l) =>
            !(
              "source" in l &&
              typeof l.source === "string" &&
              removedSources.indexOf(l.source) !== -1
            )
        );
      }
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
      } else {
        throw new Error("Failed to create bookmark");
      }
    } else {
      throw new Error("MapContext not ready to create map bookmarks");
    }
  }, [createBookmark, mapContext.manager, state?.doc, accessibleSketchIds]);

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
          const errors = getBookmarkErrors(newState, accessibleSketchIds);
          setBookmarkErrors(errors);
          onChange(
            {
              ...newState.doc.toJSON(),
            },
            errors.length > 0
          );
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
          onSubmit(
            {
              ...state.doc.toJSON(),
            },
            getBookmarkErrors(state, accessibleSketchIds).length > 0
          );
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    [state, onSubmit, accessibleSketchIds]
  );

  const removeBookmark = useCallback(
    (id: string) => {
      if (!viewRef.current) {
        throw new Error("viewRef not set");
      } // remove attachment from state
      viewRef.current.focus();
      deleteBookmark(id, viewRef.current.state, viewRef.current.dispatch);
    },
    [viewRef]
  );

  const sketchUIContext = useContext(SketchUIStateContext);

  const onMapBookmarkClick = useCallback(
    (bookmark: MapBookmarkDetailsFragment) => {
      if (mapContext.manager) {
        mapContext.manager.showMapBookmark(bookmark);
        if (bookmark.visibleSketches) {
          sketchUIContext.setVisibleSketches(
            // eslint-disable-next-line i18next/no-literal-string
            bookmark.visibleSketches.map((id) => `Sketch:${id}`)
          );
        }
      }
    },
    [mapContext.manager, sketchUIContext]
  );

  return (
    <>
      <div className="flex flex-col" style={{ minHeight: 300 }}>
        <div
          className={`flex-1 flex flex-col prosemirror-body forum-post new-forum-post ${
            disabled === true ? "opacity-50" : "opacity-100"
          }`}
          onKeyDown={onKeyDown}
          ref={root}
        ></div>

        <div
          className={
            bookmarkAttachments.length > 0
              ? ` border-t border-gray-50 pb-2`
              : ""
          }
        >
          <AnimatePresence initial={false}>
            {bookmarkAttachments.map((attachment) => (
              <BookmarkItem
                onClick={onMapBookmarkClick}
                key={attachment.data.id}
                bookmark={attachment.data}
                removeBookmark={removeBookmark}
                highlighted={Boolean(hoveredBookmarkId === attachment.data.id)}
                onHover={(id) => setHoveredBookmarkId(id || null)}
                hasErrors={Boolean(
                  bookmarkErrors.find((e) => e.id === attachment.data.id)
                )}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
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
  data: MapBookmarkDetailsFragment;
  id: string;
};

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        if (n.attrs?.data) {
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

export function collectNodes(doc: Node, type: NodeType, nodes: Node[] = []) {
  doc.forEach((node) => {
    if (node.type === type) {
      nodes.push(node);
    } else if (!node.isLeaf) {
      collectNodes(node, type, nodes);
    }
  });
  return nodes;
}

function getBookmarkErrors(state: EditorState, accessibleSketchIds: number[]) {
  const bookmarkErrors: { id: string; error: string }[] = [];
  if (state?.doc) {
    const existingSketchIds = collectExistingSketchIds(state);
    const attachments = state.doc.content.lastChild!.content;
    const bookmarks: Node[] = [];
    attachments.forEach((node) => {
      if (node.attrs.type === "MapBookmark") {
        bookmarks.push(node);
      }
    });
    for (const node of bookmarks) {
      const data = node.attrs.data;
      for (const id of data.visibleSketches) {
        if (
          existingSketchIds.indexOf(id) === -1 &&
          accessibleSketchIds.indexOf(id) === -1
        ) {
          bookmarkErrors.push({
            id: node.attrs.id,
            error: "Sketch missing from post or topic.",
          });
        }
      }
    }
  }
  return bookmarkErrors;
}

function collectExistingSketchIds(state: EditorState) {
  const existingSketchIds: number[] = [];
  if (state?.doc) {
    const sketchNodes = collectNodes(state.doc, sketchType);
    for (const node of sketchNodes) {
      const items = node.attrs.items;
      existingSketchIds.push(...items.map((i: { id: number }) => i.id));
    }
  }
  return existingSketchIds;
}
