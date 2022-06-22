import { useState, useEffect } from "react";
import localForage from "localforage";

export function useLocalForage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    (async function () {
      try {
        const value: T | null = await localForage.getItem(key);
        setStoredValue(value === null ? initialValue : value);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [initialValue, key]);

  const setValue = (value: T | ((prev: T) => T)) => {
    if (typeof value === "function") {
      value = (value as (prev: T) => T)(storedValue);
    }
    setStoredValue(value);
    (async () => {
      try {
        await localForage.setItem(key, value);
      } catch (e) {
        console.error(e);
      }
    })();
  };

  return [storedValue, setValue] as const;
}
