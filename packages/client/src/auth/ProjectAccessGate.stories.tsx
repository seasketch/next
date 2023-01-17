import React from "react";
import { Story, Meta } from "@storybook/react/types-6-0";
import { ProfileForm, ProjectAccessGate } from "./ProjectAccessGate";
import { MockedProvider } from "@apollo/client/testing";
import { Auth0Context } from "@auth0/auth0-react";
import {
  ProjectAccessControlSetting,
  ProjectAccessStatus,
  ProjectMetadataDocument,
} from "../generated/graphql";
import { createMemoryHistory } from "history";
import { Route, Router } from "react-router-dom";

export default {
  title: "ProjectAccessGate",
  component: ProjectAccessGate,
} as Meta;

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

const Template: Story<{ metadata: any; delay?: number }> = (props) => {
  const history = createMemoryHistory();
  const url = "/cburt/app";
  history.push(url);
  const response = {
    data: {
      ...props.metadata.data,
    },
  };
  return (
    <div style={{ width: "100%" }}>
      <Auth0Context.Provider
        // @ts-ignore
        value={{
          isAuthenticated: false,
          user: undefined,
        }}
      >
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
              result: response,
              delay: props.delay,
              // error: new Error("Hi!"),
            },
          ]}
        >
          <Router history={history}>
            <Route path="/:slug/app">
              <ProjectAccessGate>
                <h1>Project Name: {props.metadata.data.project?.name}</h1>
                <p>
                  This gated content would be replaced with the full
                  application.
                </p>
              </ProjectAccessGate>
            </Route>
          </Router>
        </MockedProvider>
      </Auth0Context.Provider>
    </div>
  );
};

export const Loading = () => (
  <Template metadata={mockedProjectMetadata} delay={9999999} />
);

export const AccessGranted = () => {
  const data = {
    data: {
      ...mockedProjectMetadata.data,
    },
  };
  return <Template metadata={data} />;
};

export const Error404 = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        project: null,
        projectPublicDetails: null,
      },
    }}
  />
);

// ProjectAccessStatus.DeniedAdminsOnly

// export const AdminsOnly = () => (
//   <Template
//     metadata={{
//       data: {
//         ...mockedProjectMetadata.data,
//         currentProjectAccessStatus: ProjectAccessStatus.DeniedAdminsOnly,
//       },
//     }}
//   />
// );

export const DeniedAnon = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        projectPublicDetails: {
          ...mockedProjectMetadata.data.projectPublicDetails,
          accessStatus: ProjectAccessStatus.DeniedAnon,
        },
      },
    }}
  />
);

export const DeniedAdminsOnly = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        projectPublicDetails: {
          ...mockedProjectMetadata.data.projectPublicDetails,
          accessStatus: ProjectAccessStatus.DeniedAdminsOnly,
        },
      },
    }}
  />
);

export const DeniedAdminsOnlyAndAnon = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        project: {
          ...project,
          accessControl: ProjectAccessControlSetting.AdminsOnly,
        },
        projectPublicDetails: {
          ...projectPublicDetails,
          accessControl: ProjectAccessControlSetting.AdminsOnly,
          accessStatus: ProjectAccessStatus.DeniedAnon,
        },
      },
    }}
  />
);

export const DeniedEmailNotVerified = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        projectPublicDetails: {
          ...mockedProjectMetadata.data.projectPublicDetails,
          accessStatus: ProjectAccessStatus.DeniedEmailNotVerified,
        },
      },
    }}
  />
);

export const DeniedInviteOnly = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        projectPublicDetails: {
          ...mockedProjectMetadata.data.projectPublicDetails,
          accessStatus: ProjectAccessStatus.DeniedNotRequested,
        },
      },
    }}
  />
);

export const AccessRequestScreen = () => (
  // <div
  //   style={{
  //     width: "100%",
  //     height: "100%",
  //     padding: "24px",
  //     backgroundColor: "#efefef",
  //   }}
  // >
  <MockedProvider mocks={[]}>
    <div
      className="fixed z-50 inset-0 overflow-y-auto overflow-x-hidden max-w-full"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-screen min-w-screen max-w-screen overflow-x-hidden text-center sm:block mx-auto bg-gray-200 bg-opacity-90">
        <ProfileForm
          onRequestClose={() => null}
          onMadeRequest={() => null}
          initialValues={{
            fullname: "Chad Burt",
            nickname: "",
            email: "",
            affiliations: "",
          }}
          projectId={1}
          userId={1}
          refetchProjectState={async () => null}
          skipAnimation={true}
        />
      </div>
    </div>
  </MockedProvider>
);

export const DeniedNotApproved = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        projectPublicDetails: {
          ...mockedProjectMetadata.data.projectPublicDetails,
          accessStatus: ProjectAccessStatus.DeniedNotApproved,
        },
      },
    }}
  />
);
