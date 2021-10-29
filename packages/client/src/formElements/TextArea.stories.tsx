import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import TextArea from "./TextArea";
import { questionBodyFromMarkdown } from "./fromMarkdown";

export default {
  title: "FormElements/TextArea",
  component: TextArea,
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
    compact: {
      control: "boolean",
      name: "componentSettings.compact",
    },
    placeholder: {
      control: "text",
      name: "componentSettings.placeholder",
    },
  },
  args: {
    id: 1,
    isRequired: false,
    placeholder: "Your answer here...",
    compact: true,
    body: questionBodyFromMarkdown(`
# What is your name?
`),
  },
};

const Template: Story = (args: any) => (
  <SurveyAppLayout progress={0.4}>
    <TextArea
      {...args}
      componentSettings={{
        compact: args.compact,
        placeholder: args.placeholder,
      }}
    />
  </SurveyAppLayout>
);

export const Compact = Template.bind({});
Compact.args = {
  placeholder: "Type here...",
  compact: true,
};

export const Large = Template.bind({});
Large.args = {
  placeholder: "Type here...",
  compact: false,
};

export const RequiredFieldValidation = Template.bind({});
RequiredFieldValidation.args = {
  isRequired: true,
  submissionAttempted: true,
  value: "",
};
