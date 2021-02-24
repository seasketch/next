import { DOMSerializer, Node } from "prosemirror-model";
import React, { useEffect, useRef } from "react";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { schema } from "../editor/config";

export default function MetadataModal({
  document,
  onRequestClose,
  loading,
  error,
  title,
}: {
  document?: any;
  onRequestClose: () => void;
  loading: boolean;
  error?: Error;
  title?: string;
}) {
  const target = useRef<HTMLDivElement>(null);
  const serializer = useRef(DOMSerializer.fromSchema(schema));

  useEffect(() => {
    if (target.current && document) {
      target.current.innerHTML = "";
      target.current.appendChild(
        serializer.current.serializeFragment(
          Node.fromJSON(schema, document).content
        )
      );
    }
  }, [target.current, document]);
  return (
    <Modal title={title} onRequestClose={onRequestClose} open={true}>
      <>
        <div className="w-full h-full sm:h-auto md:w-160 lg:pb-4 relative">
          <button
            className="bg-gray-400 bg-opacity-25 z-10 absolute right-0 top-0 rounded-full p-1 cursor-pointer focus:ring-blue-300"
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
          {error && `Error: ${error.message}`}
          {loading && <Spinner />}
          <div className="ProseMirror" ref={target}></div>
        </div>
      </>
    </Modal>
  );
}
