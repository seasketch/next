import { DOMSerializer, Node } from "prosemirror-model";
import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { metadata as editorConfig } from "../editor/config";

const { schema } = editorConfig;

export default function MetadataDocumentView({
  document,
  className,
  emptyMessage,
}: {
  document?: any;
  className?: string;
  emptyMessage?: ReactNode;
}) {
  const target = useRef<HTMLDivElement>(null);
  const serializer = useRef(DOMSerializer.fromSchema(schema));
  const [error, setError] = useState<Error>();
  const { t } = useTranslation("admin:data");

  useLayoutEffect(() => {
    setError(undefined);
    if (target.current) {
      target.current.innerHTML = "";
    }
    if (target.current && document) {
      try {
        target.current.appendChild(
          serializer.current.serializeFragment(
            Node.fromJSON(schema, document).content
          )
        );
      } catch (e) {
        setError(e as Error);
      }
    }
  }, [document]);

  if (!document) {
    return (
      <div className={className}>
        {emptyMessage || (
          <p className="text-sm text-gray-500">{t("No metadata to display")}</p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {t("Unable to render this metadata revision.")}
        </p>
      </div>
    );
  }

  return <div className={className} ref={target}></div>;
}
