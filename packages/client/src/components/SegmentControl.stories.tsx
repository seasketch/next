import React, { useState } from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import SegmentControl, { SegmentControlProps } from "./SegmentControl";

export default {
  title: "SegmentControl",
  component: SegmentControl,
} as Meta;

const Template: Story<SegmentControlProps> = (args) => {
  const [value, setValue] = useState(args.value);
  return (
    <div className="w-96">
      <SegmentControl {...args} onClick={(v) => setValue(v)} value={value} />
    </div>
  );
};

export const Basic = Template.bind({});
Basic.args = {
  segments: ["Raster Source", "Vector Sources", "Video Source"],
  value: "Raster Source",
};

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
