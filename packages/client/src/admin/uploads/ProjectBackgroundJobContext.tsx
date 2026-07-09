import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";
import {
  DataUploadDetailsFragment,
  DraftTableOfContentsDocument,
  GetLayerItemDocument,
  GetMetadataDocument,
  JobDetailsFragment,
  LayersAndSourcesForItemsDocument,
  LayerTotalQuotaUsedDocument,
  ProjectDataQuotaRemainingDocument,
  QuotaUsageDetailsDocument,
  useProjectBackgroundJobsQuery,
} from "../../generated/graphql";
import { Trans, useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import Spinner from "../../components/Spinner";
import Button from "../../components/Button";
import { ExclamationCircleIcon } from "@heroicons/react/outline";
import useProjectId from "../../useProjectId";
import { useApolloClient } from "@apollo/client";

import { MapManagerContext } from "../../dataLayers/MapContextManager";
import useDialog from "../../components/useDialog";
import ProjectBackgroundJobManager, {
  DataUploadErrorEvent,
  DataUploadProcessingCompleteEvent,
} from "./ProjectBackgroundJobManager";
import sleep from "../../sleep";
import ConvertFeatureLayerToHostedModal from "../data/arcgis/ConvertFeatureLayerToHostedModal";
import AiDataAnalystUploadPromptModal from "./AiDataAnalystUploadPromptModal";
import AiDataAnalystUploadReminderModal from "./AiDataAnalystUploadReminderModal";

export type UploadType = "create" | "replace";

type SupportedSpatialFormat =
  | "geojson"
  | "shapefileZip"
  | "geotiff"
  | "netcdf"
  | "flatgeobuf";

const SUPPORTED_FORMATS: {
  id: SupportedSpatialFormat;
  label: string;
  extensions: string;
  tag: string;
}[] = [
  {
    id: "geojson",
    label: "GeoJSON",
    extensions: ".geojson, .json",
    tag: "JSON",
  },
  {
    id: "shapefileZip",
    label: "Shapefile (zipped)",
    extensions: ".zip",
    tag: "ZIP",
  },
  {
    id: "geotiff",
    label: "GeoTiff",
    extensions: ".tif, .tiff",
    tag: "TIFF",
  },
  {
    id: "netcdf",
    label: "NetCDF",
    extensions: ".nc, .nc4",
    tag: "NC",
  },
  {
    id: "flatgeobuf",
    label: "FlatGeobuf",
    extensions: ".fgb",
    tag: "FGB",
  },
];

// A generic "document" glyph (a page with a folded corner) used to represent
// every supported format. The format-specific text lives outside the icon (name
// + extensions); the icon only carries a short, uppercase type tag on its label
// band so the card reads clearly without relying on bespoke iconography.
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

function fileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return fileName.slice(dotIndex).toLowerCase();
}

function detectSupportedFormat(
  fileName: string | null
): SupportedSpatialFormat | null {
  if (!fileName) return null;
  const ext = fileExtension(fileName);
  switch (ext) {
    case ".geojson":
    case ".json":
      return "geojson";
    case ".zip":
      return "shapefileZip";
    case ".tif":
    case ".tiff":
      return "geotiff";
    case ".nc":
    case ".nc4":
      return "netcdf";
    case ".fgb":
      return "flatgeobuf";
    default:
      return null;
  }
}

type DroppedFileInfo = {
  name: string;
  format: SupportedSpatialFormat | null;
};

// How long the drop confirmation lingers before fading out and handing off to
// the background job queue UI. Errors cancel this and require manual dismissal.
const OVERLAY_DISMISS_DELAY = 1000;

export const ProjectBackgroundJobContext = createContext<{
  jobs: JobDetailsFragment[];
  manager?: ProjectBackgroundJobManager;
  setDisabled: (disabled: boolean) => void;
  handleFiles: (files: File[]) => void;
  openHostFeatureLayerOnSeaSketchModal: (tocId: number) => void;
  uploadType: UploadType;
  setUploadType: (type: UploadType, sourceId?: number) => void;
  dragActive: boolean;
  replaceTableOfContentsItemId: number | null;
  browseForFiles: (multiple?: boolean) => void;
}>({
  jobs: [],
  setDisabled: () => {},
  handleFiles: () => {},
  openHostFeatureLayerOnSeaSketchModal: (tocId: number) => {},
  uploadType: "create",
  setUploadType: () => {},
  dragActive: false,
  replaceTableOfContentsItemId: null,
  browseForFiles: (multiple?: boolean) => {},
});

export default function DataUploadDropzone({
  children,
  className,
  slug,
}: {
  children?: ReactNode;
  className?: string;
  slug: string;
}) {
  const projectId = useProjectId();
  const [state, setState] = useState<{
    droppedFiles: number;
    droppedFileInfos: DroppedFileInfo[];
    uploads: DataUploadDetailsFragment[];
    error?: ReactNode;
    manager?: ProjectBackgroundJobManager;
    disabled?: boolean;
    uploadType: UploadType;
    isUploadingReplacement: boolean;
    replaceTableOfContentsItemId: number | null;
    finishedWithChangelog: boolean;
    changelog?: string;
    aiDataAnalystUploadPromptOpen: boolean;
    aiDataAnalystUploadReminderOpen: boolean;
  }>({
    droppedFiles: 0,
    droppedFileInfos: [],
    uploads: [],
    disabled: false,
    uploadType: "create",
    isUploadingReplacement: false,
    replaceTableOfContentsItemId: null,
    finishedWithChangelog: true,
    aiDataAnalystUploadPromptOpen: false,
    aiDataAnalystUploadReminderOpen: false,
  });
  const client = useApolloClient();
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { manager } = useContext(MapManagerContext);
  const { alert } = useDialog();
  const { t } = useTranslation("admin:data");
  const [hostOnSeaSketch, setHostOnSeasketch] = useState<null | number>(null);

  const jobsQuery = useProjectBackgroundJobsQuery({
    variables: {
      slug,
    },
  });

  useEffect(() => {
    const mapManager = manager;
    if (projectId && mapManager) {
      const manager = new ProjectBackgroundJobManager(slug, projectId, client);
      manager.on(
        "upload-processing-complete",
        (event: DataUploadProcessingCompleteEvent) => {
          client
            .refetchQueries({
              include: [
                DraftTableOfContentsDocument,
                ProjectDataQuotaRemainingDocument,
                QuotaUsageDetailsDocument,
                LayersAndSourcesForItemsDocument,
                GetLayerItemDocument,
                LayerTotalQuotaUsedDocument,
              ],
            })
            .then(() => {
              if (event.isFromCurrentSession && event.layerStaticIds.length) {
                mapManager.showTocItems(event.layerStaticIds);
              }
            });
        }
      );
      manager.on(
        "feature-layer-conversion-complete",
        (event: DataUploadProcessingCompleteEvent) => {
          client.refetchQueries({
            include: [
              DraftTableOfContentsDocument,
              ProjectDataQuotaRemainingDocument,
              LayersAndSourcesForItemsDocument,
              GetLayerItemDocument,
              GetMetadataDocument,
            ],
          });
        }
      );
      manager.on("upload-error", (event: DataUploadErrorEvent) => {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
        setState((prev) => ({
          ...prev,
          droppedFiles: 0,
          droppedFileInfos: [],
          error: event.error,
          isUploadingReplacement: false,
        }));
      });
      manager.on("file-uploaded", (event) => {
        setState((prev) => ({
          ...prev,
          isUploadingReplacement: false,
        }));
      });
      manager.on("ai-data-analyst-upload-prompt-needed", () => {
        setState((prev) => ({
          ...prev,
          aiDataAnalystUploadPromptOpen: true,
        }));
      });
      manager.on("ai-data-analyst-upload-reminder-needed", () => {
        setState((prev) => ({
          ...prev,
          aiDataAnalystUploadReminderOpen: true,
        }));
      });
      setState((prev) => ({
        ...prev,
        manager,
      }));
      return () => {
        manager.destroy();
      };
    }
  }, [client, slug, projectId, manager, alert, t]);

  const { confirm } = useDialog();

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  // Fade the drop confirmation away after a short delay so the persistent job
  // queue UI can take over. Cancelled if an error needs manual dismissal.
  const scheduleDismiss = useCallback(
    (delay: number) => {
      clearDismissTimer();
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        setState((prev) => {
          if (prev.error) {
            return prev;
          }
          return {
            ...prev,
            droppedFiles: 0,
            droppedFileInfos: [],
          };
        });
      }, delay);
    },
    [clearDismissTimer]
  );

  const dismissOverlay = useCallback(() => {
    clearDismissTimer();
    setState((prev) => ({
      ...prev,
      droppedFiles: 0,
      droppedFileInfos: [],
      error: undefined,
    }));
  }, [clearDismissTimer]);

  useEffect(() => clearDismissTimer, [clearDismissTimer]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      clearDismissTimer();
      function isUploadForSupported(file: File) {
        let message: string | null = null;
        let isPartOfShapefile = false;
        let isUnsupportedRaster = false;
        if (file.name.endsWith(".docx")) {
          message = t(`"${file.name}" is a Word document.`);
        } else if (file.name.endsWith(".xlsx")) {
          message = t(`"${file.name}" is an Excel spreadsheet.`);
        } else if (file.name.endsWith(".csv")) {
          message = t(`"${file.name}" is a CSV file.`);
        } else if (file.name.endsWith(".pdf")) {
          message = t(`"${file.name}" is a PDF file.`);
        } else if (file.name.endsWith(".txt")) {
          message = t(`"${file.name}" is a text file.`);
        } else if (file.name.endsWith(".dbf")) {
          message = t(`"${file.name}" is a database file.`);
          isPartOfShapefile = true;
        } else if (file.name.endsWith(".shx")) {
          message = t(`"${file.name}" is a shape index file.`);
          isPartOfShapefile = true;
        } else if (file.name.endsWith(".sbn")) {
          message = t(`"${file.name}" is a shape index file.`);
          isPartOfShapefile = true;
        } else if (file.name.endsWith(".sbx")) {
          message = t(`"${file.name}" is a shape index file.`);
          isPartOfShapefile = true;
        } else if (file.name.endsWith(".cpg")) {
          message = t(`"${file.name}" is a code page file.`);
          isPartOfShapefile = true;
        } else if (file.name.endsWith(".prj")) {
          message = t(`"${file.name}" is a projection file.`);
          isPartOfShapefile = true;
        } else if (file.name.endsWith(".shp")) {
          message = t(`"${file.name}" should be a zipfile.`);
          isPartOfShapefile = true;
        } else if (file.name.endsWith(".xml")) {
          message = t(`"${file.name}" is an XML file.`);
        } else if (file.name.endsWith(".png")) {
          message = t(`"${file.name}" is a PNG image.`);
          isUnsupportedRaster = true;
        } else if (file.name.endsWith(".jpg") || file.name.endsWith(".jpeg")) {
          message = t(`"${file.name}" is a JPG image.`);
          isUnsupportedRaster = true;
        }
        if (message) {
          const description = isPartOfShapefile
            ? t(
                `Parts of shapefiles cannot be uploaded directly. To upload a shapefile, create a zipfile (.zip) with all related sidecar files (.shp, .prj, .shx, etc). At a minimum, your upload will need to contain the geometry file (.shp) and the projection file (.prj).`
              )
            : isUnsupportedRaster
            ? t(
                `This appears to be an unsupported raster file type. For raster data, upload a GeoTiff.`
              )
            : t(
                "This appears to be a file type which SeaSketch does not support for spatial uploads."
              );
          return {
            message,
            description,
            isPartOfShapefile,
          };
        } else {
          return true;
        }
      }

      if (state.uploadType === "replace" && acceptedFiles.length > 1) {
        setState((prev) => ({
          ...prev,
          droppedFiles: 0,
          droppedFileInfos: [],
          error: (
            <Trans ns="admin:data">
              You can only upload one file to update a layer. To replace a
              layer, drop a single file. Close the data source editor if you
              would like to create new layers instead.
            </Trans>
          ),
        }));
        return;
      }

      const filteredFiles: File[] = [];
      for (const file of acceptedFiles) {
        const supported = isUploadForSupported(file);
        if (supported !== true) {
          const { message, description, isPartOfShapefile } = supported;
          if (isPartOfShapefile) {
            alert(message, {
              description,
            });
          } else {
            const response = await confirm(message, {
              description,
              secondaryButtonText: "Upload anyway",
              primaryButtonText: "Cancel",
            });
            if (!response) {
              filteredFiles.push(file);
              // Something weird happens when opening these confirm dialogs over and over again
              await sleep(100);
            }
          }
        } else {
          filteredFiles.push(file);
        }
      }

      if (filteredFiles.length === 0) {
        return;
      }

      const droppedFileInfos: DroppedFileInfo[] = filteredFiles.map((file) => ({
        name: file.name,
        format: detectSupportedFormat(file.name),
      }));

      setState((prev) => ({
        ...prev,
        droppedFiles: filteredFiles.length,
        droppedFileInfos,
        error: undefined,
      }));

      if (state.manager) {
        if (state.uploadType === "replace") {
          setState((prev) => ({
            ...prev,
            isUploadingReplacement: true,
            finishedWithChangelog: false,
          }));
        }
        // Keep the confirmation visible briefly, then fade out and let the
        // background job queue UI report on progress from here.
        scheduleDismiss(OVERLAY_DISMISS_DELAY);
        state.manager
          .uploadFiles(
            filteredFiles,
            state.uploadType === "replace" && state.replaceTableOfContentsItemId
              ? {
                  replaceTableOfContentsItemId:
                    state.replaceTableOfContentsItemId,
                }
              : undefined
          )
          .catch((e) => {
            clearDismissTimer();
            const error: ReactNode = /quota exceeded/.test(e.message) ? (
              <Trans ns="admin:data">
                This project has exceeded its data storage quota. Please delete
                some data to make room for new uploads. You can see how much
                space your layers are using by selecting{" "}
                <b>View {"->"} Data Hosting Quota</b> from the toolbar.
              </Trans>
            ) : (
              e.message
            );
            setState((prev) => ({
              ...prev,
              droppedFiles: 0,
              droppedFileInfos: [],
              isUploadingReplacement: false,
              finishedWithChangelog: true,
              error,
            }));
          });
      }
    },
    [
      alert,
      confirm,
      state.manager,
      t,
      state.uploadType,
      state.replaceTableOfContentsItemId,
      scheduleDismiss,
      clearDismissTimer,
    ]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });

  const showOverlay =
    isDragActive || state.droppedFiles > 0 || Boolean(state.error);

  const phase: "hover" | "processing" | "error" = state.error
    ? "error"
    : state.droppedFiles > 0
    ? "processing"
    : "hover";

  const droppedFormatIds = new Set(
    state.droppedFileInfos
      .map((f) => f.format)
      .filter((f): f is SupportedSpatialFormat => Boolean(f))
  );

  const singleDroppedFile =
    state.droppedFileInfos.length === 1 ? state.droppedFileInfos[0] : null;

  const setDisabled = useCallback(
    (disabled: boolean) => {
      setState((prev) => ({
        ...prev,
        disabled,
      }));
    },
    [setState]
  );

  return (
    <ProjectBackgroundJobContext.Provider
      value={{
        jobs: jobsQuery.data?.projectBySlug?.projectBackgroundJobs || [],
        manager: state.manager,
        setDisabled,
        handleFiles: onDrop,
        browseForFiles: (multiple?: boolean) => {
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = ".zip,.json,.geojson,.fgb,.tif,.tiff";
          fileInput.multiple = multiple || false;
          fileInput.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files) {
              return;
            }
            onDrop([...files]);
          };
          fileInput.click();
        },
        openHostFeatureLayerOnSeaSketchModal: setHostOnSeasketch,
        uploadType: state.uploadType,
        setUploadType: (uploadType, itemId) => {
          if (uploadType === "create") {
            setState((prev) => ({
              ...prev,
              uploadType,
              replaceTableOfContentsItemId: null,
            }));
          } else {
            if (!itemId) {
              throw new Error(
                "table of contents item id is required for replace upload type"
              );
            } else {
              setState((prev) => ({
                ...prev,
                uploadType,
                replaceTableOfContentsItemId: itemId,
              }));
            }
          }
        },
        dragActive: isDragActive,
        replaceTableOfContentsItemId: state.replaceTableOfContentsItemId,
      }}
    >
      <div
        {...(state.disabled || state.isUploadingReplacement
          ? {}
          : getRootProps())}
        // eslint-disable-next-line jsx-a11y/aria-role
        role=""
        className={className}
      >
        {hostOnSeaSketch && (
          <ConvertFeatureLayerToHostedModal
            tocId={hostOnSeaSketch}
            onRequestClose={() => setHostOnSeasketch(null)}
          />
        )}
        {state.manager && state.aiDataAnalystUploadPromptOpen && (
          <AiDataAnalystUploadPromptModal
            manager={state.manager}
            onFinished={() => {
              setState((prev) => ({
                ...prev,
                aiDataAnalystUploadPromptOpen: false,
              }));
            }}
          />
        )}
        {state.manager && state.aiDataAnalystUploadReminderOpen && (
          <AiDataAnalystUploadReminderModal
            manager={state.manager}
            onFinished={() => {
              setState((prev) => ({
                ...prev,
                aiDataAnalystUploadReminderOpen: false,
              }));
            }}
          />
        )}
        <input {...getInputProps()} className="w-1 h-1" />
        {children}
        {showOverlay &&
          createPortal(
            <AnimatePresence>
              {showOverlay && (
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
                    className="rounded-2xl shadow-xl pointer-events-none max-w-3xl w-full mx-6 overflow-hidden"
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
                                count: state.droppedFileInfos.length,
                              })
                          : state.uploadType === "create"
                          ? t("Drop Files Here to Upload")
                          : t("Drop a file to update this layer")}
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
                          className="flex flex-wrap justify-center gap-3 mt-3"
                        >
                          <AnimatePresence>
                            {SUPPORTED_FORMATS.filter((format) =>
                              phase === "processing"
                                ? droppedFormatIds.has(format.id)
                                : true
                            ).map((format) => {
                              const active = phase === "processing";
                              return (
                                <motion.div
                                  layout
                                  key={format.id}
                                  className={`rounded-xl p-3 w-32 text-center ${
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
                                    animate={
                                      active ? { y: [0, -3, 0] } : { y: 0 }
                                    }
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
                              <div>{state.error}</div>
                            </div>
                            <div className="mt-4 flex justify-center">
                              <Button
                                label={t("Dismiss")}
                                onClick={dismissOverlay}
                              />
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
          )}
      </div>
    </ProjectBackgroundJobContext.Provider>
  );
}
