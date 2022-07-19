import Modal from "../components/Modal";
import { Trans as T } from "react-i18next";
import { Header } from "../components/CenteredCardListLayout";
import { useMapDownloadManager } from "./MapDownloadManager";
import {
  BasemapDetailsFragment,
  useDownloadBasemapDetailsQuery,
} from "../generated/graphql";
import bytes from "bytes";
import { CacheProgress } from "./CacheStatus";
import Button from "../components/Button";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/solid";
import { ReactNode, useMemo } from "react";
import Warning from "../components/Warning";

const Trans = (props: any) => <T {...props} ns="offline"></T>;

export default function DownloadBasemapModal({
  map,
  onRequestClose,
}: {
  map: Pick<BasemapDetailsFragment, "id" | "url" | "name">;
  onRequestClose: () => void;
}) {
  const onError = useGlobalErrorHandler();
  const { data, loading } = useDownloadBasemapDetailsQuery({
    variables: {
      id: map.id,
    },
    onError,
  });

  const { cacheStatus, populateCache, downloadState, clearCache, cancel } =
    useMapDownloadManager({
      map: data?.basemap || undefined,
    });

  const hasMapTileUpdates = Boolean(
    (cacheStatus?.status?.sources || []).find((source) => source.hasUpdates)
  );

  const footer = useMemo(() => {
    return (
      <>
        <Button
          label={
            downloadState.working ? <Trans>Cancel</Trans> : <Trans>Close</Trans>
          }
          onClick={() => {
            cancel();
            onRequestClose();
          }}
        />
        {(cacheStatus.status?.state === "complete" ||
          cacheStatus.status?.state === "has-updates") && (
          <Button
            // backgroundColor="#cc1111"
            disabled={downloadState.working}
            label={
              <span className="text-red-800">
                <Trans>Clear Map Data</Trans>
              </span>
            }
            onClick={() => {
              if (
                window.confirm(
                  `Are you sure you want to delete this offline map data? You will not be able to use these maps until downloaded again. If map data is shared by multiple basemaps, this operation will clear data for all related basemaps.`
                )
              ) {
                clearCache();
              }
            }}
          />
        )}
        {cacheStatus.status?.state === "incomplete" && (
          <Button
            primary
            disabled={downloadState.working}
            label={<Trans>Begin Download</Trans>}
            onClick={() => populateCache()}
          />
        )}
        {cacheStatus.status?.state === "has-updates" && (
          <Button
            primary
            disabled={downloadState.working}
            label={<Trans>Update Map</Trans>}
            onClick={() => populateCache()}
          />
        )}
      </>
    );
  }, [
    cacheStatus.status?.state,
    cancel,
    clearCache,
    downloadState.working,
    onRequestClose,
    populateCache,
  ]);

  return (
    <Modal
      disableBackdropClick={!!downloadState.working}
      disableEscapeKeyDown={!!downloadState.working}
      onRequestClose={onRequestClose}
      open={true}
      loading={loading || cacheStatus.loading}
      footer={footer}
    >
      {!cacheStatus.loading && cacheStatus.status && (
        <div className="w-128 space-y-2">
          {cacheStatus.status.state === "complete" && (
            <>
              <Header>{map.name}</Header>
              <div className="flex items-center mb-2">
                <CheckCircleIcon className="text-primary-600 w-6 h-6 mr-2" />
                <p>
                  <Trans>
                    This map has been downloaded and is ready for offline use
                  </Trans>
                </p>
              </div>
              <div className="flex space-x-2 pt-2">
                <CacheBox
                  title={bytes(
                    cacheStatus.status.sources.reduce(
                      (sum, src) =>
                        (sum += src.downloadedTilePackage?.bytes || 0),
                      0
                    )
                  )}
                  subtitle={<Trans>map tile data</Trans>}
                />
                <CacheBox
                  title={cacheStatus.status.staticAssets.length.toString()}
                  subtitle={<Trans>support files</Trans>}
                />
                {cacheStatus.status.lastUpdated && (
                  <CacheBox
                    title={cacheStatus.status.lastUpdated.toLocaleDateString()}
                    subtitle={<Trans>last updated</Trans>}
                  />
                )}
              </div>
            </>
          )}
          {cacheStatus.status.state === "has-updates" && (
            <>
              <Header>
                <Trans>Update</Trans> {map.name}
              </Header>
              <div className="flex">
                <ExclamationCircleIcon className="text-primary-600 w-6 h-6 mr-2" />
                <p>
                  <Trans>
                    This map has been downloaded and can be used offline, but
                    there are updates available.
                  </Trans>
                </p>
              </div>
              {!hasMapTileUpdates &&
                cacheStatus.status.state === "has-updates" && (
                  <>
                    <div className="flex space-x-2 pt-2 pb-2">
                      <CacheBox
                        title={bytes(
                          cacheStatus.status.sources.reduce(
                            (sum, src) =>
                              (sum += src.downloadedTilePackage?.bytes || 0),
                            0
                          )
                        )}
                        subtitle={<Trans>map tile data</Trans>}
                      />
                      <CacheBox
                        title={cacheStatus.status.staticAssets.length.toString()}
                        subtitle={<Trans>support files</Trans>}
                      />
                      {cacheStatus.status.lastUpdated && (
                        <CacheBox
                          title={cacheStatus.status.lastUpdated.toLocaleDateString()}
                          subtitle={<Trans>last updated</Trans>}
                        />
                      )}
                    </div>
                    <Warning>
                      {cacheStatus.status.lastUpdated ? (
                        <Trans>
                          This map has new cartographic updates as of{" "}
                          {cacheStatus.status.lastUpdated.toLocaleString()}. You
                          can update this map without downloading new map tiles.
                        </Trans>
                      ) : (
                        <Trans>
                          This map has new cartographic updates. You can update
                          this map without downloading new map tiles.
                        </Trans>
                      )}
                    </Warning>
                  </>
                )}
              {hasMapTileUpdates && (
                <div className="pt-2 space-y-2">
                  <h4 className="text-base">
                    <Trans>Map Tile Updates</Trans>
                  </h4>
                  {cacheStatus.status.sources
                    .filter((s) => s.hasUpdates && s.downloadedTilePackage)
                    .map((source) => {
                      return (
                        <div
                          key={source.url}
                          className="w-full overflow-hidden border-gray-200 border rounded"
                        >
                          <h5 className="truncate text-sm p-2 font-semibold text-gray-600">
                            {source.url}
                          </h5>
                          <div className="flex">
                            <div className="flex-1 border-gray-200 border-t border-r p-2 overflow-hidden">
                              {source.downloadedTilePackage?.downloadedAt && (
                                <p className="text-sm text-gray-500 truncate">
                                  <Trans>
                                    Downloaded{" "}
                                    {source.downloadedTilePackage!.downloadedAt.toLocaleString()}
                                  </Trans>
                                </p>
                              )}
                              <p className="text-sm text-gray-500 truncate">
                                {bytes(
                                  source.downloadedTilePackage?.bytes || 0
                                )}
                                . {maxZLabel(source.downloadedTilePackage!)}
                              </p>
                            </div>
                            <div className="flex-1 border-gray-200 border-t p-2 border-l-0 overflow-hidden">
                              <p className="text-sm text-gray-500 truncate">
                                <Trans>
                                  Updated{" "}
                                  {source.currentTilePackage?.createdAt.toLocaleString()}
                                </Trans>
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {bytes(source.currentTilePackage?.bytes || 0)}.{" "}
                                {maxZLabel(source.currentTilePackage!)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
          {cacheStatus.status.state === "incomplete" && (
            <>
              <Header>
                <Trans>Download</Trans> {map.name}
              </Header>
              {!(downloadState.working || downloadState.error) && (
                <div className="h-11 flex items-center">
                  <div className="text-xl text-primary-600">
                    <Trans>
                      {{
                        bytes: bytes(
                          cacheStatus.status!.sources.reduce(
                            (bytes, source) =>
                              (bytes +=
                                source.currentTilePackage &&
                                source.downloadedTilePackage &&
                                source.downloadedTilePackage.id ===
                                  source.currentTilePackage.id &&
                                source.cached
                                  ? 0
                                  : source.currentTilePackage?.bytes || 0),
                            0
                          )
                        ),
                      }}{" "}
                      tile packages,{" "}
                    </Trans>
                    <Trans>
                      {cacheStatus.status!.staticAssets.length.toString()}{" "}
                      support files
                    </Trans>
                  </div>
                </div>
              )}
            </>
          )}
          {(downloadState.working || downloadState.error) && (
            <>
              <div className="h-11 flex items-center">
                {downloadState.working || downloadState.error ? (
                  <CacheProgress
                    className="w-full"
                    loading={true}
                    percent={downloadState.progress * 100}
                    description={
                      downloadState.working
                        ? downloadState.progressMessage
                        : downloadState.error
                    }
                  />
                ) : (
                  <div className="text-xl text-primary-600">
                    <Trans>
                      {{
                        bytes: bytes(
                          cacheStatus.status!.sources.reduce(
                            (bytes, source) =>
                              (bytes +=
                                source.currentTilePackage &&
                                source.downloadedTilePackage &&
                                source.downloadedTilePackage.id ===
                                  source.currentTilePackage.id
                                  ? 0
                                  : source.currentTilePackage?.bytes || 0),
                            0
                          )
                        ),
                      }}{" "}
                      tile packages,{" "}
                    </Trans>
                    <Trans>
                      {cacheStatus.status!.staticAssets.length.toString()}{" "}
                      support files
                    </Trans>
                  </div>
                )}
              </div>
            </>
          )}
          {(downloadState.working ||
            cacheStatus.status.state === "incomplete") && (
            <>
              <p className="text-sm">
                <Trans>
                  When downloading maps, be sure to leave the browser window
                  open and prevent your computer from going to sleep until after
                  the process is complete. Only one map can be downloaded at a
                  time.
                </Trans>
              </p>
            </>
          )}
          {false && (
            <div className="pt-3 h-15">
              <CacheProgress loading={true} percent={10} description={""} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function CacheBox({
  title,
  subtitle,
}: {
  title: ReactNode | string;
  subtitle: ReactNode | string;
}) {
  return (
    <div className="border p-2 border-gray-200 rounded flex flex-col w-32 shadow-sm">
      <div className="text-primary-600 text-lg">{title}</div>
      <span className="text-gray-700">{subtitle}</span>
    </div>
  );
}

export function maxZLabel({
  maxZ,
  maxShorelineZ,
}: {
  maxZ: number;
  maxShorelineZ?: number;
}) {
  if (maxShorelineZ) {
    // eslint-disable-next-line i18next/no-literal-string
    return `z${maxZ}/${maxShorelineZ}`;
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    return `z${maxZ}`;
  }
}
