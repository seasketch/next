import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import { SurveyAppLayout } from "../surveys/SurveyApp";
import ShortText from "./ShortText";
import fromMarkdown from "./fromMarkdown";

export default {
  title: "FormElements/ShortText",
  component: ShortText,
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
    minLength: {
      control: "number",
      name: "componentSettings.minLength",
    },
    maxLength: {
      control: "number",
      name: "componentSettings.maxLength",
    },
    placeholder: {
      control: "text",
      name: "componentSettings.placeholder",
    },
    name: {
      control: "text",
      name: "componentSettings.name",
    },
  },
  args: {
    id: 1,
    isRequired: false,
    placeholder: "Enter name",
    name: "name",
    body: fromMarkdown(`
# What is your name?
`),
  },
};

const Template: Story = (args: any) => (
  <SurveyAppLayout progress={0.4}>
    <ShortText
      {...args}
      componentSettings={{
        minLength: args.minLength,
        maxLength: args.maxLength,
        placeholder: args.placeholder,
      }}
    />
  </SurveyAppLayout>
);

export const BasicWithPlaceholder = Template.bind({});
BasicWithPlaceholder.args = {
  placeholder: "Please enter your full name (first and surname)",
};

export const LongerIntroduction = Template.bind({});
LongerIntroduction.args = {
  body: fromMarkdown(`
  # What is your name?
  
  Please enter your full name (first and last).
  `),
  placeholder: undefined,
};
