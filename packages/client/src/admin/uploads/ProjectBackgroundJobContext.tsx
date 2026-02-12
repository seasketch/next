import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
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

export type UploadType = "create" | "replace";

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
  }>({
    droppedFiles: 0,
    uploads: [],
    disabled: false,
    uploadType: "create",
    isUploadingReplacement: false,
    replaceTableOfContentsItemId: null,
    finishedWithChangelog: true,
  });
  const client = useApolloClient();
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
            }));
          })
          .catch((e) => {
            setState((prev) => ({
              ...prev,
              droppedFiles: 0,
              isUploadingReplacement: false,
              finishedWithChangelog: true,
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });

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
        <input {...getInputProps()} className="w-1 h-1" />
        {children}
        {(isDragActive || state.droppedFiles > 0) &&
          createPortal(
            <>
              <div
                className="absolute top-0 left-0 w-full h-full z-50 flex items-center justify-center bg-black bg-opacity-20 pointer-events-none"
                style={{
                  backdropFilter: "blur(5px)",
                }}
              >
                <div className="bg-white rounded p-4 shadow pointer-events-none text-center max-w-lg">
                  <h4 className="font-semibold">
                    {state.uploadType === "create"
                      ? t("Drop Files Here to Upload")
                      : t("Drop a file to update this layer")}
                  </h4>
                  <p className="text-sm">
                    {t(
                      "SeaSketch currently supports vector data in GeoJSON, Shapefile (zipped), GeoTiff, NetCDF and FlatGeobuf formats."
                    )}
                  </p>
                  {Boolean(state.droppedFiles) && !state.error && (
                    <div className="text-sm flex items-center text-center w-full justify-center space-x-2 mt-2">
                      <span>{t("Starting upload")}</span>
                      <Spinner />
                    </div>
                  )}
                  {state.error && (
                    <div className="text-sm flex items-center text-center w-full justify-center space-x-2 mt-2">
                      <ExclamationCircleIcon className="w-5 h-5 text-red-900" />
                      <span>{state.error}</span>
                    </div>
                  )}
                </div>
              </div>
            </>,
            document.body
          )}
      </div>
    </ProjectBackgroundJobContext.Provider>
  );
}
