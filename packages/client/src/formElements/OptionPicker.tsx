import { CheckIcon } from "@heroicons/react/outline";
import { FormElementOption } from "./FormElementOptionsInput";
import SurveyInputButton from "./SurveyInputButton";

interface PropsSingle {
  value?: string;
  multi: false;
  options: FormElementOption[];
  onChange: (value: string | undefined) => void;
}

interface PropsMulti {
  value?: string[];
  multi: true;
  options: FormElementOption[];
  onChange: (value: string[]) => void;
}

export default function OptionPicker({
  options,
  multi,
  value,
  onChange,
}: PropsSingle | PropsMulti) {
  return (
    <div>
      <div className="py-4 pb-6 space-y-2 flex flex-col">
        {(options || []).map((option) => {
          const selected = multi
            ? value?.indexOf(option.value || option.label) !== -1
            : value === (option.value || option.label);
          return (
            <SurveyInputButton
              key={option.value || option.label}
              className={"w-full text-left rtl:text-right"}
              label={option.label}
              iconPlacement={multi ? "left" : "right"}
              Icon={
                multi
                  ? selected
                    ? CheckIcon
                    : (props) => (
                        <div
                          className={`inline transform scale-75 border rounded border-opacity-50 ${props.className}`}
                        ></div>
                      )
                  : selected
                  ? CheckIcon
                  : (props) => null
              }
              selected={selected}
              onClick={() => {
                if (multi) {
                  const newVal = selected
                    ? ((value || []) as string[]).filter(
                        (v) => v !== (option.value || option.label)
                      )
                    : [...(value || []), option.value || option.label];

                  (onChange as (value: string[]) => void)(
                    newVal.length ? newVal : []
                  );
                } else {
                  if (selected) {
                    (onChange as (value: string | undefined) => void)(
                      undefined
                    );
                  } else {
                    (onChange as (value: string) => void)(
                      option.value || option.label
                    );
                  }
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
