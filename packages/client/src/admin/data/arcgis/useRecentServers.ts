import { useState } from "react";

export interface RememberedServer {
  type: "arcgis" | "wms";
  location: string;
}

export default function useRecentDataServers(
  limit = 8
): [RememberedServer[], (server: RememberedServer) => void] {
  const key = "recent-data-servers";
  const [storedValue, setStoredValue] = useState<RememberedServer[]>(() => {
    try {
      const data = window.localStorage.getItem(key);
      return data ? (JSON.parse(data) as RememberedServer[]) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  const addServer = (server: RememberedServer) => {
    if (!storedValue.find((v) => v.location === server.location)) {
      const newValue = [server, ...storedValue.slice(0, limit - 1)];
      setStoredValue(newValue);
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch (e) {
        console.error(e);
      }
    }
  };
  return [storedValue, addServer];
}
