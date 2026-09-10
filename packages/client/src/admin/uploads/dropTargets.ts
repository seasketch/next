export const DROP_TARGET_PRIORITY = {
  page: 10,
  auxView: 15,
  editorTab: 20,
  modal: 30,
  blocker: 40,
} as const;

export type DropIntent =
  | { kind: "newSpatialLayer" }
  | { kind: "replaceSpatialSource"; tableOfContentsItemId: number }
  | { kind: "createDataTable"; tableOfContentsItemId: number }
  | {
      kind: "replaceDataTable";
      tableOfContentsItemId: number;
      replaceTableId: number;
    }
  | { kind: "blocked" };

export type RegisteredDropTarget = {
  id: string;
  priority: number;
  intent: DropIntent;
  seq: number;
};

export function isSpatialDropIntent(intent: DropIntent | undefined): boolean {
  return (
    intent?.kind === "newSpatialLayer" ||
    intent?.kind === "replaceSpatialSource"
  );
}

export function isDataTableDropIntent(intent: DropIntent | undefined): boolean {
  return (
    intent?.kind === "createDataTable" || intent?.kind === "replaceDataTable"
  );
}

export function resolveActiveTarget(
  targets: RegisteredDropTarget[],
  pageEnabled = true
): RegisteredDropTarget | null {
  if (!pageEnabled) {
    return {
      id: "page-disabled",
      priority: 0,
      seq: 0,
      intent: { kind: "blocked" },
    };
  }
  if (targets.length === 0) {
    return null;
  }
  return targets.reduce((best, current) => {
    if (current.priority > best.priority) {
      return current;
    }
    if (current.priority === best.priority && current.seq > best.seq) {
      return current;
    }
    return best;
  });
}

export function upsertRegisteredTarget(
  targets: RegisteredDropTarget[],
  next: Omit<RegisteredDropTarget, "seq">,
  seq: number
): RegisteredDropTarget[] {
  return [
    ...targets.filter((target) => target.id !== next.id),
    { ...next, seq },
  ];
}

export function removeRegisteredTarget(
  targets: RegisteredDropTarget[],
  id: string
): RegisteredDropTarget[] {
  return targets.filter((target) => target.id !== id);
}
