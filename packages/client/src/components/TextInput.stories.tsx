import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import TextInput, { TextInputOptions } from "./TextInput";
import { Auth0Provider, Auth0Context } from "@auth0/auth0-react";

export default {
  title: "TextInput",
  component: TextInput,
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

const Template: Story<TextInputOptions> = (args) => (
  <div className="w-80">
    <TextInput {...args} />
  </div>
);

export const Basic = Template.bind({});
Basic.args = {
  id: "project-name",
  label: "Project Name",
  placeholder: "My Project",
  required: true,
  value: "",
};

export const ValidationError = Template.bind({});
ValidationError.args = {
  id: "project-name",
  label: "Project Name",
  error: "Name must be at least 3 characters",
  placeholder: "My Project",
  required: true,
  value: "Hi",
};

export const Saving = Template.bind({});
Saving.args = {
  id: "project-name",
  label: "Project Name",
  placeholder: "My Project",
  required: true,
  value: "My Project",
  state: "SAVING",
};

export const Saved = Template.bind({});
Saved.args = {
  id: "project-name",
  label: "Project Name",
  placeholder: "My Project",
  required: true,
  value: "My Project",
  state: "SAVED",
};
