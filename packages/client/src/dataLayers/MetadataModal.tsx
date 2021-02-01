import { DOMSerializer, Node } from "prosemirror-model";
import React, { useEffect, useRef } from "react";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { schema } from "../editor/config";
import { useGetMetadataQuery } from "../generated/graphql";

export default function MetadataModal({
  id,
  onRequestClose,
}: {
  id: number;
  onRequestClose: () => void;
}) {
  const { data, loading, error } = useGetMetadataQuery({
    variables: {
      itemId: id,
    },
  });
  const target = useRef<HTMLDivElement>(null);
  const serializer = useRef(DOMSerializer.fromSchema(schema));
  const metadata = data?.tableOfContentsItem?.metadata;

  useEffect(() => {
    if (target.current && metadata) {
      target.current.innerHTML = "";
      target.current.appendChild(
        serializer.current.serializeFragment(
          Node.fromJSON(schema, metadata).content
        )
      );
    }
  }, [target.current, metadata]);
  return (
    <Modal onRequestClose={onRequestClose} open={true}>
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
          {loading && <Spinner />}
          <div className="ProseMirror" ref={target}></div>
        </div>
      </>
    </Modal>
  );
}
