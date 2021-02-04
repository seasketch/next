import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import Button, { ButtonProps } from "./Button";

export default {
  title: "Button",
  component: Button,
} as Meta;

const Template: Story<ButtonProps> = (args) => (
  <div className="w-80">
    <Button {...args} />
  </div>
);

export const Defaults = Template.bind({});
Defaults.args = {
  label: "Click Me",
};

export const Small = Template.bind({});
Small.args = {
  small: true,
  label: "Add data",
};

export const Primary = Template.bind({});
Primary.args = {
  label: "Click Me",
  primary: true,
};

export const DisabledPrimary = Template.bind({});
DisabledPrimary.args = {
  label: "Disabled",
  primary: true,
  disabled: true,
};

export const DisabledSecondary = Template.bind({});
DisabledSecondary.args = {
  label: "Disabled",
  disabled: true,
};

export const Loading = Template.bind({});
Loading.args = {
  label: "Uploading",
  loading: true,
};

// export const On = Template.bind({});
// On.args = {
//   isToggled: true,
// };

// export const Disabled = Template.bind({});
// Disabled.args = {
//   isToggled: true,
//   disabled: true,
// };
