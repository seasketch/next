import { DOMSerializer, Node as PMNode } from "prosemirror-model";
import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { layerCommentSchema } from "./layerCommentSchema";

const serializer = DOMSerializer.fromSchema(layerCommentSchema);

export default function ResolvableLayerCommentBody({
  documentJson,
  className,
  emptyMessage,
}: {
  documentJson?: Record<string, unknown> | null;
  className?: string;
  emptyMessage?: ReactNode;
}) {
  const target = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<Error>();
  const { t } = useTranslation("admin:data");

  useLayoutEffect(() => {
    setError(undefined);
    if (target.current) {
      target.current.innerHTML = "";
    }
    if (target.current && documentJson) {
      try {
        const doc = PMNode.fromJSON(layerCommentSchema, documentJson);
        const frag = serializer.serializeFragment(doc.content);
        target.current.appendChild(frag);
      } catch (e) {
        setError(e as Error);
      }
    }
  }, [documentJson]);

  if (!documentJson) {
    return (
      <div className={className}>
        {emptyMessage || (
          <p className="text-sm text-gray-500">{t("No comment text.")}</p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {t("Unable to render comment.")}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`layer-comment-body prose prose-sm max-w-none text-gray-800 [&_.mention]:font-medium [&_.mention]:text-primary-600 ${className || ""}`}
      ref={target}
    />
  );
}
