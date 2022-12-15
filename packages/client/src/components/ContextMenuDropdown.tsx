import { createPortal } from "react-dom";
import { DropdownOption } from "./DropdownButton";
import { usePopper } from "react-popper";
import { ReactNode, useMemo, useState } from "react";

function classNames(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function ContextMenuDropdown({
  options,
  target,
  offsetX,
}: {
  options: (DropdownOption | { id: string; label?: string | ReactNode })[];
  target: HTMLElement;
  offsetX?: number;
}) {
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );

  const customModifier = useMemo(
    () => ({
      name: "offset",
      options: {
        offset: () => {
          return [offsetX, 0];
        },
      },
    }),
    [offsetX]
  );
  const { styles, attributes } = usePopper(target, popperElement, {
    placement: "bottom-start",
    modifiers: [customModifier],
  });
  return createPortal(
    <div
      ref={setPopperElement}
      className={`z-50 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none`}
      style={{
        ...styles.popper,
      }}
      {...attributes.popper}
    >
      <div className="py-1">
        {options.map((props, i) => {
          if (!isDropdownOption(props)) {
            return <DropdownDivider key={props.id} label={props.label} />;
          }
          const { label, disabled, onClick } = props;
          return (
            <span
              key={typeof label === "string" ? label : i}
              className="block group w-full"
            >
              <button
                disabled={disabled}
                onClick={onClick}
                className={classNames(
                  "group",
                  "group-hover:bg-gray-100 group-hover:text-gray-900 text-gray-700",
                  "block px-4 py-2 text-sm w-full text-left",
                  disabled ? "pointer-events-none opacity-50" : ""
                )}
              >
                {label}
              </button>
            </span>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

export function DropdownDivider({ label }: { label?: string | ReactNode }) {
  return (
    <>
      <hr className="text-gray-600 border-t border-gray-200 mt-2 mb-2" />
      {label && (
        <span className="text-xs font-light py-2 px-4 text-gray-500">
          {label}
        </span>
      )}
    </>
  );
}

export interface DropdownDividerProps {
  id: string;
  label?: string | ReactNode;
}

function isDropdownOption(
  props: DropdownDividerProps | DropdownOption
): props is DropdownOption {
  return "onClick" in props;
}
