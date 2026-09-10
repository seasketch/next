import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DropIntent,
  RegisteredDropTarget,
  removeRegisteredTarget,
  resolveActiveTarget,
  upsertRegisteredTarget,
} from "./dropTargets";

type DataAdminDropTargetContextValue = {
  activeTarget: RegisteredDropTarget | null;
  pageEnabled: boolean;
  setPageEnabled: (enabled: boolean) => void;
  register: (target: Omit<RegisteredDropTarget, "seq">) => void;
  unregister: (id: string) => void;
};

const DataAdminDropTargetContext =
  createContext<DataAdminDropTargetContextValue>({
    activeTarget: null,
    pageEnabled: true,
    setPageEnabled: () => {},
    register: () => {},
    unregister: () => {},
  });

export function DataAdminDropTargetProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [targets, setTargets] = useState<RegisteredDropTarget[]>([]);
  const [pageEnabled, setPageEnabled] = useState(true);
  const seqRef = useRef(0);

  const register = useCallback((target: Omit<RegisteredDropTarget, "seq">) => {
    const seq = ++seqRef.current;
    setTargets((prev) => upsertRegisteredTarget(prev, target, seq));
  }, []);

  const unregister = useCallback((id: string) => {
    setTargets((prev) => removeRegisteredTarget(prev, id));
  }, []);

  const activeTarget = useMemo(
    () => resolveActiveTarget(targets, pageEnabled),
    [targets, pageEnabled]
  );

  const value = useMemo(
    () => ({
      activeTarget,
      pageEnabled,
      setPageEnabled,
      register,
      unregister,
    }),
    [activeTarget, pageEnabled, register, unregister]
  );

  return (
    <DataAdminDropTargetContext.Provider value={value}>
      {children}
    </DataAdminDropTargetContext.Provider>
  );
}

export function useDataAdminDropTarget() {
  return useContext(DataAdminDropTargetContext);
}

function intentKey(intent: DropIntent): string {
  switch (intent.kind) {
    case "replaceSpatialSource":
      return `${intent.kind}:${intent.tableOfContentsItemId}`;
    case "createDataTable":
      return `${intent.kind}:${intent.tableOfContentsItemId}`;
    case "replaceDataTable":
      return `${intent.kind}:${intent.tableOfContentsItemId}:${intent.replaceTableId}`;
    default:
      return intent.kind;
  }
}

export function useRegisterDropTarget({
  id,
  priority,
  intent,
  enabled = true,
}: {
  id: string;
  priority: number;
  intent: DropIntent;
  enabled?: boolean;
}) {
  const { register, unregister } = useDataAdminDropTarget();
  const key = intentKey(intent);

  useEffect(() => {
    if (!enabled) {
      unregister(id);
      return;
    }
    register({ id, priority, intent });
    return () => {
      unregister(id);
    };
    // intent is represented by `key` so structurally equal intents do not loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, id, key, priority, register, unregister]);
}

export function useOverlayListPageEnabled(enabled: boolean) {
  const { setPageEnabled } = useDataAdminDropTarget();
  useEffect(() => {
    setPageEnabled(enabled);
    return () => {
      setPageEnabled(true);
    };
  }, [enabled, setPageEnabled]);
}
