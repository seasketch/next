import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Trans as T, useTranslation } from "react-i18next";
import {
  OfflineSupportInformation,
  OfflineTilePackageDetailsFragment,
  OfflineTilePackageStatus,
  useImportBasemapDetailsQuery,
  BasemapOfflineSupportInfoFragment,
} from "../generated/graphql";
import getSlug from "../getSlug";
import {
  addTilesToCache,
  DownloadManagerContext,
  getDownloadedOfflineTilePackages,
  parseMetadataRows,
  setBasemapClientCacheState,
  SSNMBTilesMetadata,
} from "./MapDownloadManager";
import Warning from "../components/Warning";
import { maxZLabel } from "./DownloadBasemapModal";
import bytes from "bytes";
import Badge from "../components/Badge";
import Button from "../components/Button";
import { CacheableOfflineAsset } from "../generated/queries";
import { CacheProgress } from "./CacheStatus";
import { MAP_STATIC_ASSETS_CACHE_NAME } from "./MapTileCache";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import Modal from "../components/Modal";
// @ts-ignore
// eslint-disable-next-line import/no-webpack-loader-syntax
import sqlWasm from "!!file-loader?name=sql-wasm-[contenthash].wasm!sql.js/dist/sql-wasm.wasm";

const Trans = (props: any) => (
  <T ns="offline" {...props}>
    {props.children}
  </T>
);

function ImportMbtilesModal({
  files,
  onRequestClose,
}: {
  files: FileList;
  onRequestClose: () => void;
}) {
  const abortController = useRef(new AbortController());
  const context = useContext(DownloadManagerContext);
  const { t } = useTranslation("offline");
  const { data, loading } = useImportBasemapDetailsQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const [importState, setImportState] = useState<{
    working: boolean;
    progress: number;
    message?: string;
  }>({
    working: false,
    progress: 0,
  });

  const [state, setState] = useState<
    ((InvalidMBTilesMetadata | ValidMBtilesMetadata) & {
      warnings: string[];
      maps?: {
        name: string;
        id: number;
        thumbnail: string;
        offlineSettings: BasemapOfflineSupportInfoFragment;
      }[];
    })[]
  >([]);

  const onError = useGlobalErrorHandler();

  useEffect(() => {
    if (data?.projectBySlug) {
      const projectId = data.projectBySlug.id;
      getMetadataFromMbtiles(files)
        .then(async (details) => {
          const annotated: ((InvalidMBTilesMetadata | ValidMBtilesMetadata) & {
            warnings: string[];
            maps?: {
              name: string;
              thumbnail: string;
              id: number;
              offlineSettings: BasemapOfflineSupportInfoFragment;
            }[];
          })[] = [];
          for (const record of details) {
            if (record.valid) {
              const mbtiles = record.details;
              // check to see if it's in the right project
              if (mbtiles.projectId !== projectId) {
                annotated.push({
                  ...record,
                  valid: false,
                  error: t(
                    "This tile package was generated for a different project"
                  ),
                  warnings: [],
                });
              } else {
                const warnings: string[] = [];
                const downloadedTilePackages =
                  await getDownloadedOfflineTilePackages();
                // check if it would replace a newer cache
                const existing = (downloadedTilePackages || []).find(
                  (pkg) => pkg.dataSourceUrl === record.details.dataSourceUrl
                );
                if (
                  existing &&
                  existing.packageCreationDate &&
                  existing.packageCreationDate.getTime() >
                    record.details.createdAt.getTime()
                ) {
                  warnings.push(
                    `Importing this map package will replace newer map data, downloaded ${existing.downloadedAt.toLocaleDateString()}`
                  );
                }
                // check if it's not the most up-to-date tile package (still import)
                // we'll need a completed tile package that matches the dataSourceUrl
                let currentTilePackage: null | OfflineTilePackageDetailsFragment =
                  null;
                const maps: {
                  name: string;
                  id: number;
                  thumbnail: string;
                  offlineSettings: OfflineSupportInformation;
                }[] = [];
                for (const survey of data.projectBySlug?.surveys || []) {
                  for (const basemap of survey.basemaps || []) {
                    for (const source of basemap.offlineSupportInformation
                      ?.sources || []) {
                      if (source.dataSourceUrl === mbtiles.dataSourceUrl) {
                        if (
                          !maps.find((b) => b.id === basemap.id) &&
                          !basemap.offlineSupportInformation
                            ?.hasUncacheableSources
                        ) {
                          maps.push({
                            name: basemap.name,
                            id: basemap.id,
                            thumbnail: basemap.thumbnail,
                            // @ts-ignore
                            offlineSettings: basemap.offlineSupportInformation!,
                          });
                        }
                        const complete = source.tilePackages.find(
                          (pkg) =>
                            pkg.jobStatus === OfflineTilePackageStatus.Complete
                        );
                        if (complete) {
                          currentTilePackage = complete;
                          break;
                        }
                      }
                    }
                  }
                }
                // check if it's not related to any map
                if (!currentTilePackage) {
                  annotated.push({
                    ...record,
                    valid: false,
                    error: t(
                      "This tile package is not related to any current maps, and will not be imported"
                    ),
                    warnings: [],
                  });
                  break;
                } else {
                  if (currentTilePackage.id !== mbtiles.packageId) {
                    warnings.push(
                      t(
                        `This file is not the most up to date tile package. Consider downloading the newer package instead.`
                      )
                    );
                  }
                  annotated.push({
                    ...record,
                    valid: true,
                    warnings: warnings,
                    maps,
                  });
                }
              }
            } else {
              annotated.push({
                ...record,
                warnings: [],
              });
            }
          }
          setState(annotated);
        })
        .catch((e) => {
          console.error(e);
          onError(e);
          onRequestClose();
        });
    }
  }, [files, data, onError, onRequestClose, t]);

  const relatedMaps = useMemo(() => {
    if (state) {
      const relatedMaps: {
        id: number;
        name: string;
        thumbnail: string;
        offlineSettings: BasemapOfflineSupportInfoFragment;
      }[] = [];
      for (const pkg of state) {
        for (const map of pkg.maps || []) {
          if (!relatedMaps.find((m) => m.id === map.id)) {
            relatedMaps.push({
              id: map.id,
              name: map.name,
              thumbnail: map.thumbnail,
              offlineSettings: map.offlineSettings,
            });
          }
        }
      }
      return relatedMaps;
    } else {
      return [];
    }
  }, [state]);

  const importTilesets = useCallback(
    async (signal: AbortSignal) => {
      if (signal.aborted) {
        return;
      }
      if (files.length && relatedMaps.length && !importState.working) {
        // Calculate the number of "work units" to include in the progress bar
        let workUnits = 0;
        for (const tileDetail of state) {
          if (tileDetail.valid) {
            workUnits += tileDetail.details.tileCount;
          }
        }
        let staticAssets: CacheableOfflineAsset[] = [];
        for (const map of relatedMaps) {
          for (const asset of map.offlineSettings.staticAssets) {
            if (!staticAssets.find((a) => a.url === asset.url)) {
              staticAssets.push(asset);
            }
          }
        }
        workUnits += staticAssets.length;
        let completedWorkUnits = 0;
        // 1) Download and add static assets to cache
        try {
          const cache = await caches.open(MAP_STATIC_ASSETS_CACHE_NAME);
          if (signal.aborted) {
            return;
          }
          for (const asset of staticAssets) {
            setImportState({
              working: true,
              // eslint-disable-next-line i18next/no-literal-string
              message: `Downloading support files (${completedWorkUnits + 1}/${
                staticAssets.length
              })`,
              progress: completedWorkUnits / workUnits,
            });
            // first delete so service worker doesn't respond with cache
            await caches.delete(asset.cacheKey || asset.url);
            const response = await fetch(asset.url, { signal });
            await cache.put(asset.cacheKey || asset.url, response);
            completedWorkUnits += 1;
          }
          if (signal.aborted) {
            return;
          }
          // 2) mark each map as downloaded
          // (static assets only though... could have incomplete tiles but that will be checked later. Not ideal)
          for (const map of relatedMaps) {
            await setBasemapClientCacheState(
              map.id,
              new Date(),
              map.offlineSettings.staticAssets.map((a) => a.cacheKey || a.url)
            );
          }
          if (signal.aborted) {
            return;
          }
          // 3) Cache tiles for each mbtiles file
          for (const metadata of state) {
            if (signal.aborted) {
              return;
            }
            if (metadata.valid && metadata.maps?.length) {
              const file = [...files].find(
                (f) => f.name === metadata.details.filename
              );
              if (!file) {
                throw new Error(
                  `Could not find file with name ${metadata.details.filename}`
                );
              }

              await addTilesToCache(
                new Uint8Array(await file.arrayBuffer()),
                metadata.details.originalUrlTemplate,
                // eslint-disable-next-line no-loop-func
                ({ tile, totalTiles, task }) => {
                  completedWorkUnits += 1;
                  if (tile && tile % 100 === 0) {
                    setImportState((prev) => ({
                      ...prev,
                      message: task,
                      progress: completedWorkUnits / workUnits,
                    }));
                  } else if (!tile) {
                    setImportState((prev) => ({
                      ...prev,
                      message: task,
                    }));
                  }
                },
                signal
              );
            }
          }
          if (signal.aborted) {
            return;
          }
          // 4) bump MapDownloadManager context so that ui in other places in the render tree updates
          context.bump();
          setImportState((prev) => ({
            ...prev,
            // eslint-disable-next-line i18next/no-literal-string
            message: `Import complete`,
            progress: 1,
            working: false,
          }));
        } catch (e) {
          console.error(e);
          setImportState({
            progress: 0,
            working: false,
            message: e.toString(),
          });
        }
      }
    },
    [files, relatedMaps, importState.working, state, context]
  );

  return files.length === 0 ? null : (
    <Modal
      scrollable
      onRequestClose={() => {}}
      loading={loading || state.length === 0}
      title={t("Import Map Packages")}
      footer={[
        ...(importState.progress !== 1 && relatedMaps.length > 0
          ? [
              {
                variant: "primary" as "primary",
                label: t("Import data"),
                disabled: importState.working,
                onClick: () => {
                  abortController.current = new AbortController();
                  importTilesets(abortController.current.signal);
                },
              },
            ]
          : []),
        {
          label: importState.progress === 1 ? t("Close") : t("Cancel"),
          onClick: () => {
            abortController.current?.abort();
            onRequestClose();
          },
        },
      ]}
    >
      <div className="">
        {!importState.working &&
          importState.progress !== 1 &&
          relatedMaps.length > 0 && (
            <>
              <p className="pb-4 text-sm">
                <Trans>
                  Importing data from these tile packages will add the following
                  maps to cache for offline use.
                </Trans>
              </p>
              <div className="space-x-2 flex w-full overflow-x-auto">
                {relatedMaps.map((map) => (
                  <div
                    key={map.id}
                    className="w-24 h-24 flex-none p-2 overflow-hidden text-xs text-white rounded text-center flex items-center shadow-sm"
                    style={{
                      backgroundImage: `url(${map.thumbnail})`,
                      backgroundSize: "cover",
                    }}
                  >
                    <span
                      className=""
                      style={{ textShadow: "0px 0px 3px #000000" }}
                    >
                      {map.name}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        {(importState.working || importState.progress === 1) && (
          <>
            <p className="pb-4 text-sm">
              {importState.progress === 1 ? (
                <Trans>Data has been imported and is ready for use.</Trans>
              ) : (
                <Trans>
                  Data is being loaded into your browser's cache. Please keep
                  you browser open and on this page until the process is
                  complete.
                </Trans>
              )}
            </p>
            <CacheProgress
              percent={importState.progress * 100}
              description={importState.message}
              loading={importState.working}
            />
          </>
        )}
        <h2 className="pt-4">
          <Trans>Tile Packages</Trans>
        </h2>
        <div className="mt-3 text-base space-y-3 max-h-128 overflow-y-auto">
          {state.map((file) => (
            <div key={file.id} className="p-2 border rounded shadow-sm">
              <h2 className="text-sm">{file.id}</h2>
              {file.details && (
                <>
                  <h3 className="text-sm overlow-hidden truncate text-gray-500">
                    {file.details.dataSourceUrl}
                  </h3>
                  <div className="space-x-1">
                    <Badge>{bytes(file.details.bytes)}</Badge>
                    <Badge>
                      <Trans>Created </Trans>
                      {file.details.createdAt.toLocaleDateString()}
                    </Badge>
                    <Badge>{maxZLabel(file.details)}</Badge>
                  </div>
                </>
              )}

              {!file.valid && (
                <Warning compact level="error">
                  {file.error}
                </Warning>
              )}
              {Boolean(file.warnings.length) &&
                file.warnings.map((warning) => (
                  <Warning compact key={file.id + warning}>
                    {warning}
                  </Warning>
                ))}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default ImportMbtilesModal;

type InvalidMBTilesMetadata = {
  id: string;
  valid: false;
  error: string;
  details?: SSNMBTilesMetadata & {
    filename: string;
    tileCount: number;
    bytes: number;
  };
};

type ValidMBtilesMetadata = {
  id: string;
  valid: true;
  details: SSNMBTilesMetadata & {
    filename: string;
    tileCount: number;
    bytes: number;
  };
};

export async function getMetadataFromMbtiles(
  files: FileList
): Promise<(ValidMBtilesMetadata | InvalidMBTilesMetadata)[]> {
  return new Promise((resolve, reject) => {
    import("sql.js").then(async (initSqlJs) => {
      const SQL = await initSqlJs.default({
        // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
        // You can omit locateFile completely when running in node
        locateFile: (file: string) => sqlWasm,
      });
      const details: (ValidMBtilesMetadata | InvalidMBTilesMetadata)[] = [];
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(buffer));
        try {
          // eslint-disable-next-line i18next/no-literal-string
          const stm = db.prepare(`select name, value from metadata`);
          const info = parseMetadataRows(stm);
          // eslint-disable-next-line i18next/no-literal-string
          const tileCount = db.exec(`select count(*) from tiles`);
          details.push({
            id: file.name,
            valid: true,
            details: {
              ...info,
              filename: file.name,
              bytes: file.size,
              tileCount: parseInt(tileCount[0].values[0][0]!.toString()),
            },
          });
        } catch (e) {
          details.push({
            id: file.name,
            valid: false,
            error: e.toString(),
          });
        }
      }
      resolve(details);
    });
  });
}
