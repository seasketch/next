import { DOMSerializer, Node } from "prosemirror-model";
import { useEffect, useMemo, useRef } from "react";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { metadata as editorConfig } from "../editor/config";
import { MetadataXmlFileFragment } from "../generated/graphql";
import { Trans } from "react-i18next";

const { schema } = editorConfig;

export default function MetadataModal({
  document,
  onRequestClose,
  loading,
  error,
  title,
  xml,
  hostedSourceLastUpdated,
}: {
  document?: any;
  onRequestClose: () => void;
  loading: boolean;
  error?: Error;
  title?: string;
  xml?: (MetadataXmlFileFragment & { format?: string }) | null;
  hostedSourceLastUpdated?: string;
}) {
  const target = useRef<HTMLDivElement>(null);
  const serializer = useRef(DOMSerializer.fromSchema(schema));

  const showTitle = useMemo(() => {
    return (
      !loading &&
      !document?.content?.find(
        (node: any) => node.type === "heading" && node.attrs?.level === 1
      )
    );
  }, [document, loading]);

  useEffect(() => {
    if (target.current && document) {
      target.current.innerHTML = "";
      target.current.appendChild(
        serializer.current.serializeFragment(
          Node.fromJSON(schema, document).content
        )
      );
    }
  }, [document]);

  return (
    <Modal loading={loading} title="" onRequestClose={onRequestClose}>
      <>
        <div className="relative metadata mt-3">
          <button
            className="bg-gray-400 bg-opacity-25 z-10 absolute right-0 top-0 -mr-2 rounded-full p-1 cursor-pointer focus:ring-blue-300"
            onClick={onRequestClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="w-5 h-5 text-white"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          {error &&
            // eslint-disable-next-line
            `Error: ${error.message}`}
          {loading && (
            <div className="w-full h-6 flex items-center justify-center">
              <Spinner />
            </div>
          )}
          {showTitle && title && (
            <h1 className="text-2xl font-medium">{title}</h1>
          )}
          <div className="ProseMirror" ref={target}></div>
          {xml && (
            <div className="mt-5 bg-blue-50 p-2 border rounded text-sm">
              <Trans ns="homepage">
                This layer includes metadata in {xml.format} XML format,
                available for{" "}
              </Trans>
              <a
                href={xml.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
                download={xml.filename}
              >
                <Trans ns="homepage">Download</Trans>
              </a>
            </div>
          )}
          {hostedSourceLastUpdated && (
            <p className="mt-5 text-sm bg-gray-50 p-2 border border-gray-300 rounded">
              <Trans ns="homepage">
                This hosted layer was last updated on{" "}
                {new Date(hostedSourceLastUpdated).toLocaleString()}
              </Trans>
            </p>
          )}
        </div>
      </>
    </Modal>
  );
}
