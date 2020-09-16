import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import {
  ProfileStatusButton,
  ProfileStatusButtonProps,
} from "./ProfileStatusButton";
import { Auth0Provider, Auth0Context } from "@auth0/auth0-react";

// import { Button, ButtonProps } from "./Button";

export default {
  title: "Header/ProfileStatusButton",
  component: ProfileStatusButton,
  argTypes: {
    auth0: {
      control: "object",
      description: "Auth0 context passed to hooks",
      defaultValue: {
        isAuthenticated: true,
        isLoading: false,
        user: {
          picture:
            "https://s.gravatar.com/avatar/c16715a02106b118bd244f5f3e3b06ba?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fun.png",
        },
        fullname: "Chad Burt",
      },
    },
    loadingIndicatorDelay: {
      defaultValue: 500,
    },
  },
} as Meta;

const Template: Story<ProfileStatusButtonProps & { auth0: any }> = (args) => (
  <Auth0Context.Provider value={args.auth0}>
    <ProfileStatusButton {...args} />
  </Auth0Context.Provider>
);

export const LoggedIn = Template.bind({});
LoggedIn.args = {
  auth0: {
    isAuthenticated: true,
    isLoading: false,
    user: {
      picture:
        "https://s.gravatar.com/avatar/c16715a02106b118bd244f5f3e3b06ba?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fun.png",
    },
  },
};

export const NoProfilePicture = Template.bind({});
NoProfilePicture.args = {
  auth0: {
    isAuthenticated: true,
    isLoading: false,
    user: {},
  },
};

export const Loading = Template.bind({});
Loading.args = {
  auth0: {
    isAuthenticated: false,
    isLoading: true,
  },
};

export const NetworkError = Template.bind({});
NetworkError.args = {
  auth0: {
    isAuthenticated: false,
    isLoading: false,
    error: new Error("Network Error"),
  },
};
