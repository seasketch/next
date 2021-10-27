import { KeyboardEventHandler } from "react";

export interface NumberInputOptions {
  /** Required id of input. Also referenced by labels. */
  name: string;
  /** This is a _controlled_ input so a value is required. */
  value?: number | null;
  disabled?: boolean;
  onChange?: (value: number | null) => any;
  autoFocus?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

export default function NumberInput(props: NumberInputOptions) {
  const {
    value,
    name,
    disabled,
    onChange,
    required,
    min,
    max,
    placeholder,
  } = props;

  return (
    <div className="w-24 relative rounded-md shadow-sm">
      <input
        autoFocus={!!props.autoFocus}
        type="number"
        name={name}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(e) =>
          onChange &&
          onChange(
            e.target.value && e.target.value.length
              ? parseInt(e.target.value)
              : null
          )
        }
        onKeyDown={props.onKeyDown}
        disabled={disabled}
        required={required}
        className={` w-24 block border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black  ${
          disabled && "text-gray-500 bg-gray-100"
        }`}
        value={value?.toString() || ""}
      />
    </div>
  );
}
