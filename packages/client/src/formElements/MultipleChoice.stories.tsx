// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story } from "@storybook/react/types-6-0";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import MultipleChoice from "./MultipleChoice";
import { useState } from "react";

export default {
  title: "FormElements/MultipleChoice",
  component: MultipleChoice,
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
    options: MultipleChoice.defaultComponentSettings?.options,
    body: questionBodyFromMarkdown(`
# Which option do you prefer?
`),
  },
};

const Template: Story = (args: any) => {
  const [val, setVal] = useState<any>(args.value);
  return (
    <SurveyAppLayout progress={0.4}>
      <MultipleChoice
        {...args}
        value={val}
        onChange={(value) => setVal(value)}
        componentSettings={{
          options: args.options,
          multipleSelect: args.multipleSelect,
        }}
      />
    </SurveyAppLayout>
  );
};

export const Required = Template.bind({});

export const NotRequired = Template.bind({});
NotRequired.args = {
  isRequired: false,
};

export const SelectedValue = Template.bind({});
SelectedValue.args = {
  value: "C",
};

export const MultipleSelect = Template.bind({});
MultipleSelect.args = {
  multipleSelect: true,
};
