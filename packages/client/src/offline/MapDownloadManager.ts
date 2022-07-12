import bytes from "bytes";
import { resolve } from "dns";
import { map } from "lodash";
import { useCallback, useEffect, useState } from "react";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import {
  BasemapDetailsFragment,
  OfflineTilePackageDetailsFragment,
  useDownloadableOfflineTilePackagesQuery,
} from "../generated/graphql";
import getSlug from "../getSlug";
import { getStyle, normalizeStyleUrl } from "./mapboxApiHelpers";
import {
  cacheNameForSource,
  MAP_STATIC_ASSETS_CACHE_NAME,
} from "./MapTileCache";
import { urlForSource } from "./OfflineSurveyMapSettings";

type Asset = {
  type: "font" | "sprite" | "style";
  url: string;
  cached: boolean;
};

type TilePkgAsset = {
  url: string;
  bytes?: number;
  tiles?: number;
  cached: boolean;
  key?: string;
  missing: boolean;
  urlTemplate: string;
  dataSourceUrl: string;
};

type MapDownloadManagerStatusShared = {
  staticAssets?: Asset[];
  tilePackages?: TilePkgAsset[];
  // 0 - 1
  fractionCached: number;
};

type MapDownloadManagerPausedStatus = {
  working: false;
  error?: string;
};

type MapDownloadManagerWorkingStatus = {
  working: true;
  // 0 - 1
  progress: number;
  progressMessage?: string;
  error?: string;
};

type MapDownloadManagerStatus = MapDownloadManagerStatusShared &
  (MapDownloadManagerPausedStatus | MapDownloadManagerWorkingStatus);

export function useMapDownloadManager({
  maps,
}: {
  maps: Pick<BasemapDetailsFragment, "id" | "url">[];
}) {
  const onError = useGlobalErrorHandler();
  const { data, loading } = useDownloadableOfflineTilePackagesQuery({
    variables: {
      slug: getSlug(),
    },
    onError,
  });

  const [state, setState] = useState<{
    status: MapDownloadManagerStatus;
    initializing: boolean;
  }>({
    status: {
      working: false,
      fractionCached: 0,
    },
    initializing: true,
  });

  const populateCache = useCallback(() => {
    import("sql.js").then(async (initSqlJs) => {
      // @ts-ignore
      const SQL = await initSqlJs.default({
        // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
        // You can omit locateFile completely when running in node
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
      });
      if (maps.length && data?.projectBySlug?.offlineTilePackagesConnection) {
        getAssetsForMaps(
          maps,
          data.projectBySlug.offlineTilePackagesConnection.nodes,
          data.projectBySlug.mapboxPublicKey ||
            process.env.REACT_APP_MAPBOX_ACCESS_TOKEN
        )
          .then(async ({ staticAssets, tilePackages }) => {
            let totalBytes = tilePackages.reduce(
              (sum, tp) => sum + (tp.bytes || 0),
              0
            );
            // add a buffer for tileset processing
            const allTilePackagesBytes = totalBytes;
            totalBytes += allTilePackagesBytes / 3;
            // estimate 10kb per asset
            totalBytes += staticAssets.length * 10000;
            setState((prev) => ({
              ...prev,
              initializing: false,
              status: {
                fractionCached: 0,
                working: true,
                staticAssets,
                tilePackages,
                progress: 0,
              },
            }));
            const cache = await caches.open(MAP_STATIC_ASSETS_CACHE_NAME);
            let bytesCached = 0;
            for (const asset of staticAssets) {
              setState((prev) => ({
                ...prev,
                status: {
                  ...prev.status,
                  progressMessage: `Downloading ${
                    staticAssets.indexOf(asset) + 1
                  } of ${staticAssets.length} supporting files`,
                },
              }));
              const response = await fetch(asset.url);
              // strip access_token from cache key
              const cacheKey = new URL(asset.url);
              cacheKey.searchParams.delete("access_token");
              await cache.put(cacheKey.toString(), response);
              bytesCached += 10000;
              const progress = bytesCached / totalBytes;
              setState((prev) => ({
                ...prev,
                status: {
                  ...prev.status,
                  progress,
                },
              }));
            }
            for (const tilePackage of tilePackages) {
              setState((prev) => ({
                ...prev,
                status: {
                  ...prev.status,
                  progressMessage:
                    tilePackages.length === 1
                      ? `Downloading tile package`
                      : `Downloading ${
                          tilePackages.indexOf(tilePackage) + 1
                        } of ${tilePackages.length} tile packages`,
                },
              }));
              const response = await fetch(tilePackage.url);
              if (!response.body) {
                throw new Error("Could not get response.body");
              }
              const reader = response.body.getReader();
              const contentLength = response.headers.get("Content-Length");
              let receivedLength = 0; // received that many bytes at the moment
              let chunks = []; // array of received binary chunks (comprises the body)
              while (true) {
                const { done, value } = await reader.read();

                if (done) {
                  break;
                }

                chunks.push(value);
                bytesCached += value.length;
                receivedLength += value.length;
                const progress = bytesCached / totalBytes;
                const bytesState = `${bytes(bytesCached, {
                  decimalPlaces: 0,
                })}/${bytes(tilePackage.bytes || 0, { decimalPlaces: 0 })}`;
                setState((prev) => ({
                  ...prev,
                  status: {
                    ...prev.status,
                    progress,
                    progressMessage:
                      tilePackages.length === 1
                        ? `Downloading tile package. ${bytesState}`
                        : `Downloading ${
                            tilePackages.indexOf(tilePackage) + 1
                          } of ${
                            tilePackages.length
                          } tile packages (${bytesState})`,
                  },
                }));
              }

              let chunksAll = new Uint8Array(receivedLength); // (4.1)
              let position = 0;
              for (let chunk of chunks) {
                chunksAll.set(chunk, position); // (4.2)
                position += chunk.length;
              }
              setState((prev) => ({
                ...prev,
                status: {
                  ...prev.status,
                  progressMessage: `Decoding mbtiles`,
                },
              }));
              const db = new SQL.Database(chunksAll);
              setState((prev) => ({
                ...prev,
                status: {
                  ...prev.status,
                  progressMessage: `Resetting cache...`,
                },
              }));
              let tilesProcessed = 0;
              const pkgBytesProgressBuffer = (tilePackage.bytes || 0) * 0.3;
              const progressStartPosition = bytesCached / totalBytes;
              await caches.delete(
                cacheNameForSource(tilePackage.dataSourceUrl)
              );
              const tileCache = await caches.open(
                cacheNameForSource(tilePackage.dataSourceUrl)
              );
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
                  const url = tilePackage.urlTemplate
                    .replace("{z}", zoom_level.toString())
                    .replace("{x}", tile_column.toString())
                    .replace("{y}", tile_row.toString());
                  await tileCache.put(
                    url,
                    new Response(tile_data as Uint8Array)
                  );
                  if (tilesProcessed % 100 === 0) {
                    const progressMessage = `Processing tiles (${tilesProcessed}/${tilePackage.tiles})...`;
                    const progress =
                      progressStartPosition +
                      (pkgBytesProgressBuffer *
                        (tilesProcessed / tilePackage.tiles!)) /
                        totalBytes;
                    setState((prev) => ({
                      ...prev,
                      status: {
                        ...prev.status,
                        progressMessage,
                        progress,
                      },
                    }));
                  }
                }
              } finally {
                statement.free();
              }

              setState((prev) => ({
                ...prev,
                status: {
                  working: false,
                  fractionCached: 1,
                },
              }));
            }
          })
          .catch((e) => {
            console.error(e);
            setState((prev) => ({
              ...prev,
              status: {
                working: false,
                error: e.toString(),
                fractionCached: 0,
              },
            }));
          });
      }
    });
  }, [maps, data?.projectBySlug]);

  const cancel = useCallback(() => {}, [maps]);

  useEffect(() => {
    if (!loading && data?.projectBySlug) {
      getAssetsForMaps(
        maps,
        data.projectBySlug.offlineTilePackagesConnection.nodes,
        data.projectBySlug.mapboxPublicKey ||
          process.env.REACT_APP_MAPBOX_ACCESS_TOKEN
      )
        .then(({ staticAssets, tilePackages }) => {
          let totalFiles = 0;
          let filesCached = 0;
          for (const tilePackage of tilePackages) {
            totalFiles += tilePackage.tiles || 0;
            if (tilePackage.cached) {
              filesCached += tilePackage.tiles || 0;
            }
          }
          for (const asset of staticAssets) {
            totalFiles += 1;
            if (asset.cached) {
              filesCached += 1;
            }
          }
          setState((prev) => ({
            ...prev,
            initializing: false,
            status: {
              fractionCached: filesCached / totalFiles,
              working: false,
              error: undefined,
              staticAssets,
              tilePackages,
            },
          }));
        })
        .catch((e) => {
          setState((prev) => ({
            ...prev,
            status: {
              working: false,
              error: e.toString(),
              fractionCached: 0,
            },
          }));
        });
    } else {
      setState({
        initializing: true,
        status: { working: false, fractionCached: 0 },
      });
    }
  }, [loading, maps]);

  return {
    ...state,
    populateCache,
    cancel,
  };
}

async function getAssetsForMaps(
  maps: Pick<BasemapDetailsFragment, "id" | "url">[],
  projectTilePackages: OfflineTilePackageDetailsFragment[],
  mapboxApiKey: string
) {
  const assets: Asset[] = [];
  function addAsset(asset: Asset) {
    if (!assets.find((a) => a.url === asset.url)) {
      assets.push(asset);
    }
  }

  const cache = await caches.open(MAP_STATIC_ASSETS_CACHE_NAME);

  // add the styles
  for (const map of maps) {
    addAsset({
      type: "style",
      url: normalizeStyleUrl(map.url, mapboxApiKey),
      cached: Boolean(await cache.match(map.url)),
    });
  }

  const pkgs: TilePkgAsset[] = [];
  const styles = await Promise.all(
    maps.map((map) => getStyle(map.url, mapboxApiKey))
  );
  for (const style of styles) {
    for (const source of Object.values(style.sources)) {
      const url = urlForSource(source)!;
      const existing = pkgs.find((pkg) => pkg.url === url);
      if (!existing) {
        const tilePackage = projectTilePackages.find(
          (t) => t.dataSourceUrl === url
        );
        if (tilePackage) {
          pkgs.push({
            urlTemplate: tilePackage.originalUrlTemplate,
            cached: false,
            url: tilePackage.presignedUrl,
            bytes: tilePackage?.bytes,
            key: tilePackage?.id,
            missing: Boolean(tilePackage),
            tiles: tilePackage.totalTiles,
            dataSourceUrl: tilePackage.dataSourceUrl,
          });
        }
      }
    }
    // add glyphs
    if (style.glyphs) {
      const fontStacks: string[] = [];
      for (const layer of style.layers) {
        // @ts-ignore
        if (layer.layout && layer.layout["text-font"]) {
          // @ts-ignore
          const textFont = layer.layout["text-font"];
          if (Array.isArray(textFont)) {
            // exclude expressions. TODO: support expressions
            if (!textFont.find((el) => typeof el !== "string")) {
              const stack = textFont.join(",");
              if (fontStacks.indexOf(stack) === -1) {
                fontStacks.push(stack);
              }
            }
          }
        }
      }
      for (const stack of fontStacks) {
        let url = style
          .glyphs!.replace("{fontstack}", stack)
          .replace("{range}", "0-255");
        if (/^mapbox:/.test(style.glyphs!)) {
          // eslint-disable-next-line i18next/no-literal-string
          url = `https://api.mapbox.com/fonts/v1/mapbox/${encodeURIComponent(
            stack
          )}/0-255.pbf?access_token=${mapboxApiKey}`;
        }
        addAsset({
          type: "font",
          url,
          cached: Boolean(await cache.match(url)),
        });
      }
    }
    // add sprites
    // Useful background - https://docs.mapbox.com/mapbox-gl-js/style-spec/sprite/#loading-sprite-files
    if (style.sprite) {
      const variants = ["1x", "2x"];
      if (/mapbox:/.test(style.sprite)) {
        const id = style.sprite.replace("mapbox://sprites/", "");
        for (const variant of variants) {
          // eslint-disable-next-line i18next/no-literal-string
          const jsonUrl = `https://api.mapbox.com/styles/v1/${id}/sprite@${variant}.json?access_token=${mapboxApiKey}`;
          addAsset({
            url: jsonUrl,
            cached: Boolean(await cache.match(jsonUrl)),
            type: "sprite",
          });
          // eslint-disable-next-line i18next/no-literal-string
          const pngUrl = `https://api.mapbox.com/styles/v1/${id}/sprite@${variant}.png?access_token=${mapboxApiKey}`;
          addAsset({
            url: pngUrl,
            cached: Boolean(await cache.match(pngUrl)),
            type: "sprite",
          });
        }
      } else {
        for (const variant of variants) {
          // eslint-disable-next-line i18next/no-literal-string
          const jsonUrl = `${style.sprite!}@${variant}.json`;
          addAsset({
            url: jsonUrl,
            cached: Boolean(await cache.match(jsonUrl)),
            type: "sprite",
          });
          // eslint-disable-next-line i18next/no-literal-string
          const pngUrl = `${style.sprite!}@${variant}.png`;
          addAsset({
            url: pngUrl,
            cached: Boolean(await cache.match(pngUrl)),
            type: "sprite",
          });
        }
      }
    }
  }
  return {
    staticAssets: assets,
    tilePackages: pkgs,
  };
}
