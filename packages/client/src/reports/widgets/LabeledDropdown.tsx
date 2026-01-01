import { ReactNode } from "react";
import {
  TooltipDropdown,
  TooltipDropdownOption,
} from "../../editor/TooltipMenu";

type LabeledDropdownProps = {
  label: string;
  value: string;
  options: TooltipDropdownOption[];
  onChange: (value: string) => void;
  title?: ReactNode;
  ariaLabel?: string;
  getDisplayLabel?: (selected?: TooltipDropdownOption) => ReactNode;
};

/**
 * Reusable component that combines a label with a dropdown.
 * Used for report widget tooltip controls.
 */
export function LabeledDropdown({
  label,
  value,
  options,
  onChange,
  title,
  ariaLabel,
  getDisplayLabel,
}: LabeledDropdownProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-800">
      <span className="font-light text-gray-400 whitespace-nowrap">
        {label}
      </span>
      <TooltipDropdown
        value={value}
        title={title}
        options={options}
        onChange={onChange}
        ariaLabel={ariaLabel}
        getDisplayLabel={getDisplayLabel}
      />
    </div>
  );
}
