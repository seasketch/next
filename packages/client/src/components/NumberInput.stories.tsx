import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import NumberInput, { NumberInputOptions } from "./NumberInput";
import { Auth0Provider, Auth0Context } from "@auth0/auth0-react";

export default {
  title: "NumberInput",
  component: NumberInput,
} as Meta;

const Template: Story<NumberInputOptions> = (args) => (
  <div className="w-80">
    <NumberInput {...args} />
  </div>
);

export const Basic = Template.bind({});
Basic.args = {
  name: "number",
};
