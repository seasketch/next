// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story } from "@storybook/react/types-6-0";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import ComboBox from "./ComboBox";
import { useState } from "react";

export default {
  title: "FormElements/ComboBox",
  component: ComboBox,
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
  },
  args: {
    id: 1,
    isRequired: true,
    options: ComboBox.defaultComponentSettings?.options,
    body: questionBodyFromMarkdown(`
# Which option do you prefer?
`),
  },
};

const Template: Story = (args: any) => {
  const [val, setVal] = useState<any>(args.value);
  return (
    <SurveyAppLayout progress={0.4}>
      <ComboBox
        {...args}
        value={val}
        onChange={(value) => setVal(value)}
        componentSettings={{
          options: args.options,
          autoSelectFirstOptionInList: args.autoSelectFirstOptionInList,
        }}
      />
    </SurveyAppLayout>
  );
};

export const Required = Template.bind({});
export const FirstOptionDefaultSelected = Template.bind({});
FirstOptionDefaultSelected.args = {
  autoSelectFirstOptionInList: true,
};

export const NotRequired = Template.bind({});
NotRequired.args = {
  isRequired: false,
};

export const SelectedValue = Template.bind({});
SelectedValue.args = {
  value: "c",
};
