/* eslint-disable i18next/no-literal-string */
import clsx from "clsx";
import { useEffect, useMemo, useRef } from "react";
import { DOMSerializer, Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { ProseMirror, useProseMirror } from "use-prosemirror";
import { resolvableComments } from "../../../editor/config";
import TooltipMenu from "../../../editor/TooltipMenu";
import {
  BLUR_SELECTION_STYLES,
  createBlurSelectionPlugin,
} from "../../../editor/blurSelectionPlugin";

const { schema, plugins } = resolvableComments;

export function emptyResolvableCommentDoc() {
  return schema.node("doc", null, [schema.node("paragraph")]).toJSON();
}

export function isResolvableCommentDocEmpty(doc: ProseMirrorNode) {
  return doc.textContent.trim().length === 0;
}

export function isResolvableCommentJsonEmpty(document: any) {
  return isResolvableCommentDocEmpty(
    ProseMirrorNode.fromJSON(schema, document)
  );
}

export default function ResolvableCommentEditor({
  value,
  onChange,
  autoFocus,
  placeholder,
  className,
}: {
  value?: any;
  onChange: (value: any, empty: boolean) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [state, setState] = useProseMirror({ schema });
  const viewRef = useRef<{ view: EditorView }>();
  const editorPlugins = useMemo(
    () => [...plugins, createBlurSelectionPlugin()],
    []
  );

  useEffect(() => {
    const doc = value
      ? ProseMirrorNode.fromJSON(schema, value)
      : schema.node("doc", null, [schema.node("paragraph")]);
    const editorState = EditorState.create({
      schema,
      plugins: editorPlugins,
      doc,
    });
    setState(editorState);
    onChange(
      editorState.doc.toJSON(),
      isResolvableCommentDocEmpty(editorState.doc)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoFocus && viewRef.current?.view) {
      viewRef.current.view.focus();
    }
  }, [autoFocus, viewRef.current?.view]);

  return (
    <div className={clsx("resolvable-comment-editor", className)}>
      <style>{BLUR_SELECTION_STYLES}</style>
      <TooltipMenu view={viewRef.current?.view} state={state} schema={schema} />
      <div
        className="relative text-sm text-gray-800"
        data-placeholder={placeholder}
      >
        {placeholder && isResolvableCommentDocEmpty(state.doc) && (
          <div className="pointer-events-none absolute left-0 top-0 text-gray-400">
            {placeholder}
          </div>
        )}
        <ProseMirror
          className="resolvable-comment-body"
          state={state}
          onChange={(nextState: EditorState) => {
            setState(nextState);
            onChange(
              nextState.doc.toJSON(),
              isResolvableCommentDocEmpty(nextState.doc)
            );
          }}
          // @ts-ignore
          ref={viewRef}
        />
      </div>
    </div>
  );
}

export function ResolvableCommentBody({ document }: { document: any }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    root.innerHTML = "";
    try {
      const doc = ProseMirrorNode.fromJSON(schema, document);
      const serializer = DOMSerializer.fromSchema(schema);
      root.appendChild(serializer.serializeFragment(doc.content));
    } catch (e) {
      root.textContent = "";
    }
  }, [document]);

  return <div ref={rootRef} className="resolvable-comment-body text-sm" />;
}
