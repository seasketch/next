import bytes from "bytes";
import { Feature, Polygon } from "geojson";
import localforage from "localforage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  BasemapOfflineSupportInfoFragment,
  CacheableOfflineAssetType,
  OfflineBasemapDetailsFragment,
  OfflineTilePackageSourceType,
  OfflineTilePackageStatus,
} from "../generated/graphql";
import {
  cacheNameForSource,
  MAP_STATIC_ASSETS_CACHE_NAME,
} from "./MapTileCache";

type MapDownloadManagerPausedStatus = {
  working: false;
  progress: number;
  error?: string;
};

type MapDownloadManagerWorkingStatus = {
  working: true;
  // 0 - 1
  progress: number;
  progressMessage?: string;
  error?: string;
};

type MapDownloadManagerStatus =
  | MapDownloadManagerPausedStatus
  | MapDownloadManagerWorkingStatus;

export function useMapDownloadManager({
  map,
}: {
  map: OfflineBasemapDetailsFragment | undefined;
}) {
  const context = useContext(DownloadManagerContext);
  const [cacheStatus, setCacheStatus] = useState<{
    loading: boolean;
    error?: string;
    status?: CacheStatusForBasemap;
  }>({ loading: true });

  const [downloadState, setDownloadState] = useState<MapDownloadManagerStatus>({
    working: false,
    progress: 0,
  });

  useEffect(() => {
    if (!map) {
      setCacheStatus({ loading: true });
    } else if (map.offlineSupportInformation) {
      const info = map.offlineSupportInformation;
      getCacheStatusForBasemap(map.id, info)
        .then((status) => {
          setCacheStatus({
            loading: false,
            status,
          });
        })
        .catch((e) => {
          setCacheStatus({
            loading: false,
            error: e.toString(),
          });
        });
    } else {
      setCacheStatus({
        loading: false,
        error: "No offline support information found",
      });
    }
  }, [map, context]);

  const clearCache = useCallback(async () => {
    if (!map) {
      throw new Error("MapDownloadManager: map not set");
    }
    if (!cacheStatus.status) {
      throw new Error("MapDownloadManager: cache status is not yet known");
    }
    // delete static assets
    const cache = await caches.open(MAP_STATIC_ASSETS_CACHE_NAME);
    for (const [i, asset] of cacheStatus.status.staticAssets.entries()) {
      await cache.delete(asset.cacheKey || asset.url);
    }
    // delete tile package caches
    for (const source of cacheStatus.status.sources) {
      if (source.downloadedTilePackage) {
        await caches.delete(cacheNameForSource(source.url));
        await updateDownloadedOfflineTilePackages((prev) => {
          return [
            ...prev.filter((state) => state.dataSourceUrl !== source.url),
          ];
        });
      }
    }
    await setBasemapClientCacheState(
      map.id,
      new Date(),
      cacheStatus.status.staticAssets.map((a) => a.cacheKey || a.url)
    );

    context.bump();
  }, [map, context, cacheStatus]);

  const populateCache = useCallback(async () => {
    if (!cacheStatus.status) {
      throw new Error("cache status is not yet known");
    }
    // make sure there are not any sources with missing tile packages
    if (
      cacheStatus.status.sources.find((source) => !source.currentTilePackage)
    ) {
      throw new Error("Offline tile package does not exist to be downloaded");
    }
    setDownloadState((prev) => {
      return {
        progress: 0,
        working: true,
        // eslint-disable-next-line i18next/no-literal-string
        progressMessage: `Initializing job`,
      };
    });
    // 1) First, calculate "progress units".
    // We can't just use the number of bytes downloaded for progress for a
    // couple reasons. We don't know ahead of time the total bytes for each
    // supporting files. We're also going to be commiting map data tile-by-tile
    // to cache after downloading. So, we have to have a way of normalizing
    // support file downloads, tile package download, and map tile processing
    // beforehand so that consitent progress can be shown.
    let totalProgressUnits = 0;
    // Each support file will be worth 1 "unit"
    totalProgressUnits = cacheStatus.status.staticAssets.length;
    const sourcesToDownload = cacheStatus.status.sources.filter(
      (s) => !s.cached || s.hasUpdates
    );
    // Every 10kb of tile package to be downloaded is worth a unit
    for (const source of sourcesToDownload) {
      if (source.currentTilePackage) {
        totalProgressUnits += source.currentTilePackage.bytes / 10000;
      }
    }
    // Every tile is worth a unit
    totalProgressUnits += sourcesToDownload.reduce(
      (sum, pkg) => (sum += pkg.currentTilePackage!.totalTiles),
      0
    );

    // 2) Start downloading support files
    let progress = 0;
    const cache = await caches.open(MAP_STATIC_ASSETS_CACHE_NAME);
    for (const [i, asset] of cacheStatus.status.staticAssets.entries()) {
      setDownloadState({
        progress: progress / totalProgressUnits,
        working: true,
        // eslint-disable-next-line i18next/no-literal-string
        progressMessage: `Downloading support file (${i}/${cacheStatus.status.staticAssets.length})`,
      });
      try {
        const response = await fetch(asset.url);
        await cache.put(asset.cacheKey || asset.url, response);
        progress += 1;
      } catch (e) {
        setDownloadState({
          working: false,
          progress: progress / totalProgressUnits,
          // eslint-disable-next-line i18next/no-literal-string
          error: `Failed to download ${asset.url}`,
        });
        return;
      }
    }

    setDownloadState({
      progress: progress / totalProgressUnits,
      working: true,
      // eslint-disable-next-line i18next/no-literal-string
      progressMessage: `Initializing mbtiles reader`,
    });

    import("sql.js").then(async (initSqlJs) => {
      const SQL = await initSqlJs.default({
        // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
        // You can omit locateFile completely when running in node
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
      });
      for (const source of sourcesToDownload) {
        if (!source.currentTilePackage) {
          throw new Error(
            "Offline tile package does not exist to be downloaded"
          );
        }
        setDownloadState({
          progress: progress / totalProgressUnits,
          working: true,
          // eslint-disable-next-line i18next/no-literal-string
          progressMessage: `Downloading ${source.type.toLowerCase()} tile package. ${bytes(
            0,
            { decimalPlaces: 0 }
          )} / ${bytes(source.currentTilePackage.bytes, { decimalPlaces: 0 })}`,
        });
        const response = await fetch(source.currentTilePackage.presignedUrl);
        if (!response.body) {
          throw new Error("Could not get response.body");
        }
        const reader = response.body.getReader();
        let receivedLength = 0; // received that many bytes at the moment
        let chunks = []; // array of received binary chunks (comprises the body)
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          chunks.push(value);
          receivedLength += value.length;
          progress += value.length / 10000;
          // eslint-disable-next-line i18next/no-literal-string
          const progressMessage = `Downloading ${source.type.toLowerCase()} tile package. ${bytes(
            receivedLength,
            { decimalPlaces: 0 }
          )} / ${bytes(source.currentTilePackage.bytes, {
            decimalPlaces: 0,
          })}`;
          const progressFraction = progress / totalProgressUnits;
          setDownloadState((prev) => ({
            ...prev,
            progress: progressFraction,
            // eslint-disable-next-line i18next/no-literal-string
            progressMessage,
          }));
        }
        let chunksAll = new Uint8Array(receivedLength); // (4.1)
        let position = 0;
        for (let chunk of chunks) {
          chunksAll.set(chunk, position); // (4.2)
          position += chunk.length;
        }
        setDownloadState((prev) => ({
          ...prev,
          // eslint-disable-next-line i18next/no-literal-string
          progressMessage: `Decoding mbtiles...`,
        }));
        const db = new SQL.Database(chunksAll);
        setDownloadState((prev) => ({
          ...prev,
          // eslint-disable-next-line i18next/no-literal-string
          progressMessage: `Resetting cache...`,
        }));
        let tilesProcessed = 0;
        const cacheName = cacheNameForSource(source.url);
        await caches.delete(cacheName);
        const tileCache = await caches.open(cacheName);
        const statement = db.prepare(
          "SELECT tile_column, tile_row, zoom_level, tile_data from tiles",
          []
        );
        try {
          while (statement.step()) {
            const { zoom_level, tile_column, tile_row, tile_data } =
              statement.getAsObject(null) as {
                zoom_level: number;
                tile_column: number;
                tile_row: number;
                tile_data: Uint8Array;
              };
            tilesProcessed += 1;
            progress += 1;
            const url = source.currentTilePackage.originalUrlTemplate
              .replace("{z}", zoom_level.toString())
              .replace("{x}", tile_column.toString())
              .replace("{y}", tile_row.toString());
            await tileCache.put(url, new Response(tile_data as Uint8Array));
            if (tilesProcessed % 100 === 0) {
              // eslint-disable-next-line i18next/no-literal-string
              const progressMessage = `Processing tiles (${tilesProcessed}/${source.currentTilePackage.totalTiles})...`;
              const currentProgress = progress / totalProgressUnits;
              setDownloadState((prev) => ({
                ...prev,
                progressMessage,
                progress: currentProgress,
              }));
            }
          }
        } catch (e) {
          setDownloadState({
            working: false,
            progress: progress / totalProgressUnits,
            error: e.toString(),
          });
        } finally {
          statement.free();
        }
        const currentProgress = progress / totalProgressUnits;
        setDownloadState((prev) => ({
          ...prev,
          // eslint-disable-next-line i18next/no-literal-string
          progressMessage: `Processed ${tilesProcessed} tiles`,
          progress: currentProgress,
        }));
        if (!map || !map.offlineSupportInformation) {
          throw new Error("map.offlineSupportInformation not set?");
        }
        const pkg = source.currentTilePackage;
        await updateDownloadedOfflineTilePackages((prev) => {
          return [
            {
              dataSourceUrl: source.url,
              bytes: pkg.bytes,
              packageId: pkg.id,
              downloadedAt: new Date(),
              tilingSettings: {
                maxZ: pkg.maxZ,
                maxShorelineZ: pkg.maxShorelineZ,
                region: pkg.region,
              },
            },
            ...prev.filter((state) => state.dataSourceUrl !== source.url),
          ];
        });
      }
      await setBasemapClientCacheState(
        map!.id,
        new Date(),
        map!.offlineSupportInformation!.staticAssets.map(
          (a) => a.cacheKey || a.url
        )
      );

      const status = await getCacheStatusForBasemap(
        map!.id,
        map!.offlineSupportInformation!
      );
      setCacheStatus({ loading: false, status });
      setDownloadState({
        working: false,
        progress: 0,
      });
      // Make sure parent components update their map cache states
      context.bump();
    });
  }, [cacheStatus.status, map, context]);

  return {
    cacheStatus,
    downloadState,
    populateCache,
    clearCache,
  };
}

type BasemapClientCacheState = {
  lastCached: Date;
  staticAssets: string[];
};

const BASEMAP_CLIENT_STATE_KEY_TEMPLATE = `basemap-client-cache-state-id`;

export async function getBasemapClientCacheState(
  id: number
): Promise<BasemapClientCacheState | null> {
  return localforage.getItem<{ lastCached: Date; staticAssets: string[] }>(
    BASEMAP_CLIENT_STATE_KEY_TEMPLATE.replace("id", id.toString())
  );
}

export async function setBasemapClientCacheState(
  id: number,
  lastCached: Date,
  staticAssets: string[]
) {
  return localforage.setItem(
    BASEMAP_CLIENT_STATE_KEY_TEMPLATE.replace("id", id.toString()),
    { lastCached, staticAssets }
  );
}

const DOWNLOADED_OFFLINE_TILE_PACKAGES_KEY = "downloaded-offline-tile-packages";

export type CachedTilePackageState = {
  packageId: string;
  dataSourceUrl: string;
  bytes: number;
  downloadedAt: Date;
  tilingSettings: {
    maxZ: number;
    maxShorelineZ?: number;
    region: Feature<Polygon>;
  };
};

export async function getDownloadedOfflineTilePackages() {
  return localforage.getItem<CachedTilePackageState[]>(
    DOWNLOADED_OFFLINE_TILE_PACKAGES_KEY
  );
}

// TODO: clear values for older tile packages that have been superceeded by the new ones
export async function updateDownloadedOfflineTilePackages(
  updaterFn: (previous: CachedTilePackageState[]) => CachedTilePackageState[]
) {
  const existingValue = (await getDownloadedOfflineTilePackages()) || [];
  return localforage.setItem(
    DOWNLOADED_OFFLINE_TILE_PACKAGES_KEY,
    updaterFn(existingValue)
  );
}

type CachedSourceDetails = {
  type: OfflineTilePackageSourceType;
  url: string;
  cached: boolean;
  hasUpdates: boolean;
  currentTilePackage?: {
    id: string;
    maxZ: number;
    maxShorelineZ?: number;
    bytes: number;
    createdAt: Date;
    totalTiles: number;
    presignedUrl: string;
    originalUrlTemplate: string;
    region: Feature<Polygon>;
  };
  downloadedTilePackage?: {
    id: string;
    maxZ: number;
    maxShorelineZ?: number;
    bytes: number;
    downloadedAt: Date;
  };
};

export type CacheStatusForBasemap = {
  lastUpdated?: Date;
  state: "complete" | "incomplete" | "has-updates";
  staticAssets: {
    url: string;
    cacheKey?: string;
    type: CacheableOfflineAssetType;
    cached: boolean;
  }[];
  sources: CachedSourceDetails[];
};

export async function getCacheStatusForBasemap(
  id: number,
  info: BasemapOfflineSupportInfoFragment
) {
  const clientState = await getBasemapClientCacheState(id);
  const downloadedPackages = await getDownloadedOfflineTilePackages();
  let anyMissing = false;
  let lastModified: undefined | Date;
  let anyUpdates = false;
  let styleOutOfDate = false;
  if (info.styleLastModified) {
    lastModified = new Date(info.styleLastModified);
    if (
      clientState?.lastCached &&
      lastModified!.getTime() > clientState.lastCached.getTime()
    ) {
      styleOutOfDate = true;
    }
  }
  const assets = [];
  for (const asset of info.staticAssets) {
    const cached = await caches.match(asset.cacheKey || asset.url);
    // Only flag as un-cached for missing assets if the style was never cached,
    // otherwise there is likely a perfectly good style present
    if (!cached && !styleOutOfDate) {
      anyMissing = true;
    }
    assets.push({
      url: asset.url,
      cacheKey: asset.cacheKey || undefined,
      cached: Boolean(cached),
      type: asset.type,
    });
  }
  if (styleOutOfDate) {
    // check the health of the out-of-date style
    for (const cacheKey of clientState!.staticAssets) {
      const response = await cacheKey.match(cacheKey);
      if (!response) {
        anyMissing = true;
      }
    }
  }
  const cachedSourceDetails: CachedSourceDetails[] = [];
  for (const source of info.sources) {
    const completePkg = source.tilePackages.find(
      (pkg) => pkg.jobStatus === OfflineTilePackageStatus.Complete
    );
    // if (!completePkg) {
    //   throw new Error("Source is missing completed tile package");
    // }
    // check what package ID has been downloaded (if any)
    const downloaded = downloadedPackages?.find(
      (p) => p.dataSourceUrl === source.dataSourceUrl
    );
    if (!downloaded) {
      anyMissing = true;
    } else if (completePkg && downloaded.packageId !== completePkg.id) {
      anyUpdates = true;
    }
    cachedSourceDetails.push({
      url: source.dataSourceUrl,
      type: source.type,
      cached: Boolean(downloaded),
      hasUpdates:
        Boolean(completePkg) && downloaded?.packageId !== completePkg?.id,
      currentTilePackage: completePkg
        ? {
            id: completePkg.id,
            maxZ: completePkg.maxZ,
            maxShorelineZ: completePkg.maxShorelineZ || undefined,
            bytes: completePkg.bytes,
            createdAt: new Date(completePkg.createdAt),
            totalTiles: completePkg.totalTiles,
            presignedUrl: completePkg.presignedUrl,
            originalUrlTemplate: completePkg.originalUrlTemplate,
            region: completePkg.region.geojson,
          }
        : undefined,
      downloadedTilePackage: downloaded
        ? {
            id: downloaded.packageId,
            bytes: downloaded.bytes,
            maxZ: downloaded.tilingSettings.maxZ,
            maxShorelineZ: downloaded.tilingSettings.maxShorelineZ,
            downloadedAt: downloaded.downloadedAt,
          }
        : undefined,
    });
  }
  return {
    lastUpdated: clientState?.lastCached,
    state: anyMissing
      ? "incomplete"
      : anyUpdates || styleOutOfDate
      ? "has-updates"
      : ("complete" as "incomplete" | "has-updates" | "complete"),
    staticAssets: assets,
    sources: cachedSourceDetails,
    styleLastModified: info.styleLastModified
      ? new Date(info.styleLastModified)
      : undefined,
  };
}

export const DownloadManagerContext = createContext({
  iter: 0,
  bump: () => {},
});
