import React, { useState } from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import Name from "./Name";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { SurveyContext } from "./FormElement";
import { TestSurveyContextValue } from "./testContext";

export default {
  title: "FormElements/Name",
  component: Name,
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
    placeholder: {
      control: "text",
      name: "componentSettings.placeholder",
    },
    isFacilitatedResponse: {
      control: "boolean",
    },
    submissionAttempted: {
      control: "boolean",
    },
  },
  args: {
    id: 1,
    isRequired: true,
    body: Name.defaultBody,
    isFacilitatedResponse: false,
    submissionAttempted: false,
  },
};

const Template: Story = (args: any) => {
  return (
    <SurveyContext.Provider
      value={{
        ...TestSurveyContextValue,
        isFacilitatedResponse: args.isFacilitatedResponse,
        supportedLanguages: [],
      }}
    >
      <SurveyAppLayout progress={0.4}>
        <Name
          {...args}
          componentSettings={{ placeholder: args.placeholder }}
          submissionAttempted={args.submissionAttempted}
        />
      </SurveyAppLayout>
    </SurveyContext.Provider>
  );
};

export const NameFormElement = Template.bind({});
export const FacilitatorInput = Template.bind({});
FacilitatorInput.args = {
  isFacilitatedResponse: true,
};
