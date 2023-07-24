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
  ProjectDataQuotaRemainingDocument,
  useDataUploadTasksQuery,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import Spinner from "../../components/Spinner";
import { ExclamationCircleIcon } from "@heroicons/react/outline";
import useProjectId from "../../useProjectId";
import { useApolloClient } from "@apollo/client";

import { MapContext } from "../../dataLayers/MapContextManager";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import DataUploadManager, {
  DataUploadErrorEvent,
  DataUploadProcessingCompleteEvent,
} from "./DataUploadManager";

export const DataUploadDropzoneContext = createContext<{
  uploads: DataUploadDetailsFragment[];
  manager?: DataUploadManager;
  setDisabled: (disabled: boolean) => void;
}>({
  uploads: [],
  setDisabled: () => {},
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
    manager?: DataUploadManager;
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

  const uploadsQuery = useDataUploadTasksQuery({
    variables: {
      slug,
    },
  });
  useEffect(() => {
    const mapManager = mapContext.manager;
    if (projectId && mapManager) {
      const manager = new DataUploadManager(slug, projectId, client);
      manager.on(
        "processing-complete",
        (event: DataUploadProcessingCompleteEvent) => {
          client
            .refetchQueries({
              include: [
                DraftTableOfContentsDocument,
                ProjectDataQuotaRemainingDocument,
              ],
            })
            .then(() => {
              if (event.isFromCurrentSession && event.layerStaticIds.length) {
                mapManager.showTocItems(event.layerStaticIds);
              }
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

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setState((prev) => ({
        ...prev,
        droppedFiles: acceptedFiles.length,
      }));

      if (state.manager) {
        state.manager
          .uploadFiles(acceptedFiles)
          .then(() => {
            setState((prev) => ({
              ...prev,
              droppedFiles: 0,
            }));
          })
          .catch((e) => {
            onError(e);
          });
      }
    },
    [onError, state.manager]
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
    <DataUploadDropzoneContext.Provider
      value={{
        uploads: uploadsQuery.data?.projectBySlug?.activeDataUploads || [],
        manager: state.manager,
        setDisabled,
      }}
    >
      <div
        {...(state.disabled ? {} : getRootProps())}
        // eslint-disable-next-line jsx-a11y/aria-role
        role=""
        className={className}
      >
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
    </DataUploadDropzoneContext.Provider>
  );
}
