import { AnimatePresence, motion } from "framer-motion";
import { TrashIcon } from "@heroicons/react/solid";
import { FileUploadDetailsFragment } from "../../generated/graphql";
import { FileIcon, defaultStyles } from "react-file-icon";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  EditorAttachmentProgressContext,
  EditorAttachmentProgressProvider,
} from "../../editor/EditorMenuBar";
import { createPortal } from "react-dom";
import { Trans } from "react-i18next";

export type FileUploadDetails = Pick<
  FileUploadDetailsFragment,
  | "id"
  | "filename"
  | "fileSizeBytes"
  | "contentType"
  | "downloadUrl"
  | "cloudflareImagesId"
>;

export default function FileUploadItem({
  fileUpload,
  removeAttachment,
  onHover,
  hasErrors,
  highlighted,
  onClick,
}: {
  removeAttachment?: (id: string) => void;
  fileUpload: FileUploadDetails;
  onHover?: (id?: string) => void;
  hasErrors: Boolean;
  highlighted?: Boolean;
  onClick?: (upload: FileUploadDetails) => void;
}) {
  const extension = fileUpload.filename.split(".").pop();
  const editable = Boolean(removeAttachment);
  const progressContext = useContext(EditorAttachmentProgressContext);
  const progress =
    progressContext?.progress[fileUpload.id] === undefined
      ? 1
      : progressContext?.progress[fileUpload.id];

  return (
    <>
      <motion.button
        onMouseOver={onHover ? () => onHover(fileUpload.id) : undefined}
        onMouseOut={onHover ? () => onHover() : undefined}
        key={fileUpload.id}
        initial={{ opacity: 0.2, scale: 0.25 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => {
          if (onClick) {
            onClick(fileUpload);
          }
        }}
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
        } `}
      >
        <AnimatePresence>
          {progress < 1 && (
            <motion.div
              initial={{
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              animate={{
                opacity: 1,
              }}
              className="absolute left-0 top-0 w-full h-full bg-gray-500 bg-opacity-20 z-10"
              // style={{ backdropFilter: "blur(3px)" }}
            >
              <motion.svg width="96" height="100%" viewBox="0 0 96 50">
                <motion.circle
                  cx="48"
                  cy="25"
                  r="20"
                  stroke="#444"
                  strokeWidth="4"
                  transform={`rotate(-90 48 25)`}
                  style={{
                    transitionProperty: "stroke-dashoffset",
                    transitionDuration: "0.2s",
                  }}
                  strokeDasharray={(2 * Math.PI * 20).toString()}
                  strokeDashoffset={(
                    2 *
                    Math.PI *
                    20 *
                    (1 - progress)
                  ).toString()}
                  fill="transparent"
                />
                <motion.circle
                  cx="48"
                  cy="25"
                  r="20"
                  stroke="#444"
                  strokeWidth="4"
                  opacity={0.2}
                  fill="transparent"
                />
              </motion.svg>
            </motion.div>
          )}
        </AnimatePresence>
        {editable && removeAttachment && (
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

        {fileUpload.cloudflareImagesId && progress === 1 ? (
          <div
            className="flex-1 w-full h-full"
            style={{
              backgroundImage: `url(${fileUpload.downloadUrl + "thumbnail"})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
            }}
          ></div>
        ) : (
          <div className="w-8 flex-1 flex items-center">
            <FileIcon
              extension={extension}
              /* @ts-ignore */
              {...defaultStyles[extension || "txt"]}
            />
          </div>
        )}
        {fileUpload.cloudflareImagesId && progress === 1 ? null : (
          <div className="text-xs truncate px-1 py-0.5 w-full text-center">
            {fileUpload.filename}
          </div>
        )}
      </motion.button>
    </>
  );
}

export function ImageDisplayModal({
  fileUpload,
  onRequestClose,
  onRequestNextPage,
  onRequestPreviousPage,
}: {
  fileUpload: FileUploadDetails;
  onRequestClose: () => void;
  onRequestNextPage?: (current: FileUploadDetails) => void;
  onRequestPreviousPage?: (current: FileUploadDetails) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
    }
  }, [ref, onRequestClose]);

  return createPortal(
    <div
      ref={ref}
      tabIndex={0}
      onClick={onRequestClose}
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(4px)" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onRequestClose();
        } else if (e.key === "ArrowRight") {
          onRequestNextPage?.(fileUpload);
        } else if (e.key === "ArrowLeft") {
          onRequestPreviousPage?.(fileUpload);
        }
      }}
    >
      <div className="relative w-full sm:w-4/5 h-4/5 flex flex-col items-center justify-center">
        <img
          onClick={(e) => e.stopPropagation()}
          src={fileUpload.downloadUrl + "/public"}
          alt={fileUpload.filename}
          className="w-auto h-auto max-w-full max-h-full"
        />
        <div className="hidden bg-white px-5 py-1 rounded mt-1 text-lg space-x-2 sm:flex items-center justify-center max-w-full">
          <span className="inline-block flex-1 truncate">
            {fileUpload.filename}
          </span>
          <button
            className="text-primary-500 underline"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const imageSrc = fileUpload.downloadUrl + "/public";
              const image = await fetch(imageSrc);
              const imageBlog = await image.blob();
              const imageURL = URL.createObjectURL(imageBlog);
              // create a temporary anchor element
              const a = document.createElement("a");
              a.href = imageURL;
              a.target = "_blank";
              a.download = fileUpload.filename;
              // append the anchor element to the body
              document.body.appendChild(a);
              // click the anchor element
              a.click();
              // remove the anchor element from the body
              document.body.removeChild(a);
            }}
            // eslint-disable-next-line i18next/no-literal-string
          >
            <Trans ns="forums">download</Trans>
          </button>
          <button
            className="text-primary-500 underline"
            onClick={onRequestClose}
            // eslint-disable-next-line i18next/no-literal-string
          >
            <Trans ns="forums">close</Trans>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
