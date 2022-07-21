import { ApolloClient, NormalizedCache } from "@apollo/client";
import { useDebouncedFn } from "beautiful-react-hooks";
import {
  useEffect,
  useState,
  createContext,
  PropsWithChildren,
  useCallback,
} from "react";
import { GraphqlNetworkErrorEventTarget } from "..";

export const OfflineStateContext = createContext({
  online: true,
  dismissed: false,
  dismiss: () => {},
});

export const OfflineStateDetector = ({
  graphqlErrorTarget,
  children,
}: PropsWithChildren<{
  graphqlErrorTarget?: GraphqlNetworkErrorEventTarget;
}>) => {
  const [state, setState] = useState<{ online: boolean; dismissed: boolean }>({
    online: navigator.onLine,
    dismissed: false,
  });

  const check = useCallback(async () => {
    const online = await isOnline();
    setState((prev) => ({ ...prev, online }));
  }, [setState]);

  const dismiss = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dismissed: true,
    }));
  }, [setState]);

  const debouncedCheck = useDebouncedFn(check, 200);

  useEffect(() => {
    window.addEventListener("online", check);
    window.addEventListener("offline", check);

    if (graphqlErrorTarget) {
      graphqlErrorTarget.addEventListener(
        "GraphqlNetworkError",
        debouncedCheck
      );
    }

    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
      if (graphqlErrorTarget) {
        graphqlErrorTarget.removeEventListener(
          "GraphqlNetworkError",
          debouncedCheck
        );
      }
    };
  }, [graphqlErrorTarget, check, debouncedCheck]);

  return (
    <OfflineStateContext.Provider value={{ ...state, dismiss }}>
      {children}
    </OfflineStateContext.Provider>
  );
};

async function isOnline() {
  if (navigator.onLine) {
    // navigator.online merely checks that the user is connected to a network.
    // This network may not be connected to the internet, so we'll also check
    // our connection to the origin to be sure we have a good connection.
    //
    // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
    //
    // In production, the origin index.html is hosted via a CDN (Cloudfront)
    // and so should be highly available and unlikely to give a false negative.
    const url = new URL(window.location.origin);
    // random value to prevent cached responses
    url.searchParams.set("cachebust", new Date().getTime().toString());
    try {
      const response = await fetch(url.toString(), { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  } else {
    return false;
  }
}
