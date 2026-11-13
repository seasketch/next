import { createContext, ReactNode, useContext, useState } from "react";
import { useHistory, useRouteMatch } from "react-router-dom";
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
}: {
  children?: ReactNode;
}) {
  const [stableId, setStableId] = useState<string | null>(null);
  const slug = getSlug();
  const history = useHistory();
  const match = useRouteMatch<{ layerLinkId: string }>(
    `/${slug}/layers/:layerLinkId`
  );
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
          key={stableId}
          mode="create"
          stableId={stableId}
          onClose={() => setStableId(null)}
        />
      )}
      {match?.params.layerLinkId && (
        <LayerLinkModal
          mode="view"
          bookmarkId={match.params.layerLinkId}
          onClose={() => history.replace(`/${slug}/app`)}
        />
      )}
    </LayerLinkContext.Provider>
  );
}
