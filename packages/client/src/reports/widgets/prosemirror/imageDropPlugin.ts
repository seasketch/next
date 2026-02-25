/* eslint-disable i18next/no-literal-string */
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { Schema } from "prosemirror-model";

export const imageDropPluginKey = new PluginKey("imageDropPlugin");

type UploadFn = (file: File) => Promise<string>;

let globalPlaceholderCounter = 0;

/**
 * If the cursor is in an empty textblock (e.g. the leftover paragraph after
 * slash-text deletion), delete it and return the block-boundary position.
 * Otherwise return the current selection position unchanged.
 */
function clearEmptyParentBlock(view: EditorView): number {
  const { $from } = view.state.selection;
  if (
    $from.depth > 0 &&
    $from.parent.isTextblock &&
    $from.parent.content.size === 0
  ) {
    const blockStart = $from.before();
    const blockEnd = $from.after();
    const tr = view.state.tr.delete(blockStart, blockEnd);
    const resolvedPos = tr.doc.resolve(
      Math.min(blockStart, tr.doc.content.size)
    );
    tr.setSelection(TextSelection.near(resolvedPos));
    view.dispatch(tr);
    return Math.min(blockStart, view.state.doc.content.size);
  }
  return $from.pos;
}

/**
 * Dispatch an "Uploading image…" placeholder decoration into the editor,
 * upload the file, then replace the placeholder with the real image node.
 * Reuses the same decoration machinery as the drop/paste plugin.
 *
 * If the cursor is inside an empty paragraph (typical after the slash command
 * palette removes the trigger text), that paragraph is deleted first so the
 * placeholder renders cleanly between blocks.
 */
export function uploadImageWithPlaceholder(
  view: EditorView,
  file: File,
  uploadFile: UploadFn,
  schema: Schema
) {
  const imageType = schema.nodes.image;
  if (!imageType) return;

  const id = `img-cmd-${++globalPlaceholderCounter}`;
  const pos = clearEmptyParentBlock(view);

  const addTr = view.state.tr.setMeta(imageDropPluginKey, {
    type: "add",
    pos,
    id,
  });
  view.dispatch(addTr);

  uploadFile(file)
    .then((src) => {
      const removeTr = view.state.tr.setMeta(imageDropPluginKey, {
        type: "remove",
        id,
      });
      view.dispatch(removeTr);

      const node = imageType.create({
        src,
        alt: file.name.replace(/\.[^.]+$/, ""),
      });
      const insertTr = view.state.tr.insert(
        Math.min(pos, view.state.doc.content.size),
        node
      );
      view.dispatch(insertTr);
    })
    .catch(() => {
      const removeTr = view.state.tr.setMeta(imageDropPluginKey, {
        type: "remove",
        id,
      });
      view.dispatch(removeTr);
    });
}

/**
 * Insert a block-level image node at the current selection.
 * Replaces an empty parent textblock if present, otherwise inserts
 * after the current block.
 */
export function insertBlockImage(
  view: EditorView,
  attrs: Record<string, any>,
  schema: Schema
) {
  const imageType = schema.nodes.image;
  if (!imageType) return;
  const node = imageType.create(attrs);
  const { $from } = view.state.selection;

  if (
    $from.depth > 0 &&
    $from.parent.isTextblock &&
    $from.parent.content.size === 0
  ) {
    const tr = view.state.tr.replaceWith($from.before(), $from.after(), node);
    view.dispatch(tr);
  } else {
    const insertPos =
      $from.depth > 0 ? $from.after() : view.state.doc.content.size;
    const tr = view.state.tr.insert(
      Math.min(insertPos, view.state.doc.content.size),
      node
    );
    view.dispatch(tr);
  }
}

/**
 * ProseMirror plugin that handles drag-and-drop of image files.
 * Shows a placeholder decoration while the upload is in progress,
 * then replaces it with the actual image node.
 */
export function createImageDropPlugin(
  schema: Schema,
  uploadFile: UploadFn
): Plugin {
  let placeholderCounter = 0;

  return new Plugin({
    key: imageDropPluginKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, set) {
        set = set.map(tr.mapping, tr.doc);
        const action = tr.getMeta(imageDropPluginKey);
        if (action?.type === "add") {
          const widget = Decoration.widget(
            action.pos,
            () => {
              const placeholder = document.createElement("div");
              placeholder.className = "report-image-placeholder";
              placeholder.style.cssText =
                "display: flex; align-items: center; justify-content: center; " +
                "padding: 1.5em; margin: 0.5em 0; " +
                "border: 2px dashed #d1d5db; border-radius: 0.5rem; " +
                "background: #f9fafb; color: #6b7280; font-size: 0.875rem;";
              placeholder.textContent = "Uploading image…";
              return placeholder;
            },
            { id: action.id }
          );
          set = set.add(tr.doc, [widget]);
        } else if (action?.type === "remove") {
          const found = set.find(
            undefined,
            undefined,
            (spec) => spec.id === action.id
          );
          set = set.remove(found);
        }
        return set;
      },
    },
    props: {
      decorations(state) {
        return imageDropPluginKey.getState(state);
      },
      handleDrop(view, event) {
        const droppedEvent = event as DragEvent;
        if (
          !droppedEvent.dataTransfer ||
          droppedEvent.dataTransfer.files.length === 0
        ) {
          return false;
        }

        const files = Array.from(droppedEvent.dataTransfer.files).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length === 0) return false;

        droppedEvent.preventDefault();
        droppedEvent.stopPropagation();

        const coords = {
          left: droppedEvent.clientX,
          top: droppedEvent.clientY,
        };
        const posResult = view.posAtCoords(coords);
        if (!posResult) return false;

        const imageType = schema.nodes.image;
        if (!imageType) return false;

        for (const file of files) {
          const id = `img-upload-${++placeholderCounter}`;
          const pos = posResult.pos;

          const tr = view.state.tr.setMeta(imageDropPluginKey, {
            type: "add",
            pos,
            id,
          });
          view.dispatch(tr);

          uploadFile(file)
            .then((src) => {
              const removeTr = view.state.tr.setMeta(imageDropPluginKey, {
                type: "remove",
                id,
              });
              view.dispatch(removeTr);

              const node = imageType.create({
                src,
                alt: file.name.replace(/\.[^.]+$/, ""),
              });
              const insertTr = view.state.tr.insert(
                Math.min(pos, view.state.doc.content.size),
                node
              );
              view.dispatch(insertTr);
            })
            .catch(() => {
              const removeTr = view.state.tr.setMeta(imageDropPluginKey, {
                type: "remove",
                id,
              });
              view.dispatch(removeTr);
            });
        }
        return true;
      },
      handlePaste(view, event) {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // Only intercept if the paste is purely image files (no HTML/text content).
        // If there's HTML, let the default ProseMirror paste handler deal with it
        // so that copy-pasting content with images still works via the schema's
        // parseDOM rules.
        const hasHtml = clipboardData.types.includes("text/html");
        const hasText = clipboardData.types.includes("text/plain");
        if (hasHtml || hasText) return false;

        const files = Array.from(clipboardData.files).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length === 0) return false;

        event.preventDefault();

        const imageType = schema.nodes.image;
        if (!imageType) return false;

        for (const file of files) {
          const id = `img-paste-${++placeholderCounter}`;
          const pos = view.state.selection.from;

          const tr = view.state.tr.setMeta(imageDropPluginKey, {
            type: "add",
            pos,
            id,
          });
          view.dispatch(tr);

          uploadFile(file)
            .then((src) => {
              const removeTr = view.state.tr.setMeta(imageDropPluginKey, {
                type: "remove",
                id,
              });
              view.dispatch(removeTr);

              const node = imageType.create({
                src,
                alt: file.name.replace(/\.[^.]+$/, ""),
              });
              const insertTr = view.state.tr.insert(
                Math.min(pos, view.state.doc.content.size),
                node
              );
              view.dispatch(insertTr);
            })
            .catch(() => {
              const removeTr = view.state.tr.setMeta(imageDropPluginKey, {
                type: "remove",
                id,
              });
              view.dispatch(removeTr);
            });
        }
        return true;
      },
    },
  });
}
