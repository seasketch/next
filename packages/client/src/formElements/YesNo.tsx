import { CheckIcon, XIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import {
  adminValueInputCommonClassNames,
  FormElementBody,
  FormElementComponent,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import SurveyButton from "./SurveyButton";

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
      />
      <div className="w-full max-w-full form-element-short-text pt-1 my-4 space-x-3">
        <SurveyButton
          label={t("Yes")}
          Icon={CheckIcon}
          selected={props.value === true}
          onClick={() => props.onChange(true, false)}
        />
        <SurveyButton
          label={t("No")}
          Icon={XIcon}
          selected={props.value === false}
          onClick={() => props.onChange(false, false)}
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

export default YesNo;