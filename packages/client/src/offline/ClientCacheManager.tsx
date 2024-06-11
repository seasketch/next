import { useApolloClient } from "@apollo/client";
import localforage from "localforage";
import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { cloudfrontToSameOrigin, ConsentProps } from "../formElements/Consent";
import {
  namedOperations,
  SurveyDocument,
  FormElementDetailsFragment,
} from "../generated/graphql";
import getSlug from "../getSlug";
import sleep from "../sleep";
import { srcVariants } from "../surveys/ImagePreloader";
import useIsSuperuser from "../useIsSuperuser";
import {
  ClientCacheSetting,
  ClientCacheSettings,
  CLIENT_CACHE_SETTINGS_KEY,
} from "./ClientCacheSettings";
import { GraphqlQueryCache } from "./GraphqlQueryCache/main";
import {
  offlineSurveyChoiceStrategy,
  surveyLRUStrategy,
} from "./GraphqlQueryCache/strategies";
import useGraphqlQueryCache from "./GraphqlQueryCache/useGraphqlQueryCache";
import StaticAssetCache from "./StaticAssetCache";
import * as SurveyAssetCache from "./SurveyAssetCache";

export interface CacheInformation {
  mapTiles: {
    tileCount: number;
    bytes: number;
  };
  staticAssets: {
    bytes: number;
    entries: {
      path: string;
      cached: boolean;
    }[];
  };
  queries: {
    bytes: number;
    strategies: {
      id: string;
      type: string;
      queryName: string;
      entries: number;
      bytes: number;
      limit?: number;
    }[];
  };
  selectedSurveyIds: number[];
  offlineSurveys: {
    error?: string;
    assets: SurveyAsset[];
    fractionCached: number;
    documents: number;
    images: number;
    queries: number;
    questions: number;
    loading: boolean;
    bytes?: number;
  };
}

export type SurveyAsset = {
  url: string;
  type: "unsplash-image" | "consent-document" | "graphql-query";
  cached: boolean;
  surveyId: number;
  slug: string;
  questions?: number;
  bytes?: number;
};

export interface ClientCacheContextValue {
  offlineSurveysPermitted: boolean;
  level: ClientCacheSetting;
  setLevel: (level: string) => void;
  storageEstimate?: StorageEstimate;
  storageEstimateError?: string;
  staticAssetCache: StaticAssetCache;
  graphqlQueryCache: GraphqlQueryCache | null;
  updatingCacheSizes: boolean;
  updateCacheSizes: () => Promise<CacheInformation>;
  cacheSizes?: CacheInformation;
  clearStaticAssetCache: () => void;
  reloadStaticAssetCache: () => void;
  toggleSurveyOfflineSupport: (id: number, slug: string) => Promise<void>;
  updateOfflineSurveyCacheInfoForProject: (
    slug: string
  ) => Promise<SurveyAsset[]>;
  clearOfflineSurveyAssets: () => Promise<void>;
  populateOfflineSurveyAssets: (clearFirst: boolean) => Promise<void>;
}

export const ClientCacheManagerContext = createContext<
  ClientCacheContextValue | undefined
>(undefined);

const defaultCacheSetting = ClientCacheSettings.find(
  (l) => l.id === "default"
)!;

const staticAssetCache = new StaticAssetCache();

export function ClientCacheManagerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const client = useApolloClient();
  const superuser = useIsSuperuser();
  const [state, setState] = useState<ClientCacheSetting>(defaultCacheSetting);
  const [updatingCacheSizes, setUpdatingCacheSizes] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInformation | undefined>();
  const graphqlQueryCache = useGraphqlQueryCache();
  const setLevel = useCallback(
    (id: string) => {
      const setting = ClientCacheSettings.find((s) => s.id === id);
      if (!setting) {
        throw new Error(`Unknown cache setting ${id}`);
      }
      localforage.setItem(CLIENT_CACHE_SETTINGS_KEY, id);
      setState(setting);
      if (setting.prefetchEnabled) {
        staticAssetCache.populateCache();
      }
    },
    [setState]
  );

  const [storageStats, setStorageStats] = useState<
    | {
        estimate?: StorageEstimate;
        error?: string;
      }
    | undefined
  >();

  const updateStorageStats = useCallback(async () => {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const storage = await navigator.storage.estimate();
      if (storage && storage.quota && storage.usage) {
        setStorageStats({
          estimate: {
            quota: storage.quota,
            usage: storage.usage,
          },
        });
      } else {
        setStorageStats({
          error:
            "navigator.storage.estimate() did not return useful information",
        });
      }
    } else {
      setStorageStats({ error: "Could not access navigator.storage" });
      return;
    }
  }, [setStorageStats]);

  useEffect(() => {
    updateStorageStats();
    localforage.getItem(CLIENT_CACHE_SETTINGS_KEY).then((value) => {
      const setting = ClientCacheSettings.find(
        (setting) => setting.id === value
      );
      setState(setting || defaultCacheSetting);
    });
  }, [updateStorageStats]);

  const populateCache = useCallback(async () => {
    staticAssetCache
      .populateCache((cacheState) => {
        setCacheInfo((prev) => {
          return prev
            ? {
                ...prev,
                staticAssets: cacheState,
              }
            : undefined;
        });
      })
      .then((cacheState) => {
        setCacheInfo((prev) => {
          return prev
            ? {
                ...prev,
                staticAssets: cacheState,
              }
            : undefined;
        });
        updateStorageStats();
      });
  }, [updateStorageStats]);

  const clearStaticAssetCache = useCallback(async () => {
    await staticAssetCache.clearCache();
    updateStorageStats();
    const cacheState = await staticAssetCache.getState();
    setCacheInfo((prev) =>
      prev ? { ...prev, staticAssets: cacheState } : undefined
    );
  }, [updateStorageStats]);

  const reloadStaticAssetCache = useCallback(() => {
    clearStaticAssetCache().then(() => setTimeout(() => populateCache(), 200));
  }, [clearStaticAssetCache, populateCache]);

  const getAssetsForSelectedSurveys = useCallback(async () => {
    if (!graphqlQueryCache) {
      throw new Error("GraphqlQueryCache not set");
    }
    let args =
      (await graphqlQueryCache.getStrategyArgs(
        offlineSurveyChoiceStrategy.key
      )) || [];
    const assets: SurveyAsset[] = [];
    const slug = getSlug();
    for (const variables of args) {
      if (variables.slug === slug) {
        const response = await client.query({
          query: SurveyDocument,
          variables,
          fetchPolicy: "network-only",
        });
        const data = response.data;
        const survey = data.survey;
        // Extract assets
        const elements: FormElementDetailsFragment[] =
          survey.form?.formElements || [];
        const cachedResponse = await graphqlQueryCache.getCachedResponse(
          namedOperations.Query.Survey,
          variables
        );
        // If we fetched it, the service worker should have it cached
        assets.push({
          type: "graphql-query",
          cached: true,
          slug: variables.slug,
          surveyId: variables.id,
          url: graphqlQueryCache.endpoint,
          questions: elements.filter((e) => e.isInput).length,
          bytes: cachedResponse ? (await cachedResponse.blob()).size : 0,
        });

        const consent = elements.find((t) => t.typeId === "Consent");
        if (consent) {
          const settings = consent.componentSettings as ConsentProps;
          if (settings.documentUrl) {
            const cachedResponse = await SurveyAssetCache.match(
              cloudfrontToSameOrigin(settings.documentUrl)
            );
            assets.push({
              type: "consent-document",
              cached: !!cachedResponse,
              slug: variables.slug,
              surveyId: variables.id,
              url: settings.documentUrl,
              bytes: cachedResponse
                ? (await cachedResponse.blob()).size
                : undefined,
            });
          }
        }
        for (const element of elements) {
          if (element.backgroundImage) {
            for (const src of srcVariants(element.backgroundImage)) {
              if (!assets.find((img) => img.url === src)) {
                const cachedResponse = await SurveyAssetCache.match(src);
                assets.push({
                  cached: !!cachedResponse,
                  url: src,
                  slug: variables.slug,
                  surveyId: variables.id,
                  type: "unsplash-image",
                  bytes: cachedResponse
                    ? (await cachedResponse.blob()).size
                    : undefined,
                });
              }
            }
          }
          // TODO: add rich text content when it's supported
        }
      }
    }
    return assets;
  }, [client, graphqlQueryCache]);

  const updateOfflineSurveyCacheInfoForProject = useCallback(
    async (slug: string) => {
      try {
        if (!graphqlQueryCache) {
          throw new Error("GraphqlQueryCache not set");
        }
        // get list of assets for each offline survey
        const assets = await getAssetsForSelectedSurveys();
        setCacheInfo((prev) => {
          if (prev) {
            return {
              ...prev,
              offlineSurveys: {
                assets,
                fractionCached:
                  assets.filter((a) => a.cached).length / assets.length,
                documents: assets.filter((a) => a.type === "consent-document")
                  .length,
                images: assets.filter((a) => a.type === "unsplash-image")
                  .length,
                queries: assets.filter((a) => a.type === "graphql-query")
                  .length,
                questions: assets
                  .filter((a) => a.type === "graphql-query")
                  .reduce((sum, q) => {
                    return sum + (q.questions || 0);
                  }, 0),
                loading: false,
                bytes: assets.reduce((bytes, asset) => {
                  bytes += asset.bytes || 0;
                  return bytes;
                }, 0),
              },
            };
          } else {
            return undefined;
          }
        });
        return assets;
      } catch (e) {
        setCacheInfo((prev) => {
          if (prev) {
            return {
              ...prev,
              offlineSurveys: {
                assets: [],
                error: e.toString(),
                documents: 0,
                fractionCached: 0,
                images: 0,
                queries: 0,
                questions: 0,
                loading: false,
                bytes: 0,
              },
            };
          } else {
            return undefined;
          }
        });
        return [];
      }
    },
    [getAssetsForSelectedSurveys, graphqlQueryCache]
  );

  const toggleSurveyOfflineSupport = useCallback(
    async (id: number, slug: string) => {
      if (!graphqlQueryCache) {
        throw new Error("GraphqlQueryCache not set");
      }
      let args =
        (await graphqlQueryCache.getStrategyArgs(
          offlineSurveyChoiceStrategy.key
        )) || [];
      const enabled = Boolean(
        args.find((arg: { id: number }) => arg.id === id)
      );
      if (enabled) {
        args = args.filter((arg: { id: number }) => arg.id !== id);
      } else {
        args.push({ id, slug: getSlug() });
      }
      await graphqlQueryCache.setStrategyArgs(
        offlineSurveyChoiceStrategy.key,
        args
      );
      setCacheInfo((prev) => {
        if (prev) {
          return {
            ...prev,
            selectedSurveyIds: args.map((arg: { id: number }) => arg.id),
          };
        } else {
          return undefined;
        }
      });
      updateOfflineSurveyCacheInfoForProject(slug);
    },
    [graphqlQueryCache, updateOfflineSurveyCacheInfoForProject]
  );

  const updateCacheInformation = useCallback(async () => {
    if (!graphqlQueryCache) {
      throw new Error("GraphqlQueryCache not set");
    }
    setUpdatingCacheSizes(true);
    // static assets
    const staticAssetState = await staticAssetCache.getState();
    const queries = await graphqlQueryCache.getState();
    const strategyArgs = await graphqlQueryCache.getStrategyArgs(
      offlineSurveyChoiceStrategy.key
    );
    setUpdatingCacheSizes(false);
    const stats = {
      queries,
      staticAssets: staticAssetState,
      // Map tiles - TODO: update when proper custom cache is added
      mapTiles: {
        bytes: 0,
        tileCount: 0,
      },
      selectedSurveyIds: strategyArgs.map((args: { id: number }) => args.id),
      offlineSurveys: {
        assets: [],
        fractionCached: 0,
        documents: 0,
        images: 0,
        queries: 0,
        questions: 0,
        loading: true,
      },
    } as CacheInformation;
    setCacheInfo(stats);
    await updateStorageStats();
    await updateOfflineSurveyCacheInfoForProject(getSlug());
    return stats;
  }, [
    graphqlQueryCache,
    updateOfflineSurveyCacheInfoForProject,
    updateStorageStats,
  ]);

  const clearOfflineSurveyAssets = useCallback(async () => {
    if (!graphqlQueryCache) {
      throw new Error("GraphqlQueryCache not set");
    }
    // get list of assets for each offline survey
    let args =
      (await graphqlQueryCache.getStrategyArgs(
        offlineSurveyChoiceStrategy.key
      )) || [];
    for (const variables of args) {
      await graphqlQueryCache.clearResponse(
        offlineSurveyChoiceStrategy,
        variables
      );
      await graphqlQueryCache.clearResponse(surveyLRUStrategy, variables);
    }
    SurveyAssetCache.deleteCache(getSlug());
    const queries = await graphqlQueryCache.getState();
    setCacheInfo((prev) => {
      if (prev) {
        return {
          ...prev,
          queries,
          offlineSurveys: {
            ...prev.offlineSurveys,
            assets: prev.offlineSurveys.assets.map((a) => ({
              ...a,
              cached: false,
            })),
            fractionCached: 0,
            loading: false,
            bytes: 0,
          },
        };
      } else {
        return undefined;
      }
    });
    return;
  }, [graphqlQueryCache]);

  const populateOfflineSurveyAssets = useCallback(
    async (clearFirst: boolean) => {
      if (clearFirst) {
        await clearOfflineSurveyAssets();
        await sleep(200);
      }
      setCacheInfo((prev) => {
        if (!prev) {
          return undefined;
        } else {
          return {
            ...prev,
            offlineSurveys: {
              ...prev.offlineSurveys,
              loading: true,
            },
          };
        }
      });
      const assets = await getAssetsForSelectedSurveys();
      setCacheInfo((prev) => {
        if (!prev) {
          return undefined;
        } else {
          return {
            ...prev,
            offlineSurveys: {
              ...prev.offlineSurveys,
              assets,
              fractionCached:
                assets.filter((a) => a.cached).length / assets.length,
              loading: true,
            },
          };
        }
      });
      const cache = await SurveyAssetCache.open(getSlug());
      for (const asset of assets) {
        if (!asset.cached || clearFirst) {
          let bytes = asset.bytes;
          if (asset.type !== "graphql-query") {
            // put into cache and update cache status
            await fetch(asset.url).then(async (response) => {
              if (response.ok) {
                bytes = (await response.clone().blob()).size;
                if (asset.type === "consent-document") {
                  cache.put(cloudfrontToSameOrigin(asset.url), response);
                } else {
                  cache.put(asset.url, response);
                }
              } else {
                throw new Error(`Response not ok`);
              }
            });
          }
          setCacheInfo((prev) => {
            if (!prev) {
              return undefined;
            } else {
              const assets = prev.offlineSurveys.assets.map((a) => {
                if (a.url === asset.url) {
                  return {
                    ...a,
                    cached: true,
                    bytes,
                  };
                } else {
                  return a;
                }
              });
              return {
                ...prev,
                offlineSurveys: {
                  ...prev.offlineSurveys,
                  assets,
                  fractionCached:
                    assets.filter((a) => a.cached).length / assets.length,
                  loading: Boolean(assets.indexOf(asset) < assets.length - 1),
                  bytes: assets.reduce((bytes, asset) => {
                    bytes += asset.bytes || 0;
                    return bytes;
                  }, 0),
                },
              };
            }
          });
        }
      }
      if (graphqlQueryCache) {
        const queries = await graphqlQueryCache.getState();
        setCacheInfo((prev) => {
          if (!prev) {
            return undefined;
          } else {
            return {
              ...prev,
              queries,
              offlineSurveys: {
                ...prev.offlineSurveys,
                loading: false,
              },
            };
          }
        });
      } else {
        throw new Error("GraphqlQueryCache not set");
      }
    },
    [clearOfflineSurveyAssets, getAssetsForSelectedSurveys, graphqlQueryCache]
  );

  return (
    <ClientCacheManagerContext.Provider
      value={{
        offlineSurveysPermitted: Boolean(superuser),
        level: state,
        setLevel,
        storageEstimate: storageStats?.estimate,
        storageEstimateError: storageStats?.error,
        staticAssetCache,
        graphqlQueryCache,
        updatingCacheSizes,
        cacheSizes: cacheInfo,
        updateCacheSizes: updateCacheInformation,
        clearStaticAssetCache,
        reloadStaticAssetCache,
        toggleSurveyOfflineSupport,
        updateOfflineSurveyCacheInfoForProject,
        clearOfflineSurveyAssets,
        populateOfflineSurveyAssets,
      }}
    >
      {children}
    </ClientCacheManagerContext.Provider>
  );
}
