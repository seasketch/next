/* eslint-disable i18next/no-literal-string */
import {
  DROP_TARGET_PRIORITY,
  isDataTableDropIntent,
  isSpatialDropIntent,
  RegisteredDropTarget,
  removeRegisteredTarget,
  resolveActiveTarget,
  upsertRegisteredTarget,
} from "./dropTargets";

function target(
  partial: Omit<RegisteredDropTarget, "seq"> & { seq?: number }
): RegisteredDropTarget {
  return { seq: 1, ...partial };
}

describe("drop target arbitration", () => {
  it("returns null when nothing is registered and the page is enabled", () => {
    expect(resolveActiveTarget([])).toBeNull();
  });

  it("blocks all destinations when the overlay list page is hidden", () => {
    const overlay = target({
      id: "overlay-list",
      priority: DROP_TARGET_PRIORITY.page,
      intent: { kind: "newSpatialLayer" },
    });
    const active = resolveActiveTarget([overlay], false);
    expect(active?.id).toBe("page-disabled");
    expect(active?.intent.kind).toBe("blocked");
  });

  it("prefers editor tabs over the overlay list, then modals, then blockers", () => {
    const overlay = target({
      id: "overlay-list",
      priority: DROP_TARGET_PRIORITY.page,
      intent: { kind: "newSpatialLayer" },
      seq: 1,
    });
    const source = target({
      id: "source-tab",
      priority: DROP_TARGET_PRIORITY.editorTab,
      intent: { kind: "replaceSpatialSource", tableOfContentsItemId: 9 },
      seq: 2,
    });
    const modal = target({
      id: "table-modal",
      priority: DROP_TARGET_PRIORITY.modal,
      intent: { kind: "createDataTable", tableOfContentsItemId: 9 },
      seq: 3,
    });
    const sprite = target({
      id: "sprite",
      priority: DROP_TARGET_PRIORITY.blocker,
      intent: { kind: "blocked" },
      seq: 4,
    });

    expect(resolveActiveTarget([overlay])?.intent.kind).toBe("newSpatialLayer");
    expect(resolveActiveTarget([overlay, source])?.intent.kind).toBe(
      "replaceSpatialSource"
    );
    expect(resolveActiveTarget([overlay, source, modal])?.intent.kind).toBe(
      "createDataTable"
    );
    expect(
      resolveActiveTarget([overlay, source, modal, sprite])?.intent.kind
    ).toBe("blocked");
  });

  it("restores the previous target after cleanup", () => {
    const overlay = target({
      id: "overlay-list",
      priority: DROP_TARGET_PRIORITY.page,
      intent: { kind: "newSpatialLayer" },
      seq: 1,
    });
    const tables = target({
      id: "tables-tab",
      priority: DROP_TARGET_PRIORITY.editorTab,
      intent: { kind: "createDataTable", tableOfContentsItemId: 3 },
      seq: 2,
    });
    const afterUnregister = removeRegisteredTarget(
      [overlay, tables],
      "tables-tab"
    );
    expect(resolveActiveTarget(afterUnregister)?.id).toBe("overlay-list");
  });

  it("uses registration order when priorities match", () => {
    let targets: RegisteredDropTarget[] = [];
    targets = upsertRegisteredTarget(
      targets,
      {
        id: "a",
        priority: DROP_TARGET_PRIORITY.editorTab,
        intent: { kind: "blocked" },
      },
      1
    );
    targets = upsertRegisteredTarget(
      targets,
      {
        id: "b",
        priority: DROP_TARGET_PRIORITY.editorTab,
        intent: { kind: "createDataTable", tableOfContentsItemId: 1 },
      },
      2
    );
    expect(resolveActiveTarget(targets)?.id).toBe("b");
    targets = upsertRegisteredTarget(
      targets,
      {
        id: "a",
        priority: DROP_TARGET_PRIORITY.editorTab,
        intent: { kind: "blocked" },
      },
      3
    );
    expect(resolveActiveTarget(targets)?.id).toBe("a");
  });

  it("identifies spatial vs data-table intents", () => {
    expect(isSpatialDropIntent({ kind: "newSpatialLayer" })).toBe(true);
    expect(
      isSpatialDropIntent({
        kind: "replaceSpatialSource",
        tableOfContentsItemId: 1,
      })
    ).toBe(true);
    expect(
      isDataTableDropIntent({
        kind: "createDataTable",
        tableOfContentsItemId: 1,
      })
    ).toBe(true);
    expect(isSpatialDropIntent({ kind: "blocked" })).toBe(false);
    expect(isDataTableDropIntent({ kind: "blocked" })).toBe(false);
  });
});
