import localforage from "localforage";
import { useEffect, useState } from "react";

/**
 * Uses the lightest possible approach to detect offline survey configuration,
 * so that toast/popup prompts can be shown when offline to help a user navigate
 * to surveys.
 * @returns Boolean
 */
export default function useOfflineSurveysEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    localforage.getItem<{ [key: string]: any } | undefined | null>(
      // TODO: this doesn't reference the constants in the graphql cache
      // strategy, so could get out of sync. I'm not confident tree shaking
      // will avoid pulling in too many dependencies at this point, so it is
      // hard-coded.
      "graphql-query-cache-strategy-args",
      (err, value) => {
        setEnabled(
          Boolean(
            value &&
              "selected-offline-surveys" in value &&
              Object.keys(value["selected-offline-surveys"]).length > 0
          )
        );
      }
    );
  });
  return enabled;
}
