import localforage from "localforage";

export const CLIENT_CACHE_SETTINGS_KEY = "client-cache-settings";

export interface ClientCacheSetting {
  id: string;
  prefetchEnabled: boolean;
  recentProjects: number;
}

export const ClientCacheSettings: ClientCacheSetting[] = [
  {
    id: "minimum",
    prefetchEnabled: false,
    recentProjects: 0,
  },
  {
    id: "default",
    prefetchEnabled: false,
    recentProjects: 3,
  },
  {
    id: "improved",
    prefetchEnabled: true,
    recentProjects: 5,
  },
  {
    id: "max",
    prefetchEnabled: true,
    recentProjects: 10,
  },
];

export const defaultCacheSetting = ClientCacheSettings.find(
  (l) => l.id === "default"
)!;

export async function getSetting() {
  const id = await localforage.getItem<string>(CLIENT_CACHE_SETTINGS_KEY);
  if (id) {
    return ClientCacheSettings.find((s) => s.id === id) || defaultCacheSetting;
  } else {
    return defaultCacheSetting;
  }
}
