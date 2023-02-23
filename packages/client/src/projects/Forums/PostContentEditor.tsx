import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {
  KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Node } from "prosemirror-model";
import { forumPosts as editorConfig } from "../../editor/config";
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

  const [attachments, setAttachments] = useState<MapBookmarkAttachment[]>(
    initialContent?.attachments || []
  );
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

  useEffect(() => {
    if (state) {
      onChange({ ...state.doc.toJSON(), attachments });
    }
  }, [attachments, onChange]);

  useEffect(() => {
    const el = root.current;
    if (el) {
      const mouseoverListener = (e: MouseEvent) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-bookmark-id");
          if (id) {
            setHoveredBookmarkId(id);
          }
        }
      };
      el.addEventListener("mouseover", mouseoverListener);
      const mouseoutListener = (e: MouseEvent) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-bookmark-id");
          if (id) {
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

  const mapContext = useContext(MapContext);
  const onRequestMapBookmark = useCallback(async () => {
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
        const bookmarkId = fragment.id;
        console.log("bookmark data", fragment);
        setAttachments((prev) => [...prev, bookmarkToAttachment(fragment)]);
        return bookmarkId;
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
    const view = new EditorView(root.current!, {
      state: EditorState.create({
        schema,
        plugins,
        doc,
      }),
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
            attachments,
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
            attachments,
          });
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    [state, onSubmit, attachments]
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
        bookmarks={attachments.filter((a) => a.type === "MapBookmark")}
      />
      {/* <div>
        {attachments.filter((a) => a.type === "MapBookmark").length}{" "}
        <Trans>Bookmarks</Trans>
      </div> */}
      <EditorMenuBar
        onRequestMapBookmark={onRequestMapBookmark}
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

export type MapBookmarkAttachment = MapBookmarkDetailsFragment & {
  type: "MapBookmark";
};

function bookmarkToAttachment(
  bookmark: MapBookmarkDetailsFragment
): MapBookmarkAttachment {
  return { ...cloneDeep(bookmark), type: "MapBookmark" };
}
