/* eslint-disable i18next/no-literal-string */
/* This example requires Tailwind CSS v2.0+ */
import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/solid";

function classNames(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export interface DropdownOption {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}

interface DropdownButtonProps {
  disabled?: boolean;
  label: string;
  options: DropdownOption[];
  className?: string;
  small?: boolean;
}

export default function DropdownButton({
  disabled,
  label,
  options,
  className,
  small,
}: DropdownButtonProps) {
  return (
    <Menu
      as="div"
      className={classNames("relative inline-block text-left", className)}
    >
      <div>
        <Menu.Button
          disabled={disabled}
          className={classNames(
            small ? "px-2 py-0.5" : "px-4 py-2",
            "inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm bg-white text-sm font-medium text-gray-700  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-primary-500",
            disabled ? "opacity-50 cursor-default" : "hover:bg-gray-50"
          )}
        >
          {label}
          <ChevronDownIcon
            className={classNames(
              small ? "-mr-1 mt-0.5 ml-1 h-4 w-4" : "-mr-1 ml-2 h-5 w-5"
            )}
            aria-hidden="true"
          />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="py-1">
            {options.map(({ label, onClick, disabled }) => (
              <Menu.Item key={label} disabled={disabled}>
                {({ active }) => (
                  <button
                    onClick={onClick}
                    className={classNames(
                      active ? "bg-gray-100 text-gray-900" : "text-gray-700",
                      "block px-4 py-2 text-sm w-full text-left",
                      disabled ? "pointer-events-none opacity-50" : ""
                    )}
                  >
                    {label}
                  </button>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
