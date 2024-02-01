/* eslint-disable i18next/no-literal-string */
import React from "react";
import fromMarkdown from "./fromMarkdown";
import WelcomeMessage from "./WelcomeMessage";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SurveyContext } from "./FormElement";
import { TestSurveyContextValue } from "./testContext";
import { createMemoryHistory } from "history";
import { Route, Router } from "react-router-dom";
import {
  ProjectAccessControlSetting,
  ProjectAccessStatus,
  ProjectMetadataDocument,
} from "../generated/graphql";
import { MockedProvider } from "@apollo/client/testing";

const projectCommonDetails = {
  id: 123,
  accessControl: ProjectAccessControlSetting.Public,
  slug: "cburt",
  name: "Chad's Project",
  logoUrl: "",
  supportEmail: "chad@underbluewaters.net",
  isOfflineEnabled: false,
  sketchGeometryToken: "abc123",
};

const projectPublicDetails = {
  __typename: "PublicProjectDetail",
  ...projectCommonDetails,
  accessStatus: ProjectAccessStatus.Granted,
};
const project = {
  ...projectCommonDetails,
  __typename: "Project",
  url: "https://seasketch.org/cburt",
  logoLink: "",
  description: "",
  sessionIsAdmin: false,
  isFeatured: true,
  sessionParticipationStatus: "participant_shared_profile",
  sessionHasPrivilegedAccess: true,
};

const mockedProjectMetadata = {
  data: {
    project: { ...project },
    projectPublicDetails: { ...projectPublicDetails },
    me: {
      __typename: "User",
      id: 123,
      profile: {
        __typename: "UserProfile",
        userId: 123,
        fullname: "Chad Burt",
        nickname: "underbluewaters",
        email: "chad@underbluewaters.net",
        picture: "",
        bio: "",
        affiliations: "UCSB",
      },
    },
  },
};

const body = fromMarkdown(`
# Welcome to the Survey

Enjoy your stay!

`);

test("Component renders with custom body and button text", async () => {
  const history = createMemoryHistory();
  const url = "/cburt/app";
  history.push(url);

  render(
    <Router history={history}>
      <Route path="/:slug/app">
        <MockedProvider
          addTypename={false}
          mocks={[
            {
              request: {
                query: ProjectMetadataDocument,
                variables: {
                  slug: "cburt",
                },
              },
              result: mockedProjectMetadata,
              delay: 10,
              // error: new Error("Hi!"),
            },
          ]}
        >
          <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
            <WelcomeMessage
              body={body}
              id={1}
              onChange={() => null}
              onSubmit={() => null}
              editable={false}
              isRequired={false}
              componentSettings={{
                beginButtonText: "Proceed",
                disablePracticeMode: false,
              }}
              alternateLanguageSettings={{}}
            />
          </SurveyContext.Provider>
        </MockedProvider>
      </Route>
    </Router>
  );
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Welcome to the Survey"
    );
    expect(screen.getByText("Proceed")).toBeInTheDocument();
  });
});

test("Clicking button proceeds to next page of survey", async () => {
  const onChange = jest.fn();
  const history = createMemoryHistory();
  const url = "/cburt/app";
  history.push(url);
  render(
    <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
      <Router history={history}>
        <Route path="/:slug/app">
          <MockedProvider
            addTypename={false}
            mocks={[
              {
                request: {
                  query: ProjectMetadataDocument,
                  variables: {
                    slug: "cburt",
                  },
                },
                result: mockedProjectMetadata,
                delay: 10,
                // error: new Error("Hi!"),
              },
            ]}
          >
            <WelcomeMessage
              body={body}
              id={1}
              onChange={onChange}
              onSubmit={() => null}
              editable={false}
              isRequired={false}
              componentSettings={{
                beginButtonText: "Proceed",
                disablePracticeMode: false,
              }}
              alternateLanguageSettings={{}}
            />
          </MockedProvider>
        </Route>
      </Router>
    </SurveyContext.Provider>
  );
  await waitFor(() => {
    expect(screen.getByText("Proceed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Proceed"));
    expect(onChange).toBeCalled();
  });
});
