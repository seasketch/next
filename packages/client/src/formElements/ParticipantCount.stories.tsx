// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story } from "@storybook/react/types-6-0";
import { useState } from "react";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import ParticipantCount from "./ParticipantCount";

export default {
  title: "FormElements/ParticpantCount",
  component: ParticipantCount,
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
  },
  args: {
    id: 1,
    isRequired: true,
    body: questionBodyFromMarkdown(`
# Is this a group response representing more than one person?
`),
  },
};

const Template: Story = (args: any) => {
  const [value, setValue] = useState<number>(args.value);
  console.log("top level value", value);
  return (
    <SurveyAppLayout progress={0.4}>
      <ParticipantCount
        {...args}
        onChange={setValue}
        value={value}
        componentSettings={{
          ...ParticipantCount.defaultComponentSettings,
          ...args,
        }}
      />
    </SurveyAppLayout>
  );
};

export const Basic = Template.bind({});
Basic.args = {};

export const ValidationError = Template.bind({});
ValidationError.args = {
  max: 50,
  value: 100,
};
