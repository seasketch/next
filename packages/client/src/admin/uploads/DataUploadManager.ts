import { ApolloClient, gql } from "@apollo/client";
import { EventEmitter } from "eventemitter3";
import {
  CancelUploadDocument,
  CancelUploadMutation,
  CreateDataUploadDocument,
  CreateDataUploadMutation,
  DataUploadDetailsFragment,
  DataUploadDetailsFragmentDoc,
  DataUploadEventFragment,
  DataUploadState,
  DataUploadTasksDocument,
  DataUploadTasksQuery,
  DataUploadsDocument,
  DataUploadsSubscription,
  DismissFailedTaskDocument,
  DismissFailedTaskMutation,
  SubmitDataUploadDocument,
  SubmitDataUploadMutation,
} from "../../generated/graphql";
import axios from "axios";

export interface DataUploadProcessingCompleteEvent {
  uploadTaskId: string;
  /** Current browser session (not just user) uploaded this file.
   * If the user is in a different tab or refreshes their browser after
   * upload this will not be true. */
  isFromCurrentSession: boolean;
  layerStaticIds: string[];
}

export interface DataUploadErrorEvent {
  error: string;
  /** True if the error is due to the user exceeding their upload quota */
  isQuotaError: boolean;
}

/**
 * Manages uploads of spatial data, monitoring progress of upload and processing
 * while updating the Apollo Cache. The primary way of monitoring uploads for
 * the client should be to use the DataUploadTasksQuery, whose results are
 * updated by this manager.
 *
 * In addition to monitoring DataUploadTasksQuery, clients can listen for a
 * couple useful events emitted by this manager:
 *   * upload-error, which will have isQuotaError set to true if the error is
 *    due to the user exceeding their upload quota
 *   * processing-complete, which will have isFromCurrentSession set to true if
 *     the upload was initiated in the current browser session. This is useful
 *     for updating the table of contents and displaying uploaded layers.
 *
 * @param slug The slug of the project to monitor uploads for
 * @param client ApolloClient
 * @usage
 * ```ts
 * const manager = new DataUploadManager(slug, client);
 * manager.on("upload-error", (e) => {
 *  if (e.isQuotaError) {
 *    alert("You have exceeded your upload quota");
 *  }
 * });
 * manager.on("processing-complete", (e) => {
 * if (e.isFromCurrentSession) {
 *   // update table of contents...
 *   // show layer...
 * }
 * });
 * ```
 */
export default class DataUploadManager extends EventEmitter<{
  "upload-error": DataUploadErrorEvent;
  /**
   * When a data upload processing is complete, as in it is ready to be used
   * from the table of contents (which may need refetching). This event is
   * fired for all uploads, not just those from the current session.
   */
  "processing-complete": DataUploadProcessingCompleteEvent;
}> {
  client: ApolloClient<any>;
  slug: string;
  subscription: { unsubscribe: () => void };
  private sessionUploadIds: string[] = [];
  // uploadProgress: { [uploadTaskId: string]: number } = {};
  private abortControllers: { [uploadTaskId: string]: AbortController } = {};
  private completedTasks = new Set<string>();
  private activeTasks = new Set<string>();
  projectId: number;

  constructor(slug: string, projectId: number, client: ApolloClient<any>) {
    super();
    this.client = client;
    this.slug = slug;
    this.projectId = projectId;

    // subscribe to data upload task progress using apollo client
    this.subscription = this.client
      .subscribe<DataUploadsSubscription>({
        query: DataUploadsDocument,
        variables: {
          slug,
        },
      })
      .subscribe(({ data, errors }) => {
        if (data?.dataUploadTasks?.dataUploadTask) {
          this.handleEvent(data.dataUploadTasks);
        }
      });
  }

  /**
   * Cleans up resources, particularly destroys the subscription to the graphql
   * api
   */
  destroy() {
    this.subscription.unsubscribe();
    this.removeAllListeners();
  }

  addTaskToQueryCache(task: DataUploadDetailsFragment) {
    this.client.cache.updateQuery<DataUploadTasksQuery>(
      {
        query: DataUploadTasksDocument,
        variables: {
          slug: this.slug,
        },
      },
      (data) => {
        if (data?.projectBySlug?.activeDataUploads) {
          return {
            ...data,
            projectBySlug: {
              ...data.projectBySlug,
              activeDataUploads: [
                ...data.projectBySlug.activeDataUploads.filter((u) => {
                  return u.id !== task.id;
                }),
                task,
              ],
            },
          };
        }
      }
    );
  }

  async uploadFiles(files: File[]) {
    if (files.length) {
      const tasksAndFiles = await Promise.all(
        files.map(async (file) => {
          try {
            const upload = await this.client.mutate<CreateDataUploadMutation>({
              mutation: CreateDataUploadDocument,
              variables: {
                projectId: this.projectId,
                filename: file.name,
                contentType: file.type,
              },
            });
            if (
              upload.errors ||
              !upload.data?.createDataUpload?.dataUploadTask
            ) {
              throw new Error(
                upload.errors?.toString() || "Upload task not created"
              );
            }

            const task = upload.data.createDataUpload.dataUploadTask;

            // Add the new task to DataUploadTasksQuery cache
            this.addTaskToQueryCache(task);

            this.sessionUploadIds.push(task.id);
            this.activeTasks.add(task.id);
            this.abortControllers[task.id] = new AbortController();
            if (!task.presignedUploadUrl) {
              throw new Error("No presigned upload url found in task");
            }
            return [task, file] as [typeof task, File];
          } catch (e) {
            if (/quota exceeded/.test(e.message)) {
              this.emit("upload-error", {
                error: e.message,
                isQuotaError: true,
              });
            }
            throw e;
          }
        })
      );
      Promise.all(
        tasksAndFiles.map(([task, file]) => {
          const signal = this.abortControllers[task.id].signal;
          return axios({
            url: task.presignedUploadUrl!,
            method: "PUT",
            data: file,
            signal,
            headers: {
              "Content-Type": file.type,
            },
            onUploadProgress: (progressEvent) => {
              if (!signal.aborted) {
                const progress = progressEvent.loaded / progressEvent.total;
                // update the progress in the apollo cache
                this.client.cache.writeFragment({
                  id: `DataUploadTask:${task.id}`,
                  fragment: gql`
                    fragment DUProgress on DataUploadTask {
                      progress
                    }
                  `,
                  data: {
                    progress,
                  },
                });
              }
            },
          }).then(async (response) => {
            if (response.status === 200) {
              try {
                await this.client.mutate<SubmitDataUploadMutation>({
                  mutation: SubmitDataUploadDocument,
                  variables: {
                    id: task.id,
                  },
                });
                delete this.abortControllers[task.id];
              } catch (e) {
                if (/quota exceeded/.test(e.message)) {
                  this.emit("upload-error", {
                    uploadTaskId: task.id,
                  });
                } else {
                  throw e;
                }
              }
            } else {
              throw new Error("Non-200 response code");
            }
          });
        })
      );
    }
  }

  isUploadFromMySession(taskId: string) {
    return this.sessionUploadIds.includes(taskId);
  }

  /**
   * Handles data upload task update events from the graphql api. These
   * fire on insert or update. Progress updates may fire *a lot*.
   *
   * Responsible for:
   *   * Updating the apollo cache with the latest data upload task
   *   * Emitting events for processing-complete
   */
  private handleEvent(event: DataUploadEventFragment) {
    const task = event.dataUploadTask;
    if (!task) {
      throw new Error("No data upload task found in event");
    }
    if (
      !this.activeTasks.has(task.id) &&
      task.state !== DataUploadState.Complete &&
      task.state !== DataUploadState.Failed &&
      task.state !== DataUploadState.AwaitingUpload
    ) {
      this.addTaskToQueryCache(task);
      this.activeTasks.add(task.id);
    }

    // Update apollo cache
    this.client.cache.writeFragment({
      id: `DataUploadTask:${task.id}`,
      fragment: DataUploadDetailsFragmentDoc,
      data: event.dataUploadTask,
    });
    // Detect if processing is complete
    if (
      !this.completedTasks.has(task.id) &&
      event.previousState &&
      event.previousState !== DataUploadState.Complete &&
      task.state === DataUploadState.Complete
    ) {
      const isFromCurrentSession = this.sessionUploadIds.includes(task.id);
      this.completedTasks.add(task.id);
      this.emit("processing-complete", {
        uploadTaskId: task.id,
        isFromCurrentSession,
        layerStaticIds: task.tableOfContentsItemStableIds || [],
      });
      if (isFromCurrentSession) {
        this.sessionUploadIds = this.sessionUploadIds.filter(
          (id) => id !== task.id
        );
      }
      this.activeTasks.delete(task.id);
    }
  }

  /**
   * Can be used to cancel an upload in progress. Cannot be used to cancel
   * processing.
   * @param id DataUploadTask id
   */
  abortUpload(id: string) {
    this.abortControllers[id]?.abort("User cancelled upload");
    delete this.abortControllers[id];
    this.client.mutate<CancelUploadMutation>({
      mutation: CancelUploadDocument,
      variables: {
        projectId: this.projectId,
        uploadId: id,
      },
    });
  }

  // using this method of function definition so that `this` is bound even
  // when called from react event handlers
  dismissFailedUpload = async (id: string) => {
    await this.client.mutate<DismissFailedTaskMutation>({
      mutation: DismissFailedTaskDocument,
      variables: {
        id,
      },
    });
    delete this.abortControllers[id];
    this.sessionUploadIds = this.sessionUploadIds.filter((u) => u !== id);
    this.activeTasks.delete(id);
  };

  // dismissAllFailures = async () => {
  //   await Promise.all(
  //     Object.values(this.uploads)
  //       .filter((u) => u.state === DataUploadState.Failed)
  //       .map((upload) => this.dismissFailedUpload(upload.id))
  //   );
  // };
}
