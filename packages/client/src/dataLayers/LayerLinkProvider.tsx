import { createContext, ReactNode, useContext, useState } from "react";
import { useHistory, useLocation, useRouteMatch } from "react-router-dom";
import getSlug from "../getSlug";
import LayerLinkModal from "./LayerLinkModal";

export const LayerLinkContext = createContext<{
  enabled: boolean;
  openCreator: (stableId: string) => void;
}>({
  enabled: false,
  openCreator: () => {},
});

export function useLayerLink() {
  return useContext(LayerLinkContext);
}

export default function LayerLinkProvider({
  children,
  place = "published",
}: {
  children?: ReactNode;
  place?: "admin" | "published";
}) {
  const [stableId, setStableId] = useState<string | null>(null);
  const slug = getSlug();
  const history = useHistory();
  const location = useLocation();
  const match = useRouteMatch<{ layerLinkId: string }>(
    `/${slug}/layers/:layerLinkId`
  );
  const adminLinkId =
    place === "admin"
      ? new URLSearchParams(location.search).get("layerLink")
      : null;
  const viewId =
    place === "admin" ? adminLinkId : match?.params.layerLinkId || null;
  return (
    <LayerLinkContext.Provider
      value={{
        enabled: true,
        openCreator: (id) => setStableId(id),
      }}
    >
      {children}
      {stableId && (
        <LayerLinkModal
          key={`${place}-${stableId}`}
          mode="create"
          place={place}
          stableId={stableId}
          onClose={() => setStableId(null)}
        />
      )}
      {viewId && (
        <LayerLinkModal
          key={viewId}
          mode="view"
          place={place}
          bookmarkId={viewId}
          onClose={() => {
            if (place === "admin") {
              history.replace({ pathname: location.pathname, search: "" });
            } else {
              history.replace(`/${slug}/app`);
            }
          }}
        />
      )}
    </LayerLinkContext.Provider>
  );
}
