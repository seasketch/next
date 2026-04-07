import { ApolloClient, gql } from "@apollo/client";
import { EventEmitter } from "eventemitter3";
import {
  BackgroundJobSubscriptionEventFragment,
  CancelUploadDocument,
  CancelUploadMutation,
  CreateDataUploadDocument,
  CreateDataUploadMutation,
  DismissFailedJobDocument,
  DismissFailedJobInput,
  JobDetailsFragment,
  MyProfileDocument,
  MyProfileQuery,
  ProjectBackgroundJobDocument,
  ProjectBackgroundJobState,
  ProjectBackgroundJobSubscription,
  ProjectBackgroundJobType,
  ProjectBackgroundJobsDocument,
  ProjectBackgroundJobsQuery,
  SubmitDataUploadDocument,
  SubmitDataUploadMutation,
  UserIsSuperuserDocument,
  UserIsSuperuserQuery,
} from "../../generated/graphql";
import axios from "axios";

export interface DataUploadProcessingCompleteEvent {
  jobId: string;
  uploadTaskId: string;
  /** Current browser session (not just user) uploaded this file.
   * If the user is in a different tab or refreshes their browser after
   * upload this will not be true. */
  isFromCurrentSession: boolean;
  layerStaticIds: string[];
  replaceTableOfContentsItemId?: number;
  newSourceId: number;
}

export interface FeatureLayerConversionCompleteEvent {
  jobId: string;
  stableId?: string;
}

export interface DataUploadErrorEvent {
  error: string;
  /** True if the error is due to the user exceeding their upload quota */
  isQuotaError: boolean;
  jobId: string;
}

export interface UploadSubmittedEvent {
  uploadTaskId: string;
  jobId: string;
  replaceTableOfContentsItemId?: number;
}
/**
 * Manages project background jobs, which includes:
 *
 *   * data uploads
 *   * conversion of dynamic arcgis service links to hosted services
 *   * TBD, but likely pmtiles consolidation
 *
 * This scheme can be expanded in the future to accomadate different background
 * jobs as well.
 *
 * ## Uploads
 *
 * Manages uploads of spatial data, monitoring progress of upload and processing
 * while updating the Apollo Cache. The primary way of monitoring uploads for
 * the client should be to use the ProjectBackgroundJobsQuery, whose results are
 * updated by this manager.
 *
 * In addition to monitoring ProjectBackgroundJobsQuery, clients can listen for
 * a couple useful events emitted by this manager:
 *   * upload-error, which will have isQuotaError set to true if the error is
 *     due to the user exceeding their upload quota
 *   * processing-complete, which will have isFromCurrentSession set to true if
 *     the upload was initiated in the current browser session. This is useful
 *     for updating the table of contents and displaying uploaded layers.
 *
 * @param slug The slug of the project to monitor background jobs for
 * @param client ApolloClient
 * @usage
 * ```ts
 * const manager = new ProjectBackgroundJobManager(slug, client);
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
export default class ProjectBackgroundJobManager extends EventEmitter<{
  "upload-error": DataUploadErrorEvent;
  /**
   * When a data upload processing is complete, as in it is ready to be used
   * from the table of contents (which may need refetching). This event is
   * fired for all uploads, not just those from the current session.
   */
  "upload-processing-complete": DataUploadProcessingCompleteEvent;
  "feature-layer-conversion-complete": FeatureLayerConversionCompleteEvent;
  "file-uploaded": { uploadTaskId: string; jobId: string };
  "upload-submitted": UploadSubmittedEvent;
  /**
   * Fired when at least one upload finished transferring to storage but the
   * user must choose AI Data Analyst settings before `submitDataUpload` runs.
   */
  "ai-data-analyst-upload-prompt-needed": void;
}> {
  client: ApolloClient<any>;
  slug: string;
  subscription: { unsubscribe: () => void };
  private sessionUploadJobIds: string[] = [];
  private abortControllers: { [jobId: string]: AbortController } = {};
  private completedTasks = new Set<string>();
  private activeJobs = new Set<string>();
  /** Jobs waiting for `submitDataUpload` until AI analyst prompt is resolved. */
  private pendingSubmitAfterAiPromptJobIds: string[] = [];
  private aiDataAnalystUploadPromptEmitted = false;
  projectId: number;

  constructor(slug: string, projectId: number, client: ApolloClient<any>) {
    super();
    this.client = client;
    this.slug = slug;
    this.projectId = projectId;

    // subscribe to data upload task progress using apollo client
    this.subscription = this.client
      .subscribe<ProjectBackgroundJobSubscription>({
        query: ProjectBackgroundJobDocument,
        variables: {
          slug,
        },
      })
      .subscribe(({ data, errors }) => {
        if (data?.backgroundJobs?.job) {
          this.handleEvent(data.backgroundJobs);
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

  private async resolveMyProfile(): Promise<
    NonNullable<MyProfileQuery["me"]>["profile"] | undefined
  > {
    try {
      const data = this.client.readQuery<MyProfileQuery>({
        query: MyProfileDocument,
      });
      return data?.me?.profile ?? undefined;
    } catch {
      const { data } = await this.client.query<MyProfileQuery>({
        query: MyProfileDocument,
        fetchPolicy: "network-only",
      });
      return data?.me?.profile ?? undefined;
    }
  }

  /**
   * Whether AI Data Analyst should run for spatial uploads, from the client's
   * `MyProfile` data (cache first, then network if missing). Not read on the server.
   */
  private async resolveEnableAiDataAnalyst(): Promise<boolean> {
    const profile = await this.resolveMyProfile();
    return Boolean(profile?.enableAiDataAnalyst);
  }

  /**
   * True when the user still needs the one-time upload prompt (never dismissed).
   */
  private async resolveNeedsAiDataAnalystUploadPrompt(): Promise<boolean> {
    const profile = await this.resolveMyProfile();
    if (!profile) {
      return false;
    }
    return profile.wasPromptedToEnableAiDataAnalystAt == null;
  }

  private async resolveCurrentUserIsSuperuser(): Promise<boolean> {
    try {
      const data = this.client.readQuery<UserIsSuperuserQuery>({
        query: UserIsSuperuserDocument,
      });
      return Boolean(data?.currentUserIsSuperuser);
    } catch {
      const { data } = await this.client.query<UserIsSuperuserQuery>({
        query: UserIsSuperuserDocument,
        fetchPolicy: "network-only",
      });
      return Boolean(data?.currentUserIsSuperuser);
    }
  }

  /**
   * After the user saves AI analyst preferences, submit every upload that was
   * held back. Safe to call when the queue is empty.
   */
  async flushPendingSubmitsAfterAiPrompt(
    enableAiDataAnalyst: boolean
  ): Promise<void> {
    const maxIterations = 500;
    let iterations = 0;
    while (
      this.pendingSubmitAfterAiPromptJobIds.length > 0 &&
      iterations++ < maxIterations
    ) {
      const jobId = this.pendingSubmitAfterAiPromptJobIds[0];
      await this.client.mutate<SubmitDataUploadMutation>({
        mutation: SubmitDataUploadDocument,
        variables: {
          jobId,
          enableAiDataAnalyst,
        },
      });
      this.pendingSubmitAfterAiPromptJobIds.shift();
    }
    if (this.pendingSubmitAfterAiPromptJobIds.length > 0) {
      throw new Error(
        "Exceeded iteration limit while submitting uploads after AI analyst prompt."
      );
    }
    this.aiDataAnalystUploadPromptEmitted = false;
  }

  addJobToQueryCache(task: JobDetailsFragment) {
    try {
      this.client.cache.updateQuery<ProjectBackgroundJobsQuery>(
        {
          query: ProjectBackgroundJobsDocument,
          variables: {
            slug: this.slug,
          },
        },
        (data) => {
          if (data?.projectBySlug?.projectBackgroundJobs) {
            return {
              ...data,
              projectBySlug: {
                ...data.projectBySlug,
                projectBackgroundJobs: [
                  ...data.projectBySlug.projectBackgroundJobs.filter((u) => {
                    return u.id !== task.id;
                  }),
                  {
                    ...task,
                    dataUploadTask: null,
                    esriFeatureLayerConversionTask: null,
                  },
                ],
              },
            };
          }
        }
      );
    } catch (e) {
      console.error(e);
    }
  }

  async uploadFiles(
    files: File[],
    options?: {
      replaceTableOfContentsItemId?: number;
    }
  ) {
    if (files.length > 1 && options?.replaceTableOfContentsItemId) {
      throw new Error("Cannot upload multiple files and replace a source");
    }
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
                replaceTableOfContentsItemId:
                  options?.replaceTableOfContentsItemId,
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

            const job = upload.data.createDataUpload.dataUploadTask.job;
            const task = upload.data.createDataUpload.dataUploadTask;

            if (!job) {
              throw new Error("No job found in task");
            }

            const jobId = job.id;

            this.emit("upload-submitted", {
              uploadTaskId: task.id,
              jobId,
              replaceTableOfContentsItemId:
                options?.replaceTableOfContentsItemId,
            });

            // Add the new task to DataUploadTasksQuery cache
            this.addJobToQueryCache(job);

            this.sessionUploadJobIds.push(jobId);
            this.activeJobs.add(jobId);
            this.abortControllers[jobId] = new AbortController();
            if (!task.presignedUploadUrl) {
              throw new Error("No presigned upload url found in task");
            }
            return [task, file] as [typeof task, File];
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (/quota exceeded/.test(message)) {
              this.emit("upload-error", {
                error: message,
                isQuotaError: true,
                jobId: "",
              });
            }
            throw e;
          }
        })
      );
      Promise.all(
        tasksAndFiles.map(([task, file]) => {
          if (!task.job) {
            throw new Error("No job found in task");
          }
          const jobId = task.projectBackgroundJobId;
          if (!jobId) {
            throw new Error("No jobId found in task");
          }
          const signal = this.abortControllers[jobId].signal;
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
                  id: `ProjectBackgroundJob:${jobId}`,
                  fragment: gql`
                    fragment DUProgress on ProjectBackgroundJob {
                      progress
                      progressMessage
                    }
                  `,
                  data: {
                    progress,
                    progressMessage: `uploading`,
                  },
                });
              }
            },
          }).then(async (response) => {
            if (response.status === 200) {
              try {
                this.emit("file-uploaded", {
                  uploadTaskId: task.id,
                  jobId,
                });
                const needsPrompt =
                  (await this.resolveNeedsAiDataAnalystUploadPrompt()) &&
                  (await this.resolveCurrentUserIsSuperuser());
                if (needsPrompt) {
                  this.pendingSubmitAfterAiPromptJobIds.push(jobId);
                  delete this.abortControllers[jobId];
                  if (!this.aiDataAnalystUploadPromptEmitted) {
                    this.aiDataAnalystUploadPromptEmitted = true;
                    this.emit("ai-data-analyst-upload-prompt-needed");
                  }
                } else {
                  await this.client.mutate<SubmitDataUploadMutation>({
                    mutation: SubmitDataUploadDocument,
                    variables: {
                      jobId,
                      enableAiDataAnalyst: await this.resolveEnableAiDataAnalyst(),
                    },
                  });
                  delete this.abortControllers[jobId];
                }
              } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                if (/quota exceeded/.test(message)) {
                  this.emit("upload-error", {
                    error: message,
                    isQuotaError: true,
                    jobId,
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
    return this.sessionUploadJobIds.includes(taskId);
  }

  private handleEvent(event: BackgroundJobSubscriptionEventFragment) {
    if (!event.job) {
      throw new Error("No job found in event");
    }
    if (
      !this.activeJobs.has(event.job.id) &&
      event.job.state !== ProjectBackgroundJobState.Complete &&
      event.job.state !== ProjectBackgroundJobState.Failed
    ) {
      this.addJobToQueryCache(event.job);
      this.activeJobs.add(event.job.id);
    }

    // If it's an upload task, detect if processing is complete
    const dataUploadTask = event.job.dataUploadTask;
    const conversionTask = event.job.esriFeatureLayerConversionTask;
    if (
      dataUploadTask &&
      !this.completedTasks.has(event.job.id) &&
      event.previousState &&
      event.previousState !== ProjectBackgroundJobState.Complete &&
      event.job.state === ProjectBackgroundJobState.Complete
    ) {
      const jobId = event.job.id;
      const isFromCurrentSession = this.sessionUploadJobIds.includes(jobId);
      this.completedTasks.add(event.job.id);
      this.emit("upload-processing-complete", {
        jobId,
        uploadTaskId: dataUploadTask.id,
        isFromCurrentSession,
        layerStaticIds: dataUploadTask.tableOfContentsItemStableIds || [],
        replaceTableOfContentsItemId:
          dataUploadTask.replaceTableOfContentsItemId || undefined,
      });
    }
    if (
      event.job?.type === ProjectBackgroundJobType.ArcgisImport &&
      !this.completedTasks.has(event.job.id) &&
      event.previousState &&
      event.previousState !== ProjectBackgroundJobState.Complete &&
      event.job.state === ProjectBackgroundJobState.Complete
    ) {
      this.completedTasks.add(event.job.id);
      this.emit("feature-layer-conversion-complete", {
        jobId: event.job.id,
        stableId:
          event.job.esriFeatureLayerConversionTask?.tableOfContentsItem
            ?.stableId,
      });
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
    await this.client.mutate<DismissFailedJobInput>({
      mutation: DismissFailedJobDocument,
      variables: {
        id,
      },
    });
    delete this.abortControllers[id];
    this.sessionUploadJobIds = this.sessionUploadJobIds.filter((u) => u !== id);
    this.activeJobs.delete(id);
    const cachedItem = this.client.cache.readFragment<JobDetailsFragment>({
      // eslint-disable-next-line i18next/no-literal-string
      id: `ProjectBackgroundJob:${id}`,
      // eslint-disable-next-line i18next/no-literal-string
      fragment: gql`
        fragment DismissedJob on ProjectBackgroundJob {
          id
          esriFeatureLayerConversionTask {
            tableOfContentsItem {
              id
            }
          }
        }
      `,
    });
    const tocId =
      // @ts-ignore
      cachedItem?.esriFeatureLayerConversionTask?.tableOfContentsItem?.id;
    this.client.cache.updateFragment(
      {
        // eslint-disable-next-line i18next/no-literal-string
        id: `TableOfContentsItem:${tocId}`,
        // eslint-disable-next-line i18next/no-literal-string
        fragment: gql`
          fragment DismissedJob on TableOfContentsItem {
            id
            projectBackgroundJobs {
              id
            }
          }
        `,
      },
      (data) => {
        if (data?.projectBackgroundJobs) {
          return {
            ...data,
            projectBackgroundJobs: [
              ...data.projectBackgroundJobs.filter((u: any) => {
                return u.id !== id;
              }),
            ],
          };
        } else {
          return data;
        }
      }
    );
    // Remove from job list query
    this.client.cache.updateQuery<ProjectBackgroundJobsQuery>(
      {
        query: ProjectBackgroundJobsDocument,
        variables: {
          slug: this.slug,
        },
      },
      (data) => {
        if (data?.projectBySlug?.projectBackgroundJobs) {
          return {
            ...data,
            projectBySlug: {
              ...data.projectBySlug,
              projectBackgroundJobs: [
                ...data.projectBySlug.projectBackgroundJobs.filter((u) => {
                  return u.id !== id;
                }),
              ],
            },
          };
        }
      }
    );
  };

  // dismissAllFailures = async () => {
  //   await Promise.all(
  //     Object.values(this.uploads)
  //       .filter((u) => u.state === DataUploadState.Failed)
  //       .map((upload) => this.dismissFailedUpload(upload.id))
  //   );
  // };
}
