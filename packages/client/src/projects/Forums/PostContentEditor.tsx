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
import EditorMenuBar, {
  EditorAttachmentProgressProvider,
  deleteAttachment,
} from "../../editor/EditorMenuBar";
import {
  FileUploadDetailsFragment,
  FileUploadUsageInput,
  MapBookmarkDetailsFragment,
  SketchPresentFragmentDoc,
  useCreateFileUploadForPostMutation,
  useCreateMapBookmarkMutation,
  usePublishedTableOfContentsQuery,
} from "../../generated/graphql";
import { MapContext } from "../../dataLayers/MapContextManager";
import getSlug from "../../getSlug";
import { AnimatePresence } from "framer-motion";
import BookmarkItem from "./BookmarkItem";
import { SketchUIStateContext } from "../Sketches/SketchUIStateContextProvider";
import {
  useApolloClient,
  NormalizedCacheObject,
  ApolloClient,
} from "@apollo/client";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useTranslation } from "react-i18next";
import FileUploadItem, {
  FileUploadDetails,
  ImageDisplayModal,
} from "./FileUploadItem";

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
  const { t } = useTranslation("forums");

  const apolloClient = useApolloClient() as ApolloClient<NormalizedCacheObject>;

  const tableOfContentsData = usePublishedTableOfContentsQuery({
    variables: {
      slug: getSlug(),
    },
    fetchPolicy: "cache-only",
  });

  const onError = useGlobalErrorHandler();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [createBookmark, createBookmarkState] = useCreateMapBookmarkMutation(
    {}
  );

  const [_createFileUpload, createFileUploadState] =
    useCreateFileUploadForPostMutation({
      onError,
    });

  const createFileUpload = useCallback(
    async (filename: string, fileSizeBytes: number, contentType: string) => {
      const data = await _createFileUpload({
        variables: {
          contentType,
          filename,
          fileSizeBytes,
          projectId: tableOfContentsData.data!.projectBySlug!.id!,
          usage: FileUploadUsageInput.ForumAttachment,
        },
      });
      return data.data?.createFileUpload || null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      _createFileUpload,
      tableOfContentsData?.data,
      tableOfContentsData?.data?.projectBySlug?.id,
    ]
  );

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

  const [hoveredAttachmentId, setHoveredAttachmentId] = useState<string | null>(
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

  const allAttachments = useMemo(() => {
    if (state?.doc) {
      return attachmentsFromState(state?.doc);
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
            setHoveredAttachmentId(id);
          }
        }
      };
      el.addEventListener("mouseover", mouseoverListener);
      const mouseoutListener = (e: MouseEvent) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-attachment-id");
          const type = e.target.getAttribute("data-type");
          if (id && type === "MapBookmark") {
            setHoveredAttachmentId(null);
          }
        }
      };
      el.addEventListener("mouseout", mouseoutListener);
      const onClickListener = (e: MouseEvent) => {
        if (e.target instanceof Element && e.target.tagName === "BUTTON") {
          const id = e.target.getAttribute("data-attachment-id");
          const type = e.target.getAttribute("data-type");
          if (id && type === "MapBookmark") {
            const attachment = allAttachments.find(
              (b) => b.id === id
            ) as MapBookmarkAttachment;
            if (attachment && mapContext.manager) {
              mapContext.manager.showMapBookmark(
                attachment.data,
                true,
                apolloClient
              );
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
  }, [root, allAttachments, mapContext?.manager, apolloClient]);

  const createMapBookmark = useCallback(async () => {
    try {
      if (mapContext.manager) {
        const bookmark = await mapContext.manager.getMapBookmarkData();
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

        const layerNames: { [id: string]: string } = {};
        for (const id of bookmark.visibleDataLayers) {
          const items =
            tableOfContentsData.data?.projectBySlug?.tableOfContentsItems || [];
          const item = items.find((i) => i.stableId === id);
          if (item) {
            layerNames[id] = item.title;
          }
        }

        const sketchNames: { [id: number]: string } = {};

        for (const id of bookmark.visibleSketches) {
          const data = apolloClient.readFragment({
            fragment: SketchPresentFragmentDoc,
            // eslint-disable-next-line i18next/no-literal-string
            id: `Sketch:${id}`,
          });
          if (data?.name) {
            sketchNames[id] = data.name;
          }
        }
        const data = await createBookmark({
          variables: {
            slug: getSlug(),
            ...bookmark,
            isPublic: false,
            layerNames,
            sketchNames,
            clientGeneratedThumbnail:
              bookmark.clientGeneratedThumbnail as string,
          },
        });
        if (data.data?.createMapBookmark?.mapBookmark?.id) {
          const fragment = data.data.createMapBookmark.mapBookmark;
          return fragment;
        } else {
          if (
            data.errors &&
            typeof data.errors === "string" &&
            /Rate limit/.test(data.errors)
          ) {
            throw new Error(
              "Rate limit exceeded. Please try again in a few seconds"
            );
          } else {
            throw new Error("Failed to create map bookmark");
          }
        }
      } else {
        throw new Error("MapContext not ready to create map bookmarks");
      }
    } catch (e) {
      onError(e);
      throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createBookmark,
    mapContext.manager,
    state?.doc,
    accessibleSketchIds,
    tableOfContentsData.data?.projectBySlug?.tableOfContentsItems,
    onError,
    apolloClient,
  ]);

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

  const removeAttachment = useCallback(
    (id: string) => {
      if (!viewRef.current) {
        throw new Error("viewRef not set");
      } // remove attachment from state
      viewRef.current.focus();
      deleteAttachment(id, viewRef.current.state, viewRef.current.dispatch);
    },
    [viewRef]
  );

  const sketchUIContext = useContext(SketchUIStateContext);

  const onMapBookmarkClick = useCallback(
    (bookmark: MapBookmarkDetailsFragment) => {
      if (mapContext.manager) {
        mapContext.manager.showMapBookmark(bookmark, true, apolloClient);
        if (bookmark.visibleSketches) {
          sketchUIContext.setVisibleSketches(
            // eslint-disable-next-line i18next/no-literal-string
            bookmark.visibleSketches.map((id) => `Sketch:${id}`)
          );
        }
      }
    },
    [mapContext.manager, sketchUIContext, apolloClient]
  );

  const [imageModal, setImageModal] = useState<null | FileUploadDetails>(null);
  const onRequestNextPage = useCallback(
    (current: FileUploadDetails) => {
      if (
        allAttachments.filter((a) => "cloudflareImagesId" in a.data).length > 1
      ) {
        let index = allAttachments.findIndex((a) => a.id === current.id);
        while (index < allAttachments.length - 1) {
          index++;
          if ("cloudflareImagesId" in allAttachments[index].data) {
            setImageModal((allAttachments[index] as FileUploadAttachment).data);
            return;
          }
        }
      }
    },
    [allAttachments]
  );

  const onRequestPreviousPage = useCallback(
    (current: FileUploadDetails) => {
      if (
        allAttachments.filter((a) => "cloudflareImagesId" in a.data).length > 1
      ) {
        let index = allAttachments.findIndex((a) => a.id === current.id);
        while (index > 0) {
          index--;
          if ("cloudflareImagesId" in allAttachments[index].data) {
            setImageModal((allAttachments[index] as FileUploadAttachment).data);
            return;
          }
        }
      }
    },
    [allAttachments]
  );

  return (
    <EditorAttachmentProgressProvider>
      {imageModal && (
        <ImageDisplayModal
          onRequestNextPage={onRequestNextPage}
          onRequestPreviousPage={onRequestPreviousPage}
          fileUpload={imageModal}
          onRequestClose={() => setImageModal(null)}
        />
      )}
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
            allAttachments.length > 0 ? ` border-t border-gray-50 pb-2` : ""
          }
        >
          <AnimatePresence initial={false}>
            {allAttachments.map((attachment) => {
              if (attachment.type === "MapBookmark") {
                return (
                  <BookmarkItem
                    onClick={onMapBookmarkClick}
                    key={attachment.data.id}
                    bookmark={attachment.data}
                    removeBookmark={removeAttachment}
                    highlighted={Boolean(
                      hoveredAttachmentId === attachment.data.id
                    )}
                    onHover={(id) => setHoveredAttachmentId(id || null)}
                    hasErrors={Boolean(
                      bookmarkErrors.find((e) => e.id === attachment.data.id)
                    )}
                  />
                );
              } else if (attachment.type === "FileUpload") {
                return (
                  <FileUploadItem
                    key={attachment.data.id}
                    fileUpload={attachment.data}
                    removeAttachment={removeAttachment}
                    highlighted={Boolean(
                      hoveredAttachmentId === attachment.data.id
                    )}
                    onHover={(id) => setHoveredAttachmentId(id || null)}
                    hasErrors={false}
                    onClick={(upload) => {
                      if (upload.cloudflareImagesId) {
                        setImageModal(upload);
                      }
                    }}
                  />
                );
              }
            })}
          </AnimatePresence>
        </div>
      </div>
      <EditorMenuBar
        createMapBookmark={createMapBookmark}
        createFileUpload={createFileUpload}
        view={viewRef.current}
        className=" border-t"
        style={{
          backgroundColor: "rgb(252, 252, 252)",
        }}
        state={state}
        schema={schema}
      />
    </EditorAttachmentProgressProvider>
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

export type FileUploadAttachment = {
  type: "FileUpload";
  data: Pick<
    FileUploadDetailsFragment,
    | "contentType"
    | "id"
    | "fileSizeBytes"
    | "filename"
    | "downloadUrl"
    | "cloudflareImagesId"
  >;
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

function attachmentsFromState(
  state: Node
): (MapBookmarkAttachment | FileUploadAttachment)[] {
  if (state && state.type && state.content.size) {
    let node: Node | null = null;
    state.forEach((n) => {
      if (n.type === forumPosts.schema.nodes.attachments) {
        node = n;
      }
    });
    if (node !== null) {
      const attachments: (MapBookmarkAttachment | FileUploadAttachment)[] = [];
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
