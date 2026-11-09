/* eslint-disable i18next/no-literal-string */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ChangeLogDetailsFragment } from "../../../generated/graphql";
import i18n from "../../../i18n";
import LayersPublishedFieldGroupListItem from "./LayersPublishedFieldGroupListItem";

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise((resolve) => {
      i18n.on("initialized", resolve);
    });
  }
  await i18n.loadNamespaces("admin:data");
});

function changeLog(
  overrides: Partial<ChangeLogDetailsFragment>
): ChangeLogDetailsFragment {
  return {
    id: "1",
    entityId: 1,
    entityType: "projects",
    fieldGroup: "LAYERS_PUBLISHED",
    meta: null,
    startedAt: "2026-11-09T18:00:00.000Z",
    lastAt: "2026-11-09T18:00:00.000Z",
    saveCount: 1,
    fromSummary: {},
    toSummary: { layer_count: 400 },
    fullOverlayPublish: null,
    publishedOverlayItems: [],
    editorCanonicalEmail: null,
    editorProfile: null,
    ...overrides,
  } as ChangeLogDetailsFragment;
}

function item(stableId: string, title: string, isFolder = false) {
  return { stableId, title, isFolder };
}

describe("LayersPublishedFieldGroupListItem", () => {
  it("describes a full publish by how many layers changed", () => {
    render(
      <LayersPublishedFieldGroupListItem
        scope="project"
        changeLog={changeLog({
          fullOverlayPublish: true,
          toSummary: { layer_count: 400 },
          publishedOverlayItems: [item("coral", "Coral cover")],
        })}
      />
    );

    expect(
      screen.getByText("published the full layer list, including changes to")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show published layers" })).toHaveTextContent(
      "1 / 400 layers"
    );
    fireEvent.click(screen.getByRole("button", { name: "Show published layers" }));
    expect(screen.getByText("Coral cover")).toBeTruthy();
  });

  it("describes a partial publish by the layers it shipped", () => {
    render(
      <LayersPublishedFieldGroupListItem
        scope="project"
        changeLog={changeLog({
          fullOverlayPublish: false,
          toSummary: { layer_count: 1 },
          publishedOverlayItems: [item("coral", "Coral cover")],
        })}
      />
    );

    expect(screen.getByText("published changes to")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show published layers" })).toHaveTextContent(
      "1 layer"
    );
  });

  it("keeps the old sentence when a publish has no record of what it shipped", () => {
    render(
      <LayersPublishedFieldGroupListItem
        scope="project"
        changeLog={changeLog({
          fullOverlayPublish: null,
          publishedOverlayItems: [],
          toSummary: { layer_count: 400 },
        })}
      />
    );

    expect(screen.getByText("published 400 layers to project users")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show published layers" })).toBeNull();
  });

  it("opens the rest of a long list in a modal", () => {
    const items = Array.from({ length: 13 }, (_, index) =>
      item(`id-${index}`, `Layer ${index + 1}`)
    );
    render(
      <LayersPublishedFieldGroupListItem
        scope="project"
        changeLog={changeLog({
          fullOverlayPublish: false,
          toSummary: { layer_count: 13 },
          publishedOverlayItems: items,
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show published layers" }));
    expect(screen.queryByText("Layer 13")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show all 13" }));
    const dialog = screen.getByRole("dialog", { name: "Published layers" });
    expect(within(dialog).getByText("Layer 13")).toBeTruthy();
    expect(within(dialog).getByText("13 layers")).toBeTruthy();

    fireEvent.change(within(dialog).getByPlaceholderText("Search layers"), {
      target: { value: "Layer 13" },
    });
    expect(within(dialog).getByText("Layer 13")).toBeTruthy();
    expect(within(dialog).queryByText("Layer 1")).toBeNull();

    fireEvent.change(within(dialog).getByPlaceholderText("Search layers"), {
      target: { value: "no such layer" },
    });
    expect(within(dialog).getByText("No matching layers")).toBeTruthy();
  });
});
