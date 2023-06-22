import { AnimatePresence, motion } from "framer-motion";
import { TrashIcon } from "@heroicons/react/solid";
import { FileUploadDetailsFragment } from "../../generated/graphql";
import { FileIcon, defaultStyles } from "react-file-icon";
import { useContext } from "react";
import {
  EditorAttachmentProgressContext,
  EditorAttachmentProgressProvider,
} from "../../editor/EditorMenuBar";

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
    | "id"
    | "filename"
    | "fileSizeBytes"
    | "contentType"
    | "downloadUrl"
    | "cloudflareImagesId"
  >;
  onHover?: (id?: string) => void;
  hasErrors: Boolean;
  highlighted?: Boolean;
}) {
  const extension = fileUpload.filename.split(".").pop();
  const editable = Boolean(removeAttachment);
  const progressContext = useContext(EditorAttachmentProgressContext);
  const progress =
    progressContext?.progress[fileUpload.id] === undefined
      ? 1
      : progressContext?.progress[fileUpload.id];

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
        >
          {/* <img src={fileUpload.downloadUrl + "/thumbnail"} /> */}
        </div>
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
    </motion.a>
  );
}
