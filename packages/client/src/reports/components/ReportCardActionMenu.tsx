import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import React from "react";

export type ReportCardActionMenuProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  className?: string;
  triggerClassName?: string;
  children: React.ReactNode;
};

export type ReportCardActionMenuItemProps = {
  icon?: React.ReactNode;
  onSelect?: (event: Event | React.SyntheticEvent) => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

function classNames(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function ReportCardActionMenu(
  props: ReportCardActionMenuProps
): JSX.Element {
  const {
    open,
    onOpenChange,
    label = "Card actions",
    className,
    triggerClassName,
    children,
  } = props;

  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={classNames(
            "p-1 rounded-full",
            open
              ? "text-gray-600 bg-gray-50"
              : " text-gray-400 hover:text-gray-600 hover:bg-gray-50",
            triggerClassName
          )}
          aria-label={label}
          title={label}
        >
          <DotsHorizontalIcon className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={4}
          className={classNames(
            "z-50 min-w-[160px] rounded-md border border-black/5 bg-white p-1 shadow-lg",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item(props: ReportCardActionMenuItemProps): JSX.Element {
  const {
    icon,
    onSelect,
    variant = "default",
    disabled,
    className,
    children,
  } = props;

  const base =
    "flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm outline-none";
  const variantClasses =
    variant === "danger"
      ? "text-red-600 data-[highlighted]:bg-red-50"
      : "text-gray-700 data-[highlighted]:bg-gray-100";

  return (
    <DropdownMenu.Item
      disabled={disabled}
      className={classNames(base, variantClasses, className)}
      onSelect={(e) => {
        // Allow Radix to close the menu; just forward the event
        if (onSelect) {
          onSelect(e);
        }
      }}
    >
      {icon ? (
        <span className="mr-2 h-4 w-4 inline-flex items-center justify-center">
          {icon}
        </span>
      ) : null}
      {children}
    </DropdownMenu.Item>
  );
}

// Attach Item as a static property for namespaced API
ReportCardActionMenu.Item = Item;

export default ReportCardActionMenu;
