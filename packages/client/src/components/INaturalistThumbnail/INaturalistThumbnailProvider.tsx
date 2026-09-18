import React from "react";

/**
 * Mount once at the app root. The photo scheduler is a process-wide
 * singleton; this provider is the documented attachment point so every
 * surface shares one throttled queue.
 */
export const INaturalistThumbnailContext = React.createContext(true);

export default function INaturalistThumbnailProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <INaturalistThumbnailContext.Provider value={true}>
      {children}
    </INaturalistThumbnailContext.Provider>
  );
}
