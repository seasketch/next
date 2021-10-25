import { Story } from "@storybook/react/types-6-0";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import Email from "./Email";
import { questionBodyFromMarkdown } from "./fromMarkdown";

export default {
  title: "FormElements/Email",
  component: Email,
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
  },
  args: {
    id: 1,
    isRequired: true,
    placeholder: "me@example.com",
    body: questionBodyFromMarkdown(`
# What is your email?
`),
  },
};

const Template: Story = (args: any) => (
  <SurveyAppLayout progress={0.4}>
    <Email
      {...args}
      componentSettings={{
        placeholder: args.placeholder,
      }}
    />
  </SurveyAppLayout>
);

export const EmailElement = Template.bind({});
EmailElement.args = {
  placeholder: "me@example.com",
};

export const ValidationError = Template.bind({});
ValidationError.args = {
  value: "me_at_example.com",
  submissionAttempted: true,
};
