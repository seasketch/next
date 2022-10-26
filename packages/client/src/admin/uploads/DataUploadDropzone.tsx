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
  CancelUploadDocument,
  CancelUploadMutation,
  CreateDataUploadDocument,
  CreateDataUploadMutation,
  DataUploadDetailsFragment,
  DataUploadState,
  DataUploadTasksDocument,
  DataUploadTasksQueryResult,
  DismissFailedTaskDocument,
  DismissFailedTaskMutation,
  DraftTableOfContentsDocument,
  FailUploadDocument,
  FailUploadMutation,
  ProjectDataQuotaRemainingDocument,
  SubmitDataUploadMutation,
} from "../../generated/graphql";
import { Trans as T, useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import Spinner from "../../components/Spinner";
import { ExclamationCircleIcon } from "@heroicons/react/outline";
import useProjectId from "../../useProjectId";
import axios from "axios";
import EventEmitter from "eventemitter3";
import { ApolloClient, InMemoryCache, useApolloClient } from "@apollo/client";
import { SubmitDataUploadDocument } from "../../generated/queries";

import debounce from "lodash.debounce";
import { MapContext } from "../../dataLayers/MapContextManager";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";

const Trans = (props: any) => <T ns="admin:data" {...props} />;

export const DataUploadDropzoneContext = createContext<{
  uploads: DataUploadDetailsFragment[];
  manager?: UploadManager;
}>({
  uploads: [],
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
    manager?: UploadManager;
  }>({
    droppedFiles: 0,
    uploads: [],
  });
  const client = useApolloClient();
  const mapContext = useContext(MapContext);
  const onError = useGlobalErrorHandler();
  const { alert } = useDialog();
  const { t } = useTranslation("admin:data");

  useEffect(() => {
    const mapManager = mapContext.manager;
    if (projectId && mapManager) {
      const manager = new UploadManager({
        client: client as ApolloClient<InMemoryCache>,
        slug,
        projectId,
        showLayer: mapManager
          ? (layerId: string) => mapManager.showLayers([layerId])
          : (id: string) => {},
        onError,
        onQuotaError: () => {
          alert(t("You have exceeded the data hosting quota"), {
            description: t(
              "This quota is intended to prevent abuse. Contact support@seasketch.org to discuss raising your project's storage limits. Deleting layers from your project will also free up space."
            ),
          });
        },
      });
      manager.on("change", (uploads) => {
        setState((prev) => ({
          ...prev,
          uploads,
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
  }, [client, slug, projectId, mapContext.manager]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setState((prev) => ({
        ...prev,
        droppedFiles: acceptedFiles.length,
      }));
      state.manager?.startUpload(acceptedFiles).then(() => {
        setState((prev) => ({
          ...prev,
          droppedFiles: 0,
        }));
      });
    },
    [state.manager]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });

  return (
    <DataUploadDropzoneContext.Provider
      value={{
        uploads: state.uploads,
        manager: state.manager,
      }}
    >
      <div
        {...getRootProps()}
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
                    <Trans>Drop Files Here to Upload</Trans>
                  </h4>
                  <p className="text-sm">
                    <Trans>
                      SeaSketch currently supports vector data in GeoJSON,
                      Shapefile (zipped), and FlatGeobuf formats.
                    </Trans>
                  </p>
                  {Boolean(state.droppedFiles) && !state.error && (
                    <div className="text-sm flex items-center text-center w-full justify-center space-x-2 mt-2">
                      <span>
                        <Trans>Starting upload</Trans>
                      </span>
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

class UploadManager extends EventEmitter<{
  change: [DataUploadDetailsFragment[]];
}> {
  client: ApolloClient<InMemoryCache>;
  uploads: { [uuid: string]: DataUploadDetailsFragment } = {};
  slug: string;
  interval? = 60000;
  projectId: number;
  inProgressUploads: string[] = [];
  onError?: (error: Error) => void;
  showLayer?: (nodeId: string) => void;
  uploadAbortControllers: { [uploadId: string]: AbortController } = {};
  onQuotaError?: (e: Error) => void;

  constructor({
    client,
    slug,
    projectId,
    onError,
    showLayer,
    onQuotaError,
  }: {
    client: ApolloClient<InMemoryCache>;
    slug: string;
    projectId: number;
    onError?: (error: Error) => void;
    showLayer?: (nodeId: string) => void;
    onQuotaError?: (e: Error) => void;
  }) {
    super();
    this.slug = slug;
    this.client = client;
    this.fetchTasks();
    this.projectId = projectId;
    this.onError = onError;
    this.showLayer = showLayer;
    this.onQuotaError = onQuotaError;
  }

  destroy() {
    delete this.interval;
    this.removeAllListeners();
  }

  // using this method of function definition so that `this` is bound even
  // when called from react event handlers
  dismissFailedUpload = async (id: string) => {
    try {
      await this.client.mutate<DismissFailedTaskMutation>({
        mutation: DismissFailedTaskDocument,
        variables: {
          id,
        },
      });
      delete this.uploads[id];
      this.emitChange();
    } catch (e) {
      if (this.onError) {
        this.onError(e);
      } else {
        throw e;
      }
    }
  };

  dismissAllFailures = async () => {
    await Promise.all(
      Object.values(this.uploads)
        .filter((u) => u.state === DataUploadState.Failed)
        .map((upload) => this.dismissFailedUpload(upload.id))
    );
  };

  async startUpload(files: File[]) {
    if (files.length) {
      Promise.all(
        files.map(async (file) => {
          const upload = await this.client.mutate<CreateDataUploadMutation>({
            mutation: CreateDataUploadDocument,
            variables: {
              projectId: this.projectId,
              filename: file.name,
              contentType: file.type,
            },
          });

          if (upload.errors || !upload.data?.createDataUpload?.dataUploadTask) {
            throw new Error(
              upload.errors?.toString() || "Upload task not created"
            );
          }
          this.inProgressUploads.push(
            upload.data.createDataUpload.dataUploadTask.id
          );
          this.uploads[upload.data.createDataUpload.dataUploadTask.id] = {
            ...upload.data.createDataUpload.dataUploadTask,
            progress: 0,
          };
          this.emitChange();
          return [file, upload.data.createDataUpload.dataUploadTask] as [
            File,
            DataUploadDetailsFragment & {
              presignedUploadUrl: string;
            }
          ];
        })
      )
        .then(async (fileUploads) => {
          for (const [file, upload] of fileUploads) {
            this.uploadAbortControllers[upload.id] = new AbortController();
            const signal = this.uploadAbortControllers[upload.id].signal;
            axios({
              url: upload.presignedUploadUrl,
              method: "PUT",
              data: file,
              signal,
              headers: {
                "Content-Type": file.type,
              },
              onUploadProgress: (progressEvent) => {
                if (!signal.aborted) {
                  this.updateUploadProgress(
                    upload.id,
                    progressEvent.loaded / progressEvent.total
                  );
                }
              },
            })
              .then((response) => {
                if (response.status === 200) {
                  return this.client
                    .mutate<SubmitDataUploadMutation>({
                      mutation: SubmitDataUploadDocument,
                      variables: {
                        id: upload.id,
                      },
                    })
                    .then((response) => {
                      if (response.data?.submitDataUpload?.dataUploadTask) {
                        this.uploads[upload.id] =
                          response.data?.submitDataUpload?.dataUploadTask;
                        this.debouncedEmitChange();
                      }
                    });
                } else {
                  throw new Error("Non-200 response code");
                }
              })
              .catch((e) => {
                if (e.message === "canceled") {
                  // nothing to do
                } else {
                  this.uploads[upload.id] = {
                    ...upload,
                    state: DataUploadState.Failed,
                    errorMessage: "Upload failed",
                  };
                  this.debouncedEmitChange();
                  this.inProgressUploads = this.inProgressUploads.filter(
                    (id) => id !== upload.id
                  );
                }
              });
          }
        })
        .then(() => {
          this.fetchTasks();
        })
        .catch((e) => {
          if (/quota exceeded/.test(e.message) && this.onQuotaError) {
            this.onQuotaError(e);
          } else if (this.onError) {
            this.onError(e);
          } else {
            throw e;
          }
        });
    }
  }

  abortUpload(id: string) {
    this.uploadAbortControllers[id]?.abort("User cancelled upload");
    delete this.uploads[id];
    this.inProgressUploads = this.inProgressUploads.filter((uid) => uid !== id);
    this.client.mutate<CancelUploadMutation>({
      mutation: CancelUploadDocument,
      variables: {
        projectId: this.projectId,
        uploadId: id,
      },
    });
    this.debouncedEmitChange();
  }

  updateUploadProgress(id: string, progress: number) {
    this.uploads[id] = {
      ...this.uploads[id],
      progress,
    };
    this.debouncedEmitChange();
  }

  debouncedEmitChange = debounce(this.emitChange, 250, {
    maxWait: 500,
  });

  emitChange() {
    this.emit("change", Object.values(this.uploads));
  }

  async fetchTasks() {
    if (!this.interval) {
      return;
    }
    this.client
      .query({
        query: DataUploadTasksDocument,
        variables: {
          slug: this.slug,
        },
        fetchPolicy: "network-only",
      })
      .then((response) => {
        if (!this.interval) {
          return;
        }
        if (response.error) {
          throw new Error(response.error.message);
        } else {
          const uploads = (
            (response as DataUploadTasksQueryResult).data?.projectBySlug
              ?.activeDataUploads || []
          ).reduce((uploads, current) => {
            uploads[current.id] = current;
            return uploads;
          }, {} as { [uuid: string]: DataUploadDetailsFragment });
          // Diff and update this.uploads, and emit change event if there are any changes
          let changed = false;
          // If any upload jobs have finished successfully, we will need to update the table of contents
          let completed: DataUploadDetailsFragment[] = [];
          if (
            Object.keys(this.uploads).length === 0 &&
            Object.keys(uploads).length === 0
          ) {
            // do nothing
          } else {
            // first check for updates or additions
            for (const uuid in uploads) {
              if (uuid in this.uploads) {
                // may be an update if data has changed
                const newData = uploads[uuid];
                const oldData = this.uploads[uuid];
                if (
                  newData.state === DataUploadState.Complete &&
                  oldData.state !== DataUploadState.Complete
                ) {
                  // upload transitioned to complete. Need to update the ToC
                  completed.push(newData);
                }
                if (
                  newData.state !== oldData.state ||
                  (newData.progress !== oldData.progress &&
                    newData.state !== DataUploadState.AwaitingUpload)
                ) {
                  changed = true;
                  this.uploads[uuid] = newData;
                }
              } else {
                changed = true;
                this.uploads[uuid] = uploads[uuid];
              }
            }
            // see if any local uploads are not found on the server
            for (const uuid in this.uploads) {
              if (this.uploads[uuid].state !== DataUploadState.AwaitingUpload) {
                if (!(uuid in uploads)) {
                  changed = true;
                  delete this.uploads[uuid];
                }
              } else if (this.inProgressUploads.indexOf(uuid) === -1) {
                changed = true;
                this.uploads[uuid] = {
                  ...this.uploads[uuid],
                  state: DataUploadState.Failed,
                  // eslint-disable-next-line i18next/no-literal-string
                  errorMessage: `Client upload never completed`,
                };
                this.client.mutate<FailUploadMutation>({
                  mutation: FailUploadDocument,
                  variables: {
                    id: uuid,
                    message: this.uploads[uuid].errorMessage,
                  },
                });
              }
            }
          }
          if (changed) {
            this.emit("change", Object.values(this.uploads));
            if (completed.length > 0) {
              this.client
                .refetchQueries({
                  include: [
                    DraftTableOfContentsDocument,
                    ProjectDataQuotaRemainingDocument,
                  ],
                })
                .then(() => {
                  for (const complete of completed) {
                    for (const layer of complete.layers || []) {
                      if (layer.tableOfContentsItem) {
                        if (this.showLayer) {
                          this.showLayer(layer.id.toString());
                        }
                      }
                    }
                  }
                });
            }
          } else {
            // No need to emit any events
          }
          const tasksInProgressOnServer = Object.values(this.uploads).find(
            (upload) =>
              upload.state !== DataUploadState.AwaitingUpload &&
              upload.state !== DataUploadState.Complete &&
              upload.state !== DataUploadState.Failed &&
              upload.state !== DataUploadState.FailedDismissed &&
              upload.state !== DataUploadState.RequiresUserInput
          );
          // Check with increased frequency for running tasks
          if (tasksInProgressOnServer) {
            this.interval = 1000;
          } else {
            this.interval = 10000;
          }
          setTimeout(() => {
            this.fetchTasks();
          }, this.interval);
        }
      })
      .catch((e) => {
        // Not throwing or reporting an error here since polling can be
        // unreliable and it's not clear to the user where these messages come
        // from
        console.error(e);
        // if (this.onError) {
        //   this.onError(e);
        // } else {
        //   throw e;
        // }
      });
  }
}
