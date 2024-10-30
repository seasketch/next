import { CheckIcon, FilterIcon } from "@heroicons/react/outline";
import { useContext, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import EditableResponseCell from "../admin/surveys/EditableResponseCell";
import Badge from "../components/Badge";
import Button from "../components/Button";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import useDialog from "../components/useDialog";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  FormLanguageContext,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { GeostatsAttribute } from "@seasketch/geostats-types";

export type FilterServiceMetadata = {
  version: number;
  attributes: GeostatsAttribute[];
};

export type FilterInputProps = {
  attribute: string;
};
export type FilterInputValue = {
  selected: boolean;
  numberState?: {
    min?: number;
    max?: number;
  };
  stringState?: string[];
  booleanState?: boolean;
};

const FilterInput: FormElementComponent<FilterInputProps, FilterInputValue> = (
  props
) => {
  const { t } = useTranslation("surveys");
  const context = useContext(FormLanguageContext);
  // const options = useLocalizedComponentSetting(
  //   "options",
  //   props
  // ) as FormElementOption[];
  const { confirm } = useDialog();

  // useEffect(() => {
  //   if (props.isRequired && (!props.value || props.value.length === 0)) {
  //     props.onChange(props.value, true);
  //   }
  // }, []);

  // const noValue = props.componentSettings.multipleSelect
  //   ? !props.value || props.value.length === 0
  //   : !props.value;
  return (
    <>
      <div className="w-full flex items-center h-0 justify-end relative overflow-visible z-10 mt-2">
        {!Boolean(props.value?.selected) && (
          <div className="flex-1 prosemirror-body">
            <h1 data-question="yes">{props.body.content[0].content[0].text}</h1>
          </div>
        )}
        <Switch
          className="transform scale-75"
          isToggled={Boolean(props.value?.selected)}
          onClick={(val) => {
            props.onChange(
              {
                ...props.value,
                selected: val,
              },
              false,
              false
            );
          }}
        />
      </div>

      <>
        {Boolean(props.value?.selected) && (
          <div style={{ marginTop: -10, marginBottom: 10 }}>
            <FormElementBody
              formElementId={props.id}
              isInput={true}
              body={props.body}
              required={props.isRequired}
              editable={props.editable && Boolean(props.value?.selected)}
              alternateLanguageSettings={props.alternateLanguageSettings}
            />
          </div>
        )}

        {/* {props.value?.selected && (
          <div className="block sm:inline-block">
            <div className="py-4 pb-6 space-y-2 flex flex-col">
              {props.componentSettings.attribute}
            </div>
          </div>
        )} */}
      </>

      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return <></>;
        }}
      />
    </>
  );
};

FilterInput.label = <Trans ns="admin:surveys">Filter Input</Trans>;
FilterInput.description = (
  <Trans ns="admin:surveys">Filter planning units by attribute</Trans>
);
FilterInput.defaultBody = questionBodyFromMarkdown(`
# 
`);
FilterInput.defaultComponentSettings = {
  attribute: "",
};
FilterInput.advanceAutomatically = false;

FilterInput.icon = () => (
  <div className="bg-blue-600 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <FilterIcon className="w-5 h-5" />
  </div>
);

FilterInput.templatesOnly = true;

export default FilterInput;
