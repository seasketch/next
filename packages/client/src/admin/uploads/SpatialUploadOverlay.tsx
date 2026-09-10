import { AnimatePresence, motion } from "framer-motion";
import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ExclamationCircleIcon } from "@heroicons/react/outline";
import Button from "../../components/Button";
import Spinner from "../../components/Spinner";
import {
  SUPPORTED_SPATIAL_FORMATS,
  SupportedSpatialFormat,
} from "./uploadFileTypes";

export type SpatialOverlayPhase = "hover" | "processing" | "error";

export type DroppedSpatialFileInfo = {
  name: string;
  format: SupportedSpatialFormat | null;
};

function DocumentFormatIcon({
  tag,
  active,
  className,
}: {
  tag: string;
  active?: boolean;
  className?: string;
}) {
  const accent = active ? "#0891b2" : "#94a3b8";
  const fold = active ? "#cffafe" : "#e2e8f0";
  return (
    <svg
      className={className}
      viewBox="0 0 54 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M11 4a2 2 0 0 1 2-2h18l12 12v40a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V4Z"
        fill="#ffffff"
        stroke={accent}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M31 2l12 12H33a2 2 0 0 1-2-2V2Z"
        fill={fold}
        stroke={accent}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <rect x="13" y="33" width="30" height="15" rx="3" fill={accent} />
      <text
        x="28"
        y="44.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.3"
        fill="#ffffff"
      >
        {tag}
      </text>
    </svg>
  );
}

export default function SpatialUploadOverlay({
  open,
  phase,
  replaceMode,
  droppedFileInfos,
  error,
  onDismiss,
}: {
  open: boolean;
  phase: SpatialOverlayPhase;
  replaceMode: boolean;
  droppedFileInfos: DroppedSpatialFileInfo[];
  error?: ReactNode;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const droppedFormatIds = new Set(
    droppedFileInfos
      .map((file) => file.format)
      .filter((format): format is SupportedSpatialFormat => Boolean(format))
  );
  const singleDroppedFile =
    droppedFileInfos.length === 1 ? droppedFileInfos[0] : null;

  if (!open) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed top-0 left-0 w-full h-full z-50 flex items-center justify-center pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, rgba(6, 95, 70, 0.28) 0%, rgba(7, 27, 56, 0.55) 70%)",
            backdropFilter: "blur(6px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            layout
            className="rounded-2xl shadow-xl pointer-events-none max-w-lg w-full mx-6 overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,252,255,0.97) 100%)",
              border: "1px solid rgba(255,255,255,0.4)",
            }}
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 6 }}
            transition={{
              type: "spring",
              damping: 28,
              stiffness: 340,
            }}
          >
            <div className="p-7 text-center">
              <h4 className="font-semibold text-2xl text-gray-900 px-2">
                {phase === "error"
                  ? t("We couldn't process that")
                  : phase === "processing"
                  ? singleDroppedFile
                    ? t("Processing {{filename}}", {
                        filename: singleDroppedFile.name,
                      })
                    : t("Processing {{count}} files", {
                        count: droppedFileInfos.length,
                      })
                  : replaceMode
                  ? t("Drop a file to update this layer")
                  : t("Drop Files Here to Upload")}
              </h4>

              <AnimatePresence>
                {phase === "processing" && (
                  <motion.div
                    className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-600"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Spinner />
                    <span>{t("Beginning data processing...")}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {phase === "hover" && (
                <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-6">
                  {t("Supported Formats")}
                </h5>
              )}

              {phase !== "error" && (
                <motion.div
                  layout
                  className={
                    phase === "processing"
                      ? "flex flex-wrap justify-center gap-3 mt-3"
                      : "grid grid-cols-3 gap-3 mt-3 max-w-md mx-auto"
                  }
                >
                  <AnimatePresence>
                    {SUPPORTED_SPATIAL_FORMATS.filter((format) =>
                      phase === "processing"
                        ? droppedFormatIds.has(format.id)
                        : true
                    ).map((format) => {
                      const active = phase === "processing";
                      return (
                        <motion.div
                          layout
                          key={format.id}
                          className={`rounded-xl p-3 text-center ${
                            active ? "w-32" : "w-full"
                          } ${
                            active
                              ? "ring-2 ring-cyan-500 shadow-md"
                              : "ring-1 ring-gray-200"
                          }`}
                          style={{
                            background: active
                              ? "linear-gradient(180deg, rgba(236,254,255,0.98) 0%, rgba(240,249,255,0.95) 100%)"
                              : "rgba(255,255,255,0.75)",
                          }}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{
                            type: "spring",
                            damping: 24,
                            stiffness: 320,
                          }}
                        >
                          <motion.div
                            className="mb-2"
                            animate={active ? { y: [0, -3, 0] } : { y: 0 }}
                            transition={{
                              duration: 1.6,
                              repeat: active ? Infinity : 0,
                              ease: "easeInOut",
                            }}
                          >
                            <DocumentFormatIcon
                              tag={format.tag}
                              active={active}
                              className="w-12 h-14 mx-auto"
                            />
                          </motion.div>
                          <div className="font-medium text-sm text-gray-900">
                            {t(format.label)}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {format.extensions}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              )}

              <AnimatePresence>
                {phase === "error" && (
                  <motion.div
                    layout
                    className="mt-5 mx-auto max-w-xl pointer-events-auto"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className="rounded-lg px-4 py-3 text-sm text-left text-red-900 flex items-start gap-2"
                      style={{
                        background: "rgba(254, 226, 226, 0.7)",
                        border: "1px solid rgba(220, 38, 38, 0.25)",
                      }}
                    >
                      <ExclamationCircleIcon className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-700" />
                      <div>{error}</div>
                    </div>
                    <div className="mt-4 flex justify-center">
                      <Button label={t("Dismiss")} onClick={onDismiss} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
