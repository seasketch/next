import { ReactNode } from "react";
import * as Menubar from "@radix-ui/react-menubar";
import { ChevronRightIcon, DotFilledIcon } from "@radix-ui/react-icons";

export function MenubarTrigger({ children }: { children?: ReactNode }) {
  return (
    <Menubar.Trigger className="MenubarTrigger py-2 px-3 outline-none select-none font-medium leading-none rounded hover:bg-gray-200">
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

export function MenuBarSeparator() {
  return (
    <Menubar.Separator
      style={{ height: 1 }}
      className="bg-black opacity-10 my-1.5 mb-1"
    />
  );
}

export function MenuBarContent({ children }: { children?: ReactNode }) {
  return (
    <Menubar.Content
      style={{ backdropFilter: "blur(3px)", minWidth: 220 }}
      className="z-50 bg-gray-100 bg-opacity-80 rounded shadow-md p-1 px-2 border border-black border-opacity-10"
      align="start"
      sideOffset={2}
      alignOffset={-3}
    >
      {children}
    </Menubar.Content>
  );
}

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
      className="RadixDropdownItem text-sm leading-none rounded flex items-center h-6 px-2 relative select-none pl-5 outline-none "
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
