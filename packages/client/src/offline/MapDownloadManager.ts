import bboxPolygon from "@turf/bbox-polygon";
import bytes from "bytes";
import { Feature, Polygon } from "geojson";
import localforage from "localforage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Statement } from "sql.js";
import {
  BasemapOfflineSupportInfoFragment,
  CacheableOfflineAssetType,
  OfflineBasemapDetailsFragment,
  OfflineTilePackageSourceType,
  OfflineTilePackageStatus,
} from "../generated/graphql";
import { normalizeSourceUrlTemplate } from "./mapboxApiHelpers";
import {
  cacheNameForSource,
  MAP_STATIC_ASSETS_CACHE_NAME,
} from "./MapTileCache";
import { removeDpiComponentFromMapboxUrl } from "./MapTileCacheHandlers";

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
  const abortController = useRef(new AbortController());
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        // first delete so service worker doesn't respond with cache
        await cache.delete(asset.cacheKey || asset.url);
        const response = await fetch(asset.url, {
          signal: abortController.current.signal,
        });
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

    for (const source of sourcesToDownload) {
      if (!source.currentTilePackage) {
        throw new Error("Offline tile package does not exist to be downloaded");
      }
      const currentTilePackage = source.currentTilePackage;
      setDownloadState({
        progress: progress / totalProgressUnits,
        working: true,
        // eslint-disable-next-line i18next/no-literal-string
        progressMessage: `Downloading ${source.type.toLowerCase()} tile package. ${bytes(
          0,
          { decimalPlaces: 0 }
        )} / ${bytes(source.currentTilePackage.bytes, { decimalPlaces: 0 })}`,
      });

      const mbtiles = await downloadMbtiles(
        currentTilePackage.presignedUrl,
        // eslint-disable-next-line no-loop-func
        ({ chunkBytes, receivedBytes }) => {
          progress += chunkBytes / 10000;
          // eslint-disable-next-line i18next/no-literal-string
          const progressMessage = `Downloading ${source.type.toLowerCase()} tile package. ${bytes(
            receivedBytes,
            { decimalPlaces: 0 }
          )} / ${bytes(currentTilePackage.bytes, {
            decimalPlaces: 0,
          })}`;
          const progressFraction = progress / totalProgressUnits;
          setDownloadState((prev) => ({
            ...prev,
            progress: progressFraction,
            // eslint-disable-next-line i18next/no-literal-string
            progressMessage,
          }));
        },
        abortController.current.signal
      );
      let tilesProcessed = 0;
      try {
        await addTilesToCache(
          mbtiles,
          currentTilePackage.originalUrlTemplate,
          // eslint-disable-next-line no-loop-func
          ({ tile, totalTiles, task }) => {
            progress += 1;
            if (tile && tile % 100 === 0) {
              tilesProcessed = tile;
              const currentProgress = progress / totalProgressUnits;
              setDownloadState((prev) => ({
                ...prev,
                progressMessage: task,
                progress: currentProgress,
              }));
            } else if (!tile) {
              setDownloadState((prev) => ({
                ...prev,
                progressMessage: task,
              }));
            }
          },
          abortController.current.signal
        );
        const currentProgress = progress / totalProgressUnits;
        // eslint-disable-next-line i18next/no-literal-string
        const msg = `Processed ${tilesProcessed} tiles`;
        setDownloadState((prev) => ({
          ...prev,
          progressMessage: msg,
          progress: currentProgress,
        }));
        if (!map || !map.offlineSupportInformation) {
          throw new Error("map.offlineSupportInformation not set?");
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
      } catch (e) {
        setDownloadState({
          working: false,
          progress: progress / totalProgressUnits,
          error: e.toString(),
        });
        return;
      }
    }
  }, [cacheStatus.status, map, context]);

  const cancel = useCallback(() => {
    abortController.current?.abort();
  }, []);

  return {
    cacheStatus,
    downloadState,
    populateCache,
    clearCache,
    cancel,
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
  packageCreationDate: Date;
  totalTiles: number;
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

async function downloadMbtiles(
  presignedUrl: string,
  progressCallback: (details: {
    chunkBytes: number;
    receivedBytes: number;
  }) => void,
  signal: AbortSignal
) {
  const response = await fetch(presignedUrl, { signal });
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
    progressCallback({
      chunkBytes: value.length,
      receivedBytes: receivedLength,
    });
  }
  let chunksAll = new Uint8Array(receivedLength);
  let position = 0;
  for (let chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }
  return chunksAll;
}

export async function addTilesToCache(
  mbtiles: Uint8Array,
  sourceUrlTemplate: string,
  progressCallback: (progress: {
    tile?: number;
    totalTiles?: number;
    task: string;
  }) => void,
  signal: AbortSignal
) {
  return new Promise((resolve, reject) => {
    import("sql.js").then(async (initSqlJs) => {
      if (signal.aborted) {
        reject(new Error("Aborted"));
        return;
      }
      const SQL = await initSqlJs.default({
        // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
        // You can omit locateFile completely when running in node
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
      });
      progressCallback({ task: "Initializing database" });
      const db = new SQL.Database(mbtiles);
      progressCallback({ task: "Reading mbtiles metadata" });
      let meta: SSNMBTilesMetadata;
      try {
        // eslint-disable-next-line i18next/no-literal-string
        const stm = db.prepare(`select name, value from metadata`);
        meta = parseMetadataRows(stm);
      } catch (e) {
        reject(new Error(`Does not appear to be a valid mbtiles file`));
        return;
      }
      if (!meta.dataSourceUrl) {
        reject(new Error(`mbtiles file does not contain required metadata`));
        return;
      }
      if (signal.aborted) {
        reject(new Error("Aborted"));
        return;
      }
      progressCallback({ task: "Resetting cache" });
      const cacheName = cacheNameForSource(meta.dataSourceUrl);
      let tilesProcessed = 0;
      // eslint-disable-next-line i18next/no-literal-string
      const results = db.exec(`select count(*) from tiles`);
      const totalTiles = parseInt(results[0].values[0][0]!.toString());
      await caches.delete(cacheName);
      const tileCache = await caches.open(cacheName);
      if (signal.aborted) {
        reject(new Error("Aborted"));
        return;
      }
      const statement = db.prepare(
        "SELECT tile_column, tile_row, zoom_level, tile_data from tiles",
        []
      );
      try {
        while (statement.step()) {
          if (signal.aborted) {
            reject(new Error("Aborted"));
            return;
          }
          const { zoom_level, tile_column, tile_row, tile_data } =
            statement.getAsObject(null) as {
              zoom_level: number;
              tile_column: number;
              tile_row: number;
              tile_data: Uint8Array;
            };
          tilesProcessed += 1;

          let cacheKey = sourceUrlTemplate
            .replace("{z}", zoom_level.toString())
            .replace("{x}", tile_column.toString())
            .replace("{y}", tile_row.toString());
          if (/api.mapbox.com/.test(cacheKey)) {
            cacheKey = removeDpiComponentFromMapboxUrl(cacheKey);
          }
          await tileCache.put(cacheKey, new Response(tile_data as Uint8Array));
          progressCallback({
            tile: tilesProcessed,
            totalTiles: totalTiles,
            // eslint-disable-next-line i18next/no-literal-string
            task: `Processing tiles (${tilesProcessed}/${totalTiles})...`,
          });
        }
      } catch (e) {
        reject(new Error(`Failed to process tiles`));
      } finally {
        statement.free();
      }

      await updateDownloadedOfflineTilePackages((prev) => {
        return [
          {
            dataSourceUrl: meta.dataSourceUrl,
            bytes: mbtiles.byteLength,
            packageId: meta.packageId,
            downloadedAt: new Date(),
            packageCreationDate: new Date(meta.createdAt),
            totalTiles,
            tilingSettings: {
              maxZ: meta.maxZ,
              maxShorelineZ: meta.maxShorelineZ,
              region: meta.region,
            },
          },
          ...prev.filter((state) => state.dataSourceUrl !== meta.dataSourceUrl),
        ];
      });
      resolve(cacheName);
    });
  });
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
    let cacheExists = false;
    if (!downloaded) {
      anyMissing = true;
    } else {
      // check that cache has not been deleted
      const cacheName = cacheNameForSource(source.dataSourceUrl);
      cacheExists = await caches.has(cacheName);
      if (!cacheExists) {
        anyMissing = true;
      }
      if (completePkg && downloaded.packageId !== completePkg.id) {
        anyUpdates = true;
      }
    }
    cachedSourceDetails.push({
      url: source.dataSourceUrl,
      type: source.type,
      cached: Boolean(downloaded) && cacheExists,
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

export type SSNMBTilesMetadata = {
  format: string;
  dataSourceUrl: string;
  maxZ: number;
  maxShorelineZ?: number;
  projectId: number;
  createdAt: Date;
  packageId: string;
  bounds: [number, number, number, number];
  region: Feature<Polygon>;
  sourceType: "raster" | "vector" | "raster-dem";
  originalUrlTemplate: string;
};

export function parseMetadataRows(stm: Statement) {
  const kv: { [name: string]: any } = {};
  while (stm.step()) {
    const { name, value } = stm.getAsObject() as {
      name: string;
      value: string;
    };
    switch (name) {
      case "dataSourceUrl":
        kv.dataSourceUrl = value;
        break;
      case "format":
        kv.format = value;
        break;
      case "maxShorelineZ":
        kv.maxShorelineZ = parseInt(value);
        break;
      case "maxZ":
        kv.maxZ = parseInt(value);
        break;
      case "projectId":
        kv.projectId = parseInt(value);
        break;
      case "createdAt":
        kv.createdAt = new Date(value);
        break;
      case "uuid":
        kv.packageId = value;
        break;
      case "sourceType":
        kv.sourceType = value;
        break;
      case "originalUrlTemplate":
        kv.originalUrlTemplate = value;
        break;
      case "bounds":
        kv.bounds = value
          .toString()
          .split(",")
          .map((coord) => parseFloat(coord)) as [
          number,
          number,
          number,
          number
        ];
        kv.region = bboxPolygon(kv.bounds);
        break;
      default:
        break;
    }
  }
  const required = [
    "dataSourceUrl",
    "maxZ",
    "projectId",
    "createdAt",
    "packageId",
    "format",
    "bounds",
    "sourceType",
    "originalUrlTemplate",
  ];
  for (const key of required) {
    if (!(key in kv)) {
      throw new Error(`Required metadata field "${key}" is missing`);
    }
  }
  return kv as SSNMBTilesMetadata;
}
