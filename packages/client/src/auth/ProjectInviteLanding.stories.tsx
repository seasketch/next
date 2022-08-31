import React, { ProviderProps } from "react";
import { Story, Meta } from "@storybook/react/types-6-0";
import Landing from "./ProjectInviteLanding";
import { createMemoryHistory } from "history";
import { Router } from "react-router-dom";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import {
  ConfirmProjectInviteDocument,
  ProjectAccessControlSetting,
  ProjectAccessStatus,
  ProjectInviteTokenClaims,
  ProjectMetadataDocument,
  VerifyProjectInviteDocument,
} from "../generated/graphql";
import jwt from "jsonwebtoken";
import {
  Auth0Context,
  Auth0ContextInterface,
  useAuth0,
} from "@auth0/auth0-react";
import { InMemoryCache } from "@apollo/client";
const projectCommonDetails = {
  id: 123,
  accessControl: ProjectAccessControlSetting.Public,
  slug: "cburt",
  name: "Chad's Project",
  logoUrl: "",
  supportEmail: "chad@underbluewaters.net",
  isOfflineEnabled: false,
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

export default {
  title: "ProjectInviteLandingPage",
  component: Landing,
} as Meta;

const Template: Story<{
  token: string;
  auth?: any;
  mocks?: MockedResponse<Record<string, any>>[];
}> = (props) => {
  const history = createMemoryHistory();
  history.push(`/auth/projectInvite?token=${props.token}`);
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Auth0Context.Provider
        value={
          props.auth || {
            isAuthenticated: false,
            user: null,
          }
        }
      >
        <MockedProvider mocks={props.mocks}>
          <Router history={history}>
            <Landing />
          </Router>
        </MockedProvider>
      </Auth0Context.Provider>
    </div>
  );
};

export const InvalidToken = () => <Template token="abc123" />;

export const ExpiredInvitation = () => {
  const claims: ProjectInviteTokenClaims = {
    email: "test@example.com",
    projectName: "Test Project",
    projectSlug: "test",
    fullname: "Tester",
    admin: false,
    inviteId: 1,
    wasUsed: false,
    projectId: 1,
  };
  const token = jwt.sign(claims, "secret", {
    expiresIn: -5,
  });
  return (
    <Template
      token={token}
      mocks={[
        {
          request: {
            query: VerifyProjectInviteDocument,
            variables: {
              token,
            },
          },
          result: () => {
            return {
              data: {
                verifyProjectInvite: {
                  error: "jwt: expired",
                  existingAccount: false,
                },
              },
            };
          },
        },
        {
          request: {
            query: ProjectMetadataDocument,
            variables: {
              slug: "test",
            },
          },
          result: () => {
            return mockedProjectMetadata;
          },
        },
      ]}
    />
  );
};

export const ValidInviteUnknownEmail = () => {
  const claims: ProjectInviteTokenClaims = {
    email: "test@example.com",
    projectName: "Test Project",
    projectSlug: "test",
    fullname: "Tester",
    admin: false,
    inviteId: 1,
    wasUsed: false,
    projectId: 1,
  };
  const token = jwt.sign(claims, "secret", {
    expiresIn: "1 day",
  });
  return (
    <Template
      mocks={[
        {
          request: {
            query: VerifyProjectInviteDocument,
            variables: {
              token,
            },
          },
          result: () => {
            return {
              data: {
                verifyProjectInvite: {
                  claims,
                  existingAccount: false,
                },
              },
            };
          },
        },
      ]}
      token={token}
    />
  );
};

export const ValidInviteSentToKnownEmail = () => {
  const claims: ProjectInviteTokenClaims = {
    email: "test@example.com",
    projectName: "Test Project",
    projectSlug: "test",
    fullname: "Tester",
    admin: false,
    inviteId: 1,
    wasUsed: false,
    projectId: 1,
  };
  const token = jwt.sign(claims, "secret", {
    expiresIn: "1 day",
  });
  return (
    <Template
      mocks={[
        {
          request: {
            query: VerifyProjectInviteDocument,
            variables: {
              token,
            },
          },
          result: () => {
            return {
              data: {
                verifyProjectInvite: {
                  claims,
                  existingAccount: true,
                },
              },
            };
          },
        },
      ]}
      token={token}
    />
  );
};

export const LoggedInAsDifferentUser = () => {
  const claims = {
    email: "testDiff@example.com",
    projectName: "Test Project",
    projectSlug: "test",
    fullname: "Tester",
    admin: false,
    inviteId: 1,
    wasUsed: false,
    projectId: 1,
  };
  const token = jwt.sign(claims, "secret", {
    expiresIn: "1 day",
  });
  return (
    <Template
      auth={{
        isAuthenticated: true,
        user: {
          email: "userA@example.com",
          name: "User A",
        },
      }}
      token={token}
      mocks={[
        {
          request: {
            query: VerifyProjectInviteDocument,
            variables: {
              token,
            },
          },
          result: () => {
            return {
              data: {
                verifyProjectInvite: {
                  claims,
                  existingAccount: false,
                },
              },
            };
          },
        },
      ]}
    />
  );
};

export const LoggedInAsDifferentUserWhichHasExistingAccount = () => {
  const claims = {
    email: "testDiff@example.com",
    projectName: "Test Project",
    projectSlug: "test",
    fullname: "Tester",
    admin: false,
    inviteId: 1,
    wasUsed: false,
    projectId: 1,
  };
  const token = jwt.sign(claims, "secret", {
    expiresIn: "1 day",
  });
  return (
    <Template
      auth={{
        isAuthenticated: true,
        user: {
          email: "userA@example.com",
          name: "User A",
        },
      }}
      token={token}
      mocks={[
        {
          request: {
            query: VerifyProjectInviteDocument,
            variables: {
              token,
            },
          },
          result: () => {
            return {
              data: {
                verifyProjectInvite: {
                  claims,
                  existingAccount: true,
                },
              },
            };
          },
        },
      ]}
    />
  );
};
