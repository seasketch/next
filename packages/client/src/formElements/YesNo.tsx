import { CheckIcon, XIcon } from "@heroicons/react/outline";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import EditableResponseCell, {
  CellEditorComponent,
} from "../admin/surveys/EditableResponseCell";
import { SkippedQuestion } from "../admin/surveys/ResponseGrid";
import {
  adminValueInputCommonClassNames,
  FormElementBody,
  FormElementComponent,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import SurveyInputButton from "./SurveyInputButton";

export type YesNoProps = {};

/**
 * Boolean input element
 */
const YesNo: FormElementComponent<YesNoProps, boolean> = (props) => {
  const { t } = useTranslation("surveys");
  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
        alternateLanguageSettings={props.alternateLanguageSettings}
      />
      <div className="w-full max-w-full form-element-short-text pt-1 my-4 space-x-3 rtl:space-x-reverse">
        <SurveyInputButton
          label={t("Yes")}
          Icon={CheckIcon}
          selected={props.value === true}
          onClick={() => props.onChange(true, false, true)}
        />
        <SurveyInputButton
          label={t("No")}
          Icon={XIcon}
          selected={props.value === false}
          onClick={() => props.onChange(false, false, true)}
        />
      </div>
      {/* <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
            </>
          );
        }}
      /> */}
    </>
  );
};

YesNo.label = <Trans>Yes/No</Trans>;
YesNo.description = <Trans>Boolean input</Trans>;
// eslint-disable-next-line i18next/no-literal-string
YesNo.defaultBody = questionBodyFromMarkdown(`
# 
`);
YesNo.advanceAutomatically = true;
YesNo.icon = () => (
  <div className="bg-green-600 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <CheckIcon className="w-2/3" />
  </div>
);

function AdminValueInput({
  value,
  onChange,
  componentSettings,
}: {
  value: any;
  onChange: (value: any) => void;
  componentSettings: YesNoProps;
}) {
  const { t } = useTranslation("admin:surveys");
  return (
    <select
      className={`bg-transparent border-none text-center w-full ${adminValueInputCommonClassNames}`}
      value={value === true ? "TRUE" : "FALSE"}
      onChange={(e) => {
        onChange(e.target.value === "TRUE" ? true : false);
      }}
    >
      <option value="TRUE">{t("Yes")}</option>
      <option value="FALSE">{t("No")}</option>
    </select>
  );
}

YesNo.adminValueInput = AdminValueInput;

YesNo.ResponseGridCell = function ({
  value,
  componentSettings,
  elementId,
  updateValue,
}) {
  return (
    <EditableResponseCell
      elementId={elementId}
      value={value}
      updateValue={updateValue}
      editor={YesNoCellEditor}
      componentSettings={componentSettings}
    >
      {value === undefined || value === null ? (
        <SkippedQuestion />
      ) : value ? (
        <span>
          <Trans ns="admin:surveys">Yes</Trans>{" "}
          <CheckIcon className="w-4 h-4 inline text-green-700" />
        </span>
      ) : (
        <span>
          <Trans ns="admin:surveys">No</Trans>{" "}
          <XIcon className="w-4 h-4 inline text-red-700" />
        </span>
      )}
    </EditableResponseCell>
  );
};

export const YesNoCellEditor: CellEditorComponent<
  boolean | undefined | null,
  YesNoProps
> = ({
  value,
  disabled,
  onChange,
  onRequestSave,
  onRequestCancel,
  componentSettings,
}) => {
  const [val, setVal] = useState(value);

  useEffect(() => {
    onChange(val);
  }, [val]);

  return (
    <select
      onChange={(e) => setVal(e.target.value === "true")}
      value={val ? "true" : "false"}
      className="p-0 px-1 rounded  text-sm w-full"
    >
      <option value="true">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {"Yes"}
      </option>
      <option value="false">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {"No"}
      </option>
    </select>
  );
};

export default YesNo;
