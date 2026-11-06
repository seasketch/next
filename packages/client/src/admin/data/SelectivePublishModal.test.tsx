/* eslint-disable i18next/no-literal-string */
import { MockedProvider } from "@apollo/client/testing";
import { render, waitFor } from "@testing-library/react";
import { Route, MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import {
  ProjectMetadataDocument,
  SelectivePublishDetailsDocument,
} from "../../generated/graphql";
import i18n from "../../i18n";
import SelectivePublishModal from "./SelectivePublishModal";

beforeAll(() => {
  i18n.addResourceBundle(
    "en",
    "admin:data",
    {
      "and {{count}} items inside": "and {{count}} items inside",
      "Included with {{name}}": "Included with {{name}}",
      "Publish {{count}} selected": "Publish {{count}} selected",
      "Layer stacking order": "Layer stacking order",
    },
    true,
    true
  );
  i18n.addResourceBundle(
    "en",
    "admin",
    {
      Added: "Added",
      Updated: "Updated",
      Removed: "Removed",
      "Other Changes": "Other Changes",
    },
    true,
    true
  );
  return i18n.changeLanguage("en");
});

const details = {
  request: {
    query: SelectivePublishDetailsDocument,
    variables: { slug: "demo-samoa" },
  },
  result: {
    data: {
      projectBySlug: {
        id: 2,
        tableOfContentsLastPublished: "2026-01-01T00:00:00.000Z",
        layerStackOrderPending: true,
        pendingPublishItems: [
          {
            stableId: "habitats",
            kind: "added",
            title: "Habitats",
            isFolder: true,
            parentStableId: null,
            path: "habitats",
            requiresStableIds: [],
            bundleId: null,
            draftId: 10,
            includedInBundle: false,
          },
          {
            stableId: "coral",
            kind: "updated",
            title: "Coral cover",
            isFolder: false,
            parentStableId: "habitats",
            path: "habitats.coral",
            requiresStableIds: ["habitats"],
            bundleId: null,
            draftId: 11,
            includedInBundle: false,
          },
          {
            stableId: "benthic",
            kind: "removed",
            title: "Benthic",
            isFolder: true,
            parentStableId: null,
            path: "benthic",
            requiresStableIds: [],
            bundleId: "benthic",
            draftId: null,
            includedInBundle: false,
          },
          {
            stableId: "old-reef",
            kind: "removed",
            title: "Old reef",
            isFolder: false,
            parentStableId: "benthic",
            path: "benthic.oldreef",
            requiresStableIds: [],
            bundleId: "benthic",
            draftId: null,
            includedInBundle: true,
          },
        ],
        draftTableOfContentsItems: [],
        tableOfContentsItems: [
          {
            id: 1,
            stableId: "habitats",
            title: "Habitats",
            isFolder: true,
            parentStableId: null,
          },
        ],
        changeLogsSinceLastPublish: [],
      },
    },
  },
};

const metadata = {
  request: {
    query: ProjectMetadataDocument,
    variables: { slug: "demo-samoa" },
  },
  result: {
    data: {
      projectBySlug: {
        id: 2,
      },
    },
  },
};

function renderModal() {
  return render(
    <MemoryRouter initialEntries={["/admin/demo-samoa"]}>
      <Route path="/admin/:slug">
        <ToastProvider>
          <MockedProvider mocks={[details, metadata]} addTypename={false}>
            <SelectivePublishModal onRequestClose={jest.fn()} />
          </MockedProvider>
        </ToastProvider>
      </Route>
    </MemoryRouter>
  );
}

test("selective publish binds a new folder to the layer that moved into it", async () => {
  renderModal();
  await waitFor(() => {
    expect(document.body.textContent).toContain("Coral cover");
    expect(document.body.textContent).toContain("Old reef");
    expect(document.body.textContent).toContain("Layer stacking order");
  });

  const stacking = document.getElementById(
    "selective-publish-z-order"
  ) as HTMLInputElement;
  const habitats = document.getElementById(
    "selective-publish-habitats"
  ) as HTMLInputElement;
  const coral = document.getElementById(
    "selective-publish-coral"
  ) as HTMLInputElement;
  expect(stacking.checked).toBe(true);
  expect(habitats.checked).toBe(true);
  expect(coral.checked).toBe(true);

  stacking.click();
  habitats.click();
  await waitFor(() => {
    const state = document.querySelector(
      "[data-testid='selective-publish-state']"
    );
    expect(state?.getAttribute("data-explicit") || "").not.toContain("coral");
  });

  (
    document.getElementById("selective-publish-coral") as HTMLInputElement
  ).click();
  const included = await waitFor(() => {
    const button = document.querySelector(
      "[aria-label*='Included with']"
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    return button as HTMLButtonElement;
  });
  expect(
    document.getElementById("selective-publish-habitats")
  ).toBeNull();

  included.click();
  await waitFor(() => {
    expect(
      (
        document.getElementById(
          "selective-publish-habitats"
        ) as HTMLInputElement
      ).checked
    ).toBe(true);
  });
});
