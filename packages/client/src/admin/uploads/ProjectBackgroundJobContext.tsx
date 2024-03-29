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
  JobDetailsFragment,
  LayersAndSourcesForItemsDocument,
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

import { MapContext } from "../../dataLayers/MapContextManager";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import ProjectBackgroundJobManager, {
  DataUploadErrorEvent,
  DataUploadProcessingCompleteEvent,
} from "./ProjectBackgroundJobManager";
import sleep from "../../sleep";
import ConvertFeatureLayerToHostedModal from "../data/arcgis/ConvertFeatureLayerToHostedModal";

export const ProjectBackgroundJobContext = createContext<{
  jobs: JobDetailsFragment[];
  manager?: ProjectBackgroundJobManager;
  setDisabled: (disabled: boolean) => void;
  handleFiles: (files: File[]) => void;
  openHostFeatureLayerOnSeaSketchModal: (tocId: number) => void;
}>({
  jobs: [],
  setDisabled: () => {},
  handleFiles: () => {},
  openHostFeatureLayerOnSeaSketchModal: (tocId: number) => {},
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
  }>({
    droppedFiles: 0,
    uploads: [],
    disabled: false,
  });
  const client = useApolloClient();
  const mapContext = useContext(MapContext);
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
    const mapManager = mapContext.manager;
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
            ],
          });
        }
      );
      manager.on("upload-error", (event: DataUploadErrorEvent) => {
        setState((prev) => ({
          ...prev,
          droppedFiles: 0,
          error: event.error,
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
  }, [client, slug, projectId, mapContext.manager, alert, onError, t]);

  const { confirm } = useDialog();

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
      message = t(`"${file.name}" is a bare shapefile.`);
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
            `Parts of shapefiles cannot be uploaded directly. To upload a shapefile, create a .zip file with all related files (.shp, .prj, .shx, etc) and upload that zipfile.`
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
      };
    } else {
      return true;
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const filteredFiles: File[] = [];
      for (const file of acceptedFiles) {
        const supported = isUploadForSupported(file);
        if (supported !== true) {
          const { message, description } = supported;
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
        } else {
          filteredFiles.push(file);
        }
      }

      setState((prev) => ({
        ...prev,
        droppedFiles: filteredFiles.length,
      }));

      if (state.manager) {
        state.manager
          .uploadFiles(filteredFiles)
          .then(() => {
            setState((prev) => ({
              ...prev,
              droppedFiles: 0,
            }));
          })
          .catch((e) => {
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
    [alert, confirm, isUploadForSupported, onError, state.manager, t]
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
        openHostFeatureLayerOnSeaSketchModal: setHostOnSeasketch,
      }}
    >
      <div
        {...(state.disabled ? {} : getRootProps())}
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
              <div className="absolute top-0 left-0 w-full h-full z-50 flex items-center justify-center bg-black bg-opacity-20 pointer-events-none">
                <div className="bg-white rounded p-4 shadow pointer-events-none text-center max-w-lg">
                  <h4 className="font-semibold">
                    {t("Drop Files Here to Upload")}
                  </h4>
                  <p className="text-sm">
                    {t(
                      "SeaSketch currently supports vector data in GeoJSON, Shapefile (zipped), GeoTiff, and FlatGeobuf formats."
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
