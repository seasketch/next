import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  adminValueInputCommonClassNames,
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
  useLocalizedComponentSetting,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { useCombobox } from "downshift";
import { SearchIcon, SelectorIcon } from "@heroicons/react/outline";
import FormElementOptionsInput, {
  FormElementOption,
} from "./FormElementOptionsInput";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import { XIcon } from "@heroicons/react/outline";
import Button from "../components/Button";
import { FormElementLayoutContext } from "../surveys/SurveyAppLayout";
import { SkippedQuestion } from "../admin/surveys/ResponseGrid";
import Badge from "../components/Badge";
import EditableResponseCell, {
  CellEditorComponent,
} from "../admin/surveys/EditableResponseCell";
import { MultipleChoiceProps, MultipleChoiceValue } from "./MultipleChoice";
import useDialog from "../components/useDialog";

export type ComboBoxProps = {
  options?: FormElementOption[];
  placeholder?: string;
  autoSelectFirstOptionInList?: boolean;
};

export type ComboBoxValue = string | null;

const ComboBox: FormElementComponent<ComboBoxProps, ComboBoxValue> = (
  props
) => {
  const { t } = useTranslation("surveys");
  const items: FormElementOption[] =
    useLocalizedComponentSetting("options", props) || [];
  const [choices, setChoices] = useState<string[]>(items.map((i) => i.label));
  const [selectedOption, setSelectedOption] = useState<
    FormElementOption | undefined | null
  >();
  const context = useContext(SurveyContext);

  useEffect(() => {
    setChoices(items.map((i) => i.label));
  }, [context?.lang]);

  function onChange(value: string | null | undefined) {
    if (value === null) {
      props.onChange(null, props.isRequired);
    } else if (value === undefined) {
      props.onChange(undefined, props.isRequired);
    } else {
      props.onChange(value, false);
    }
  }

  const [inputValue, setInputValue] = useState<string>("");
  useEffect(() => {
    if (props.value) {
      const item = items.find((i) => (i.value || i.label) === props.value);
      setSelectedOption(item);
      setInputValue(item?.label || "");
    } else {
      setSelectedOption(null);
    }
  }, [props.value]);

  useEffect(() => {
    if (
      (props.value === undefined || (props.value === null && props.editable)) &&
      props.componentSettings.autoSelectFirstOptionInList
    ) {
      onChange(items[0].value || items[0].label);
    }
    if (
      props.editable &&
      !props.componentSettings.autoSelectFirstOptionInList &&
      items[0] &&
      props.value === (items[0].value || items[0].label)
    ) {
      onChange(null);
      setInputValue("");
    }
  }, [props.componentSettings.autoSelectFirstOptionInList]);

  const style = useContext(FormElementLayoutContext).style;
  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    openMenu,
    closeMenu,
    getInputProps,
    getComboboxProps,
    highlightedIndex,
    getItemProps,
  } = useCombobox({
    inputValue,
    selectedItem: selectedOption?.label || null,
    items: choices,
    onInputValueChange: (e) => {
      if (e.type === useCombobox.stateChangeTypes.InputChange) {
        const inputValue = e.inputValue;
        if (inputValue) {
          setChoices(
            items
              .filter((item) =>
                item.label.toLowerCase().startsWith(inputValue.toLowerCase())
              )
              .map((i) => i.label)
          );
        } else {
          setChoices(items.map((i) => i.label));
        }
        if (selectedOption && selectedOption.label !== inputValue) {
          setSelectedOption(null);
          setChoices(items.map((i) => i.label));
          onChange(null);
        }
        setInputValue(e.inputValue || "");
      }
    },
    onSelectedItemChange: ({ selectedItem }) => {
      const item = items.find((i) => i.label === selectedItem);
      onChange(item?.value || item?.label || null);
    },
  });

  const input = (
    <div
      className={`sm:w-96 mb-4 mt-4 relative w-full ${
        style.isSmall && "hidden"
      }`}
    >
      <div
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        className={`bg-white rounded w-full text-black ${
          style.compactAppearance ? "border-gray-300 border shadow-sm" : ""
        } relative flex justify-center ${
          getComboboxProps()["aria-expanded"]
            ? "ring ring-blue-200 ring-opacity-50"
            : ""
        }`}
        {...getComboboxProps()}
        style={{
          background: `linear-gradient(white 50%, rgba(255, 255, 255, 0.85) 100%)`,
        }}
      >
        <input
          spellCheck={false}
          className={`flex-1 p-2 px-3 ring-0 outline-none rounded-l bg-transparent ${
            selectedOption?.label === inputValue
              ? "text-black"
              : "text-gray-500"
          }`}
          {...getInputProps({})}
          placeholder={
            props.isRequired && props.submissionAttempted
              ? t("Selection required", { ns: "surveys" })
              : props.componentSettings.placeholder ||
                t("Select an option...", { ns: "surveys" })
          }
        />
        {(selectedOption || inputValue.length > 0) && (
          <button
            onClick={(e) => {
              onChange(null);
              setInputValue("");
              setChoices(items.map((i) => i.label));
              e.preventDefault();
              e.stopPropagation();
            }}
            type="button"
            aria-label="clear value"
            className=""
          >
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        )}
        <button
          type="button"
          {...getToggleButtonProps()}
          aria-label="toggle menu"
          className="p-2"
        >
          <SelectorIcon className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      <ul
        {...getMenuProps()}
        className={`max-h-72 overflow-y-auto max-w-full absolute bg-white text-gray-800 w-96 shadow-xl mt-2 z-10 rounded`}
      >
        {isOpen &&
          choices.map((item, index) => (
            <li
              className={`px-3 py-2 ${
                highlightedIndex === index
                  ? "bg-primary-500 text-white"
                  : "text-black"
              }`}
              key={`${item}${index}`}
              {...getItemProps({ item, index })}
            >
              {item}
            </li>
          ))}
      </ul>
    </div>
  );

  const selectInput = (
    <div>
      <select
        className="text-gray-800 rounded w-full mt-2 mb-4 focus:ring-2 focus:ring-blue-300 outline-none "
        value={
          items.find((i) => (i.value || i.label) === props.value)?.label || ""
        }
        onChange={(e) => {
          const item = items.find((i) => i.label === e.target.value);
          let value: string | undefined | null = item?.value || item?.label;
          if (e.target.value === "__UNDEFINED__") {
            value = undefined;
          } else if (e.target.value === "__NULL__") {
            value = null;
          }
          // @ts-ignore
          onChange(value);
        }}
      >
        {!props.isRequired && <option value="__NULL__">&nbsp;</option>}
        {props.isRequired && <option value="__UNDEFINED__">&nbsp;</option>}
        {items.map((i) => (
          <option key={i.label} value={i.label}>
            {i.label}
          </option>
        ))}
      </select>
    </div>
  );

  const { confirm } = useDialog();
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
      {input}
      {style.isSmall && selectInput}
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <InputBlock
                labelType="small"
                title={t("Auto-select first option", { ns: "admin:surveys" })}
                input={
                  <Switch
                    isToggled={
                      !!props.componentSettings?.autoSelectFirstOptionInList
                    }
                    onClick={updateComponentSetting(
                      "autoSelectFirstOptionInList",
                      props.componentSettings
                    )}
                  />
                }
              />

              <Button
                small
                onClick={async () => {
                  if (
                    await confirm(
                      t(
                        "Are you sure? You can change the element type back to ComboBox later if you like.",
                        { ns: "admin:surveys" }
                      )
                    )
                  ) {
                    updateBaseSetting("typeId")("MultipleChoice");
                  }
                }}
                label={t("Change to Multiple Choice", { ns: "admin:surveys" })}
              />
              <FormElementOptionsInput
                prop="options"
                componentSettings={props.componentSettings}
                alternateLanguageSettings={props.alternateLanguageSettings}
                onChange={updateComponentSetting(
                  "options",
                  props.componentSettings,
                  context?.lang.code,
                  props.alternateLanguageSettings
                )}
              />
            </>
          );
        }}
      />
    </>
  );
};

ComboBox.label = <Trans ns="admin:surveys">Combo Box</Trans>;
ComboBox.description = (
  <Trans ns="admin:surveys">For large lists of options</Trans>
);
ComboBox.defaultBody = questionBodyFromMarkdown(`
# Choices, choices

Use a combo box when you have a long list of choices and it's necessary to be able to search using the keyboard. Note that in most cases a Choice field is a better solution. Dropdowns have many UX issues, [especially on mobile](https://www.lukew.com/ff/entry.asp?1950).

On small mobile devices, the native *select* input of the operating system will be shown.
`);
ComboBox.defaultComponentSettings = {
  options: ["a", "b", "c", "d"].map((str) => ({
    // eslint-disable-next-line i18next/no-literal-string
    label: `Option ${str.toUpperCase()}`,
    value: str,
  })),
};

ComboBox.icon = () => (
  <div className="bg-blue-500 w-full h-full font-bold text-center flex justify-center items-center text-white">
    {/*eslint-disable-next-line i18next/no-literal-string*/}
    <SearchIcon className="w-2/3 h-2/3" />
    {/* <span className="text-2xl">T</span> */}
  </div>
);

export function ChoiceAdminValueInput({
  value,
  onChange,
  componentSettings,
  optionsProp,
}: {
  value: any;
  onChange: (value: any) => void;
  componentSettings: any;
  optionsProp?: string;
}) {
  const { t } = useTranslation("admin:surveys");
  return (
    <select
      className={`bg-transparent border-none text-center w-full ${adminValueInputCommonClassNames}`}
      value={value || "NULL"}
      onChange={(e) => {
        onChange(e.target.value === "NULL" ? null : e.target.value);
      }}
    >
      {value === null && <option value="NULL"> </option>}
      {(
        (componentSettings[optionsProp || "options"] ||
          []) as FormElementOption[]
      )?.map((option) => (
        <option key={option.label} value={option.value || option.label}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

ComboBox.adminValueInput = ChoiceAdminValueInput;

ComboBox.ResponseGridCell = function ({
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
      editor={SingleSelectCellEditor}
      componentSettings={componentSettings}
    >
      {value === null || value === undefined ? (
        <SkippedQuestion />
      ) : (
        <div className="space-x-1">
          {(componentSettings.options || [])
            .filter((o) => value === (o.value || o.label))
            .map((option) => (
              <Badge key={option.label}>{option.label}</Badge>
            ))}
        </div>
      )}
    </EditableResponseCell>
  );
};

export const SingleSelectCellEditor: CellEditorComponent<
  ComboBoxValue | MultipleChoiceValue | undefined,
  ComboBoxProps & MultipleChoiceProps
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
      className="p-0 px-1 rounded  text-sm w-full"
      value={val || ""}
      onChange={(e) => {
        if (componentSettings.multipleSelect) {
          const selected: string[] = [];
          var options = e.target.options;
          for (var i = 0, l = options.length; i < l; i++) {
            if (options[i].selected) {
              selected.push(options[i].value);
            }
          }
          setVal(selected);
        } else {
          setVal(e.target.value);
        }
      }}
      multiple={componentSettings.multipleSelect}
    >
      {(componentSettings.options || []).map((option) => (
        <option value={option.value || option.label}>{option.label}</option>
      ))}
    </select>
  );
};

export default ComboBox;
