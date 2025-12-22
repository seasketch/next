import { ReactNode } from "react";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

export type CommandPaletteItem = {
  id: string;
  label: string;
  description?: string;
  /**
   * Optional screenshot for previewing the command. If omitted, a placeholder
   * should be rendered.
   */
  screenshotSrc?: string;
  screenshotAlt?: string;
  keywords?: string[];
  icon?: ReactNode;
  children?: CommandPaletteItem[];
  isEnabled?: (state: EditorState) => boolean;
  run?: (
    state: EditorState,
    dispatch: (tr: Transaction) => void,
    view: EditorView
  ) => void;
};

export type CommandPaletteGroup = {
  id: string;
  label: string;
  items: CommandPaletteItem[];
};

