import { ReactNode, useContext, useEffect } from "react";
import { useState } from "react";
import Papa from "papaparse";
import { Trans, useTranslation } from "react-i18next";
import EditorLanguageSelector from "../surveys/EditorLanguageSelector";
import { FormLanguageContext, SurveyContext } from "./FormElement";

export type FormElementOption = {
  value?: string;
  label: string;
};

export default function FormElementOptionsInput({
  prop,
  componentSettings,
  alternateLanguageSettings,
  onChange,
  heading,
  description,
}: {
  prop: string;
  componentSettings?: { [key: string]: any };
  alternateLanguageSettings?: { [lang: string]: { [key: string]: any } };
  onChange: (options: FormElementOption[]) => void;
  heading?: string;
  description?: ReactNode | string;
}) {
  const context = useContext(FormLanguageContext);
  const { t } = useTranslation("admin:surveys");
  let initialValue: FormElementOption[] = (componentSettings || {})[prop] || [];
  if (
    context &&
    context.lang.code !== "EN" &&
    alternateLanguageSettings &&
    alternateLanguageSettings[context.lang.code]
  ) {
    initialValue =
      alternateLanguageSettings[context.lang.code][prop] || initialValue;
  }

  const [state, setState] = useState(toText(initialValue));
  const [optionsState, setOptionsState] = useState(initialValue);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setState(toText(initialValue));
  }, [context?.lang]);

  let valuesSpecified = true;
  if (optionsState.length > 0) {
    for (const option of optionsState) {
      if (!option.value) {
        valuesSpecified = false;
        break;
      }
    }
  }

  let valuesMatch = true;
  if (valuesSpecified && context?.supportedLanguages.length) {
    const valuesString = (
      componentSettings ? componentSettings[prop] || [] : []
    )
      .map((o: FormElementOption) => o.value || "")
      .sort()
      .join(",");
    for (const lang of context.supportedLanguages) {
      if (
        alternateLanguageSettings &&
        alternateLanguageSettings[lang] &&
        alternateLanguageSettings[lang][prop]
      ) {
        const langValuesString = alternateLanguageSettings[lang][prop]
          .map((o: FormElementOption) => o.value || "")
          .sort()
          .join(",");
        valuesMatch = valuesMatch && valuesString === langValuesString;
      }
    }
  }

  return (
    <div className="relative">
      <h3 className="text-sm font-medium text-gray-800 leading-5">
        {heading || <Trans ns="admin:surveys">Options</Trans>}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 mb-2">{description}</p>
      )}
      <p className="text-sm text-gray-500">
        <Trans ns="admin:surveys">
          List options as{" "}
          <code className="font-mono bg-gray-100 p-1 rounded">
            label,value{" "}
          </code>
          each on a new line. Use quotes to escape commas. Values are not
          required but will keep data consistent if text changes are needed.
          Copying data from Google Sheets can help manage longer lists.
        </Trans>
      </p>
      <span></span>
      <textarea
        spellCheck={false}
        className={`mt-1 w-full text-sm text-gray-800 rounded h-24 whitespace-nowrap border-1 ${
          errors.length
            ? "border-red-800 active:ring active:outline-red-800"
            : "border-gray-500"
        }`}
        value={state}
        onChange={(e) => {
          setState(e.target.value);
          const { errors, options, delimiter } = fromText(e.target.value);
          if (errors.length) {
            setErrors(errors);
          } else {
            onChange(options);
            setOptionsState(options);
            if (options.length === 0) {
              setErrors([t("No options specified")]);
            } else {
              setErrors([]);
            }
            if (delimiter !== ",") {
              setState(toText(options));
            }
          }
        }}
      />
      <EditorLanguageSelector />
      {errors.map((e) => (
        <p key={e.toString()} className="text-red-900">
          {e}
        </p>
      ))}
      {!valuesSpecified && (context?.supportedLanguages || []).length > 0 && (
        <p className="text-red-900">
          <Trans ns="admin:surveys">
            To support multiple languages, each option must specify a label and
            a value for all languages!
          </Trans>
        </p>
      )}
      {!valuesMatch && (context?.supportedLanguages || []).length > 0 && (
        <p className="text-red-900">
          <Trans ns="admin:surveys">
            Values do not match between different translations!
          </Trans>
        </p>
      )}{" "}
    </div>
  );
}

function toText(options: FormElementOption[]): string {
  return Papa.unparse(
    options.map((option) =>
      option.value ? [option.label, option.value] : [option.label]
    )
  );
}

function fromText(text: string) {
  let options: FormElementOption[] = [];
  let errors: string[] = [];
  let delimiter: string | undefined = undefined;
  const result = Papa.parse(text, { skipEmptyLines: true });
  if (
    result.errors?.length &&
    result.errors.filter((e) => e.type !== "Delimiter").length
  ) {
    errors = result.errors.map((e) => e.message);
  } else {
    options = result.data.map((r: any) =>
      r.length === 1
        ? { label: r[0].trim() }
        : { label: r[0].trim(), value: r[1].trim() }
    );
    if (options.length === 0) {
      errors = ["No options specified"];
    } else {
      errors = [];
    }
    delimiter = result.meta.delimiter;
  }
  return { options, errors, delimiter };
}
