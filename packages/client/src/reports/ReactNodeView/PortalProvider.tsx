import React, {
  ReactNode,
  ReactPortal,
  useCallback,
  useContext,
  useState,
} from "react";

export const ReactNodeViewPortalsContext = React.createContext<{
  createPortal: (key: string, portal: ReactPortal) => void;
  removePortal: (key: string) => void;
  state: { [key: string]: ReactPortal };
  setSelection: (
    selection: { anchorPos: number; headPos: number } | null
  ) => void;
  selection: { anchorPos: number; headPos: number } | null;
}>({
  createPortal: () => {},
  removePortal: () => {},
  state: {},
  setSelection: () => {},
  selection: null,
});

function ReactNodeViewPortalsProvider({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<{ [key: string]: ReactPortal }>({});
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

  return (
    <ReactNodeViewPortalsContext.Provider
      value={{
        createPortal,
        removePortal,
        state,
        setSelection,
        selection,
      }}
    >
      {children}
      {Object.keys(state).map((key) => state[key])}
    </ReactNodeViewPortalsContext.Provider>
  );
}

export const useReactNodeViewPortals = () =>
  useContext(ReactNodeViewPortalsContext);

export default ReactNodeViewPortalsProvider;
