import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import WelcomeMessage from "./WelcomeMessage";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import { NodeType } from "prosemirror-model";
import fromMarkdown from "./fromMarkdown";

export default {
  title: "FormElements/WelcomeMessage",
  component: WelcomeMessage,
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
    body: fromMarkdown(`
    # Welcome to the Ocean Uses Survey!
    
    Please submit a response so we can do the thing.
    `),
  },
};

const Template: Story = (args: any) => (
  <SurveyAppLayout progress={0.4}>
    <WelcomeMessage
      {...args}
      componentSettings={{
        beginButtonText: args.beginButtonText,
      }}
    />
  </SurveyAppLayout>
);

export const Basic = Template.bind({});

Basic.args = {
  body: fromMarkdown(`
  # Welcome to the Ocean Uses Survey!
  
  Recording where and how you use ocean resources will help us better protect future use.
  `),
};

export const RichText = Template.bind({});

RichText.args = {
  body: fromMarkdown(`
# Welcome to the Ocean Uses Survey!

Recording where and how you use ocean resources will help us better protect future use.

## Quick Links 🐟

  * **[our privacy policy](http://example.com)**
  * Our [homepage (seasketch.org)](https://www.seasketch.org)
  * ![Tux, the Linux mascot](https://www.seasketch.org/images/logo.png)
  `),
};
