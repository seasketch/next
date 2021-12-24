import { StarIcon } from "@heroicons/react/solid";
import { ReactNode, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  adminValueInputCommonClassNames,
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
require("./SAPRange.css");

export type SAPRangeProps = {
  min?: number;
  max?: number;
  step?: number;
  highText?: string | ReactNode;
  averageText?: string | ReactNode;
  lowText?: string | ReactNode;
};

const SAPRange: FormElementComponent<SAPRangeProps, number> = (props) => {
  const { t } = useTranslation("surveys");
  const { min, max, step, highText, averageText, lowText } = {
    ...(SAPRange.defaultComponentSettings as {
      min: number;
      max: number;
      step: number;
    }),
    ...props,
    highText: t("High"),
    averageText: t("Average"),
    lowText: t("Low"),
  };
  const [state, setState] = useState({
    hovered: 0,
    selected: props.value || 0,
  });

  useEffect(() => {
    if (props.value === undefined) {
      props.onChange(Math.round((max - min) / 2), false);
    }
  }, []);

  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
      />
      <div className="py-4 pb-6 space-x-1">
        <input
          className="w-full SAPRange"
          type="range"
          value={props.value}
          onChange={(e) => props.onChange(parseInt(e.target.value), false)}
          min={min}
          max={max}
          step={step}
        />
        <div className="flex">
          <div className="flex-1">{lowText}</div>
          <div className="flex-1 text-center">{averageText}</div>
          <div className="flex-1 text-right">{highText}</div>
        </div>
      </div>
      {/* <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return <></>;
        }}
      /> */}
    </>
  );
};

SAPRange.defaultComponentSettings = {
  min: 0,
  max: 100,
  step: 5,
};

SAPRange.label = <Trans ns="admin:surveys">SAPRange</Trans>;
SAPRange.description = <Trans>Numeric saprange</Trans>;
SAPRange.defaultBody = questionBodyFromMarkdown(`
# 
`);

SAPRange.icon = () => (
  <div className="bg-yellow-200 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <StarIcon className="w-2/3 text-yellow-600" />
  </div>
);

SAPRange.adminValueInput = function ({
  value,
  onChange,
  componentSettings,
}: {
  value: any;
  onChange: (value: any) => void;
  componentSettings: SAPRangeProps;
}) {
  const stars = Array.from(Array(componentSettings.max || 5).keys()).map(
    (i) => i + 1
  );
  return (
    <select
      className={`bg-transparent border-none text-center w-full ${adminValueInputCommonClassNames}`}
      value={value || "NULL"}
      onChange={(e) => onChange(parseInt(e.target.value))}
    >
      {value === null && <option value="NULL"> </option>}
      {stars.map((star) => (
        <option key={star} value={star}>
          {star}
        </option>
      ))}
    </select>
  );
};

export default SAPRange;
