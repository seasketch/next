import { ReactNode } from "react";
import * as Menubar from "@radix-ui/react-menubar";
import {
  CheckIcon,
  ChevronRightIcon,
  DotFilledIcon,
} from "@radix-ui/react-icons";

export function MenubarTrigger({
  children,
  dark,
}: {
  children?: ReactNode;
  dark?: boolean;
}) {
  return (
    <Menubar.Trigger
      className={`MenubarTrigger py-2 px-3 outline-none select-none font-medium leading-none rounded ${
        dark
          ? "hover:bg-gray-700 hover:text-blue-100 text-gray-300"
          : "hover:bg-gray-200 hover:text-black text-black"
      }`}
    >
      {children}
    </Menubar.Trigger>
  );
}

export function MenubarRadioItem({
  value,
  children,
}: {
  value: string;
  children?: ReactNode;
}) {
  return (
    <Menubar.RadioItem
      value={value}
      className="RadixDropdownItem text-sm leading-none rounded flex items-center h-6 px-2 relative select-none pl-5 outline-none "
    >
      <Menubar.ItemIndicator className="absolute left-0 w-5 inline-flex items-center justify-center">
        <DotFilledIcon />
      </Menubar.ItemIndicator>
      {children}
    </Menubar.RadioItem>
  );
}

export function MenubarCheckboxItem({
  children,
  checked,
}: {
  children?: ReactNode;
  checked?: boolean;
}) {
  return (
    <Menubar.CheckboxItem
      checked={checked}
      className="RadixDropdownItem text-sm leading-none rounded flex items-center h-6 px-2 relative select-none pl-5 outline-none "
    >
      <Menubar.ItemIndicator className="absolute left-0 w-5 inline-flex items-center justify-center">
        <CheckIcon />
      </Menubar.ItemIndicator>
      {children}
    </Menubar.CheckboxItem>
  );
}

export function MenuBarLabel({ children }: { children?: ReactNode }) {
  return (
    <Menubar.Label className="RadixDropdownItem text-sm leading-none rounded flex items-center h-6 px-2 relative select-none pl-2 outline-none text-gray-500">
      {children}
    </Menubar.Label>
  );
}

export const MenuBarSeparatorProps = {
  className: "bg-black opacity-10 my-1.5 mb-1",
  style: { height: 1 },
};

export function MenuBarSeparator() {
  return <Menubar.Separator {...MenuBarSeparatorProps} />;
}

export const MenuBarContentClasses =
  "z-50 bg-gray-100 bg-opacity-90 rounded shadow-md p-1 border border-black border-opacity-10";

export function MenuBarContent({ children }: { children?: ReactNode }) {
  return (
    <Menubar.Content
      style={{ backdropFilter: "blur(3px)", minWidth: 220 }}
      className={MenuBarContentClasses}
      align="start"
      sideOffset={2}
      alignOffset={-3}
    >
      {children}
    </Menubar.Content>
  );
}

export const MenuBarItemClasses =
  "RadixDropdownItem text-sm leading-none rounded flex items-center h-6 px-2 relative select-none outline-none ";

export function MenuBarItem({
  children,
  onClick,
  disabled,
}: {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Menubar.Item
      onClick={onClick}
      disabled={disabled}
      className={MenuBarItemClasses + " pl-5"}
    >
      {children}
    </Menubar.Item>
  );
}

export function MenuBarSubmenu({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}) {
  return (
    <Menubar.Sub>
      <Menubar.SubTrigger className="RadixDropdownItem text-sm leading-none rounded flex items-center h-6 px-2 relative select-none pl-5">
        {label}
        <div className="ml-auto pl-5">
          <ChevronRightIcon />
        </div>
      </Menubar.SubTrigger>
      <Menubar.Portal>
        <Menubar.SubContent
          style={{ backdropFilter: "blur(3px)", minWidth: 180 }}
          className="z-50 bg-gray-100 bg-opacity-80 rounded shadow-md p-1 px-2 border border-black border-opacity-10"
          sideOffset={5}
          alignOffset={-4}
        >
          {children}
        </Menubar.SubContent>
      </Menubar.Portal>
    </Menubar.Sub>
  );
}
