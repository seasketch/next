import React from "react";
import { Story, Meta } from "@storybook/react/types-6-0";
import { ProfileForm, ProjectAccessGate } from "./ProjectAccessGate";
import { MockedProvider } from "@apollo/client/testing";
import { useAuth0 } from "@auth0/auth0-react";
import { Auth0Provider, Auth0Context } from "@auth0/auth0-react";
import {
  CurrentProjectMetadataDocument,
  ProjectAccessControlSetting,
  ProjectAccessStatus,
} from "../generated/graphql";
import { InMemoryCache } from "@apollo/client";
import ProjectAppSidebar from "../projects/ProjectAppSidebar";

export default {
  title: "ProjectAccessGate",
  component: ProjectAccessGate,
} as Meta;

const currentProjectPublicDetails = {
  id: 123,
  accessControl: ProjectAccessControlSetting.Public,
  slug: "cburt",
  name: "Chad's Project",
  logoUrl: "",
  supportEmail: "chad@underbluewaters.net",
};
const project = {
  url: "https://seasketch.org/cburt",
  logoLink: "",
  description: "",
  sessionIsAdmin: false,
  isFeatured: true,
  ...currentProjectPublicDetails,
  supportEmail: undefined,
};

const mockedProjectMetadata = {
  data: {
    currentProject: { ...project },
    currentProjectPublicDetails,
    currentProjectAccessStatus: ProjectAccessStatus.Granted,
    me: {
      id: 123,
      profile: {
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
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Auth0Context.Provider
        // @ts-ignore
        value={{
          isAuthenticated: false,
          user: null,
        }}
      >
        <MockedProvider
          mocks={[
            {
              request: {
                query: CurrentProjectMetadataDocument,
              },
              result: () => {
                return props.metadata;
              },
              delay: props.delay,
              // error: new Error("Hi!"),
            },
          ]}
        >
          <ProjectAccessGate>
            <h1>Project Name: {props.metadata.data.currentProject?.name}</h1>
            <p>
              This gated content would be replaced with the full application.
            </p>
          </ProjectAccessGate>
        </MockedProvider>
      </Auth0Context.Provider>
    </div>
  );
};

export const Loading = () => (
  <Template metadata={mockedProjectMetadata} delay={9999999} />
);

export const AccessGranted = () => (
  <Template metadata={mockedProjectMetadata} />
);

export const Error404 = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        currentProject: null,
        currentProjectPublicDetails: null,
        currentProjectAccessStatus: ProjectAccessStatus.ProjectDoesNotExist,
      },
    }}
  />
);

// ProjectAccessStatus.DeniedAdminsOnly

export const AdminsOnly = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        currentProjectAccessStatus: ProjectAccessStatus.DeniedAdminsOnly,
      },
    }}
  />
);

export const DeniedAnon = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        currentProjectAccessStatus: ProjectAccessStatus.DeniedAnon,
      },
    }}
  />
);

export const DeniedAdminsOnly = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        currentProjectAccessStatus: ProjectAccessStatus.DeniedAdminsOnly,
      },
    }}
  />
);

export const DeniedEmailNotVerified = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        currentProjectAccessStatus: ProjectAccessStatus.DeniedEmailNotVerified,
      },
    }}
  />
);

export const DeniedInviteOnly = () => (
  <Template
    metadata={{
      data: {
        ...mockedProjectMetadata.data,
        currentProjectAccessStatus: ProjectAccessStatus.DeniedNotRequested,
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
        currentProjectAccessStatus: ProjectAccessStatus.DeniedNotApproved,
      },
    }}
  />
);
