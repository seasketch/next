import { ReactNode } from "react";

/**
 * When disabled, visually obscures cell contents (e.g. when survey response access is limited).
 * Use with metadata on columns to leave id / timestamps readable.
 */
export default function ResponseGridCellBlur({
  disabled,
  children,
}: {
  disabled: boolean;
  children: ReactNode;
}) {
  if (!disabled) {
    return <>{children}</>;
  }
  return (
    <span
      className="inline-flex max-w-full min-w-0 blur-sm select-none pointer-events-none opacity-90"
      aria-hidden
    >
      {children}
    </span>
  );
}
