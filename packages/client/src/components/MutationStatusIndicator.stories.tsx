import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import MutationStatusIndicator, {
  MutationStatusIndicatorProps,
} from "./MutationStatusIndicator";
import { Auth0Provider, Auth0Context } from "@auth0/auth0-react";
import { ApolloError } from "@apollo/client";

export default {
  title: "MutationStatusIndicator",
  component: MutationStatusIndicator,
  // argTypes: {
  //   id
  //   auth0: {
  //     control: "object",
  //     description: "Auth0 context passed to hooks",
  //     defaultValue: {
  //       isAuthenticated: true,
  //       isLoading: false,
  //       user: {
  //         picture:
  //           "https://s.gravatar.com/avatar/c16715a02106b118bd244f5f3e3b06ba?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fun.png",
  //       },
  //       fullname: "Chad Burt",
  //     },
  //   },
  //   loadingIndicatorDelay: {
  //     defaultValue: 500,
  //   },
  // },
} as Meta;

const Template: Story<MutationStatusIndicatorProps> = (args) => (
  <div className="w-80">
    <MutationStatusIndicator {...args} />
  </div>
);

export const Off = Template.bind({});
Off.args = {
  mutationStatus: {
    loading: false,
    called: false,
  },
};

export const Loading = Template.bind({});
Loading.args = {
  mutationStatus: {
    loading: true,
    called: true,
  },
};

export const Saved = Template.bind({});
Saved.args = {
  mutationStatus: {
    loading: false,
    called: true,
  },
};

export const Error = Template.bind({});
Error.args = {
  mutationStatus: {
    loading: false,
    called: true,
    error: new ApolloError({
      errorMessage: "Mutation failed",
    }),
  },
};
