import React from "react";
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from "@storybook/react/types-6-0";
import ThankYou from "./ThankYou";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import { NodeType } from "prosemirror-model";
import fromMarkdown from "./fromMarkdown";
import { MockedProvider } from "@apollo/client/testing";
import { Auth0Provider, Auth0Context } from "@auth0/auth0-react";
import {
  CurrentProjectMetadataDocument,
  ProjectAccessControlSetting,
  ProjectAccessStatus,
} from "../generated/graphql";
import { MemoryRouter, Router, useHistory } from "react-router";
import { createMemoryHistory } from "history";

export default {
  title: "FormElements/ThankYou",
  component: ThankYou,
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
    respondAgainMessage: {
      control: "text",
      name: "componentSettings.respondAgainMessage",
      description: "componentSettings.respondAgainMessage",
    },
    promptToRespondAgain: {
      control: "boolean",
      name: "componentSettings.promptToRespondAgain",
      description: "componentSettings.promptToRespondAgain",
    },
    shareButtons: {
      control: "boolean",
      name: "componentSettings.shareButtons",
      description: "componentSettings.shareButtons",
    },
    linkToProject: {
      control: "boolean",
      name: "componentSettings.linkToProject",
      description: "componentSettings.linkToProject",
    },
  },
  args: {
    id: 1,
    body: ThankYou.defaultBody,
  },
};

const Template: Story = (args: any) => {
  const history = createMemoryHistory();
  return (
    <Router history={history}>
      <SurveyAppLayout progress={0.4}>
        <ThankYou
          {...args}
          componentSettings={{
            respondAgainMessage: args.respondAgainMessage,
            promptToRespondAgain: args.promptToRespondAgain,
            shareButtons: args.shareButtons,
            linkToProject: args.linkToProject,
          }}
          projectName={"Project A"}
          projectUrl={"https://next.seasket.ch/project_a"}
          surveyUrl={"https://next.seasket.ch/project_a/surveys/1"}
        />
      </SurveyAppLayout>
    </Router>
  );
};

export const Basic = Template.bind({});
export const RespondAgain = Template.bind({});
RespondAgain.args = {
  promptToRespondAgain: true,
  respondAgainMessage: "Submit Another Observation",
  linkToProject: true,
};
export const Social = Template.bind({});
Social.args = {
  shareButtons: true,
  linkToProject: true,
};
