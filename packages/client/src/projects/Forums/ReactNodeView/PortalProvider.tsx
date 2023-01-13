import React, {
  ReactNode,
  ReactPortal,
  useCallback,
  useContext,
  useState,
} from "react";

const ReactNodeViewPortalsContext = React.createContext<{
  createPortal: (key: string, portal: ReactPortal) => void;
  removePortal: (key: string) => void;
  state: { [key: string]: ReactPortal };
}>({
  createPortal: () => {},
  removePortal: () => {},
  state: {},
});

function ReactNodeViewPortalsProvider({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<{ [key: string]: ReactPortal }>({});
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
        delete prev[key];
        return { ...prev };
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
