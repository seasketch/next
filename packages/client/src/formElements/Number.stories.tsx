// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story } from "@storybook/react/types-6-0";
import { useState } from "react";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import Number from "./Number";

export default {
  title: "FormElements/Number",
  component: Number,
  layout: "fullscreen",
  argTypes: {
    body: {
      control: "object",
    },
    id: {
      table: {
        disable: true,
      },
    },
    componentSettings: {
      table: {
        disable: true,
      },
    },
    onChange: {
      table: {
        disable: true,
      },
    },
    onSubmit: {
      table: {
        disable: true,
      },
    },
    max: {
      control: "number",
    },
    min: {
      control: "number",
    },
    defaultValue: {
      control: "number",
    },
  },
  args: {
    id: 1,
    defaultValue: 0,
    isRequired: true,
    body: questionBodyFromMarkdown(`
# How many fingers do you have?

Be honest. Try counting on your fingers and toes if you have trouble.
`),
  },
};

const Template: Story = (args: any) => {
  const [value, setValue] = useState<number>(args.value);
  return (
    <SurveyAppLayout progress={0.4}>
      <Number
        {...args}
        onChange={setValue}
        value={value}
        componentSettings={{
          max: args.max,
          min: args.min,
          defaultValue: args.defaultValue,
        }}
      />
    </SurveyAppLayout>
  );
};

export const Basic = Template.bind({});
Basic.args = {
  defaultValue: 0,
};

export const MinMax = Template.bind({});
MinMax.args = {
  min: 1,
  max: 12,
  defaultValue: 1,
};

export const ValidationError = Template.bind({});
ValidationError.args = {
  min: 1,
  max: 12,
  defaultValue: 1,
  value: 15,
};
// export const TenStars = Template.bind({});

// TenStars.args = { max: 10 };
