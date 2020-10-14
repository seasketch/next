import React, { useState } from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import InputBlock, { InputBlockProps } from "./InputBlock";
import Switch from "./Switch";

export default {
  title: "InputBlock",
  component: InputBlock,
} as Meta;

const Template: Story<InputBlockProps> = (args) => {
  return (
    <div className="max-w-lg">
      <InputBlock title="Enable Feature" input={<Switch isToggled={true} />}>
        Lorem ipsum dolor, sit amet consectetur adipisicing elit. Officia
        corporis delectus labore accusamus ipsam, consectetur illum iusto
        repellat voluptas maiores neque expedita. Quibusdam possimus libero in
        magni officia velit maiores?
      </InputBlock>
    </div>
  );
};

export const Basic = Template.bind({});

// export const Defaults = Template.bind({});
// Defaults.args = {
//   label: "Click Me",
// };

// export const Primary = Template.bind({});
// Primary.args = {
//   label: "Click Me",
//   primary: true,
// };

// export const DisabledPrimary = Template.bind({});
// DisabledPrimary.args = {
//   label: "Disabled",
//   primary: true,
//   disabled: true,
// };

// export const DisabledSecondary = Template.bind({});
// DisabledSecondary.args = {
//   label: "Disabled",
//   disabled: true,
// };

// export const Loading = Template.bind({});
// Loading.args = {
//   label: "Uploading",
//   loading: true,
// };

// // export const On = Template.bind({});
// // On.args = {
// //   isToggled: true,
// // };

// // export const Disabled = Template.bind({});
// // Disabled.args = {
// //   isToggled: true,
// //   disabled: true,
// // };
