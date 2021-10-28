import { Story } from "@storybook/react/types-6-0";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import YesNo from "./YesNo";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { useState } from "react";

export default {
  title: "FormElements/YesNo",
  component: YesNo,
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
  },
  args: {
    id: 1,
    isRequired: true,
    body: questionBodyFromMarkdown(`
# Would you like fries with that?
`),
  },
};

const Template: Story = (args: any) => {
  const [state, setState] = useState<boolean>();
  return (
    <SurveyAppLayout progress={0.4}>
      <YesNo
        {...args}
        componentSettings={{}}
        onChange={(val) => setState(val)}
        value={state}
      />
    </SurveyAppLayout>
  );
};

export const YesNoQuestion = Template.bind({});
