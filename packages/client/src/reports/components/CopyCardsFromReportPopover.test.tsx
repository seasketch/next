import { render, screen } from "@testing-library/react";
import { CopyCardsFromReportPopover } from "./CopyCardsFromReportPopover";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@apollo/client", () => {
  const actual = jest.requireActual("@apollo/client");
  return {
    ...actual,
    useApolloClient: () => ({
      query: jest.fn(),
      cache: {},
    }),
  };
});

jest.mock("../../generated/graphql", () => {
  const actual = jest.requireActual("../../generated/graphql");
  return {
    ...actual,
    useAddReportCardMutation: () => [jest.fn(), { loading: false }],
    useDeleteReportCardMutation: () => [jest.fn(), { loading: false }],
  };
});

const copyQueryData = {
  project: {
    id: 1,
    draftReports: [
      {
        id: 9,
        title: "Current report",
        tabs: [
          {
            id: 1,
            position: 0,
            title: "Hidden",
            cards: [
              {
                id: 1,
                position: 0,
                title: "Should not show",
                body: null,
                componentSettings: null,
                alternateLanguageSettings: null,
              },
            ],
          },
        ],
      },
      {
        id: 10,
        title: "Coastal habitats",
        tabs: [
          {
            id: 2,
            position: 1,
            title: "Representation",
            cards: [
              {
                id: 3,
                position: 0,
                title: "Reef",
                body: null,
                componentSettings: null,
                alternateLanguageSettings: null,
              },
            ],
          },
          {
            id: 3,
            position: 0,
            title: "Viability",
            cards: [
              {
                id: 2,
                position: 0,
                title: "Size",
                body: null,
                componentSettings: null,
                alternateLanguageSettings: null,
              },
            ],
          },
        ],
      },
    ],
  },
};

test("groups copyable cards under report titles and omits the open report", () => {
  render(
    <CopyCardsFromReportPopover
      targetTabId={100}
      draftReportId={9}
      demonstrationSketchId={null}
      existingCopies={new Map()}
      onDone={() => undefined}
      copyQueryData={copyQueryData as any}
      copyQueryLoading={false}
    />
  );

  expect(
    screen.getByText("Copy cards from other reports.")
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Coastal habitats" })).toBeInTheDocument();
  expect(screen.getByText("Viability")).toBeInTheDocument();
  expect(screen.getByText("Representation")).toBeInTheDocument();
  expect(screen.getByText("Size")).toBeInTheDocument();
  expect(screen.getByText("Reef")).toBeInTheDocument();
  expect(screen.queryByText("Current report")).not.toBeInTheDocument();
  expect(screen.queryByText("Should not show")).not.toBeInTheDocument();
  expect(screen.queryByText(/sketch class/i)).not.toBeInTheDocument();
});
