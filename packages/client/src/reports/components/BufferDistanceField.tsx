import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Switch from "../../components/Switch";
import clsx from "clsx";
import * as Popover from "@radix-ui/react-popover";
import { InfoCircledIcon } from "@radix-ui/react-icons";

type BufferDistanceFieldProps = {
  value?: number | null;
  onChange: (value?: number) => void;
  className?: string;
  /**
   * Custom label text. Defaults to "Apply buffer".
   */
  label?: string;
  /**
   * Custom description text. Defaults to generic guidance.
   */
  description?: string;
  /**
   * Minimum allowed distance in meters. Defaults to 1m.
   */
  min?: number;
};

const DEFAULT_BUFFER_METERS = 50;

export default function BufferDistanceField({
  value,
  onChange,
  className,
  label,
  description,
  min = 1,
}: BufferDistanceFieldProps) {
  const { t } = useTranslation("admin:sketching");
  const [isEnabled, setIsEnabled] = useState(
    typeof value === "number" && value > 0
  );
  const [inputValue, setInputValue] = useState(
    typeof value === "number" && value > 0 ? String(value) : ""
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    const nextEnabled = typeof value === "number" && value > 0;
    setIsEnabled(nextEnabled);
    if (nextEnabled && typeof value === "number") {
      setInputValue(String(value));
    }
    if (!nextEnabled && value === undefined) {
      setInputValue("");
    }
  }, [value]);

  const handleToggle = (nextEnabled: boolean) => {
    setIsEnabled(nextEnabled);
    if (!nextEnabled) {
      setInputValue("");
      onChange(undefined);
      return;
    }
    const nextValue =
      typeof value === "number" && value > 0 ? value : DEFAULT_BUFFER_METERS;
    setInputValue(String(nextValue));
    onChange(nextValue);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setInputValue(inputValue);
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed >= min) {
      onChange(parsed);
    }
  };

  return (
    <div className={clsx("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <label className="text-sm font-medium text-gray-900">
              {label ?? t("Apply buffer")}
            </label>
            <Popover.Root open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  onMouseEnter={() => setIsPopoverOpen(true)}
                  onMouseLeave={() => setIsPopoverOpen(false)}
                >
                  <InfoCircledIcon className="w-4 h-4" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="w-80 rounded-lg bg-white p-4 shadow-lg border border-gray-200 z-50"
                  sideOffset={5}
                  onMouseEnter={() => setIsPopoverOpen(true)}
                  onMouseLeave={() => setIsPopoverOpen(false)}
                >
                  <p className="text-sm text-gray-700">
                    {t(
                      "Buffers should only be used to capture overlap with features outside of the sketch geography. For example, intertidal areas on shore that would not overlap the sketch."
                    )}
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    {t(
                      "Otherwise there is a chance that sketches split into multiple fragments across the antimeridian or geography bounds would result in double-counting where their buffered areas overlap each other."
                    )}
                  </p>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-prose">
            {description ??
              t(
                "Buffer the sketch before measuring overlap. Distance is applied in meters."
              )}
          </p>
        </div>
        <Switch isToggled={isEnabled} onClick={handleToggle} />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          step="1"
          className="w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
          value={isEnabled ? inputValue : ""}
          onChange={handleInputChange}
          disabled={!isEnabled}
          placeholder={t("Enter meters")}
        />
        <span className="text-sm text-gray-600">{t("meters")}</span>
      </div>
    </div>
  );
}
