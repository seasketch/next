import { Trans, useTranslation } from "react-i18next";
import {
  ArchivedDataSource,
  AuthorProfileFragment,
  BackgroundJobDetailsFragment,
  DataSourceTypes,
  DraftTableOfContentsDocument,
  FullAdminDataLayerFragment,
  FullAdminOverlayFragment,
  FullAdminSourceFragment,
  GetLayerItemDocument,
  GetMetadataDocument,
  JobDetailsFragment,
  LayersAndSourcesForItemsDocument,
  ProjectBackgroundJobState,
  SublayerType,
  useDeleteArchivedDataSourceMutation,
  useProjectBackgroundJobsQuery,
  useRollbackArchivedDataSourceMutation,
  useSetChangelogMutation,
} from "../../../generated/graphql";
import {
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import LayerInfoList, { isRemoteSource } from "./LayerInfoList";
import getSlug from "../../../getSlug";
import { motion } from "framer-motion";
import { XIcon } from "@heroicons/react/outline";
import { ProjectBackgroundJobContext } from "../../uploads/ProjectBackgroundJobContext";
import ProgressBar from "../../../components/ProgressBar";
import { MapManagerContext } from "../../../dataLayers/MapContextManager";
import Warning from "../../../components/Warning";
import { createPortal } from "react-dom";
import useDialog from "../../../components/useDialog";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import ConvertFeatureLayerToHostedModal from "../arcgis/ConvertFeatureLayerToHostedModal";
import useIsSuperuser from "../../../useIsSuperuser";

export default function LayerVersioning({
  item,
}: {
  item: FullAdminOverlayFragment;
}) {
  const { t } = useTranslation("admin:data");
  const { data } = useProjectBackgroundJobsQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const isInaturalist =
    item.dataLayer?.dataSource?.type === DataSourceTypes.Inaturalist;

  const [changelogState, setChangelogState] = useState({
    content: "",
    submitted: true,
    jobId: undefined as number | undefined,
  });

  const [setChangelogMutation, changelogMutationState] =
    useSetChangelogMutation();

  const jobContext = useContext(ProjectBackgroundJobContext);

  useEffect(() => {
    if (item.dataLayer?.dataSourceId) {
      setSelectedItemId(item.dataLayer.dataSourceId);
      manager?.zoomToTocItem(item.stableId, {
        onlyIfNotVisible: true,
      });
    }
    if (isInaturalist) {
      jobContext.setDisabled(true);
    } else {
      jobContext.setDisabled(false);
    }
    if (!item.copiedFromDataLibraryTemplateId) {
      jobContext.setUploadType("replace", item.id);
    }
    return () => {
      jobContext.setUploadType("create");
    };
  }, [
    item.id,
    item.stableId,
    item.dataLayer?.dataSourceId,
    item.copiedFromDataLibraryTemplateId,
    isInaturalist,
  ]);

  const versions = useMemo(() => {
    let versions = [
      { version: item.dataLayer!.version, source: item.dataLayer!.dataSource! },
    ] as {
      version: number;
      source: FullAdminSourceFragment & { isArchived: boolean };
    }[];
    // add archived versions
    for (const v of item.dataLayer!.archivedSources || []) {
      if (v.dataSource) {
        versions.push({
          version: v.version,
          source: { ...v.dataSource, isArchived: true },
        });
      }
    }
    versions = versions.filter((v) => v.source);
    return versions.sort((a, b) => b.version - a.version);
  }, [item]);

  const relatedJobs = useMemo(() => {
    if (!data?.projectBySlug?.projectBackgroundJobs?.length) return [];
    return data.projectBySlug.projectBackgroundJobs
      .filter((job) =>
        versions.find(
          ({ source }) =>
            source &&
            (item.id === job.dataUploadTask?.replaceTableOfContentsItemId ||
              item.id ===
                job.esriFeatureLayerConversionTask?.tableOfContentsItemId) &&
            job.state !== ProjectBackgroundJobState.Complete
        )
      )
      .sort(
        (a, b) =>
          new Date(b.dataUploadTask!.createdAt).getTime() -
          new Date(a.dataUploadTask!.createdAt).getTime()
      );
  }, [data?.projectBySlug?.projectBackgroundJobs, versions, item.id]);

  // Jobs have string (UUID) ids, sources have number ids
  const [selectedItemId, setSelectedItemId] = useState<string | number>(
    versions[0]?.source?.id
  );

  const { manager } = useContext(MapManagerContext);

  useEffect(() => {
    if (jobContext.manager && !item.copiedFromDataLibraryTemplateId) {
      const manager = jobContext.manager;
      const handler = (e: { uploadTaskId: number; jobId: number }) => {
        setChangelogState((prev) => ({
          ...prev,
          submitted: false,
          jobId: e.jobId,
          content: "",
        }));
      };
      manager.on("upload-submitted", handler);
      return () => {
        manager.off("upload-submitted", handler);
      };
    }
  }, [jobContext.manager, item.copiedFromDataLibraryTemplateId]);

  const currentJob = data?.projectBySlug?.projectBackgroundJobs.find(
    (j) => j.id === changelogState.jobId
  );
  const isUploading =
    currentJob?.state === ProjectBackgroundJobState.Queued &&
    currentJob?.progress < 1;

  useEffect(() => {
    if (
      typeof selectedItemId === "number" &&
      selectedItemId !== item.dataLayer?.dataSourceId &&
      manager
    ) {
      const archivedSource = item.dataLayer?.archivedSources?.find(
        (s) => s.dataSource?.id === selectedItemId
      );
      if (archivedSource) {
        manager.showArchivedSource(archivedSource);
        manager.zoomToTocItem(item.stableId, { onlyIfNotVisible: true });
        return () => {
          manager.clearArchivedSource();
          manager.zoomToTocItem(item.stableId, { onlyIfNotVisible: true });
        };
      }
    } else {
      manager?.clearArchivedSource();
    }
  }, [selectedItemId, item.dataLayer?.dataSourceId, manager]);

  const submitChangelog = useCallback(() => {
    if (currentJob!.dataUploadTask) {
      setChangelogMutation({
        variables: {
          dataUploadTaskId: currentJob!.dataUploadTask!.id,
          changelog: changelogState.content,
        },
      });
    }
    setChangelogState((prev) => ({
      ...prev,
      submitted: true,
    }));
  }, [changelogState.content, currentJob, setChangelogMutation]);

  return (
    <Container
      dragActive={
        jobContext.dragActive && !item.copiedFromDataLibraryTemplateId
      }
    >
      <h2 className="font-medium px-2 py-2 border-b">{t("Versions")}</h2>
      <VersionsContainer>
        <div className="px-4 py-4 space-y-2">
          {relatedJobs.length > 0 &&
            relatedJobs.map((job) => (
              <JobListItem
                key={job.id}
                job={job}
                selected={job.id === selectedItemId}
                version={versions[0].version + 1}
                onClick={() => {
                  setSelectedItemId(job.id);
                }}
              />
            ))}
          {versions.map(({ version, source }, i) => (
            <VersionListItem
              key={source.id}
              isUpload={!isRemoteSource(source.type)}
              authorProfile={
                source.uploadedBy === "datalibrary@seasketch.org"
                  ? {
                      userId: -9999,
                      email: "support@seasketch.org",
                      fullname: "SeaSketch Data Library",
                    }
                  : source.authorProfile!
              }
              version={
                source.isArchived ? version : item.dataLayer?.version || version
              }
              createdAt={new Date(source.createdAt)}
              selected={source.id === selectedItemId}
              current={item.dataLayer?.dataSourceId === source.id}
              isMostRecent={i === 0}
              isOldest={i === versions.length - 1}
              onClick={() => setSelectedItemId(source.id)}
              isConversion={Boolean(
                source.changelog &&
                  /Converted from ESRI Feature Layer/.test(source.changelog)
              )}
            />
          ))}
        </div>

        <>
          {isInaturalist && (
            <div className="py-4 px-4 text-gray-500 text-sm space-y-4">
              <p>
                <Trans ns="admin:data">
                  iNaturalist layers read data directly from the iNaturalist
                  API. As such, they cannot be edited or versioned.
                </Trans>
              </p>
            </div>
          )}
          {!isInaturalist && (
            <div className="py-4 px-4 text-gray-500 text-sm space-y-4">
              {versions.length === 1 && versions[0].version === 1 && (
                <p>
                  <Trans ns="admin:data">
                    This is the first version of this data source. SeaSketch can
                    track changes to this layer as you upload new revisions,
                    enabling you to monitor changes over time and rollback to
                    previous versions.
                  </Trans>
                </p>
              )}
              <p>
                {item.copiedFromDataLibraryTemplateId ? (
                  <Warning level="warning">
                    <Trans ns="admin:data">
                      This layer was added from the SeaSketch Data Library. As
                      such, it cannot be edited. Updates from the original
                      source will be automatically applied by the SeaSketch
                      team.
                    </Trans>
                  </Warning>
                ) : (
                  <Trans ns="admin:data">
                    Drag & Drop a spatial data file here to create a new version
                    of this layer, or{" "}
                    <button
                      className="underline text-primary-500"
                      onClick={() => {
                        jobContext.browseForFiles(false);
                      }}
                    >
                      browse for files on your computer
                    </button>
                    .
                  </Trans>
                )}
              </p>
            </div>
          )}
        </>
      </VersionsContainer>
      {data?.projectBySlug?.projectBackgroundJobs.find(
        (j) => j.id === selectedItemId
      ) && (
        <JobDetails
          onDismissed={() => {
            setSelectedItemId(
              item.dataLayer?.dataSourceId || versions[0].source.id
            );
          }}
          version={versions[0].version + 1}
          job={
            data?.projectBySlug?.projectBackgroundJobs.find(
              (j) => j.id === selectedItemId
            )!
          }
        />
      )}
      {versions.find((v) => v.source.id === selectedItemId) && (
        <VersionDetails
          itemId={item.id}
          version={
            versions.find((v) => v.source.id === selectedItemId)!.version
          }
          source={versions.find((v) => v.source.id === selectedItemId)?.source!}
          layer={item.dataLayer!}
          archivedDataSource={
            item.dataLayer?.archivedSources?.find(
              (s) => s.dataSource?.id === selectedItemId
            ) as ArchivedDataSource | undefined
          }
          onDelete={() => {
            setSelectedItemId(
              item.dataLayer?.dataSourceId || versions[0].source.id
            );
          }}
          onRollback={(e) => {
            setSelectedItemId(e.sourceId);
          }}
        />
      )}
      {currentJob &&
        (isUploading || !changelogState.submitted) &&
        createPortal(
          <>
            <div
              style={{
                backdropFilter: "blur(5px)",
              }}
              className="absolute top-0 left-0 w-full h-full z-50 flex items-center justify-center bg-black bg-opacity-20"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="bg-white rounded p-4 shadow text-center max-w-xl w-128 pointer-events-auto">
                <h4 className="font-semibold">
                  {isUploading ? t("Uploading File") : t("Upload Complete")}
                </h4>
                <p className="text-sm">
                  {isUploading
                    ? t(
                        "Please do not close this window until the upload is complete. Take this moment to author a changelog for this revision."
                      )
                    : t("Submit your changelog to proceed.")}
                </p>
                {isUploading ? (
                  <ProgressBar progress={currentJob.progress} />
                ) : (
                  <div className="mt-2"></div>
                )}
                <textarea
                  onKeyDown={(e) => {
                    // if meta + enter, submit the changelog
                    if (e.metaKey && e.key === "Enter") {
                      submitChangelog();
                    }
                  }}
                  onChange={(e) => {
                    setChangelogState((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }));
                  }}
                  disabled={changelogState.submitted}
                  autoFocus
                  className={`w-full text-sm rounded border-gray-500 pointer-events-auto h-32 ring-0 outline-none focus:ring-0 focus:border-black ${
                    changelogState.submitted
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }`}
                  placeholder="Changelogs should clearly describe why a new revision of this layer is being uploaded."
                />
                <button
                  onClick={submitChangelog}
                  className={`px-2 py-1 text-sm border shadow-sm rounded border-black border-opacity-20 ${
                    changelogState.submitted
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }`}
                >
                  {changelogState.submitted
                    ? t("Changelog Submitted")
                    : t("Submit Changelog")}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </Container>
  );
}

function Container({
  children,
  dragActive,
}: {
  dragActive: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`h-full bg-gray-100 flex flex-col overflow-y-hidden ${
        dragActive ? "ring-4 ring-blue-600" : ""
      }`}
    >
      {children}
    </div>
  );
}

function VersionsContainer({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxHeight: "35%" }} className="overflow-y-auto bg-white">
      {children}
    </div>
  );
}

function VersionDetails({
  source,
  version,
  layer,
  onDelete,
  onRollback,
  itemId,
  archivedDataSource,
}: {
  itemId: number;
  source: FullAdminSourceFragment & { isArchived: boolean };
  version: number;
  layer: Pick<
    FullAdminDataLayerFragment,
    "sublayer" | "sublayerType" | "id" | "version" | "sourceLayer"
  >;
  onDelete?: () => void;
  onRollback?: (e: { sourceId: number }) => void;
  archivedDataSource?: Pick<ArchivedDataSource, "sublayer" | "sourceLayer">;
}) {
  const onError = useGlobalErrorHandler();
  const [deleteArchive, deleteArchiveState] =
    useDeleteArchivedDataSourceMutation({
      onError,
    });
  const [rollbackGLStyle, setRollbackGLStyle] = useState(false);
  const [rollback, rollbackState] = useRollbackArchivedDataSourceMutation({
    onError,
    refetchQueries: [
      DraftTableOfContentsDocument,
      LayersAndSourcesForItemsDocument,
      GetLayerItemDocument,
      GetMetadataDocument,
    ],
    variables: {
      id: source.id,
      rollbackGLStyle,
    },
  });
  const [hostOnSeaSketch, setHostOnSeasketch] = useState<number | null>(null);
  const { confirmDelete, setState: setDialogState } = useDialog();
  const isSuperuser = useIsSuperuser();

  const isArcGISVectorSource =
    source.type === DataSourceTypes.ArcgisVector ||
    source.type === DataSourceTypes.ArcgisDynamicMapserver ||
    source.type === DataSourceTypes.ArcgisDynamicMapserverVectorSublayer;
  const confirmRollbackDescription = (
    <div>
      <p>
        <Trans ns="admin:data">
          Archives which were created after version {{ version }} will be
          automatically deleted. This action cannot be undone.
        </Trans>
      </p>
      {isSuperuser && getSlug() === "superuser" && (
        // eslint-disable-next-line i18next/no-literal-string
        <Warning level="warning">
          Replated copies will not be rolled back for Data Library items. To
          rollback Data Library layers, download the previous version and upload
          it as a new version.
        </Warning>
      )}

      <div className="relative flex items-start px-1 py-2">
        <div className="flex h-6 items-center">
          <input
            tabIndex={-1}
            checked={isArcGISVectorSource || rollbackGLStyle}
            onChange={(e) => {
              setRollbackGLStyle(e.target.checked);
            }}
            disabled={isArcGISVectorSource}
            id="includeGLStyle"
            aria-describedby="includeGLStyle-description"
            name="includeGLStyle"
            type="checkbox"
            className={`h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500 ${
              isArcGISVectorSource ? "opacity-50" : ""
            }`}
          />
        </div>
        <div
          className={`ml-2 text-sm leading-6 ${
            isArcGISVectorSource ? "opacity-60" : ""
          }`}
        >
          <label htmlFor="includeGLStyle" className="font-medium text-gray-900">
            <Trans ns="admin:data">Include cartography.</Trans>
          </label>{" "}
          <span id="includeGLStyle-description" className="text-gray-500">
            <span className="sr-only">
              <Trans ns="admin:data">Include cartography.</Trans>
            </span>
            {isArcGISVectorSource ? (
              <Trans ns="admin:data">
                ArcGIS sources always rollback to dynamic style from source
                server.
              </Trans>
            ) : (
              <Trans ns="admin:data">
                Rollback to older style, discarding recent changes.
              </Trans>
            )}
          </span>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (setDialogState) {
      setDialogState((prev) => ({
        ...prev,
        description: confirmRollbackDescription,
      }));
    }
  }, [rollbackGLStyle, setDialogState]);
  return (
    <div className="flex-2 p-4 border-t overflow-y-auto">
      <h2 className="text-base font-medium leading-6 text-gray-900">
        <Trans ns="admin:data">
          Version {{ version }} details and settings
        </Trans>
      </h2>
      <div className="border rounded mt-4 overflow-hidden bg-white">
        <LayerInfoList
          isLatestVersion={version === layer.version}
          source={source}
          layer={{
            ...layer,
            sublayer: archivedDataSource?.sublayer || layer.sublayer,
            sourceLayer: archivedDataSource?.sourceLayer || layer.sourceLayer,
          }}
          readonly={false}
        >
          {source.changelog && source.changelog.length > 0 && (
            <div className="p-2 border-t ">
              <h3 className="text-sm font-medium text-gray-500 py-1 ">
                <Trans ns="admin:data">Changelog</Trans>
              </h3>
              <p className="text-sm py-2 italic">{source.changelog}</p>
            </div>
          )}
        </LayerInfoList>
      </div>
      {(getSlug() === "superuser" ||
        source.uploadedBy !== "datalibrary@seasketch.org") && (
        <div className="py-2 flex space-x-2">
          {source.isArchived && (
            <button
              onClick={
                async () => {
                  confirmDelete({
                    message: `Are you sure you want to delete version ${version}?`,
                    description: "This action cannot be undone.",

                    onDelete: async () => {
                      await deleteArchive({
                        variables: {
                          id: source.id,
                        },
                      });
                      if (onDelete) {
                        onDelete();
                      }
                    },
                  });
                }
                //   if (jobContext.manager) {
                //     jobContext.manager.dismissFailedUpload(job.id);
                //     if (onDismissed) {
                //       onDismissed(job.id);
                //     }
                //   }
              }
              className="px-2 py-1 text-sm text-black border-black border-opacity-20 font-medium bg-white rounded border shadow-sm"
            >
              <Trans ns="admin:data">Delete Version</Trans>
            </button>
          )}
          {source.isArchived && (
            <button
              onClick={
                async () => {
                  confirmDelete({
                    primaryButtonText: "Rollback",
                    message: `Are you sure you want to rollback to version ${version}?`,
                    description: confirmRollbackDescription,
                    onDelete: async () => {
                      await rollback();
                      if (onRollback) {
                        onRollback({ sourceId: source.id });
                      }
                    },
                  });
                }
                //   if (jobContext.manager) {
                //     jobContext.manager.dismissFailedUpload(job.id);
                //     if (onDismissed) {
                //       onDismissed(job.id);
                //     }
                //   }
              }
              className="px-2 py-1 text-sm text-black border-black border-opacity-20 font-medium bg-white rounded border shadow-sm"
            >
              <Trans ns="admin:data">Rollback to Version {{ version }}</Trans>
            </button>
          )}
          {!source.isArchived &&
            (source.type === DataSourceTypes.ArcgisVector ||
              (source.type === DataSourceTypes.ArcgisDynamicMapserver &&
                layer.sublayerType === SublayerType.Vector)) && (
              <button
                onClick={() => setHostOnSeasketch(itemId)}
                className="px-2 py-1 text-sm text-black border-black border-opacity-20 font-medium bg-white rounded border shadow-sm"
              >
                <Trans ns="admin:data">Convert to Hosted Layer</Trans>
              </button>
            )}

          {hostOnSeaSketch && (
            <ConvertFeatureLayerToHostedModal
              tocId={hostOnSeaSketch}
              onRequestClose={() => setHostOnSeasketch(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function JobDetails({
  job,
  version,
  onDismissed,
}: {
  job: BackgroundJobDetailsFragment;
  version: number;
  onDismissed?: (jobId: number) => void;
}) {
  const jobContext = useContext(ProjectBackgroundJobContext);
  return (
    <div className="flex-2 p-4 border-t">
      <h2 className="text-base font-medium leading-6 text-gray-900">
        {job.esriFeatureLayerConversionTask ? (
          <Trans ns="admin:data">Conversion job details</Trans>
        ) : (
          <Trans ns="admin:data">Update job details</Trans>
        )}
      </h2>
      <div className="w-full flex items-center mt-2">
        <span className="font-medium flex-1">
          {job.dataUploadTask?.filename || (
            <Trans ns="admin:data">Converting ArcGIS Service</Trans>
          )}
        </span>
        <span className="font-normal">{job.progressMessage}</span>
      </div>
      {job.state === ProjectBackgroundJobState.Failed && job.errorMessage && (
        <Warning level="error">{job.errorMessage}</Warning>
      )}
      {job.progress && job.state === ProjectBackgroundJobState.Running && (
        <ProgressBar progress={job.progress} />
      )}
      {job.state === ProjectBackgroundJobState.Queued && (
        <p className="text-gray-500 text-sm mt-2">
          <Trans ns="admin:data">
            File has been uploaded and has been submitted to the system. It
            should be processed shortly. You can close this window or your
            browser and return later if you wish.
          </Trans>
        </p>
      )}
      {job.state === ProjectBackgroundJobState.Failed && (
        <p className="text-gray-500 text-sm mt-2">
          <Trans ns="admin:data">
            This update job failed. You can try again by uploading a new file.
            Contact{" "}
            <a
              className="text-primary-500"
              target="_blank"
              href="mailto:support@seasketch.org"
            >
              support@seasketch.org
            </a>{" "}
            for assistance.
          </Trans>
          <div className="mt-3">
            <button
              onClick={() => {
                if (jobContext.manager) {
                  jobContext.manager.dismissFailedUpload(job.id);
                  if (onDismissed) {
                    onDismissed(job.id);
                  }
                }
              }}
              className="px-4 py-2 text-black border-black border-opacity-20 font-medium bg-white rounded border shadow-sm"
            >
              <Trans ns="admin:data">Dismiss Error</Trans>
            </button>
          </div>
        </p>
      )}
    </div>
  );
}

function VersionListItem({
  version,
  createdAt,
  selected,
  current,
  onClick,
  isOldest,
  authorProfile,
  isUpload,
  isConversion,
}: {
  version: number;
  createdAt: Date;
  selected: boolean;
  current: boolean;
  isMostRecent: boolean;
  isConversion?: boolean;
  isOldest: boolean;
  onClick: () => void;
  isUpload?: boolean;
  authorProfile?: Pick<
    AuthorProfileFragment,
    "affiliations" | "email" | "fullname" | "nickname" | "picture" | "userId"
  >;
}) {
  const { t } = useTranslation("admin:data");
  return (
    <button
      className={`group relative flex items-center space-x-2 border-transparent group border rounded pr-4 ${
        selected
          ? "bg-blue-50 bg-opacity-60 rounded-l-full rounded-r-full border-blue-900 border-opacity-10 shadow-sm"
          : ""
      }`}
      onClick={onClick}
    >
      <VersionDot
        onClick={onClick}
        selected={selected}
        version={version}
        blendTail={isOldest}
        color={current ? "blue-500" : "gray-400"}
      />
      <div className="flex space-x-1 text-sm font-medium items-center">
        <span>
          {isConversion
            ? t("Converted")
            : isUpload
            ? t("Uploaded")
            : t("Created")}
        </span>
        <span>{createdAt.toLocaleDateString()}</span>
        <span>
          <Trans ns="admin:data">by</Trans>
        </span>
        {authorProfile ? (
          <span>
            {authorProfile.fullname ||
              authorProfile.nickname ||
              authorProfile.email}
          </span>
        ) : (
          <span>
            <Trans ns="admin:data">Unknown author</Trans>
          </span>
        )}
      </div>
    </button>
  );
}

function VersionDot({
  version,
  selected,
  onClick,
  isLoading,
  blendTail,
  color,
}: {
  version: number | string | ReactNode;
  selected?: boolean;
  onClick?: () => void;
  isLoading?: boolean;
  blendTail?: boolean;
  color?: string;
}) {
  return (
    <div className="relative">
      {/* Adding this hidden element so that tailwind border color classes (which are dynamically built with string interpolation) are included in the production build */}
      <div className="border-green-500 border-indigo-500 border-gray-400 border-gray-500 hidden"></div>
      <button
        disabled={selected}
        onClick={onClick}
        style={{ zIndex: 3 }}
        className={
          selected
            ? "relative rounded-full border-4 border-blue-300 border-opacity-80 pointer-events-none"
            : "relative group-hover:border-blue-300 group-hover:border-opacity-60 border-transparent rounded-full border-4 rotating-border"
        }
      >
        <div
          style={{ zIndex: 2 }}
          className={`transition-colors duration-500 relative rounded-full w-9 h-9 bg-opacity-10 border-4   text-center flex items-center justify-center font-bold ${
            color
              ? `${
                  color === "gray-400" ? "text-black" : `text-${color}`
                } border-${color} bg-${color}`
              : `border-blue-500 text-blue-500 bg-blue-500`
          }`}
        >
          {isLoading && (
            <motion.div
              className="w-full h-full absolute p-3.5 -top-1 -left-1 z-20 border-4 rounded-full"
              style={{
                borderColor:
                  "transparent rgba(255,255,255,0.4) transparent rgba(255,255,255,0.4)",
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                // repeatType: "reverse",
                ease: "linear",
              }}
              animate={{
                rotate: [0, 180],
              }}
              exit={{
                opacity: 0,
              }}
            ></motion.div>
          )}
          <span
            className={"z-20" + (selected === true ? " text-blue-900" : "")}
          >
            {version}
          </span>
          {isLoading && (
            <motion.div
              animate={{
                opacity: [0, 0.2, 0],
              }}
              transition={{
                repeat: Infinity,
                duration: 2.5,
              }}
              className={`z-10 absolute top-0 left-0 w-full h-full rounded-full bg-${color}`}
            ></motion.div>
          )}
        </div>
      </button>
      <div
        style={{
          background: blendTail
            ? "linear-gradient(180deg, rgba(150,150,150,1) 0%, rgba(150,150,150,1) 15%, rgba(150,150,150,0) 100%)"
            : "rgba(150,150,150,1)",
          zIndex: 1,
          marginLeft: -2,
        }}
        className="absolute top-9 h-6 w-1 left-1/2 bg-gray-500"
      ></div>
    </div>
  );
}

function JobListItem({
  job,
  version,
  onClick,
  selected,
}: {
  job: JobDetailsFragment;
  version: number;
  onClick: () => void;
  selected?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  return (
    <button
      onClick={onClick}
      disabled={selected}
      className={`max-w-full group flex items-center space-x-2 border-transparent border rounded pr-4 ${
        selected
          ? "bg-blue-50 bg-opacity-60 rounded-l-full rounded-r-full border-blue-900 border-opacity-10 shadow-sm"
          : ""
      }`}
    >
      <VersionDot
        selected={selected}
        onClick={onClick}
        isLoading={
          job.state === ProjectBackgroundJobState.Queued ||
          job.state === ProjectBackgroundJobState.Running
        }
        color={
          job.state === ProjectBackgroundJobState.Failed
            ? "red-500"
            : job.state === ProjectBackgroundJobState.Queued
            ? "indigo-500"
            : "green-500"
        }
        version={
          job.state === ProjectBackgroundJobState.Failed ? (
            <XIcon className="w-4 h-4" />
          ) : (
            version
          )
        }
      />
      <div className="flex space-x-1 text-sm font-medium items-center overflow-hidden">
        <span className="font-medium truncate">
          {job.dataUploadTask?.filename || job.title}
        </span>
        <span className="font-normal text-gray-500 flex-none">
          {job.progressMessage.toLowerCase()}
        </span>
      </div>
    </button>
  );
}
