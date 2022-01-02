import { useContext, useEffect, useState, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  adminValueInputCommonClassNames,
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { useCombobox, UseComboboxStateChangeTypes } from "downshift";
import { SearchIcon, SelectorIcon } from "@heroicons/react/outline";
import { SurveyStyleContext } from "../surveys/appearance";
import FormElementOptionsInput, {
  FormElementOption,
} from "./FormElementOptionsInput";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import { XIcon } from "@heroicons/react/outline";
import Button from "../components/Button";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";

export type ComboBoxProps = {
  options?: FormElementOption[];
  placeholder?: string;
  autoSelectFirstOptionInList?: boolean;
};

const ComboBox: FormElementComponent<ComboBoxProps, string | null> = (
  props
) => {
  const { t } = useTranslation("surveys");
  const items = props.componentSettings.options || [];
  const [choices, setChoices] = useState<string[]>(items.map((i) => i.label));
  const [selectedOption, setSelectedOption] = useState<
    FormElementOption | undefined | null
  >();

  function onChange(value: string | null) {
    if (value === null) {
      props.onChange(null, props.isRequired);
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

  console.warn("inputValue", inputValue);

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
      props.value === (items[0].value || items[0].label)
    ) {
      onChange(null);
      setInputValue("");
    }
  }, [props.componentSettings.autoSelectFirstOptionInList]);

  const style = useContext(SurveyLayoutContext).style;
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
        className={`bg-white rounded w-full text-black relative flex justify-center ${
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
        className={`max-h-72 overflow-y-scroll max-w-full absolute bg-white text-gray-800 w-96 shadow-xl mt-2 z-10 rounded`}
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
          onChange(item?.value || item?.label || null);
        }}
      >
        {!props.isRequired && <option value="__NULL__">&nbsp;</option>}
        {items.map((i) => (
          <option key={i.label} value={i.label}>
            {i.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
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
                      !!props.componentSettings.autoSelectFirstOptionInList
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
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        "Are you sure? You can change the element type back to ComboBox later if you like."
                      )
                    )
                  ) {
                    updateBaseSetting("typeId")("MultipleChoice");
                  }
                }}
                label={t("Change to Multiple Choice")}
              />
              <FormElementOptionsInput
                initialValue={props.componentSettings.options || []}
                onChange={updateComponentSetting(
                  "options",
                  props.componentSettings
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
ComboBox.description = <Trans>For large lists of options</Trans>;
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
}: {
  value: any;
  onChange: (value: any) => void;
  componentSettings: { options?: FormElementOption[] };
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
      {componentSettings.options?.map((option) => (
        <option key={option.label} value={option.value || option.label}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

ComboBox.adminValueInput = ChoiceAdminValueInput;

export default ComboBox;
