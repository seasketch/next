import { useState, useEffect } from "react";
import localForage from "localforage";

export function useLocalForage<T>(
  key: string,
  defaultValue: T,
  loadingValue?: T
) {
  const [storedValue, setStoredValue] = useState<T>(
    loadingValue ?? defaultValue
  );
  const [hasRestoredState, setHasRestoredState] = useState(false);

  useEffect(() => {
    (async function () {
      try {
        const value: T | null = await localForage.getItem(key);
        setStoredValue(value === null ? defaultValue : value);
        setHasRestoredState(true);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [key]);

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

  return [storedValue, setValue, hasRestoredState] as const;
}
