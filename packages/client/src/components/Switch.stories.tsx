import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import Switch, { SwitchProps } from "./Switch";

export default {
  title: "Switch",
  component: Switch,
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

const Template: Story<SwitchProps> = (args) => (
  <div className="w-80">
    <Switch {...args} />
  </div>
);

export const Off = Template.bind({});
Off.args = {
  isToggled: false,
};

export const On = Template.bind({});
On.args = {
  isToggled: true,
};

export const Disabled = Template.bind({});
Disabled.args = {
  isToggled: true,
  disabled: true,
};
