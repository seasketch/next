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
import useProjectId from "../../useProjectId";
import { useApolloClient } from "@apollo/client";

import { MapManagerContext } from "../../dataLayers/MapContextManager";
import useDialog from "../../components/useDialog";
import ProjectBackgroundJobManager, {
  DataUploadErrorEvent,
  DataUploadProcessingCompleteEvent,
} from "./ProjectBackgroundJobManager";
import { dataTableChangeLogRefetchQueries } from "../changelogs/dataTableChangeLogRefetch";
import sleep from "../../sleep";
import ConvertFeatureLayerToHostedModal from "../data/arcgis/ConvertFeatureLayerToHostedModal";
import AiDataAnalystUploadPromptModal from "./AiDataAnalystUploadPromptModal";
import DelimitedUploadConfigModal from "./delimitedSpatial/DelimitedUploadConfigModal";
import { resolveDelimitedUploads } from "./delimitedSpatial/resolveDelimitedUploads";
import { DelimitedUploadProcessingOptions } from "./delimitedSpatial/types";
import AiDataAnalystUploadReminderModal from "./AiDataAnalystUploadReminderModal";
import {
  DataAdminDropTargetProvider,
  useDataAdminDropTarget,
} from "./DataAdminDropTargetContext";
import SpatialUploadOverlay, {
  DroppedSpatialFileInfo,
} from "./SpatialUploadOverlay";
import {
  describeUnsupportedSpatialFile,
  detectSupportedFormat,
  isDelimitedSpatialFile,
  spatialReplaceAllowsMultiple,
  SPATIAL_FILE_ACCEPT,
} from "./uploadFileTypes";

export type UploadType = "create" | "replace";

export type SpatialUploadOptions = {
  replaceTableOfContentsItemId?: number;
};

export const ProjectBackgroundJobContext = createContext<{
  jobs: JobDetailsFragment[];
  manager?: ProjectBackgroundJobManager;
  handleSpatialFiles: (files: File[], options?: SpatialUploadOptions) => void;
  openHostFeatureLayerOnSeaSketchModal: (tocId: number) => void;
  browseForFiles: (multiple?: boolean, options?: SpatialUploadOptions) => void;
}>({
  jobs: [],
  handleSpatialFiles: () => {},
  openHostFeatureLayerOnSeaSketchModal: () => {},
  browseForFiles: () => {},
});

// How long the drop confirmation lingers before fading out and handing off to
// the background job queue UI. Errors cancel this and require manual dismissal.
const OVERLAY_DISMISS_DELAY = 1000;

export default function DataUploadDropzone({
  children,
  className,
  slug,
}: {
  children?: ReactNode;
  className?: string;
  slug: string;
}) {
  return (
    <DataAdminDropTargetProvider>
      <DataUploadDropzoneInner className={className} slug={slug}>
        {children}
      </DataUploadDropzoneInner>
    </DataAdminDropTargetProvider>
  );
}

function DataUploadDropzoneInner({
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
    droppedFileInfos: DroppedSpatialFileInfo[];
    uploads: DataUploadDetailsFragment[];
    error?: ReactNode;
    manager?: ProjectBackgroundJobManager;
    isUploadingReplacement: boolean;
    finishedWithChangelog: boolean;
    changelog?: string;
    aiDataAnalystUploadPromptOpen: boolean;
    pendingDelimitedUpload: {
      delimitedFiles: File[];
      otherFiles: File[];
      autoConfigsByFile: Map<File, DelimitedUploadProcessingOptions>;
      replaceTableOfContentsItemId?: number;
    } | null;
    aiDataAnalystUploadReminderOpen: boolean;
  }>({
    droppedFiles: 0,
    droppedFileInfos: [],
    uploads: [],
    isUploadingReplacement: false,
    pendingDelimitedUpload: null,
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
  const { activeTarget } = useDataAdminDropTarget();

  const jobsQuery = useProjectBackgroundJobsQuery({
    variables: {
      slug,
    },
  });

  useEffect(() => {
    const mapManager = manager;
    if (projectId && mapManager) {
      const jobManager = new ProjectBackgroundJobManager(
        slug,
        projectId,
        client
      );
      jobManager.on(
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
              // hostedTileUuidsRequiringAuth arrives via Draft TOC on the
              // Project entity; MapManagerContextProvider syncs it into the
              // manager. Brief delay so that React effect runs before tiles
              // are requested.
              if (event.isFromCurrentSession && event.layerStaticIds.length) {
                window.setTimeout(() => {
                  mapManager.showTocItems(event.layerStaticIds);
                }, 50);
              }
            });
        }
      );
      jobManager.on("feature-layer-conversion-complete", () => {
        client.refetchQueries({
          include: [
            DraftTableOfContentsDocument,
            ProjectDataQuotaRemainingDocument,
            LayersAndSourcesForItemsDocument,
            GetLayerItemDocument,
            GetMetadataDocument,
          ],
        });
      });
      jobManager.on(
        "data-table-upload-complete",
        (event: { jobId: string; tableOfContentsItemId: number }) => {
          client.refetchQueries({
            include: [
              GetLayerItemDocument,
              DraftTableOfContentsDocument,
              ...dataTableChangeLogRefetchQueries(event.tableOfContentsItemId),
            ],
          });
        }
      );
      jobManager.on("upload-error", (event: DataUploadErrorEvent) => {
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
      jobManager.on("file-uploaded", () => {
        setState((prev) => ({
          ...prev,
          isUploadingReplacement: false,
        }));
      });
      jobManager.on("ai-data-analyst-upload-prompt-needed", () => {
        setState((prev) => ({
          ...prev,
          aiDataAnalystUploadPromptOpen: true,
        }));
      });
      jobManager.on("ai-data-analyst-upload-reminder-needed", () => {
        setState((prev) => ({
          ...prev,
          aiDataAnalystUploadReminderOpen: true,
        }));
      });
      setState((prev) => ({
        ...prev,
        manager: jobManager,
      }));
      return () => {
        jobManager.destroy();
      };
    }
  }, [client, slug, projectId, manager]);

  const { confirm } = useDialog();

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

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

  const startUpload = useCallback(
    (
      filesToUpload: File[],
      processingOptionsByFile?: Map<File, DelimitedUploadProcessingOptions>,
      replaceTableOfContentsItemId?: number
    ) => {
      const droppedFileInfos: DroppedSpatialFileInfo[] = filesToUpload.map(
        (file) => ({
          name: file.name,
          format: detectSupportedFormat(file.name),
        })
      );

      setState((prev) => ({
        ...prev,
        droppedFiles: filesToUpload.length,
        droppedFileInfos,
        error: undefined,
      }));

      if (state.manager) {
        if (replaceTableOfContentsItemId) {
          setState((prev) => ({
            ...prev,
            isUploadingReplacement: true,
            finishedWithChangelog: false,
          }));
        }
        scheduleDismiss(OVERLAY_DISMISS_DELAY);
        state.manager
          .uploadFiles(
            filesToUpload,
            replaceTableOfContentsItemId
              ? {
                  replaceTableOfContentsItemId,
                  processingOptionsByFile,
                }
              : { processingOptionsByFile }
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
    [state.manager, scheduleDismiss, clearDismissTimer]
  );

  const handleSpatialFiles = useCallback(
    async (acceptedFiles: File[], options?: SpatialUploadOptions) => {
      clearDismissTimer();
      const replaceTableOfContentsItemId =
        options?.replaceTableOfContentsItemId;

      if (
        replaceTableOfContentsItemId &&
        !spatialReplaceAllowsMultiple(acceptedFiles.length)
      ) {
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
        const unsupported = describeUnsupportedSpatialFile(file.name);
        if (unsupported) {
          const message =
            unsupported.kind === "docx"
              ? t(`"${file.name}" is a Word document.`)
              : unsupported.kind === "xlsx"
              ? t(`"${file.name}" is an Excel spreadsheet.`)
              : unsupported.kind === "pdf"
              ? t(`"${file.name}" is a PDF file.`)
              : unsupported.kind === "dbf"
              ? t(`"${file.name}" is a database file.`)
              : unsupported.kind === "shapeIndex"
              ? t(`"${file.name}" is a shape index file.`)
              : unsupported.kind === "cpg"
              ? t(`"${file.name}" is a code page file.`)
              : unsupported.kind === "prj"
              ? t(`"${file.name}" is a projection file.`)
              : unsupported.kind === "shp"
              ? t(`"${file.name}" should be a zipfile.`)
              : unsupported.kind === "xml"
              ? t(`"${file.name}" is an XML file.`)
              : unsupported.kind === "png"
              ? t(`"${file.name}" is a PNG image.`)
              : t(`"${file.name}" is a JPG image.`);
          const description =
            unsupported.descriptionKind === "shapefilePart"
              ? t(
                  `Parts of shapefiles cannot be uploaded directly. To upload a shapefile, create a zipfile (.zip) with all related sidecar files (.shp, .prj, .shx, etc). At a minimum, your upload will need to contain the geometry file (.shp) and the projection file (.prj).`
                )
              : unsupported.descriptionKind === "unsupportedRaster"
              ? t(
                  `This appears to be an unsupported raster file type. For raster data, upload a GeoTiff.`
                )
              : t(
                  "This appears to be a file type which SeaSketch does not support for spatial uploads."
                );
          if (unsupported.isPartOfShapefile) {
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

      const delimitedFiles = filteredFiles.filter((file) =>
        isDelimitedSpatialFile(file.name)
      );
      const otherFiles = filteredFiles.filter(
        (file) => !isDelimitedSpatialFile(file.name)
      );
      if (delimitedFiles.length > 0) {
        const resolved = await resolveDelimitedUploads(delimitedFiles);
        const blockingErrors = resolved
          .map((entry) => entry.blockingError)
          .filter((message): message is string => Boolean(message));
        if (blockingErrors.length > 0) {
          alert(blockingErrors.join("\n\n"));
          return;
        }

        const autoConfigsByFile = new Map<
          File,
          DelimitedUploadProcessingOptions
        >();
        const filesNeedingConfig: File[] = [];
        for (const entry of resolved) {
          if (entry.needsConfig) {
            filesNeedingConfig.push(entry.file);
          } else if (entry.processingOptions) {
            autoConfigsByFile.set(entry.file, entry.processingOptions);
          }
        }

        if (filesNeedingConfig.length === 0) {
          startUpload(
            [...otherFiles, ...delimitedFiles],
            autoConfigsByFile,
            replaceTableOfContentsItemId
          );
          return;
        }

        setState((prev) => ({
          ...prev,
          pendingDelimitedUpload: {
            delimitedFiles: filesNeedingConfig,
            otherFiles,
            autoConfigsByFile,
            replaceTableOfContentsItemId,
          },
        }));
        return;
      }

      startUpload(filteredFiles, undefined, replaceTableOfContentsItemId);
    },
    [alert, confirm, t, clearDismissTimer, startUpload]
  );

  const browseForFiles = useCallback(
    (multiple?: boolean, options?: SpatialUploadOptions) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = SPATIAL_FILE_ACCEPT;
      fileInput.multiple = multiple || false;
      fileInput.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files) {
          return;
        }
        handleSpatialFiles([...files], options);
      };
      fileInput.click();
    },
    [handleSpatialFiles]
  );

  const onCancelDelimitedConfig = useCallback(() => {
    setState((prev) => ({ ...prev, pendingDelimitedUpload: null }));
  }, []);

  const onSubmitDelimitedConfig = useCallback(
    (configsByFile: Map<File, DelimitedUploadProcessingOptions>) => {
      const pending = state.pendingDelimitedUpload;
      if (!pending) return;
      setState((prev) => ({ ...prev, pendingDelimitedUpload: null }));
      const processingOptionsByFile = new Map(pending.autoConfigsByFile);
      configsByFile.forEach((options, file) => {
        processingOptionsByFile.set(file, options);
      });
      startUpload(
        [...pending.otherFiles, ...Array.from(processingOptionsByFile.keys())],
        processingOptionsByFile,
        pending.replaceTableOfContentsItemId
      );
    },
    [state.pendingDelimitedUpload, startUpload]
  );

  // Source-tab replacements use a local dropzone on the versions list.
  // The shell dropzone is only for creating new overlay layers.
  const spatialEnabled =
    activeTarget?.intent.kind === "newSpatialLayer" &&
    !state.isUploadingReplacement;
  const replaceMode = Boolean(
    state.pendingDelimitedUpload?.replaceTableOfContentsItemId
  );

  const onPageDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!spatialEnabled) {
        return;
      }
      handleSpatialFiles(acceptedFiles);
    },
    [handleSpatialFiles, spatialEnabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onPageDrop,
    noClick: true,
    disabled: !spatialEnabled,
  });

  const showOverlay =
    Boolean(state.error) ||
    (spatialEnabled && (isDragActive || state.droppedFiles > 0));

  const phase = state.error
    ? "error"
    : state.droppedFiles > 0
    ? "processing"
    : "hover";

  return (
    <ProjectBackgroundJobContext.Provider
      value={{
        jobs: jobsQuery.data?.projectBySlug?.projectBackgroundJobs || [],
        manager: state.manager,
        handleSpatialFiles,
        browseForFiles,
        openHostFeatureLayerOnSeaSketchModal: setHostOnSeasketch,
      }}
    >
      <div
        {...(spatialEnabled ? getRootProps() : {})}
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
        {state.pendingDelimitedUpload && (
          <DelimitedUploadConfigModal
            files={state.pendingDelimitedUpload.delimitedFiles}
            onSubmit={onSubmitDelimitedConfig}
            onCancel={onCancelDelimitedConfig}
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
        {spatialEnabled ? (
          <input {...getInputProps()} className="w-1 h-1" />
        ) : null}
        {children}
        <SpatialUploadOverlay
          open={showOverlay}
          phase={phase}
          replaceMode={replaceMode}
          droppedFileInfos={state.droppedFileInfos}
          error={state.error}
          onDismiss={dismissOverlay}
        />
      </div>
    </ProjectBackgroundJobContext.Provider>
  );
}
