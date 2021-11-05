import { useEffect } from "react";
import { useState } from "react";
import Papa, { ParseError } from "papaparse";
import { Trans, useTranslation } from "react-i18next";

export type FormElementOption = {
  value?: string;
  label: string;
};

export default function FormElementOptionsInput({
  initialValue,
  onChange,
}: {
  initialValue: FormElementOption[];
  onChange: (options: FormElementOption[]) => void;
}) {
  const [state, setState] = useState(toText(initialValue));
  const [errors, setErrors] = useState<string[]>([]);
  const { t } = useTranslation("admin:surveys");
  useEffect(() => {
    const result = Papa.parse(state, { skipEmptyLines: true });
    if (
      result.errors?.length &&
      result.errors.filter((e) => e.type !== "Delimiter").length
    ) {
      setErrors(result.errors.map((e) => e.message));
    } else {
      const options = result.data.map((r: any) =>
        r.length === 1 ? { label: r[0] } : { label: r[0], value: r[1] }
      );
      onChange(options);
      if (options.length === 0) {
        setErrors([t("No options specified")]);
      } else {
        setErrors([]);
      }
      if (result.meta.delimiter !== ",") {
        setState(toText(options));
      }
    }
  }, [state]);
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-800 leading-5">
        <Trans ns="admin:surveys">Options</Trans>
      </h3>
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
        className={`mt-1 w-full text-sm text-gray-800 rounded h-24 border-1 ${
          errors.length
            ? "border-red-800 active:ring active:outline-red-800"
            : "border-gray-500"
        }`}
        value={state}
        onChange={(e) => setState(e.target.value)}
      />
      {errors.map((e) => (
        <p className="text-red-900">{e}</p>
      ))}
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
