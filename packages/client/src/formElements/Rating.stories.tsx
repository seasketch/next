// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story } from "@storybook/react/types-6-0";
import { SurveyAppLayout } from "../surveys/SurveyAppLayout";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import Rating from "./Rating";

export default {
  title: "FormElements/Rating",
  component: Rating,
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
    max: {
      control: "number",
    },
  },
  args: {
    id: 1,
    isRequired: true,
    max: 5,
    body: questionBodyFromMarkdown(`
# How do you like this FormElement?
`),
  },
};

const Template: Story = (args: any) => (
  <SurveyAppLayout progress={0.4}>
    <Rating {...args} componentSettings={{ max: args.max }} />
  </SurveyAppLayout>
);

export const Basic = Template.bind({});

export const TenStars = Template.bind({});

TenStars.args = { max: 10 };
