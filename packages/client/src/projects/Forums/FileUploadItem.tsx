import { motion } from "framer-motion";
import Spinner from "../../components/Spinner";
import { TrashIcon } from "@heroicons/react/solid";
import {
  FileUpload,
  FileUploadDetailsFragment,
  JobFragment,
  MapBookmarkDetailsFragment,
  useGetBookmarkQuery,
  useMapBookmarkSubscription,
  WorkerJobStatus,
} from "../../generated/graphql";
import { useState, useCallback } from "react";
import { Trans } from "react-i18next";
import WorkerJobDetails from "../../components/WorkerJobDetails";
import { InformationCircleIcon } from "@heroicons/react/outline";
import MapBookmarkDetailsOverlay from "../../components/MapBookmarkDetailsOverlay";
import { FileUploadAttachment } from "./PostContentEditor";
import { FileIcon, defaultStyles } from "react-file-icon";

export default function FileUploadItem({
  fileUpload,
  removeAttachment,
  onHover,
  hasErrors,
  highlighted,
}: {
  removeAttachment?: (id: string) => void;
  fileUpload: Pick<
    FileUploadDetailsFragment,
    "id" | "filename" | "fileSizeBytes" | "contentType" | "downloadUrl"
  >;
  onHover?: (id?: string) => void;
  hasErrors: Boolean;
  highlighted?: Boolean;
}) {
  const extension = fileUpload.filename.split(".").pop();
  const editable = Boolean(removeAttachment);
  return (
    <motion.a
      onMouseOver={onHover ? () => onHover(fileUpload.id) : undefined}
      onMouseOut={onHover ? () => onHover() : undefined}
      key={fileUpload.id}
      initial={{ opacity: 0.2, scale: 0.25 }}
      animate={{ opacity: 1, scale: 1 }}
      href={fileUpload.downloadUrl}
      transition={{
        duration: 0.2,
        type: "spring",
        stiffness: 200,
        velocity: 5,
      }}
      title={undefined}
      exit={{
        opacity: 0,
        scale: 0.25,
        transition: { duration: 0.2, type: "tween" },
      }}
      className={`flex flex-col items-center group overflow-hidden box-content transform float-left ml-3.5 mt-2.5 rounded w-24 2xl:w-27 h-14 2xl:h-16 2xl:ml-2 2xl:mt-2 shadow-sm relative  ${
        hasErrors
          ? "border-red-500 border"
          : highlighted
          ? "border-blue-500 border"
          : "border "
      }`}
    >
      {removeAttachment && (
        <button
          onClick={
            removeAttachment
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeAttachment(fileUpload.id);
                }
              : undefined
          }
          className="group-hover:opacity-100 opacity-0 w-5 text-red-500 h-5 absolute right-2 top-2 z-10"
        >
          <TrashIcon />
        </button>
      )}
      <div className="w-8 flex-1 flex items-center">
        <FileIcon
          extension={extension}
          /* @ts-ignore */
          {...defaultStyles[extension || "txt"]}
        />
      </div>
      <div className="text-xs truncate px-1 py-0.5 w-full text-center">
        {fileUpload.filename}
      </div>
    </motion.a>
  );
}
