import { useState } from "react";
import useLocalStorage from "../useLocalStorage";

export default function useSegmentState<T>(props: {
  segments: T[];
  defaultValue?: T;
  storageKey: string;
}): [T, (arg0: T) => void, T[]] {
  const [value, setValue] = useLocalStorage(
    props.storageKey,
    props.defaultValue || props.segments[0]
  );
  return [value, setValue, props.segments];
}
