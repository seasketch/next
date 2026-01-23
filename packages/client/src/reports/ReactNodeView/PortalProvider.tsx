import React, {
  ReactNode,
  ReactPortal,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CompatibleSpatialMetricDetailsFragment, OverlaySourceDetailsFragment } from "../../generated/graphql";
import { DraftReportContext } from "../DraftReportContext";
import { MetricDependency } from "overlay-engine";

export const ReactNodeViewPortalsContext = React.createContext<{
  createPortal: (key: string, portal: ReactPortal) => void;
  removePortal: (key: string) => void;
  state: { [key: string]: ReactPortal };
  setSelection: (
    selection: { anchorPos: number; headPos: number } | null
  ) => void;
  selection: { anchorPos: number; headPos: number } | null;
  setDraftDependencies: (draftDependencies: {
    metrics: CompatibleSpatialMetricDetailsFragment[];
    overlaySources: OverlaySourceDetailsFragment[];
    dependencies: MetricDependency[];
  }) => void;
}>({
  createPortal: () => { },
  removePortal: () => { },
  state: {},
  setSelection: () => { },
  selection: null,
  setDraftDependencies: () => { },
});

function ReactNodeViewPortalsProvider({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<{ [key: string]: ReactPortal }>({});
  const [draftDependencies, setDraftDependencies] = useState<{
    metrics: CompatibleSpatialMetricDetailsFragment[];
    overlaySources: OverlaySourceDetailsFragment[];
    dependencies: MetricDependency[];
  }>({
    metrics: [],
    overlaySources: [],
    dependencies: [],
  });
  const [selection, _setSelection] = useState<{
    anchorPos: number;
    headPos: number;
  } | null>(null);

  const setSelection = useCallback(
    (nextSelection: { anchorPos: number; headPos: number } | null) => {
      _setSelection(nextSelection);
    },
    [_setSelection]
  );

  const createPortal = useCallback(
    (key: string, portal: ReactPortal) => {
      setState((prev) => ({
        ...prev,
        [key]: portal,
      }));
    },
    [setState]
  );

  const removePortal = useCallback(
    (key: string) => {
      setState((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [setState]
  );

  const draftReportContextValue = useMemo(() => {
    return {
      draftMetrics: draftDependencies.metrics,
      draftOverlaySources: draftDependencies.overlaySources,
      draftDependencies: draftDependencies.dependencies,
    };
  }, [draftDependencies.metrics, draftDependencies.overlaySources, draftDependencies.dependencies]);

  return (
    <DraftReportContext.Provider value={draftReportContextValue}><ReactNodeViewPortalsContext.Provider
      value={{
        createPortal,
        removePortal,
        state,
        setSelection,
        selection,
        setDraftDependencies,
      }}
    >
      {children}
      {Object.keys(state).map((key) => state[key])}
    </ReactNodeViewPortalsContext.Provider>
    </DraftReportContext.Provider>

  );
}

export const useReactNodeViewPortals = () =>
  useContext(ReactNodeViewPortalsContext);

export default ReactNodeViewPortalsProvider;
