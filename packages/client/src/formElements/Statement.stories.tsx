import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import Statement from "./Statement";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import { NodeType } from "prosemirror-model";
import fromMarkdown from "./fromMarkdown";

export default {
  title: "FormElements/Statement",
  component: Statement,
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
    value: {
      table: {
        disable: true,
      },
    },
    onChange: {
      table: {
        disable: true,
      },
    },
    submissionAttempted: {
      table: {
        disable: true,
      },
    },
    isRequired: {
      table: {
        disable: true,
      },
    },
    beginButtonText: {
      control: "text",
      name: "componentSettings.beginButtonText",
      description: "componentSettings.beginButtonText",
    },
  },
  args: {
    id: 1,
    isRequired: false,
    beginButtonText: "Start Survey",
    disablePracticeMode: false,
    body: fromMarkdown(`
# Welcome to the Ocean Uses Survey!

Please submit a response so we can do the thing.
    `),
  },
};

const Template: Story = (args: any) => (
  <SurveyAppLayout progress={0.4}>
    <Statement
      {...args}
      componentSettings={{
        beginButtonText: args.beginButtonText,
        disablePracticeMode: args.disablePracticeMode,
      }}
    />
  </SurveyAppLayout>
);

export const Basic = Template.bind({});

Basic.args = {
  body: fromMarkdown(`
  # This is a heading!
  
  Use statements to break up forms into sections and explain questions in more detail

  ## Quick Links 🐟

  * **[our privacy policy](http://example.com)**
  * Our [homepage (seasketch.org)](https://www.seasketch.org)
  * ![SeaSketch Logo](https://www.seasketch.org/images/logo.png)
`),
};
