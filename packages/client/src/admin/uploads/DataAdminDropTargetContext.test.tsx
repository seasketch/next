/* eslint-disable i18next/no-literal-string */
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DataAdminDropTargetProvider,
  useDataAdminDropTarget,
  useOverlayListPageEnabled,
  useRegisterDropTarget,
} from "./DataAdminDropTargetContext";
import { DROP_TARGET_PRIORITY } from "./dropTargets";

function ActiveKind() {
  const { activeTarget } = useDataAdminDropTarget();
  return <div data-testid="active">{activeTarget?.intent.kind ?? "none"}</div>;
}

function OverlayList({ enabled = true }: { enabled?: boolean }) {
  useRegisterDropTarget({
    id: "overlay-list",
    priority: DROP_TARGET_PRIORITY.page,
    intent: { kind: "newSpatialLayer" },
    enabled,
  });
  return null;
}

function SourceTab({
  enabled = true,
  itemId = 12,
}: {
  enabled?: boolean;
  itemId?: number;
}) {
  useRegisterDropTarget({
    id: "source-tab",
    priority: DROP_TARGET_PRIORITY.editorTab,
    intent: { kind: "replaceSpatialSource", tableOfContentsItemId: itemId },
    enabled,
  });
  return null;
}

function TablesTab({ enabled = true }: { enabled?: boolean }) {
  useRegisterDropTarget({
    id: "tables-tab",
    priority: DROP_TARGET_PRIORITY.editorTab,
    intent: { kind: "createDataTable", tableOfContentsItemId: 12 },
    enabled,
  });
  return null;
}

function TableModal({
  enabled = true,
  replace = false,
}: {
  enabled?: boolean;
  replace?: boolean;
}) {
  useRegisterDropTarget({
    id: "table-modal",
    priority: DROP_TARGET_PRIORITY.modal,
    intent: replace
      ? {
          kind: "replaceDataTable",
          tableOfContentsItemId: 12,
          replaceTableId: 4,
        }
      : { kind: "createDataTable", tableOfContentsItemId: 12 },
    enabled,
  });
  return null;
}

function OtherTab({ enabled = true }: { enabled?: boolean }) {
  useRegisterDropTarget({
    id: "other-tab",
    priority: DROP_TARGET_PRIORITY.editorTab,
    intent: { kind: "blocked" },
    enabled,
  });
  return null;
}

function MapsGate({ enabled }: { enabled: boolean }) {
  useOverlayListPageEnabled(enabled);
  return null;
}

describe("DataAdminDropTargetProvider", () => {
  it("uses the overlay list for new spatial layers", () => {
    render(
      <DataAdminDropTargetProvider>
        <OverlayList />
        <ActiveKind />
      </DataAdminDropTargetProvider>
    );
    expect(screen.getByTestId("active")).toHaveTextContent("newSpatialLayer");
  });

  it("switches the Source tab to spatial replacement and restores the list on leave", () => {
    const { rerender } = render(
      <DataAdminDropTargetProvider>
        <OverlayList />
        <SourceTab />
        <ActiveKind />
      </DataAdminDropTargetProvider>
    );
    expect(screen.getByTestId("active")).toHaveTextContent(
      "replaceSpatialSource"
    );

    rerender(
      <DataAdminDropTargetProvider>
        <OverlayList />
        <SourceTab enabled={false} />
        <ActiveKind />
      </DataAdminDropTargetProvider>
    );
    expect(screen.getByTestId("active")).toHaveTextContent("newSpatialLayer");
  });

  it("lets the Tables tab claim CSV drops without falling through to spatial create", () => {
    render(
      <DataAdminDropTargetProvider>
        <OverlayList />
        <TablesTab />
        <ActiveKind />
      </DataAdminDropTargetProvider>
    );
    expect(screen.getByTestId("active")).toHaveTextContent("createDataTable");
  });

  it("lets the upload modal supersede the Tables tab for create and replace", () => {
    const { rerender } = render(
      <DataAdminDropTargetProvider>
        <OverlayList />
        <TablesTab enabled={false} />
        <TableModal />
        <ActiveKind />
      </DataAdminDropTargetProvider>
    );
    expect(screen.getByTestId("active")).toHaveTextContent("createDataTable");

    rerender(
      <DataAdminDropTargetProvider>
        <OverlayList />
        <TablesTab enabled={false} />
        <TableModal replace />
        <ActiveKind />
      </DataAdminDropTargetProvider>
    );
    expect(screen.getByTestId("active")).toHaveTextContent("replaceDataTable");
  });

  it("blocks drops on non-upload editor tabs and the Maps view", () => {
    const { rerender } = render(
      <DataAdminDropTargetProvider>
        <OverlayList />
        <OtherTab />
        <ActiveKind />
      </DataAdminDropTargetProvider>
    );
    expect(screen.getByTestId("active")).toHaveTextContent("blocked");

    rerender(
      <DataAdminDropTargetProvider>
        <OverlayList />
        <OtherTab enabled={false} />
        <MapsGate enabled={false} />
        <ActiveKind />
      </DataAdminDropTargetProvider>
    );
    expect(screen.getByTestId("active")).toHaveTextContent("blocked");
  });

  it("does not flap the active target across unrelated pointer events", () => {
    render(
      <DataAdminDropTargetProvider>
        <OverlayList />
        <SourceTab />
        <button type="button">leave</button>
        <ActiveKind />
      </DataAdminDropTargetProvider>
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "leave" }));
    fireEvent.mouseLeave(screen.getByRole("button", { name: "leave" }));
    expect(screen.getByTestId("active")).toHaveTextContent(
      "replaceSpatialSource"
    );
  });
});
