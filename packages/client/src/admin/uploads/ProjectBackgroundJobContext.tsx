import {
  AnimatePresence,
  motion,
} from "framer-motion";
import {
  ArchiveIcon,
  CollectionIcon,
  DocumentTextIcon,
  MapIcon,
  UploadIcon,
} from "@heroicons/react/outline";
import {
  createContext,
  DragEvent,
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
import { ExclamationCircleIcon } from "@heroicons/react/outline";
import useProjectId from "../../useProjectId";
import { useApolloClient } from "@apollo/client";

import { MapManagerContext } from "../../dataLayers/MapContextManager";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import ProjectBackgroundJobManager, {
  DataUploadErrorEvent,
  DataUploadProcessingCompleteEvent,
} from "./ProjectBackgroundJobManager";
import sleep from "../../sleep";
import ConvertFeatureLayerToHostedModal from "../data/arcgis/ConvertFeatureLayerToHostedModal";
import AiDataAnalystUploadPromptModal from "./AiDataAnalystUploadPromptModal";

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
  icon: (props: { className?: string }) => JSX.Element;
}[] = [
  {
    id: "geojson",
    label: "GeoJSON",
    extensions: ".geojson, .json",
    icon: MapIcon,
  },
  {
    id: "shapefileZip",
    label: "Shapefile (zipped)",
    extensions: ".zip",
    icon: ArchiveIcon,
  },
  {
    id: "geotiff",
    label: "GeoTiff",
    extensions: ".tif, .tiff",
    icon: CollectionIcon,
  },
  {
    id: "netcdf",
    label: "NetCDF",
    extensions: ".nc, .nc4",
    icon: UploadIcon,
  },
  {
    id: "flatgeobuf",
    label: "FlatGeobuf",
    extensions: ".fgb",
    icon: DocumentTextIcon,
  },
];

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

function detectDraggedFileName(dataTransfer: DataTransfer | null): string | null {
  if (!dataTransfer) return null;
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return dataTransfer.files[0].name || null;
  }
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const firstItem = dataTransfer.items[0];
    if (firstItem.kind === "file") {
      const file = firstItem.getAsFile();
      if (file?.name) {
        return file.name;
      }
      const fileSystemEntry =
        (firstItem as unknown as { webkitGetAsEntry?: () => { name?: string } })
          .webkitGetAsEntry?.() || null;
      if (fileSystemEntry?.name) {
        return fileSystemEntry.name;
      }
    }
  }
  return null;
}

function detectSupportedFormatFromMime(
  mimeType: string | null | undefined
): SupportedSpatialFormat | null {
  if (!mimeType) return null;
  const normalized = mimeType.toLowerCase();
  if (
    normalized === "application/geo+json" ||
    normalized === "application/vnd.geo+json" ||
    normalized === "application/json"
  ) {
    return "geojson";
  }
  if (
    normalized === "application/zip" ||
    normalized === "application/x-zip-compressed" ||
    normalized === "multipart/x-zip"
  ) {
    return "shapefileZip";
  }
  if (
    normalized === "image/tiff" ||
    normalized === "image/geotiff" ||
    normalized === "application/geotiff" ||
    normalized === "application/x-geotiff"
  ) {
    return "geotiff";
  }
  if (
    normalized === "application/x-netcdf" ||
    normalized === "application/netcdf"
  ) {
    return "netcdf";
  }
  if (normalized === "application/flatgeobuf") {
    return "flatgeobuf";
  }
  return null;
}

function detectDraggedFilePreview(dataTransfer: DataTransfer | null): {
  fileName: string | null;
  format: SupportedSpatialFormat | null;
} {
  const fileName = detectDraggedFileName(dataTransfer);
  if (fileName) {
    return {
      fileName,
      format: detectSupportedFormat(fileName),
    };
  }
  if (dataTransfer?.items) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind === "file") {
        const format = detectSupportedFormatFromMime(item.type);
        if (format) {
          return {
            fileName: null,
            format,
          };
        }
      }
    }
  }
  return {
    fileName: null,
    format: null,
  };
}

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
    uploads: DataUploadDetailsFragment[];
    error?: string;
    manager?: ProjectBackgroundJobManager;
    disabled?: boolean;
    uploadType: UploadType;
    isUploadingReplacement: boolean;
    replaceTableOfContentsItemId: number | null;
    finishedWithChangelog: boolean;
    changelog?: string;
    aiDataAnalystUploadPromptOpen: boolean;
    activeFileName: string | null;
    detectedFormat: SupportedSpatialFormat | null;
  }>({
    droppedFiles: 0,
    uploads: [],
    disabled: false,
    uploadType: "create",
    isUploadingReplacement: false,
    replaceTableOfContentsItemId: null,
    finishedWithChangelog: true,
    aiDataAnalystUploadPromptOpen: false,
    activeFileName: null,
    detectedFormat: null,
  });
  const client = useApolloClient();
  const dragDepthRef = useRef(0);
  const { manager } = useContext(MapManagerContext);
  const onError = useGlobalErrorHandler();
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
        setState((prev) => ({
          ...prev,
          droppedFiles: 0,
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
      setState((prev) => ({
        ...prev,
        manager,
      }));
      return () => {
        manager.destroy();
      };
    }
  }, [client, slug, projectId, manager, alert, onError, t]);

  const { confirm } = useDialog();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      dragDepthRef.current = 0;
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
        alert(t("You can only upload one file to update a layer."), {
          description: t(
            "To replace a layer, upload a single file that will replace the existing layer. Close the data source editor if you would like to create new layers."
          ),
        });
        return;
      }

      const firstFileName = acceptedFiles[0]?.name || null;
      setState((prev) => ({
        ...prev,
        activeFileName: firstFileName,
        detectedFormat: detectSupportedFormat(firstFileName),
      }));

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

      setState((prev) => ({
        ...prev,
        droppedFiles: filteredFiles.length,
        error: undefined,
        activeFileName: filteredFiles[0]?.name || null,
        detectedFormat: detectSupportedFormat(filteredFiles[0]?.name || null),
      }));

      if (state.manager) {
        if (state.uploadType === "replace") {
          setState((prev) => ({
            ...prev,
            isUploadingReplacement: true,
            finishedWithChangelog: false,
          }));
        }
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
          .then(() => {
            setState((prev) => ({
              ...prev,
              droppedFiles: 0,
              activeFileName: null,
              detectedFormat: null,
            }));
          })
          .catch((e) => {
            setState((prev) => ({
              ...prev,
              droppedFiles: 0,
              isUploadingReplacement: false,
              finishedWithChangelog: true,
              activeFileName: null,
              detectedFormat: null,
            }));
            if (/quota exceeded/.test(e.message)) {
              alert(t("Quota Exceeded"), {
                description: (
                  <Trans ns="admin:data">
                    This project has exceeded its data storage quota. Please
                    delete some data to make room for new uploads. You can see
                    how much space your layers are using by selecting{" "}
                    <b>View {"->"} Data Hosting Quota</b> from the toolbar.
                  </Trans>
                ),
              });
            } else {
              onError(e);
            }
          });
      }
    },
    [
      alert,
      confirm,
      onError,
      state.manager,
      t,
      state.uploadType,
      state.replaceTableOfContentsItemId,
    ]
  );

  const updateDragPreview = useCallback((event: DragEvent<HTMLElement>) => {
    const preview = detectDraggedFilePreview(event.dataTransfer);
    setState((prev) => ({
      ...prev,
      activeFileName: preview.fileName ?? prev.activeFileName,
      detectedFormat: preview.format ?? prev.detectedFormat,
      error: undefined,
    }));
  }, []);

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      dragDepthRef.current += 1;
      updateDragPreview(event);
    },
    [updateDragPreview]
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      updateDragPreview(event);
    },
    [updateDragPreview]
  );

  const onDragLeave = useCallback(() => {
    setState((prev) => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current > 0 || prev.droppedFiles > 0) {
        return prev;
      }
      return {
        ...prev,
        activeFileName: null,
        detectedFormat: null,
      };
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter,
    onDragOver,
    onDragLeave,
    noClick: true,
  });

  const showOverlay = isDragActive || state.droppedFiles > 0;

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
                      <motion.div
                        className="inline-flex items-center px-3 py-1.5 rounded-full mb-4 text-sm font-medium"
                        style={{
                          background: "rgba(14, 116, 144, 0.12)",
                          color: "rgb(14, 116, 144)",
                        }}
                        animate={{
                          scale: [1, 1.04, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <UploadIcon className="w-4 h-4 mr-2" />
                        {t("Spatial Data Upload")}
                      </motion.div>
                      <h4 className="font-semibold text-2xl text-gray-900">
                        {state.uploadType === "create"
                          ? t("Drop Files Here to Upload")
                          : t("Drop a file to update this layer")}
                      </h4>
                      <p className="text-sm text-gray-700 mt-2">
                        {t(
                          "SeaSketch currently supports vector data in GeoJSON, Shapefile (zipped), GeoTiff, NetCDF and FlatGeobuf formats."
                        )}
                      </p>
                      <AnimatePresence>
                        {(state.activeFileName || state.detectedFormat) && (
                          <motion.div
                            className="mt-5 mx-auto rounded-lg px-4 py-2.5 max-w-xl text-sm text-left"
                            style={{
                              background: "rgba(15, 23, 42, 0.06)",
                              border: "1px solid rgba(15, 23, 42, 0.08)",
                            }}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                          >
                            <div className="font-medium text-gray-900 truncate">
                              {state.activeFileName || t("File being dragged")}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {state.detectedFormat
                                ? t("Detected format: {{format}}", {
                                    format:
                                      SUPPORTED_FORMATS.find(
                                        (format) =>
                                          format.id === state.detectedFormat
                                      )?.label || t("Unknown"),
                                  })
                                : t(
                                    "Format not recognized from extension yet."
                                  )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-6 text-left">
                        {SUPPORTED_FORMATS.map((format) => {
                          const Icon = format.icon;
                          const active = format.id === state.detectedFormat;
                          return (
                            <motion.div
                              key={format.id}
                              className={`rounded-xl p-3 ${
                                active
                                  ? "ring-2 ring-cyan-500 shadow-md"
                                  : "ring-1 ring-gray-200"
                              }`}
                              style={{
                                background: active
                                  ? "linear-gradient(180deg, rgba(236,254,255,0.98) 0%, rgba(240,249,255,0.95) 100%)"
                                  : "rgba(255,255,255,0.75)",
                              }}
                              animate={
                                active
                                  ? {
                                      y: [0, -2, 0],
                                    }
                                  : { y: 0 }
                              }
                              transition={{
                                duration: 1.4,
                                repeat: active ? Infinity : 0,
                                ease: "easeInOut",
                              }}
                            >
                              <div
                                className={`rounded-lg w-8 h-8 flex items-center justify-center mb-2 ${
                                  active
                                    ? "bg-cyan-100 text-cyan-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="font-medium text-sm text-gray-900">
                                {t(format.label)}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {format.extensions}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {Boolean(state.droppedFiles) && !state.error && (
                        <motion.div
                          className="text-sm flex items-center text-center w-full justify-center space-x-2 mt-6 text-gray-700"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <span>{t("Starting upload")}</span>
                          <Spinner />
                        </motion.div>
                      )}
                      {state.error && (
                        <div className="text-sm flex items-center text-center w-full justify-center space-x-2 mt-6 text-red-900">
                          <ExclamationCircleIcon className="w-5 h-5 text-red-900" />
                          <span>{state.error}</span>
                        </div>
                      )}
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
