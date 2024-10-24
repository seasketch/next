import { useCallback, useEffect, useState } from "react";

export default function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (val: T | ((prev: T) => T)) => void, () => void] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Get from local storage by key
      const item = window.sessionStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item && item !== "undefined" ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(storedValue));
    } catch (e) {
      console.error(e);
    }
  }, [storedValue, key]);

  const clearValue = useCallback(() => {
    setStoredValue(initialValue);
    window.sessionStorage.removeItem(key);
  }, [key, initialValue]);

  return [storedValue, setStoredValue, clearValue];
}
