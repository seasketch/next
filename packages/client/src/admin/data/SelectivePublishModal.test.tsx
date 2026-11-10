/* eslint-disable i18next/no-literal-string */
import { MockedProvider } from "@apollo/client/testing";
import { MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Route, MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import {
  ProjectMetadataDocument,
  PublishTableOfContentsItemsDocument,
  SelectivePublishDetailsDocument,
} from "../../generated/graphql";
import i18n from "../../i18n";
import SelectivePublishModal from "./SelectivePublishModal";

jest.mock("../../useProjectId", () => () => 2);

beforeAll(() => {
  if (!("ResizeObserver" in window)) {
    (window as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  i18n.addResourceBundle(
    "en",
    "admin:data",
    {
      "and {{count}} items inside": "and {{count}} items inside",
      "Must be published together": "Must be published together",
      "Must be published with {{names}}": "Must be published with {{names}}",
      Publish: "Publish",
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
        overlayOrderPending: false,
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

function renderModal(mocks: MockedResponse[] = [details, metadata]) {
  return render(
    <MemoryRouter initialEntries={["/admin/demo-samoa"]}>
      <Route path="/admin/:slug">
        <ToastProvider>
          <MockedProvider mocks={mocks} addTypename={false}>
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
    expect(document.body.textContent).toContain("and {{count}} items inside");
  });
  expect(document.body.textContent).not.toContain("Old reef");
  const inside = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "and {{count}} items inside"
  );
  fireEvent.pointerEnter(inside as HTMLButtonElement);
  await waitFor(() => {
    expect(document.body.textContent).toContain("Old reef");
  });
  fireEvent.pointerLeave(inside as HTMLButtonElement);
  await waitFor(() => {
    expect(document.body.textContent).not.toContain("Old reef");
  });

  const habitats = document.getElementById(
    "selective-publish-habitats"
  ) as HTMLInputElement;
  const coral = document.getElementById(
    "selective-publish-coral"
  ) as HTMLInputElement;
  expect(habitats.checked).toBe(true);
  expect(coral.checked).toBe(true);
  expect(document.getElementById("selective-publish-z-order")).toBeNull();

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
      "button[data-together='habitats coral']"
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    return button as HTMLButtonElement;
  });
  expect(
    document.getElementById("selective-publish-habitats")
  ).toBeNull();
  expect(document.body.textContent).not.toContain("Included with");
  expect(document.body.textContent).not.toContain("+ 1 included");
  expect(document.querySelector(".bg-emerald-50")).toBeNull();
  expect(
    document.querySelectorAll("button[data-together='habitats coral']")
  ).toHaveLength(2);

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

function emptyDetails(overlayOrderPending: boolean) {
  return {
    ...details,
    result: {
      data: {
        projectBySlug: {
          ...details.result.data.projectBySlug,
          overlayOrderPending,
          pendingPublishItems: [],
        },
      },
    },
  };
}

test("an updated item without change history is labelled", async () => {
  renderModal();
  await waitFor(() => {
    expect(document.body.textContent).toContain("Coral cover");
  });
  expect(document.body.textContent).toContain("Other changes");
});

test("the empty state says when only ordering is left for Publish", async () => {
  renderModal([emptyDetails(true), metadata]);
  const notice = await waitFor(() => {
    const element = document.querySelector(
      "[data-testid='selective-publish-empty']"
    );
    expect(element).toBeTruthy();
    return element as HTMLElement;
  });
  expect(notice.textContent).toContain("must be published as a full update");
});

test("the empty state says the lists match when nothing differs", async () => {
  renderModal([emptyDetails(false), metadata]);
  const notice = await waitFor(() => {
    const element = document.querySelector(
      "[data-testid='selective-publish-empty']"
    );
    expect(element).toBeTruthy();
    return element as HTMLElement;
  });
  expect(notice.textContent).toContain("matches the draft");
});

test("a server error is shown with its message", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const failure = {
    request: {
      query: PublishTableOfContentsItemsDocument,
      variables: {
        projectId: 2,
        stableIds: ["benthic", "old-reef", "coral", "habitats"],
      },
    },
    result: {
      errors: [
        new GraphQLError(
          'Publishing this selection would leave "Coral cover" without a published folder. Use Publish to publish the whole list.'
        ),
      ],
    },
  };
  renderModal([details, metadata, failure]);
  const button = await waitFor(() => {
    const element = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Publish"
    );
    expect(element).toBeTruthy();
    expect(element?.disabled).toBe(false);
    return element as HTMLButtonElement;
  });
  button.click();
  const alert = await waitFor(() => {
    const element = document.querySelector("[role='alert']");
    expect(element).toBeTruthy();
    return element as HTMLElement;
  });
  expect(alert.textContent).toContain("without a published folder");
});
