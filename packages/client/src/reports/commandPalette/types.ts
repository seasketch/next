import { ReactNode } from "react";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

export type CommandPaletteGroup = {
  id: string;
  label: string;
  items: CommandPaletteItem[];
};

export type CommandPaletteItem = {
  id: string;
  label: string;
  description?: string;
  muted?: boolean;
  /**
   * When true, children / customPopoverContent will be shown on hover
   * instead of requiring a click to activate.
   */
  activateOnHover?: boolean;
  /**
   * Optional React element rendered at the top of the popover header,
   * above the processing status. Use for author/layer info.
   */
  popoverHeader?: ReactNode;
  /**
   * Optional React element rendered in the popover header as live status.
   * Use this for polling-based status indicators (e.g. processing progress).
   */
  popoverStatus?: ReactNode;
  status?: {
    label?: string;
    progressPercent?: number | null;
    state?: string | null;
  };
  /**
   * Optional screenshot for previewing the command. If omitted, a placeholder
   * should be rendered.
   */
  screenshotSrc?: string;
  screenshotAlt?: string;
  keywords?: string[];
  icon?: ReactNode;
  customPopoverContent?: (helpers: {
    closePopover: () => void;
    focusPalette: () => void;
    apply: (
      item: CommandPaletteItem,
      extra?: { state?: EditorState; view?: EditorView }
    ) => void;
  }) => ReactNode;
  disabled?: boolean;
  children?: CommandPaletteItem[];
  /**
   * When set, the popover renders children organized into labeled sections.
   * Takes precedence over flat `children` for rendering.
   */
  childGroups?: CommandPaletteGroup[];
  isEnabled?: (state: EditorState) => boolean;
  run?: (
    state: EditorState,
    dispatch: (tr: Transaction) => void,
    view: EditorView
  ) => void;
};
